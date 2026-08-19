(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const u = App.utils;
  const model = App.stateModel;
  const storage = App.storage;
  const NATIVE_HEADERS = [
    "mcfamily_csv_version", "record_type", "id", "person_id", "family_title", "initialized_at", "home_person_id",
    "created_at", "updated_at", "order", "given_name", "middle_name", "family_name", "birth_name", "preferred_name", "suffix", "display_name",
    "living_status", "gender", "pronouns", "birth_date", "birth_date_qualifier", "birth_place", "death_date", "death_date_qualifier", "death_place",
    "heritage_note", "person_notes", "address_label", "address_current", "address_line_1", "address_line_2", "city", "region", "postal_code", "country",
    "address_start_date", "address_start_qualifier", "address_end_date", "address_end_qualifier", "address_notes", "contact_label", "contact_value",
    "relationship_type", "parent_id", "child_id", "parent_kind", "person_1_id", "person_2_id", "partner_status", "relationship_start_date",
    "relationship_start_qualifier", "relationship_end_date", "relationship_end_qualifier", "relationship_place", "relationship_notes", "family_notes",
    "source_json", "settings_json"
  ];
  const MCLINEAGE_REQUIRED = ["record_id", "lineage_id", "descendant_first_names", "descendant_last_name"];
  let pendingImport = null;

  function parseCsv(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const matrix = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else cell += character;
      } else if (character === '"' && !cell) quoted = true;
      else if (character === ",") { row.push(cell); cell = ""; }
      else if (character === "\n" || character === "\r") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(cell); cell = "";
        if (row.some(function (value) { return value !== ""; })) matrix.push(row);
        row = [];
      } else cell += character;
    }
    if (quoted) throw new Error("The CSV ends inside a quoted field.");
    row.push(cell);
    if (row.some(function (value) { return value !== ""; })) matrix.push(row);
    if (matrix.length < 2) throw new Error("The CSV must contain a header and at least one data row.");
    if (matrix[0].length > 200) throw new Error("The CSV contains too many columns.");
    if (matrix.length > 12000) throw new Error("The CSV contains too many rows.");
    const headers = matrix.shift().map(function (value) { return u.cleanLine(value, 100); });
    const seen = new Set();
    headers.forEach(function (header) {
      if (!header || ["__proto__", "prototype", "constructor"].includes(header)) throw new Error("The CSV contains an invalid header.");
      if (seen.has(header)) throw new Error("The CSV contains a duplicate header: " + header + ".");
      seen.add(header);
    });
    const rows = matrix.map(function (values) {
      const item = Object.create(null);
      headers.forEach(function (header, index) { item[header] = String(values[index] == null ? "" : values[index]); });
      return item;
    });
    return { headers: headers, rows: rows };
  }

  function csvValue(value) {
    let text = String(value == null ? "" : value);
    if (/^[\t ]*[=+\-@]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function originalCsvValue(value) {
    const text = String(value == null ? "" : value);
    return /^'[\t ]*[=+\-@]/.test(text) ? text.slice(1) : text;
  }

  function encodeCsv(rows) {
    return [NATIVE_HEADERS.join(",")].concat(rows.map(function (row) {
      return NATIVE_HEADERS.map(function (header) { return csvValue(row[header]); }).join(",");
    })).join("\r\n") + "\r\n";
  }

  function rowOf(type, values) {
    return Object.assign({ mcfamily_csv_version: config.csvFormat, record_type: type }, values || {});
  }

  function dateColumns(prefix, date) {
    return {
      [prefix + "_date"]: date && date.value || "",
      [prefix + "_qualifier"]: date && date.qualifier || "exact"
    };
  }

  function nativeRows(state) {
    const rows = [];
    rows.push(rowOf("family", {
      id: "family", family_title: state.workspace.family.title, initialized_at: state.workspace.family.initializedAt,
      home_person_id: state.workspace.family.homePersonId, created_at: state.meta.createdAt, updated_at: state.meta.updatedAt
    }));
    state.workspace.people.slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (person) {
      rows.push(rowOf("person", Object.assign({
        id: person.id, created_at: person.createdAt, updated_at: person.updatedAt, order: person.order,
        given_name: person.names.given, middle_name: person.names.middle, family_name: person.names.family, birth_name: person.names.birth,
        preferred_name: person.names.preferred, suffix: person.names.suffix, display_name: person.names.display, living_status: person.livingStatus,
        gender: person.gender, pronouns: person.pronouns, birth_place: person.birth.place, death_place: person.death.place,
        heritage_note: person.heritageNote, person_notes: person.notes, source_json: JSON.stringify(person.source || {})
      }, dateColumns("birth", person.birth.date), dateColumns("death", person.death.date))));
      person.addresses.forEach(function (address) {
        rows.push(rowOf("address", Object.assign({
          id: address.id, person_id: person.id, order: address.order, address_label: address.label, address_current: String(address.current),
          address_line_1: address.line1, address_line_2: address.line2, city: address.city, region: address.region, postal_code: address.postalCode,
          country: address.country, address_notes: address.notes
        }, dateColumns("address_start", address.startDate), dateColumns("address_end", address.endDate))));
      });
      person.phones.forEach(function (contact) { rows.push(rowOf("phone", { id: contact.id, person_id: person.id, order: contact.order, contact_label: contact.label, contact_value: contact.value })); });
      person.emails.forEach(function (contact) { rows.push(rowOf("email", { id: contact.id, person_id: person.id, order: contact.order, contact_label: contact.label, contact_value: contact.value })); });
    });
    state.workspace.relationships.slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (relationship) {
      rows.push(rowOf("relationship", Object.assign({
        id: relationship.id, created_at: relationship.createdAt, updated_at: relationship.updatedAt, order: relationship.order,
        relationship_type: relationship.type, parent_id: relationship.parentId, child_id: relationship.childId, parent_kind: relationship.kind,
        person_1_id: relationship.person1Id, person_2_id: relationship.person2Id, partner_status: relationship.status,
        relationship_place: relationship.place, relationship_notes: relationship.notes, source_json: JSON.stringify(relationship.source || {})
      }, dateColumns("relationship_start", relationship.startDate), dateColumns("relationship_end", relationship.endDate))));
    });
    rows.push(rowOf("note", { id: "app-notes", family_notes: u.richTextToPlainText(state.workspace.documents[0] && state.workspace.documents[0].html || "", config.controls.maxDocumentHtmlLength) }));
    rows.push(rowOf("settings", { id: "settings", settings_json: JSON.stringify({ meta: state.meta, preferences: state.preferences, ui: state.ui, modules: state.modules }) }));
    return rows;
  }

  function exportCsv() {
    const state = storage.getState();
    if (!state.workspace.family.initializedAt) {
      App.components.message("No family to export", "Import the initial family CSV before creating an export.");
      return;
    }
    storage.saveNow();
    const csv = encodeCsv(nativeRows(state));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug = state.workspace.family.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mcfamily";
    link.href = url;
    link.download = slug + "-private-backup-" + new Date().toISOString().slice(0, 10) + "-v" + config.identity.version + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    App.components.toast("The complete private family CSV was downloaded. Store it securely.", { title: "CSV exported", kind: "success", duration: 5000 });
  }

  function readFile(file) {
    if (!file) return Promise.reject(new Error("No file was selected."));
    if (file.size > config.controls.maxImportBytes) return Promise.reject(new Error("That CSV is larger than the " + u.formatBytes(config.controls.maxImportBytes) + " import limit."));
    return file.text ? file.text() : new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(new Error("The selected CSV could not be read.")); };
      reader.readAsText(file);
    });
  }

  function sourceDate(value, precision, counters) {
    const raw = u.cleanLine(value, 40);
    const kind = u.cleanLine(precision, 40).toLowerCase();
    if (!raw) return { value: "", qualifier: "exact" };
    if (/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(raw)) {
      return { value: raw, qualifier: kind === "partial" || kind === "ambiguous_year" ? "about" : "exact" };
    }
    counters.unmappedDates += 1;
    return { value: "", qualifier: "exact" };
  }

  function stableId(prefix, value, fallback) {
    const cleaned = u.cleanLine(value || fallback, 100).replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return prefix + "-" + (cleaned || u.uid("source"));
  }

  function sourceRecordKey(value) {
    const cleaned = u.cleanLine(value, 100);
    return /^P\d{3,}$/i.test(cleaned) ? cleaned.toUpperCase() : cleaned;
  }

  function sourcePersonId(row, index) {
    const recordId = sourceRecordKey(row.record_id);
    return /^P\d{3,}$/.test(recordId) ? recordId : stableId("person", recordId, "row-" + (index + 1));
  }

  function sourceFields(row) {
    const fields = {};
    Object.keys(row).forEach(function (key) { fields[key] = u.cleanText(row[key], 4000).trim(); });
    return fields;
  }

  function sourcePerson(row, index, counters) {
    const deathRaw = u.cleanLine(row.descendant_death_date_value, 40);
    const ancestry = ["root_ancestor_01_name", "root_ancestor_02_name", "root_ancestor_03_name", "lineage_level_01_name", "lineage_level_02_name", "lineage_level_03_name", "lineage_level_04_name", "lineage_level_05_name", "lineage_level_06_name"].map(function (key) { return u.cleanLine(row[key], 200); }).filter(Boolean);
    const notes = [];
    if (u.cleanText(row.notes, 4000).trim()) notes.push(u.cleanText(row.notes, 4000).trim());
    if (u.cleanText(row.data_quality_notes, 4000).trim()) notes.push("Data quality: " + u.cleanText(row.data_quality_notes, 4000).trim());
    return {
      id: sourcePersonId(row, index),
      givenName: row.descendant_first_names,
      familyName: row.descendant_last_name,
      livingStatus: deathRaw ? "deceased" : "unknown",
      birth: { date: sourceDate(row.descendant_birth_date_value, row.descendant_birth_date_precision, counters), place: "" },
      death: { date: sourceDate(row.descendant_death_date_value, row.descendant_death_date_precision, counters), place: "" },
      addresses: [], phones: [], emails: [],
      heritageNote: ancestry.join(" → "),
      notes: notes.join("\n\n"),
      source: { format: "mclineage-cleaned", fields: sourceFields(row) },
      order: index,
      updatedAt: /^\d{4}-\d{2}-\d{2}$/.test(row.source_last_modified_date || "") ? row.source_last_modified_date + "T00:00:00.000Z" : ""
    };
  }

  function sourceSpouse(row, slot, primaryId, index, counters) {
    const prefix = "spouse_" + slot + "_";
    const first = u.cleanLine(row[prefix + "first_names"], 200);
    const last = u.cleanLine(row[prefix + "last_name"], 200);
    if (!first && !last) return null;
    const sourceSubset = { originating_record_id: row.record_id || "", spouse_slot: String(slot) };
    Object.keys(row).filter(function (key) { return key.startsWith(prefix); }).forEach(function (key) { sourceSubset[key] = row[key]; });
    const deathRaw = u.cleanLine(row[prefix + "death_date_value"], 40);
    const lastSpouseSlot = [1, 2, 3].filter(function (candidate) {
      return u.cleanLine(row["spouse_" + candidate + "_first_names"], 200) || u.cleanLine(row["spouse_" + candidate + "_last_name"], 200);
    }).slice(-1)[0] || slot;
    const legacyStatus = u.cleanLine(row.legacy_relationship_status_code, 20).toUpperCase();
    const partnerStatus = slot < lastSpouseSlot ? "divorced" : legacyStatus === "M" ? "married" : legacyStatus === "D" ? "divorced" : "unknown";
    return {
      person: {
        id: stableId("person", (row.record_id || index + 1) + "-spouse-" + slot, "spouse-" + index + "-" + slot),
        givenName: first,
        familyName: last,
        livingStatus: deathRaw || String(row[prefix + "deceased"]).toLowerCase() === "true" ? "deceased" : "unknown",
        birth: { date: sourceDate(row[prefix + "birth_date_value"], row[prefix + "birth_date_precision"], counters), place: "" },
        death: { date: sourceDate(row[prefix + "death_date_value"], row[prefix + "death_date_precision"], counters), place: "" },
        addresses: [], phones: [], emails: [], heritageNote: "", notes: "",
        source: { format: "mclineage-cleaned-spouse", fields: sourceSubset },
        order: 10000 + index * 3 + slot
      },
      relationship: {
        id: stableId("relationship", (row.record_id || index + 1) + "-spouse-" + slot, "spouse-relationship-" + index + "-" + slot),
        type: "partner", person1Id: primaryId,
        status: partnerStatus,
        startDate: sourceDate(row[prefix + "marriage_date_value"], row[prefix + "marriage_date_precision"], counters),
        endDate: { value: "", qualifier: "exact" }, place: "",
        notes: "Imported spouse slot " + slot + (row.legacy_relationship_status_code ? " · legacy status " + row.legacy_relationship_status_code : ""),
        source: { format: "mclineage-cleaned", fields: { originating_record_id: row.record_id || "", spouse_slot: String(slot), legacy_relationship_status_code: row.legacy_relationship_status_code || "" } },
        order: 10000 + index * 3 + slot
      }
    };
  }

  function prepareMcLineage(parsed, fileName) {
    const counters = { sourceRows: parsed.rows.length, orphanParents: 0, ambiguousParents: 0, unmappedDates: 0 };
    const directParentReferences = parsed.headers.includes("lineage_parent_id");
    const people = [];
    const relationships = [];
    const primaryByRow = [];
    const byRecordId = new Map();
    const byLineage = new Map();
    parsed.rows.forEach(function (row, index) {
      if (directParentReferences && !/^P\d{3,}$/.test(sourceRecordKey(row.record_id))) throw new Error("McLineage record_id values must use P references such as P001.");
      const person = sourcePerson(row, index, counters);
      people.push(person);
      primaryByRow[index] = person;
      const recordId = sourceRecordKey(row.record_id);
      if (recordId) {
        if (!byRecordId.has(recordId)) byRecordId.set(recordId, []);
        byRecordId.get(recordId).push(person);
      }
      const lineageId = u.cleanLine(row.lineage_id, 100);
      if (lineageId) {
        if (!byLineage.has(lineageId)) byLineage.set(lineageId, []);
        byLineage.get(lineageId).push(person);
      }
    });
    const duplicateRecordId = Array.from(byRecordId.entries()).find(function (entry) { return entry[1].length > 1; });
    if (duplicateRecordId) throw new Error("The McLineage CSV contains a duplicate record_id: " + duplicateRecordId[0] + ".");
    parsed.rows.forEach(function (row, index) {
      const primary = primaryByRow[index];
      const parentReference = directParentReferences ? sourceRecordKey(row.lineage_parent_id) : u.cleanLine(row.parent_lineage_id, 100);
      if (parentReference) {
        const candidates = directParentReferences ? byRecordId.get(parentReference) || [] : byLineage.get(parentReference) || [];
        if (candidates.length === 1) relationships.push({
          id: stableId("relationship", (row.record_id || index + 1) + "-parent", "parent-" + index),
          type: "parent-child", parentId: candidates[0].id, childId: primary.id, kind: "unknown",
          notes: "Imported lineage parent " + parentReference,
          source: { format: "mclineage-cleaned", fields: directParentReferences
            ? { child_record_id: row.record_id || "", lineage_parent_id: parentReference, lineage_parent_name_full: row.lineage_parent_name_full || "" }
            : { child_record_id: row.record_id || "", parent_lineage_id: parentReference } },
          order: relationships.length
        });
        else if (candidates.length > 1) counters.ambiguousParents += 1;
        else counters.orphanParents += 1;
      }
      [1, 2, 3].forEach(function (slot) {
        const spouse = sourceSpouse(row, slot, primary.id, index, counters);
        if (!spouse) return;
        spouse.relationship.person2Id = spouse.person.id;
        people.push(spouse.person);
        relationships.push(spouse.relationship);
      });
    });
    const firstRoot = parsed.rows.findIndex(function (row) { return !u.cleanLine(directParentReferences ? row.lineage_parent_id : row.parent_lineage_id, 100); });
    const now = u.isoNow();
    const rawState = {
      schemaVersion: config.schemaVersion,
      workspace: {
        family: { title: "McLineage", initializedAt: now, homePersonId: primaryByRow[Math.max(0, firstRoot)] && primaryByRow[Math.max(0, firstRoot)].id || people[0] && people[0].id || "" },
        people: people,
        relationships: relationships,
        documents: [{ id: "app-notes", title: "Notes", html: "", order: 0, createdAt: now, updatedAt: now }]
      }
    };
    const prepared = model.prepare(rawState);
    const warnings = [];
    if (counters.orphanParents) warnings.push(counters.orphanParents + " lineage parent reference" + (counters.orphanParents === 1 ? " was" : "s were") + " not found and skipped.");
    if (counters.ambiguousParents) warnings.push(counters.ambiguousParents + " ambiguous lineage parent reference" + (counters.ambiguousParents === 1 ? " was" : "s were") + " skipped.");
    if (counters.unmappedDates) warnings.push(counters.unmappedDates + " partial or invalid source date" + (counters.unmappedDates === 1 ? " is" : "s are") + " preserved in source fields but not shown as a normalized date.");
    prepared.validation.warnings = prepared.validation.warnings.concat(warnings);
    return Object.assign(prepared, { formatLabel: "McLineage cleaned CSV", sourceRows: parsed.rows.length, fileName: fileName });
  }

  function parseJsonObject(value, label) {
    const text = originalCsvValue(value).trim();
    if (!text) return {};
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch (error) { throw new Error(label + " contains invalid JSON."); }
  }

  function nativeDate(row, prefix) {
    return { value: originalCsvValue(row[prefix + "_date"]), qualifier: originalCsvValue(row[prefix + "_qualifier"]) || "exact" };
  }

  function prepareNative(parsed, fileName) {
    const versions = new Set(parsed.rows.map(function (row) { return originalCsvValue(row.mcfamily_csv_version); }).filter(Boolean));
    if (versions.size !== 1 || !versions.has(config.csvFormat)) throw new Error("This McFamily CSV version is not supported.");
    const allowed = new Set(["family", "person", "address", "phone", "email", "relationship", "note", "settings"]);
    parsed.rows.forEach(function (row) { if (!allowed.has(originalCsvValue(row.record_type))) throw new Error("The CSV contains an unsupported record type: " + originalCsvValue(row.record_type) + "."); });
    const familyRow = parsed.rows.find(function (row) { return originalCsvValue(row.record_type) === "family"; });
    if (!familyRow) throw new Error("The McFamily CSV is missing its family row.");
    const personRows = parsed.rows.filter(function (row) { return originalCsvValue(row.record_type) === "person"; });
    const people = personRows.map(function (row, index) {
      return {
        id: originalCsvValue(row.id), createdAt: originalCsvValue(row.created_at), updatedAt: originalCsvValue(row.updated_at), order: Number(originalCsvValue(row.order) || index),
        givenName: originalCsvValue(row.given_name), middleName: originalCsvValue(row.middle_name), familyName: originalCsvValue(row.family_name),
        birthSurname: originalCsvValue(row.birth_name), preferredName: originalCsvValue(row.preferred_name), suffix: originalCsvValue(row.suffix), displayName: originalCsvValue(row.display_name),
        livingStatus: originalCsvValue(row.living_status), gender: originalCsvValue(row.gender), pronouns: originalCsvValue(row.pronouns),
        birth: { date: nativeDate(row, "birth"), place: originalCsvValue(row.birth_place) }, death: { date: nativeDate(row, "death"), place: originalCsvValue(row.death_place) },
        addresses: [], phones: [], emails: [], heritageNote: originalCsvValue(row.heritage_note), notes: originalCsvValue(row.person_notes),
        source: parseJsonObject(row.source_json, "A person source field")
      };
    });
    const peopleById = new Map(people.map(function (person) { return [person.id, person]; }));
    parsed.rows.filter(function (row) { return ["address", "phone", "email"].includes(originalCsvValue(row.record_type)); }).forEach(function (row) {
      const type = originalCsvValue(row.record_type);
      const person = peopleById.get(originalCsvValue(row.person_id));
      if (!person) throw new Error("A " + type + " row references a person that is not in the CSV.");
      if (type === "address") person.addresses.push({
        id: originalCsvValue(row.id), label: originalCsvValue(row.address_label), current: originalCsvValue(row.address_current) !== "false",
        line1: originalCsvValue(row.address_line_1), line2: originalCsvValue(row.address_line_2), city: originalCsvValue(row.city), region: originalCsvValue(row.region),
        postalCode: originalCsvValue(row.postal_code), country: originalCsvValue(row.country), startDate: nativeDate(row, "address_start"), endDate: nativeDate(row, "address_end"),
        notes: originalCsvValue(row.address_notes), order: Number(originalCsvValue(row.order) || person.addresses.length)
      });
      else person[type + "s"].push({ id: originalCsvValue(row.id), label: originalCsvValue(row.contact_label), value: originalCsvValue(row.contact_value), order: Number(originalCsvValue(row.order) || person[type + "s"].length) });
    });
    const relationships = parsed.rows.filter(function (row) { return originalCsvValue(row.record_type) === "relationship"; }).map(function (row, index) {
      return {
        id: originalCsvValue(row.id), type: originalCsvValue(row.relationship_type), parentId: originalCsvValue(row.parent_id), childId: originalCsvValue(row.child_id),
        kind: originalCsvValue(row.parent_kind), person1Id: originalCsvValue(row.person_1_id), person2Id: originalCsvValue(row.person_2_id), status: originalCsvValue(row.partner_status),
        startDate: nativeDate(row, "relationship_start"), endDate: nativeDate(row, "relationship_end"), place: originalCsvValue(row.relationship_place),
        notes: originalCsvValue(row.relationship_notes), source: parseJsonObject(row.source_json, "A relationship source field"), order: Number(originalCsvValue(row.order) || index),
        createdAt: originalCsvValue(row.created_at), updatedAt: originalCsvValue(row.updated_at)
      };
    });
    const noteRow = parsed.rows.find(function (row) { return originalCsvValue(row.record_type) === "note"; });
    const settingsRow = parsed.rows.find(function (row) { return originalCsvValue(row.record_type) === "settings"; });
    const settings = settingsRow ? parseJsonObject(settingsRow.settings_json, "The settings row") : {};
    const rawState = {
      schemaVersion: config.schemaVersion,
      meta: Object.assign({}, u.plainObject(settings.meta), { createdAt: originalCsvValue(familyRow.created_at) || u.plainObject(settings.meta).createdAt, updatedAt: originalCsvValue(familyRow.updated_at) || u.plainObject(settings.meta).updatedAt }),
      workspace: {
        family: { title: originalCsvValue(familyRow.family_title), initializedAt: originalCsvValue(familyRow.initialized_at), homePersonId: originalCsvValue(familyRow.home_person_id) },
        people: people, relationships: relationships,
        documents: [{ id: "app-notes", title: "Notes", html: u.escapeHtml(noteRow ? originalCsvValue(noteRow.family_notes) : "").replace(/\n/g, "<br>"), order: 0 }]
      },
      preferences: u.plainObject(settings.preferences), ui: u.plainObject(settings.ui), modules: u.plainObject(settings.modules)
    };
    const prepared = model.prepare(rawState);
    return Object.assign(prepared, { formatLabel: "McFamily CSV v1", sourceRows: parsed.rows.length, fileName: fileName });
  }

  function prepareCsv(text, fileName) {
    const parsed = parseCsv(text);
    if (parsed.headers.includes("mcfamily_csv_version") && parsed.headers.includes("record_type")) return prepareNative(parsed, fileName);
    if (MCLINEAGE_REQUIRED.every(function (header) { return parsed.headers.includes(header); }) && (parsed.headers.includes("lineage_parent_id") || parsed.headers.includes("parent_lineage_id"))) return prepareMcLineage(parsed, fileName);
    throw new Error("That CSV is neither a McFamily export nor the supported McLineage-cleaned format.");
  }

  function summaryFor(state, candidate) {
    return {
      familyTitle: state.workspace.family.title,
      initialized: Boolean(state.workspace.family.initializedAt),
      people: state.workspace.people.length,
      relationships: state.workspace.relationships.length,
      addresses: state.workspace.people.reduce(function (total, person) { return total + person.addresses.length; }, 0),
      schemaVersion: state.schemaVersion,
      appVersion: state.meta.appVersion,
      updatedAt: state.meta.updatedAt,
      migrations: candidate && candidate.migrations || [],
      formatLabel: candidate && candidate.formatLabel || "Current local family",
      sourceRows: candidate && candidate.sourceRows || 0
    };
  }

  function isInitialImport() {
    return !storage.getState().workspace.family.initializedAt;
  }

  function requireInitialCsv(prepared) {
    if (!prepared.state.workspace.family.initializedAt) throw new Error("That CSV is not marked as an initialized McFamily family.");
    if (!prepared.state.workspace.people.length) throw new Error("The first CSV must contain at least one person.");
  }

  function renderPreview(candidate, fileName) {
    const summary = summaryFor(candidate.state, candidate);
    const current = summaryFor(storage.getState());
    document.querySelector("[data-import-file]").textContent = fileName || "Selected CSV";
    document.querySelector("[data-import-family]").textContent = summary.familyTitle;
    document.querySelector("[data-import-people]").textContent = String(summary.people) + (candidate.initial ? "" : " (current: " + current.people + ")");
    document.querySelector("[data-import-relationships]").textContent = String(summary.relationships);
    document.querySelector("[data-import-addresses]").textContent = String(summary.addresses);
    document.querySelector("[data-import-version]").textContent = summary.formatLabel + " · " + summary.sourceRows + " CSV rows · state v" + summary.schemaVersion;
    document.querySelector("[data-import-updated]").textContent = u.dateLabel(summary.updatedAt);
    const migrationRow = document.querySelector("[data-import-migrations-row]");
    migrationRow.hidden = summary.migrations.length === 0;
    document.querySelector("[data-import-migrations]").textContent = summary.migrations.length ? summary.migrations.join(", ") : "None";
    const warning = document.querySelector("[data-import-warning]");
    warning.hidden = candidate.validation.warnings.length === 0;
    warning.textContent = candidate.validation.warnings.join(" ");
    document.querySelector("[data-import-recovery-note]").hidden = candidate.initial;
    document.querySelector("[data-import-confirm]").textContent = candidate.initial ? "Open this family" : "Replace local family";
  }

  async function previewFile(file, trigger) {
    try {
      App.components.setLoading(true, "Checking private CSV…");
      const text = await readFile(file);
      const prepared = prepareCsv(text, file.name);
      const initial = isInitialImport();
      if (initial) requireInitialCsv(prepared);
      pendingImport = Object.assign({}, prepared, { initial: initial });
      renderPreview(pendingImport, file.name);
      App.components.openDialog("#importPreviewDialog", { trigger: trigger, focus: "[data-import-confirm]" });
    } catch (error) {
      pendingImport = null;
      App.components.message("Import unavailable", error.message || "That CSV could not be used.", { trigger: trigger });
    } finally {
      App.components.setLoading(false);
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    if (!pendingImport.initial) {
      const accepted = await App.components.confirm({
        title: "Replace the local family?",
        message: "This validated CSV will replace all people, relationships, contacts, Notes, and preferences on this browser. A recovery copy will be saved first.",
        confirmLabel: "Replace local family", cancelLabel: "Keep current family", danger: true,
        trigger: document.querySelector("[data-import-confirm]")
      });
      if (!accepted) return;
    }
    const summary = summaryFor(pendingImport.state, pendingImport);
    storage.replace(pendingImport.state, { recoveryReason: "Before importing " + summary.familyTitle, saveRecovery: !pendingImport.initial, reason: "import" });
    pendingImport = null;
    App.components.closeDialog("#importPreviewDialog", "imported");
    App.components.toast("Opened " + summary.familyTitle + " with " + summary.people + " people.", { title: "Family imported", kind: "success", duration: 5000 });
  }

  function init() {
    document.querySelectorAll("[data-import-file-input]").forEach(function (input) {
      input.addEventListener("change", function (event) {
        const file = event.target.files && event.target.files[0];
        previewFile(file, input.dataset.importTrigger ? document.querySelector(input.dataset.importTrigger) : document.activeElement);
        event.target.value = "";
      });
    });
    document.querySelector("[data-import-confirm]")?.addEventListener("click", confirmImport);
    document.querySelector("#importPreviewDialog")?.addEventListener("close", function () { if (this.returnValue !== "imported") pendingImport = null; });
  }

  App.portability = {
    init: init,
    exportCsv: exportCsv,
    previewFile: previewFile,
    prepareCsv: prepareCsv,
    encodeCsv: encodeCsv,
    nativeRows: nativeRows,
    summaryFor: summaryFor,
    requireInitialCsv: requireInitialCsv
  };
})();
