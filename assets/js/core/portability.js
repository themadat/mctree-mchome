(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const u = App.utils;
  const model = App.stateModel;
  const storage = App.storage;
  const NATIVE_HEADERS = [
    "mcfamily_csv_version", "record_type", "id", "person_id", "family_title", "initialized_at", "home_person_id",
    "created_at", "updated_at", "order",
    "birth_prefix", "birth_first", "birth_middle", "birth_last", "birth_suffix",
    "current_prefix", "current_first", "current_middle", "current_last", "current_suffix",
    "preferred_prefix", "preferred_first", "preferred_middle", "preferred_last", "preferred_suffix", "maiden_last_name",
    "living_status", "gender", "pronouns", "birth_date", "birth_date_qualifier", "birth_place", "death_date", "death_date_qualifier", "death_place",
    "heritage_note", "person_notes", "address_label", "address_current", "address_line_1", "address_line_2", "city", "region", "postal_code", "country",
    "address_start_date", "address_start_qualifier", "address_end_date", "address_end_qualifier", "address_notes", "contact_label", "contact_value",
    "relationship_type", "parent_id", "child_id", "parent_kind", "person_1_id", "person_2_id", "partner_status", "relationship_start_date",
    "relationship_start_qualifier", "relationship_end_date", "relationship_end_qualifier", "relationship_place", "relationship_notes", "family_notes",
    "source_json", "settings_json"
  ];
  const MCLINEAGE_PERSON_DATE_HEADERS = [
    "person-date-birth-value", "person-date-birth-descriptor",
    "person-date-death-value", "person-date-death-descriptor"
  ];
  const CONSANGUINITY_FIELD = "parent-consanguinity-person-id";
  const AFFINITY_FIELD = "parent-affinal-person-id";
  const MCLINEAGE_HEADERS = [
    "record-id",
    "person-name-birth-prefix", "person-birth-name-first", "person-birth-name-middle", "person-birth-name-last", "person-birth-name-suffix",
    "person-name-current-prefix", "person-current-name-first", "person-current-name-middle", "person-current-name-last", "person-current-name-suffix",
    "person-name-preferred-prefix", "person-preferred-name-first", "person-preferred-name-middle", "person-preferred-name-last", "person-preferred-name-suffix",
    "person-name-maiden-last", "lineage-id", CONSANGUINITY_FIELD, AFFINITY_FIELD
  ].concat(MCLINEAGE_PERSON_DATE_HEADERS, [
    "partner-relationships-json", "notes", "source-last-modified-date", "source-last-modified-by", "source-row-number", "data-quality-notes"
  ]);
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

  function nameColumns(prefix, parts) {
    const name = model.nameParts({ names: { [prefix]: parts } }, prefix);
    return {
      [prefix + "_prefix"]: name.prefix,
      [prefix + "_first"]: name.first,
      [prefix + "_middle"]: name.middle,
      [prefix + "_last"]: name.last,
      [prefix + "_suffix"]: name.suffix
    };
  }

  function nativeNameParts(row, prefix) {
    return {
      prefix: originalCsvValue(row[prefix + "_prefix"]),
      first: originalCsvValue(row[prefix + "_first"]),
      middle: originalCsvValue(row[prefix + "_middle"]),
      last: originalCsvValue(row[prefix + "_last"]),
      suffix: originalCsvValue(row[prefix + "_suffix"])
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
        maiden_last_name: person.names.maidenLast, living_status: person.livingStatus,
        gender: person.gender, pronouns: person.pronouns, birth_place: person.birth.place, death_place: person.death.place,
        heritage_note: person.heritageNote, person_notes: person.notes, source_json: JSON.stringify(person.source || {})
      }, nameColumns("birth", person.names.birth), nameColumns("current", person.names.current), nameColumns("preferred", person.names.preferred), dateColumns("birth", person.birth.date), dateColumns("death", person.death.date))));
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

  function isPartialSourceDate(value) {
    const raw = u.cleanLine(value, 40);
    return raw.includes("?") && /^[\d?]{4}(?:-[\d?]{2}(?:-[\d?]{2})?)?$/.test(raw);
  }

  function sourceDate(value, precision, counters) {
    const raw = u.cleanLine(value, 40);
    const kind = u.cleanLine(precision, 40).toLowerCase();
    if (!raw) return { value: "", qualifier: "exact" };
    if (kind === "partial" && isPartialSourceDate(raw)) {
      return { value: "", qualifier: "about" };
    }
    if (/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(raw)) {
      return { value: raw, qualifier: kind === "partial" || kind === "ambiguous_year" ? "about" : "exact" };
    }
    counters.unmappedDates += 1;
    return { value: "", qualifier: "exact" };
  }

  function personDateValue(row, kind) {
    return row["person-date-" + kind + "-value"];
  }

  function personDateDescriptor(row, kind) {
    return row["person-date-" + kind + "-descriptor"];
  }

  function validatePersonDateSchema(parsed) {
    const present = MCLINEAGE_PERSON_DATE_HEADERS.filter(function (header) { return parsed.headers.includes(header); });
    if (present.length !== MCLINEAGE_PERSON_DATE_HEADERS.length) throw new Error("The current McLineage person date schema is incomplete.");
    parsed.rows.forEach(function (row) {
      ["birth", "death"].forEach(function (kind) {
        const value = u.cleanLine(personDateValue(row, kind), 40);
        const descriptor = u.cleanLine(personDateDescriptor(row, kind), 40);
        const allowedDescriptors = kind === "death"
          ? ["year", "month", "day", "partial", "NONE", "UNKNOWN", "UNKNOWN PRESUMED"]
          : ["year", "month", "day", "partial", "UNKNOWN"];
        if (!allowedDescriptors.includes(descriptor)) throw new Error("McLineage birth descriptors must be year, month, day, partial, or UNKNOWN; death descriptors must additionally support NONE and UNKNOWN PRESUMED.");
        if (kind === "birth" && !descriptor) throw new Error("McLineage birth descriptors cannot be blank.");
        const partial = isPartialSourceDate(value);
        if (value && !partial && !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(value)) throw new Error("McLineage person date values must be a normalized date, a question-mark partial date, or blank.");
        const expected = partial ? "partial" : value.length === 4 ? "year" : value.length === 7 ? "month" : value.length === 10 ? "day" : "";
        if (value && descriptor !== expected) throw new Error("A McLineage person date descriptor does not match its value.");
        if (!value && kind === "birth" && descriptor !== "UNKNOWN") throw new Error("A McLineage birth date without a value must use UNKNOWN.");
        if (!value && kind === "death" && !["NONE", "UNKNOWN", "UNKNOWN PRESUMED"].includes(descriptor)) throw new Error("A McLineage death date without a value must use NONE, UNKNOWN, or UNKNOWN PRESUMED.");
      });
    });
    return true;
  }

  function validateCurrentSourceDates(parsed, counters) {
    const valueHeaders = parsed.headers.filter(function (header) { return header.includes("date") && header.endsWith("-value"); });
    parsed.rows.forEach(function (row) {
      valueHeaders.forEach(function (valueHeader) {
        if (MCLINEAGE_PERSON_DATE_HEADERS.includes(valueHeader)) return;
        const descriptorHeader = valueHeader.replace(/-value$/, "-descriptor");
        if (!parsed.headers.includes(descriptorHeader)) throw new Error("The current McLineage date schema is incomplete at " + valueHeader + ".");
        const value = u.cleanLine(row[valueHeader], 40);
        const descriptor = u.cleanLine(row[descriptorHeader], 40);
        if (descriptor.toLowerCase() === "invalid") throw new Error("Current McLineage date descriptors cannot be invalid.");
        if (!["year", "month", "day", "UNKNOWN", "partial", ""].includes(descriptor)) throw new Error("Current McLineage date descriptors must be year, month, day, partial, UNKNOWN, or blank.");
        if (value.includes("?") && (!isPartialSourceDate(value) || descriptor !== "partial")) {
          throw new Error("Question-mark McLineage dates must use the partial descriptor.");
        }
        if (value.includes("?")) counters.partialDates += 1;
        if (value && !value.includes("?")) {
          if (!/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(value)) throw new Error("Known McLineage dates must use YYYY, YYYY-MM, or YYYY-MM-DD.");
          const expected = value.length === 4 ? "year" : value.length === 7 ? "month" : "day";
          if (descriptor !== expected) throw new Error("A current McLineage date descriptor does not match its value.");
        }
        if (!value && !["UNKNOWN", ""].includes(descriptor)) throw new Error("A current McLineage date without a value must be UNKNOWN or blank.");
      });
    });
  }

  function validateRootToPersonLineage(parsed, byRecordId) {
    const parentReferenceField = CONSANGUINITY_FIELD;
    const byLineageId = new Map();
    parsed.rows.forEach(function (row) {
      const recordId = sourceRecordKey(row["record-id"]);
      const lineageId = u.cleanLine(row["lineage-id"], 100);
      const parentRecordId = sourceRecordKey(row[parentReferenceField]);
      if (!lineageId) {
        if (parentRecordId) throw new Error("A McLineage person with a lineage parent must also have a lineage-id: " + recordId + ".");
        return;
      }
      if (!/^(?:\d{2})(?:\.\d{2})*$|^99$/.test(lineageId)) throw new Error("Current McLineage lineage-id values must use two-digit root-to-person segments.");
      if (lineageId !== "99" && byLineageId.has(lineageId)) throw new Error("The McLineage CSV contains a duplicate lineage-id: " + lineageId + ".");
      if (lineageId !== "99") byLineageId.set(lineageId, recordId);
    });
    parsed.rows.forEach(function (row) {
      const recordId = sourceRecordKey(row["record-id"]);
      const parentRecordId = sourceRecordKey(row[parentReferenceField]);
      const lineageId = u.cleanLine(row["lineage-id"], 100);
      if (!parentRecordId) return;
      const parentPerson = (byRecordId.get(parentRecordId) || [])[0];
      if (!parentPerson) return;
      const parentFields = parentPerson && parentPerson.source && parentPerson.source.fields;
      const parentLineageId = u.cleanLine(parentFields && parentFields["lineage-id"], 100);
      if (!parentLineageId || !lineageId.startsWith(parentLineageId + ".") || lineageId.split(".").length !== parentLineageId.split(".").length + 1) {
        throw new Error("The lineage-id for " + recordId + " must extend its direct parent's root-to-person lineage path by one segment.");
      }
    });
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
    const recordId = sourceRecordKey(row["record-id"]);
    return /^P\d{3,}$/.test(recordId) ? recordId : stableId("person", recordId, "row-" + (index + 1));
  }

  function sourceFields(row) {
    const fields = {};
    Object.keys(row).forEach(function (key) { fields[key] = u.cleanText(row[key], 4000).trim(); });
    return fields;
  }

  function sourcePerson(row, index, counters) {
    const birthRaw = u.cleanLine(personDateValue(row, "birth"), 40);
    const birthDescriptor = u.cleanLine(personDateDescriptor(row, "birth"), 40);
    const deathRaw = u.cleanLine(personDateValue(row, "death"), 40);
    const deathDescriptor = u.cleanLine(personDateDescriptor(row, "death"), 40);
    const notes = [];
    if (u.cleanText(row.notes, 4000).trim()) notes.push(u.cleanText(row.notes, 4000).trim());
    if (u.cleanText(row["data-quality-notes"], 4000).trim()) notes.push("Data quality: " + u.cleanText(row["data-quality-notes"], 4000).trim());
    const person = {
      id: sourcePersonId(row, index),
      names: {
        birth: {
          prefix: row["person-name-birth-prefix"], first: row["person-birth-name-first"], middle: row["person-birth-name-middle"],
          last: row["person-birth-name-last"], suffix: row["person-birth-name-suffix"]
        },
        current: {
          prefix: row["person-name-current-prefix"], first: row["person-current-name-first"], middle: row["person-current-name-middle"],
          last: row["person-current-name-last"], suffix: row["person-current-name-suffix"]
        },
        preferred: {
          prefix: row["person-name-preferred-prefix"], first: row["person-preferred-name-first"], middle: row["person-preferred-name-middle"],
          last: row["person-preferred-name-last"], suffix: row["person-preferred-name-suffix"]
        },
        maidenLast: row["person-name-maiden-last"]
      },
      livingStatus: deathRaw ? "deceased" : "unknown",
      birth: { date: sourceDate(birthRaw, birthDescriptor, counters), place: "" },
      death: { date: sourceDate(deathRaw, deathDescriptor, counters), place: "" },
      addresses: [], phones: [], emails: [],
      heritageNote: "",
      notes: notes.join("\n\n"),
      source: { format: "mclineage-cleaned", fields: sourceFields(row) },
      order: index,
      updatedAt: /^\d{4}-\d{2}-\d{2}$/.test(row["source-last-modified-date"] || "") ? row["source-last-modified-date"] + "T00:00:00.000Z" : ""
    };
    person.livingStatus = model.mcLineageLivingStatus(person, person.livingStatus);
    return person;
  }

  function validatePartnerRelationshipDate(value, descriptor, label) {
    const cleanValue = u.cleanLine(value, 40);
    const cleanDescriptor = u.cleanLine(descriptor, 40);
    if (!["year", "month", "day", "UNKNOWN", "partial", ""].includes(cleanDescriptor)) throw new Error(label + " descriptors must be year, month, day, partial, UNKNOWN, or blank.");
    const partial = isPartialSourceDate(cleanValue);
    if (cleanValue && !partial && !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(cleanValue)) throw new Error(label + " values must be normalized dates, question-mark partial dates, or blank.");
    const expected = partial ? "partial" : cleanValue.length === 4 ? "year" : cleanValue.length === 7 ? "month" : cleanValue.length === 10 ? "day" : "";
    if (cleanValue && cleanDescriptor !== expected) throw new Error(label + " value and descriptor do not match.");
    if (!cleanValue && !["UNKNOWN", ""].includes(cleanDescriptor)) throw new Error(label + " without a value must be UNKNOWN or blank.");
    return { value: cleanValue, descriptor: cleanDescriptor };
  }

  function partnerStatusFromSource(type, endReason) {
    if (endReason === "death") return "widowed";
    if (endReason === "divorce") return "divorced";
    if (endReason === "separation") return "separated";
    if (endReason === "annulment") return "former";
    if (endReason === "UNKNOWN") return "former";
    if (type === "marriage") return "married";
    if (type === "partnership") return "partnered";
    return "unknown";
  }

  function sourcePartnerRelationships(row, owner, index, counters) {
    const text = originalCsvValue(row["partner-relationships-json"]).trim();
    if (!text) return [];
    let entries;
    try { entries = JSON.parse(text); }
    catch (error) { throw new Error("partner-relationships-json on " + row["record-id"] + " contains invalid JSON."); }
    if (!Array.isArray(entries)) throw new Error("partner-relationships-json on " + row["record-id"] + " must be a JSON array.");
    return entries.map(function (input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Every partner relationship on " + row["record-id"] + " must be a JSON object.");
      const required = ["relationship_id", "partner_person_id", "relationship_type", "relationship_order", "date_start_value", "date_start_descriptor", "date_end_value", "date_end_descriptor", "end_reason"];
      const missing = required.find(function (key) { return !Object.prototype.hasOwnProperty.call(input, key); });
      if (missing) throw new Error("A partner relationship on " + row["record-id"] + " is missing " + missing + ".");
      const relationshipId = u.cleanLine(input.relationship_id, 100).toUpperCase();
      const partnerId = sourceRecordKey(input.partner_person_id);
      const type = u.cleanLine(input.relationship_type, 40);
      const order = Number(input.relationship_order);
      const endReason = u.cleanLine(input.end_reason, 40);
      if (!/^R\d{3,}$/.test(relationshipId)) throw new Error("McLineage partner relationship IDs must use R references such as R001.");
      if (!/^P\d{3,}$/.test(partnerId)) throw new Error("McLineage partner person references must use P references such as P001.");
      if (!["marriage", "partnership", "UNKNOWN"].includes(type)) throw new Error("McLineage relationship types must be marriage, partnership, or UNKNOWN.");
      if (!Number.isInteger(order) || order < 1 || order > config.controls.maxRelationships) throw new Error("McLineage relationship_order values must be positive integers within the relationship limit.");
      if (!["death", "divorce", "separation", "annulment", "UNKNOWN", ""].includes(endReason)) throw new Error("McLineage relationship end reasons must be death, divorce, separation, annulment, UNKNOWN, or blank.");
      const start = validatePartnerRelationshipDate(input.date_start_value, input.date_start_descriptor, "McLineage partner start date");
      const end = validatePartnerRelationshipDate(input.date_end_value, input.date_end_descriptor, "McLineage partner end date");
      if (end.value && !endReason) throw new Error("A McLineage partner end date requires an end_reason.");
      const sourceFields = { originating_record_id: row["record-id"] || "" };
      required.forEach(function (key) { sourceFields[key] = String(input[key] == null ? "" : input[key]); });
      return {
        id: relationshipId,
        type: "partner",
        person1Id: owner.id,
        partnerPersonId: partnerId,
        status: partnerStatusFromSource(type, endReason),
        startDate: sourceDate(start.value, start.descriptor, counters),
        endDate: sourceDate(end.value, end.descriptor, counters),
        place: "",
        notes: "Imported " + type + " relationship " + relationshipId + (endReason ? " · ended by " + endReason : ""),
        source: { format: "mclineage-cleaned", fields: sourceFields },
        order: 10000 + index * 10 + order
      };
    });
  }

  function prepareMcLineage(parsed, fileName) {
    const counters = { sourceRows: parsed.rows.length, orphanParents: 0, ambiguousParents: 0, orphanAffinalParents: 0, partialDates: 0, unmappedDates: 0 };
    validatePersonDateSchema(parsed);
    validateCurrentSourceDates(parsed, counters);
    const people = [];
    const relationships = [];
    const primaryByRow = [];
    const byRecordId = new Map();
    parsed.rows.forEach(function (row, index) {
      if (!/^P\d{3,}$/.test(sourceRecordKey(row["record-id"]))) throw new Error("McLineage record-id values must use P references such as P001.");
      const person = sourcePerson(row, index, counters);
      people.push(person);
      primaryByRow[index] = person;
      const recordId = sourceRecordKey(row["record-id"]);
      if (!byRecordId.has(recordId)) byRecordId.set(recordId, []);
      byRecordId.get(recordId).push(person);
    });
    const duplicateRecordId = Array.from(byRecordId.entries()).find(function (entry) { return entry[1].length > 1; });
    if (duplicateRecordId) throw new Error("The McLineage CSV contains a duplicate record-id: " + duplicateRecordId[0] + ".");
    validateRootToPersonLineage(parsed, byRecordId);
    const partnerPairs = new Set();
    const relationshipIds = new Set();
    parsed.rows.forEach(function (row, index) {
      const primary = primaryByRow[index];
      sourcePartnerRelationships(row, primary, index, counters).forEach(function (relationship) {
        const candidates = byRecordId.get(relationship.partnerPersonId) || [];
        if (candidates.length !== 1) throw new Error("McLineage partner reference " + relationship.partnerPersonId + " on " + row["record-id"] + " does not resolve to exactly one person.");
        if (candidates[0].id === primary.id) throw new Error("McLineage partner references cannot point to the same person: " + row["record-id"] + ".");
        if (relationshipIds.has(relationship.id)) throw new Error("The McLineage CSV contains a duplicate partner relationship ID: " + relationship.id + ".");
        relationshipIds.add(relationship.id);
        const pairKey = [primary.id, candidates[0].id].sort().join("|");
        if (partnerPairs.has(pairKey)) throw new Error("The McLineage CSV contains a duplicate partner relationship for " + row["record-id"] + " and " + relationship.partnerPersonId + ".");
        partnerPairs.add(pairKey);
        relationship.person2Id = candidates[0].id;
        delete relationship.partnerPersonId;
        relationships.push(relationship);
      });
    });
    parsed.rows.forEach(function (row, index) {
      const primary = primaryByRow[index];
      const parentReference = sourceRecordKey(row[CONSANGUINITY_FIELD]);
      if (parentReference) {
        if (!/^P\d{3,}$/.test(parentReference)) throw new Error("McLineage Lineal parent references must use P references such as P001.");
        const candidates = byRecordId.get(parentReference) || [];
        if (candidates.length === 1) relationships.push({
          id: stableId("relationship", row["record-id"] + "-parent", "parent-" + index),
          type: "parent-child", parentId: candidates[0].id, childId: primary.id, kind: "biological",
          notes: "Imported Lineal parent " + parentReference,
          source: { format: "mclineage-cleaned", fields: { "child-record-id": row["record-id"], [CONSANGUINITY_FIELD]: parentReference } },
          order: relationships.length
        });
        else counters.orphanParents += 1;
      }
      const affinalParentReference = sourceRecordKey(row[AFFINITY_FIELD]);
      if (affinalParentReference) {
        if (!parentReference) throw new Error("A McLineage Non-Lineal parent requires a Lineal parent: " + row["record-id"] + ".");
        if (!/^P\d{3,}$/.test(affinalParentReference)) throw new Error("McLineage Non-Lineal parent references must use P references such as P001.");
        if (affinalParentReference === sourceRecordKey(row["record-id"]) || affinalParentReference === parentReference) throw new Error("McLineage Non-Lineal parents must differ from the child and Lineal parent: " + row["record-id"] + ".");
        const affinalCandidates = byRecordId.get(affinalParentReference) || [];
        if (!partnerPairs.has([parentReference, affinalParentReference].sort().join("|"))) throw new Error("McLineage Non-Lineal parent " + affinalParentReference + " is not a recorded partner of " + parentReference + ".");
        if (affinalCandidates.length === 1) relationships.push({
          id: stableId("relationship", row["record-id"] + "-affinal-parent", "affinal-parent-" + index),
          type: "parent-child", parentId: affinalCandidates[0].id, childId: primary.id, kind: "affinal",
          notes: "Imported Non-Lineal parent " + affinalParentReference,
          source: { format: "mclineage-cleaned", fields: { "child-record-id": row["record-id"], [AFFINITY_FIELD]: affinalParentReference } },
          order: relationships.length
        });
        else counters.orphanAffinalParents += 1;
      }
    });
    const firstRoot = parsed.rows.findIndex(function (row) { return !u.cleanLine(row[CONSANGUINITY_FIELD], 100); });
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
    if (counters.orphanAffinalParents) warnings.push(counters.orphanAffinalParents + " Non-Lineal parent reference" + (counters.orphanAffinalParents === 1 ? " was" : "s were") + " not found and skipped.");
    if (counters.partialDates) warnings.push(counters.partialDates + " partial source date" + (counters.partialDates === 1 ? " is" : "s are") + " preserved in source fields but not shown as a normalized date.");
    if (counters.unmappedDates) warnings.push(counters.unmappedDates + " unrecognized source date" + (counters.unmappedDates === 1 ? " is" : "s are") + " preserved in source fields but not shown as a normalized date.");
    prepared.validation.warnings = prepared.validation.warnings.concat(warnings);
    return Object.assign(prepared, { formatLabel: "McLineage v14 CSV", sourceRows: parsed.rows.length, fileName: fileName });
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
    const missingHeaders = NATIVE_HEADERS.filter(function (header) { return !parsed.headers.includes(header); });
    if (missingHeaders.length) throw new Error("That McFamily CSV is missing current schema columns: " + missingHeaders.join(", ") + ".");
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
        names: {
          birth: nativeNameParts(row, "birth"), current: nativeNameParts(row, "current"), preferred: nativeNameParts(row, "preferred"),
          maidenLast: originalCsvValue(row.maiden_last_name)
        },
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
    return Object.assign(prepared, { formatLabel: "McFamily CSV v2", sourceRows: parsed.rows.length, fileName: fileName });
  }

  function prepareCsv(text, fileName) {
    const parsed = parseCsv(text);
    if (parsed.headers.includes("mcfamily_csv_version") && parsed.headers.includes("record_type")) return prepareNative(parsed, fileName);
    const missing = MCLINEAGE_HEADERS.filter(function (header) { return !parsed.headers.includes(header); });
    const unexpected = parsed.headers.filter(function (header) { return !MCLINEAGE_HEADERS.includes(header); });
    const exactOrder = parsed.headers.length === MCLINEAGE_HEADERS.length && parsed.headers.every(function (header, index) { return header === MCLINEAGE_HEADERS[index]; });
    if (!missing.length && !unexpected.length && exactOrder) return prepareMcLineage(parsed, fileName);
    if (parsed.headers.some(function (header) { return header === "record-id" || header === "record_id" || header.startsWith("person-") || header.startsWith("person_"); })) {
      const details = [];
      if (missing.length) details.push("missing: " + missing.join(", "));
      if (unexpected.length) details.push("unexpected: " + unexpected.join(", "));
      if (!missing.length && !unexpected.length && !exactOrder) details.push("columns are not in the McLineage v14 order");
      throw new Error("McFamily accepts only the exact McLineage v14 schema (" + details.join("; ") + ").");
    }
    throw new Error("That CSV is neither a current McFamily export nor an exact McLineage v14 file.");
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
