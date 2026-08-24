(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const u = App.utils;
  const model = App.stateModel;
  const storage = App.storage;
  const FILE_NAMES = ["McPeople.csv", "McPlaces.csv", "McRelations.csv", "McResidences.csv", "McMetadata.csv"];
  const FILE_SCHEMA_VERSIONS = {
    "McPeople.csv": "1.0.0",
    "McPlaces.csv": "1.0.0",
    "McRelations.csv": "2.0.0",
    "McResidences.csv": "1.0.0",
    "McMetadata.csv": "1.0.0"
  };
  const PARENT_LINEAGES = new Set(config.parentLineages.map(function (item) { return item.id; }));
  const PARENT_TYPES = new Set(config.parentKinds.map(function (item) { return item.id; }));
  const PEOPLE_HEADERS = [
    "record-id",
    "person-name-birth-prefix", "person-birth-name-first", "person-birth-name-middle", "person-birth-name-last", "person-birth-name-suffix",
    "person-name-current-prefix", "person-current-name-first", "person-current-name-middle", "person-current-name-last", "person-current-name-suffix",
    "person-name-preferred-prefix", "person-preferred-name-first", "person-preferred-name-middle", "person-preferred-name-last", "person-preferred-name-suffix",
    "person-name-maiden-last", "lineage-id",
    "person-date-birth-value", "person-date-birth-descriptor", "person-date-death-value", "person-date-death-descriptor",
    "notes", "source-last-modified-date", "source-last-modified-by", "source-row-number", "data-quality-notes"
  ];
  const PLACE_HEADERS = [
    "place-id", "place-label", "address-line-1", "address-line-2", "city", "region", "postal-code", "country", "notes",
    "source-last-modified-date", "source-last-modified-by"
  ];
  const RELATION_HEADERS = [
    "relationship-id", "relationship-type", "person-1-id", "person-2-id", "parent-lineage", "parent-type", "partner-type", "relationship-order",
    "date-start-value", "date-start-descriptor", "date-end-value", "date-end-descriptor", "end-reason", "place-id", "notes",
    "source-last-modified-date", "source-last-modified-by"
  ];
  const RESIDENCE_HEADERS = [
    "residence-id", "person-id", "place-id", "residence-label", "is-current", "date-start-value", "date-start-descriptor",
    "date-end-value", "date-end-descriptor", "notes", "source-last-modified-date", "source-last-modified-by"
  ];
  const METADATA_HEADERS = ["metadata-id", "metadata-type", "subject", "key", "value", "recorded-at", "recorded-by", "details"];
  const HEADERS_BY_FILE = {
    "McPeople.csv": PEOPLE_HEADERS,
    "McPlaces.csv": PLACE_HEADERS,
    "McRelations.csv": RELATION_HEADERS,
    "McResidences.csv": RESIDENCE_HEADERS,
    "McMetadata.csv": METADATA_HEADERS
  };
  let pendingImport = null;

  function isSupportedDatasetVersion(value) {
    const escapedSeries = String(config.datasetSeries || config.datasetVersion.split(".").slice(0, 2).join(".")).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^" + escapedSeries + "\\.\\d+$").test(u.cleanLine(value, 40));
  }

  function datasetVersionFor(state) {
    const value = u.cleanLine(state && state.meta && state.meta.package && state.meta.package.datasetVersion, 40);
    return isSupportedDatasetVersion(value) ? value : config.datasetVersion;
  }

  function nextDatasetPatch(value) {
    if (!isSupportedDatasetVersion(value)) throw new Error("Only dataset " + config.datasetSeries + " patch versions can be published by this website.");
    const parts = value.split(".").map(Number);
    return parts[0] + "." + parts[1] + "." + (parts[2] + 1);
  }

  function parseCsv(text, fileName) {
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
    if (quoted) throw new Error(fileName + " ends inside a quoted field.");
    row.push(cell);
    if (row.some(function (value) { return value !== ""; })) matrix.push(row);
    if (!matrix.length) throw new Error(fileName + " is empty.");
    if (matrix[0].length > 200 || matrix.length > 12000) throw new Error(fileName + " exceeds the supported row or column limit.");
    const headers = matrix.shift().map(function (value) { return u.cleanLine(value, 100); });
    const seen = new Set();
    headers.forEach(function (header) {
      if (!header || ["__proto__", "prototype", "constructor"].includes(header)) throw new Error(fileName + " contains an invalid header.");
      if (seen.has(header)) throw new Error(fileName + " contains a duplicate header: " + header + ".");
      seen.add(header);
    });
    const expected = HEADERS_BY_FILE[fileName];
    const missing = expected.filter(function (header) { return !headers.includes(header); });
    const unexpected = headers.filter(function (header) { return !expected.includes(header); });
    const exactOrder = headers.length === expected.length && headers.every(function (header, index) { return header === expected[index]; });
    if (missing.length || unexpected.length || !exactOrder) {
      const details = [];
      if (missing.length) details.push("missing: " + missing.join(", "));
      if (unexpected.length) details.push("unexpected: " + unexpected.join(", "));
      if (!missing.length && !unexpected.length && !exactOrder) details.push("columns are out of order");
      throw new Error(fileName + " does not match schema " + FILE_SCHEMA_VERSIONS[fileName] + " (" + details.join("; ") + ").");
    }
    const rows = matrix.map(function (values, rowIndex) {
      if (values.length > headers.length || values.slice(headers.length).some(Boolean)) throw new Error(fileName + " row " + (rowIndex + 2) + " has too many cells.");
      const item = Object.create(null);
      headers.forEach(function (header, index) { item[header] = originalCsvValue(values[index]); });
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

  function encodeCsv(headers, rows) {
    return [headers.join(",")].concat(rows.map(function (row) {
      return headers.map(function (header) { return csvValue(row[header]); }).join(",");
    })).join("\r\n") + "\r\n";
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function concatBytes(parts) {
    const length = parts.reduce(function (total, part) { return total + part.length; }, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    parts.forEach(function (part) { result.set(part, offset); offset += part.length; });
    return result;
  }

  function zipHeader(size) {
    const bytes = new Uint8Array(size);
    return { bytes: bytes, view: new DataView(bytes.buffer) };
  }

  function encodeZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    Object.keys(files).forEach(function (name) {
      const nameBytes = encoder.encode(name);
      const data = encoder.encode(files[name]);
      const crc = crc32(data);
      const local = zipHeader(30);
      local.view.setUint32(0, 0x04034b50, true);
      local.view.setUint16(4, 20, true);
      local.view.setUint16(6, 0x0800, true);
      local.view.setUint32(14, crc, true);
      local.view.setUint32(18, data.length, true);
      local.view.setUint32(22, data.length, true);
      local.view.setUint16(26, nameBytes.length, true);
      localParts.push(local.bytes, nameBytes, data);
      const central = zipHeader(46);
      central.view.setUint32(0, 0x02014b50, true);
      central.view.setUint16(4, 20, true);
      central.view.setUint16(6, 20, true);
      central.view.setUint16(8, 0x0800, true);
      central.view.setUint32(16, crc, true);
      central.view.setUint32(20, data.length, true);
      central.view.setUint32(24, data.length, true);
      central.view.setUint16(28, nameBytes.length, true);
      central.view.setUint32(42, offset, true);
      centralParts.push(central.bytes, nameBytes);
      offset += local.bytes.length + nameBytes.length + data.length;
    });
    const centralSize = centralParts.reduce(function (total, part) { return total + part.length; }, 0);
    const end = zipHeader(22);
    end.view.setUint32(0, 0x06054b50, true);
    end.view.setUint16(8, Object.keys(files).length, true);
    end.view.setUint16(10, Object.keys(files).length, true);
    end.view.setUint32(12, centralSize, true);
    end.view.setUint32(16, offset, true);
    return concatBytes(localParts.concat(centralParts, end.bytes));
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot read compressed ZIP entries. Re-create the archive without compression.");
    let stream;
    try { stream = new DecompressionStream("deflate-raw"); }
    catch (error) { throw new Error("This browser cannot read deflated ZIP entries. Re-create the archive without compression."); }
    const response = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await response.arrayBuffer());
  }

  async function parseZip(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    if (bytes.length < 22) throw new Error("The selected file is not a complete ZIP archive.");
    let endOffset = -1;
    for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
      if (view.getUint32(index, true) === 0x06054b50) { endOffset = index; break; }
    }
    if (endOffset < 0) throw new Error("The ZIP end record is missing or damaged.");
    if (view.getUint16(endOffset + 4, true) !== 0 || view.getUint16(endOffset + 6, true) !== 0) throw new Error("Multi-disk ZIP archives are not supported.");
    const entryCount = view.getUint16(endOffset + 10, true);
    const centralSize = view.getUint32(endOffset + 12, true);
    const centralOffset = view.getUint32(endOffset + 16, true);
    if (entryCount !== FILE_NAMES.length || centralOffset + centralSize > endOffset) throw new Error("The package must contain exactly five root CSV files.");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const files = new Map();
    let cursor = centralOffset;
    let uncompressedTotal = 0;
    for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
      if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) throw new Error("The ZIP directory is damaged.");
      const flags = view.getUint16(cursor + 8, true);
      const method = view.getUint16(cursor + 10, true);
      const crc = view.getUint32(cursor + 16, true);
      const compressedSize = view.getUint32(cursor + 20, true);
      const uncompressedSize = view.getUint32(cursor + 24, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      if ((flags & 1) || ![0, 8].includes(method)) throw new Error("Encrypted or unsupported ZIP entries are not allowed.");
      const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
      if (!FILE_NAMES.includes(name) || files.has(name) || name.includes("/") || name.includes("\\")) throw new Error("The ZIP contains a missing, duplicate, nested, or unexpected file: " + name + ".");
      if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(name + " has a damaged ZIP header.");
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      if (dataStart + compressedSize > bytes.length) throw new Error(name + " is truncated.");
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      const data = method === 0 ? compressed : await inflateRaw(compressed);
      if (data.length !== uncompressedSize || crc32(data) !== crc) throw new Error(name + " failed ZIP size or checksum validation.");
      uncompressedTotal += data.length;
      if (uncompressedTotal > config.controls.maxImportBytes) throw new Error("The extracted package is larger than the " + u.formatBytes(config.controls.maxImportBytes) + " import limit.");
      files.set(name, decoder.decode(data));
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    const missing = FILE_NAMES.filter(function (name) { return !files.has(name); });
    if (missing.length) throw new Error("The package is missing: " + missing.join(", ") + ".");
    return files;
  }

  function isPartialSourceDate(value) {
    const raw = u.cleanLine(value, 40);
    return raw.includes("?") && /^[\d?]{4}(?:-[\d?]{2}(?:-[\d?]{2})?)?$/.test(raw);
  }

  function validateSourceDate(value, descriptor, label, options) {
    const settings = Object.assign({ allowBlankDescriptor: true, death: false }, options || {});
    const cleanValue = u.cleanLine(value, 40);
    const cleanDescriptor = u.cleanLine(descriptor, 40);
    const allowed = settings.death
      ? ["year", "month", "day", "partial", "NONE", "UNKNOWN", "UNKNOWN PRESUMED"]
      : ["year", "month", "day", "partial", "UNKNOWN"].concat(settings.allowBlankDescriptor ? [""] : []);
    if (!allowed.includes(cleanDescriptor)) throw new Error(label + " has an unsupported date descriptor.");
    const partial = isPartialSourceDate(cleanValue);
    if (cleanValue && !partial && !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(cleanValue)) throw new Error(label + " must use YYYY, YYYY-MM, YYYY-MM-DD, a question-mark partial date, or blank.");
    const expected = partial ? "partial" : cleanValue.length === 4 ? "year" : cleanValue.length === 7 ? "month" : cleanValue.length === 10 ? "day" : "";
    if (cleanValue && cleanDescriptor !== expected) throw new Error(label + " value and descriptor do not match.");
    if (!cleanValue && settings.death && !["NONE", "UNKNOWN", "UNKNOWN PRESUMED"].includes(cleanDescriptor)) throw new Error(label + " without a value must use NONE, UNKNOWN, or UNKNOWN PRESUMED.");
    if (!cleanValue && !settings.death && !settings.allowBlankDescriptor && cleanDescriptor !== "UNKNOWN") throw new Error(label + " without a value must use UNKNOWN.");
    if (!cleanValue && !settings.death && settings.allowBlankDescriptor && !["", "UNKNOWN"].includes(cleanDescriptor)) throw new Error(label + " without a value must be blank or UNKNOWN.");
    return { value: cleanValue, descriptor: cleanDescriptor, partial: partial };
  }

  function sourceDate(value, descriptor, counters) {
    const checked = validateSourceDate(value, descriptor, "A source date", { allowBlankDescriptor: true });
    if (!checked.value) return { value: "", qualifier: checked.descriptor === "UNKNOWN" ? "about" : "exact" };
    if (checked.partial) { counters.partialDates += 1; return { value: "", qualifier: "about" }; }
    return { value: checked.value, qualifier: "exact" };
  }

  function sourceFields(row, selectedKeys) {
    const fields = {};
    (selectedKeys || Object.keys(row)).forEach(function (key) { fields[key] = u.cleanText(row[key], 4000).trim(); });
    return fields;
  }

  function sourcePerson(row, index, counters) {
    ["person-birth-name-first", "person-birth-name-last", "person-current-name-first", "person-current-name-last"].forEach(function (field) {
      if (!u.cleanLine(row[field], 120)) throw new Error("McPeople.csv " + row["record-id"] + " requires " + field + ".");
    });
    const birth = validateSourceDate(row["person-date-birth-value"], row["person-date-birth-descriptor"], "McPeople.csv birth date on " + row["record-id"], { allowBlankDescriptor: false });
    const death = validateSourceDate(row["person-date-death-value"], row["person-date-death-descriptor"], "McPeople.csv death date on " + row["record-id"], { death: true });
    const notes = [];
    if (u.cleanText(row.notes, 4000).trim()) notes.push(u.cleanText(row.notes, 4000).trim());
    if (u.cleanText(row["data-quality-notes"], 4000).trim()) notes.push("Data quality: " + u.cleanText(row["data-quality-notes"], 4000).trim());
    const person = {
      id: row["record-id"],
      names: {
        birth: { prefix: row["person-name-birth-prefix"], first: row["person-birth-name-first"], middle: row["person-birth-name-middle"], last: row["person-birth-name-last"], suffix: row["person-birth-name-suffix"] },
        current: { prefix: row["person-name-current-prefix"], first: row["person-current-name-first"], middle: row["person-current-name-middle"], last: row["person-current-name-last"], suffix: row["person-current-name-suffix"] },
        preferred: { prefix: row["person-name-preferred-prefix"], first: row["person-preferred-name-first"], middle: row["person-preferred-name-middle"], last: row["person-preferred-name-last"], suffix: row["person-preferred-name-suffix"] },
        maidenLast: row["person-name-maiden-last"]
      },
      livingStatus: death.value || ["UNKNOWN", "UNKNOWN PRESUMED"].includes(death.descriptor) ? "deceased" : death.descriptor === "NONE" ? "living" : "unknown",
      birth: { date: sourceDate(birth.value, birth.descriptor, counters), place: "" },
      death: { date: death.value && !death.partial ? { value: death.value, qualifier: "exact" } : { value: "", qualifier: death.partial ? "about" : "exact" }, place: "" },
      addresses: [], phones: [], emails: [], heritageNote: "", notes: notes.join("\n\n"),
      source: { format: "mcpeople-v1", fields: sourceFields(row) }, order: index,
      updatedAt: /^\d{4}-\d{2}-\d{2}$/.test(row["source-last-modified-date"]) ? row["source-last-modified-date"] + "T00:00:00.000Z" : ""
    };
    if (death.partial) counters.partialDates += 1;
    return person;
  }

  function partnerStatus(type, endReason) {
    if (endReason === "death") return "widowed";
    if (endReason === "divorce") return "divorced";
    if (endReason === "separation") return "separated";
    if (["annulment", "UNKNOWN"].includes(endReason)) return "former";
    if (type === "marriage") return "married";
    if (type === "partnership") return "partnered";
    return "unknown";
  }

  function prepareMetadata(parsed) {
    const ids = new Set();
    parsed.rows.forEach(function (row) {
      const id = u.cleanLine(row["metadata-id"], 100).toUpperCase();
      if (!/^[A-Z][A-Z0-9_-]{2,99}$/.test(id) || ids.has(id)) throw new Error("McMetadata.csv contains an invalid or duplicate metadata-id: " + (id || "(blank)") + ".");
      ids.add(id);
      if (!u.cleanLine(row["metadata-type"], 40) || !u.cleanLine(row.key, 120)) throw new Error("Every McMetadata.csv row requires metadata-type and key.");
      if (row["recorded-at"] && !Number.isFinite(Date.parse(row["recorded-at"]))) throw new Error("McMetadata.csv contains an invalid recorded-at timestamp.");
    });
    function one(type, key) {
      const matches = parsed.rows.filter(function (row) { return row["metadata-type"] === type && row.key === key; });
      if (matches.length !== 1) throw new Error("McMetadata.csv requires exactly one " + type + " / " + key + " row.");
      return originalCsvValue(matches[0].value);
    }
    if (one("package", "package-format") !== config.packageFormat) throw new Error("This McFamily package format is not supported.");
    if (one("package", "package-version") !== config.packageVersion) throw new Error("This McFamily package version is not supported.");
    const datasetVersion = one("package", "dataset-version");
    if (!isSupportedDatasetVersion(datasetVersion)) throw new Error("This website accepts only McFamily dataset " + config.datasetSeries + " patch versions.");
    const accessRows = parsed.rows.filter(function (row) { return row["metadata-type"] === "access" && row.key === "access-mode"; });
    if (accessRows.length > 1) throw new Error("McMetadata.csv may declare access / access-mode only once.");
    const accessMode = accessRows.length ? originalCsvValue(accessRows[0].value) : "editor";
    if (!Object.prototype.hasOwnProperty.call(config.accessModes, accessMode)) throw new Error("McMetadata.csv contains an unsupported access-mode.");
    const schemaRows = parsed.rows.filter(function (row) { return row["metadata-type"] === "schema" && row.key === "schema-version"; });
    const schemaSubjects = new Set(schemaRows.map(function (row) { return row.subject; }));
    if (schemaRows.length !== FILE_NAMES.length || FILE_NAMES.some(function (name) { return !schemaSubjects.has(name); }) || schemaRows.some(function (row) { return row.value !== FILE_SCHEMA_VERSIONS[row.subject]; })) {
      throw new Error("McMetadata.csv must declare each file's supported schema version exactly once.");
    }
    const audits = parsed.rows.filter(function (row) { return row["metadata-type"] === "audit"; }).map(function (row) {
      if (!u.cleanLine(row.value, 120) || !row["recorded-at"]) throw new Error("Every audit row requires an action and recorded-at timestamp.");
      return { id: row["metadata-id"], subject: row.subject, action: originalCsvValue(row.value), recordedAt: row["recorded-at"], recordedBy: row["recorded-by"], details: originalCsvValue(row.details) };
    });
    if (!audits.length) throw new Error("McMetadata.csv must contain at least one audit event.");
    let settings = {};
    try { settings = JSON.parse(originalCsvValue(one("family", "settings-json")) || "{}"); }
    catch (error) { throw new Error("McMetadata.csv family settings-json is invalid JSON."); }
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("McMetadata.csv family settings-json must be an object.");
    return {
      counts: {
        people: Number(one("package", "person-count")), relationships: Number(one("package", "relationship-count")),
        places: Number(one("package", "place-count")), residences: Number(one("package", "residence-count"))
      },
      family: {
        title: one("family", "title"), initializedAt: one("family", "initialized-at"), homePersonId: one("family", "home-person-id"),
        createdAt: one("family", "created-at"), updatedAt: one("family", "updated-at"), notes: one("family", "notes"), settings: settings
      },
      audits: audits,
      datasetVersion: datasetVersion,
      accessMode: accessMode
    };
  }

  function validateLineage(people, relationships) {
    const peopleById = new Map(people.map(function (person) { return [person.id, person]; }));
    const linealParents = new Map();
    relationships.filter(function (relationship) { return relationship.type === "parent-child" && relationship.lineage === "lineal"; }).forEach(function (relationship) {
      if (linealParents.has(relationship.childId)) throw new Error("McRelations.csv gives " + relationship.childId + " more than one Lineal parent.");
      linealParents.set(relationship.childId, relationship.parentId);
    });
    const usedLineage = new Set();
    people.forEach(function (person) {
      const lineage = u.cleanLine(person.source.fields["lineage-id"], 100);
      const parentId = linealParents.get(person.id);
      if (!lineage) {
        if (parentId) throw new Error(person.id + " has a Lineal parent but no lineage-id.");
        return;
      }
      if (!/^(?:\d{2})(?:\.\d{2})*$|^99$/.test(lineage)) throw new Error("McPeople.csv lineage-id values must use two-digit root-to-person segments.");
      if (lineage !== "99" && usedLineage.has(lineage)) throw new Error("McPeople.csv contains a duplicate lineage-id: " + lineage + ".");
      if (lineage !== "99") usedLineage.add(lineage);
      if (!parentId) return;
      const parent = peopleById.get(parentId);
      const parentLineage = parent && u.cleanLine(parent.source.fields["lineage-id"], 100);
      if (!parentLineage || !lineage.startsWith(parentLineage + ".") || lineage.split(".").length !== parentLineage.split(".").length + 1) {
        throw new Error("The lineage-id for " + person.id + " must extend its Lineal parent's path by one segment.");
      }
    });
  }

  function preparePackage(files, fileName) {
    const parsed = {};
    FILE_NAMES.forEach(function (name) { parsed[name] = parseCsv(files.get(name), name); });
    const metadata = prepareMetadata(parsed["McMetadata.csv"]);
    const counters = { partialDates: 0 };
    const personIds = new Set();
    const people = parsed["McPeople.csv"].rows.map(function (row, index) {
      const id = u.cleanLine(row["record-id"], 100).toUpperCase();
      if (!/^P\d{3,}$/.test(id) || personIds.has(id)) throw new Error("McPeople.csv contains an invalid or duplicate record-id: " + (id || "(blank)") + ".");
      personIds.add(id);
      row["record-id"] = id;
      return sourcePerson(row, index, counters);
    });
    if (!people.length) throw new Error("McPeople.csv must contain at least one person.");
    const personDetails = u.plainObject(metadata.family.settings.personDetails);
    people.forEach(function (person) {
      const details = u.plainObject(personDetails[person.id]);
      person.gender = details.gender;
      person.pronouns = details.pronouns;
      person.birth.place = details.birthPlace;
      person.death.place = details.deathPlace;
      person.heritageNote = details.heritageNote;
      person.phones = Array.isArray(details.phones) ? details.phones : [];
      person.emails = Array.isArray(details.emails) ? details.emails : [];
    });

    const placeIds = new Set();
    const places = parsed["McPlaces.csv"].rows.map(function (row, index) {
      const id = u.cleanLine(row["place-id"], 100).toUpperCase();
      if (!/^L\d{4,}$/.test(id) || placeIds.has(id)) throw new Error("McPlaces.csv contains an invalid or duplicate place-id: " + (id || "(blank)") + ".");
      if (![row["address-line-1"], row.city, row.region, row["postal-code"], row.country].some(function (value) { return Boolean(u.cleanLine(value, 200)); })) throw new Error("Every McPlaces.csv row must contain a physical place value.");
      placeIds.add(id);
      return {
        id: id, label: row["place-label"], line1: row["address-line-1"], line2: row["address-line-2"], city: row.city,
        region: row.region, postalCode: row["postal-code"], country: row.country, notes: row.notes,
        source: { format: "mcplaces-v1", fields: sourceFields(row, ["source-last-modified-date", "source-last-modified-by"]) }, order: index
      };
    });

    const relationshipIds = new Set();
    const relationships = parsed["McRelations.csv"].rows.map(function (row, index) {
      const id = u.cleanLine(row["relationship-id"], 100).toUpperCase();
      const type = u.cleanLine(row["relationship-type"], 40);
      const person1 = u.cleanLine(row["person-1-id"], 100).toUpperCase();
      const person2 = u.cleanLine(row["person-2-id"], 100).toUpperCase();
      const order = Number(row["relationship-order"]);
      if (!/^[A-Z][A-Z0-9_-]{2,99}$/.test(id) || relationshipIds.has(id)) throw new Error("McRelations.csv contains an invalid or duplicate relationship-id: " + (id || "(blank)") + ".");
      if (!personIds.has(person1) || !personIds.has(person2) || person1 === person2) throw new Error("McRelations.csv " + id + " contains a missing or self person reference.");
      if (!Number.isInteger(order) || order < 1 || order > config.controls.maxRelationships) throw new Error("McRelations.csv " + id + " requires a positive relationship-order.");
      relationshipIds.add(id);
      const start = validateSourceDate(row["date-start-value"], row["date-start-descriptor"], "McRelations.csv " + id + " start date", { allowBlankDescriptor: true });
      const end = validateSourceDate(row["date-end-value"], row["date-end-descriptor"], "McRelations.csv " + id + " end date", { allowBlankDescriptor: true });
      if (row["place-id"] && !placeIds.has(row["place-id"].toUpperCase())) throw new Error("McRelations.csv " + id + " references a missing place.");
      if (type === "parent-child") {
        if (!PARENT_LINEAGES.has(row["parent-lineage"]) || !PARENT_TYPES.has(row["parent-type"]) || row["partner-type"] || row["end-reason"]) throw new Error("McRelations.csv " + id + " has inconsistent parent fields.");
        return {
          id: id, type: type, parentId: person1, childId: person2, lineage: row["parent-lineage"], kind: row["parent-type"],
          startDate: sourceDate(start.value, start.descriptor, counters), endDate: sourceDate(end.value, end.descriptor, counters),
          place: "", notes: row.notes, source: { format: "mcrelations-v2", fields: sourceFields(row, [
            "parent-lineage", "parent-type", "date-start-value", "date-start-descriptor", "date-end-value", "date-end-descriptor", "place-id",
            "source-last-modified-date", "source-last-modified-by"
          ]) }, order: order
        };
      }
      if (type !== "partner") throw new Error("McRelations.csv " + id + " must be parent-child or partner.");
      if (row["parent-lineage"] || row["parent-type"] || !["marriage", "partnership", "UNKNOWN"].includes(row["partner-type"]) || !["death", "divorce", "separation", "annulment", "UNKNOWN", ""].includes(row["end-reason"])) throw new Error("McRelations.csv " + id + " has inconsistent partner fields.");
      if (end.value && !row["end-reason"]) throw new Error("McRelations.csv " + id + " has an end date without an end reason.");
      return {
        id: id, type: type, person1Id: person1, person2Id: person2, status: partnerStatus(row["partner-type"], row["end-reason"]),
        startDate: sourceDate(start.value, start.descriptor, counters), endDate: sourceDate(end.value, end.descriptor, counters),
        place: "", notes: row.notes, source: { format: "mcrelations-v2", fields: sourceFields(row, [
          "partner-type", "date-start-value", "date-start-descriptor", "date-end-value", "date-end-descriptor", "end-reason", "place-id",
          "source-last-modified-date", "source-last-modified-by"
        ]) }, order: order
      };
    });
    const relationshipDetails = u.plainObject(metadata.family.settings.relationshipDetails);
    relationships.forEach(function (relationship) {
      relationship.place = u.cleanLine(u.plainObject(relationshipDetails[relationship.id]).place, 500);
    });

    const parentsByChild = new Map();
    relationships.filter(function (relationship) { return relationship.type === "parent-child"; }).forEach(function (relationship) {
      if (!parentsByChild.has(relationship.childId)) parentsByChild.set(relationship.childId, []);
      parentsByChild.get(relationship.childId).push(relationship);
    });
    parentsByChild.forEach(function (parents, childId) {
      const lineal = parents.filter(function (relationship) { return relationship.lineage === "lineal"; });
      if (lineal.length > 1) throw new Error("McRelations.csv gives " + childId + " more than one Lineal parent.");
    });
    validateLineage(people, relationships);

    const residenceIds = new Set();
    const residenceLinks = new Set();
    const residences = parsed["McResidences.csv"].rows.map(function (row, index) {
      const id = u.cleanLine(row["residence-id"], 100).toUpperCase();
      const personId = u.cleanLine(row["person-id"], 100).toUpperCase();
      const placeId = u.cleanLine(row["place-id"], 100).toUpperCase();
      if (!/^RS\d{4,}$/.test(id) || residenceIds.has(id)) throw new Error("McResidences.csv contains an invalid or duplicate residence-id: " + (id || "(blank)") + ".");
      if (!personIds.has(personId) || !placeIds.has(placeId)) throw new Error("McResidences.csv " + id + " contains a missing person or place reference.");
      if (!["TRUE", "FALSE"].includes(row["is-current"].toUpperCase())) throw new Error("McResidences.csv " + id + " is-current must be TRUE or FALSE.");
      const start = validateSourceDate(row["date-start-value"], row["date-start-descriptor"], "McResidences.csv " + id + " start date", { allowBlankDescriptor: true });
      const end = validateSourceDate(row["date-end-value"], row["date-end-descriptor"], "McResidences.csv " + id + " end date", { allowBlankDescriptor: true });
      const link = personId + "|" + placeId + "|" + start.value;
      if (residenceLinks.has(link)) throw new Error("McResidences.csv contains a duplicate Person-to-Place link.");
      residenceIds.add(id); residenceLinks.add(link);
      return {
        id: id, personId: personId, placeId: placeId, label: row["residence-label"], current: row["is-current"].toUpperCase() === "TRUE",
        startDate: sourceDate(start.value, start.descriptor, counters), endDate: sourceDate(end.value, end.descriptor, counters), notes: row.notes,
        source: { format: "mcresidences-v1", fields: sourceFields(row, [
          "date-start-value", "date-start-descriptor", "date-end-value", "date-end-descriptor",
          "source-last-modified-date", "source-last-modified-by"
        ]) }, order: index
      };
    });

    const actualCounts = { people: people.length, relationships: relationships.length, places: places.length, residences: residences.length };
    Object.keys(actualCounts).forEach(function (key) {
      if (!Number.isInteger(metadata.counts[key]) || metadata.counts[key] !== actualCounts[key]) throw new Error("McMetadata.csv " + key + " count does not match the package files.");
    });
    if (metadata.accessMode === "redacted-viewer") {
      if (actualCounts.places || actualCounts.residences) throw new Error("A Viewer package cannot contain place or residence records.");
      if (parsed["McPeople.csv"].rows.some(function (row) { return Boolean(u.cleanText(row.notes, 4000).trim() || u.cleanText(row["data-quality-notes"], 4000).trim()); })) throw new Error("A Viewer package cannot contain person notes.");
      if (parsed["McRelations.csv"].rows.some(function (row) { return Boolean(u.cleanText(row.notes, 4000).trim() || u.cleanLine(row["place-id"], 100)); })) throw new Error("A Viewer package cannot contain relationship notes or place references.");
      if (u.cleanText(metadata.family.notes, config.controls.maxDocumentHtmlLength).trim()) throw new Error("A Viewer package cannot contain family Notes.");
      if (Object.keys(personDetails).length || Object.keys(relationshipDetails).length) throw new Error("A Viewer package cannot contain supplemental private profile or relationship details.");
    }
    if (!personIds.has(metadata.family.homePersonId)) throw new Error("McMetadata.csv home-person-id does not resolve to McPeople.csv.");
    if (!metadata.family.initializedAt || !Number.isFinite(Date.parse(metadata.family.initializedAt))) throw new Error("McMetadata.csv requires a valid initialized-at timestamp.");
    const now = u.isoNow();
    const settings = metadata.family.settings;
    const rawState = {
      schemaVersion: config.schemaVersion,
      meta: {
        createdAt: metadata.family.createdAt, updatedAt: metadata.family.updatedAt,
        package: { format: config.packageFormat, version: config.packageVersion, datasetVersion: metadata.datasetVersion, accessMode: metadata.accessMode, auditHistory: metadata.audits }
      },
      workspace: {
        family: { title: metadata.family.title || "McFamily", initializedAt: metadata.family.initializedAt, homePersonId: metadata.family.homePersonId },
        people: people, relationships: relationships, places: places, residences: residences,
        documents: [{ id: "app-notes", title: "Notes", html: u.escapeHtml(metadata.family.notes).replace(/\n/g, "<br>"), order: 0, createdAt: now, updatedAt: now }]
      },
      preferences: u.plainObject(settings.preferences), ui: u.plainObject(settings.ui), modules: u.plainObject(settings.modules)
    };
    const prepared = model.prepare(rawState);
    if (prepared.state.workspace.people.length !== people.length || prepared.state.workspace.relationships.length !== relationships.length || prepared.state.workspace.places.length !== places.length || prepared.state.workspace.residences.length !== residences.length) {
      throw new Error("Package normalization changed record counts; the import was rejected instead of silently dropping data.");
    }
    prepared.validation.warnings = counters.partialDates ? [counters.partialDates + " partial source dates were preserved and displayed approximately."] : [];
    return Object.assign(prepared, {
      formatLabel: "McFamily package v" + config.packageVersion + " · dataset " + metadata.datasetVersion,
      sourceRows: Object.values(parsed).reduce(function (total, file) { return total + file.rows.length; }, 0),
      fileName: fileName, checkCount: 13
    });
  }

  function sourceDateForExport(fields, prefix, date, fallbackDescriptor) {
    const rawValue = originalCsvValue(fields[prefix + "-value"] || "");
    const rawDescriptor = originalCsvValue(fields[prefix + "-descriptor"] || "");
    const value = date && date.value || "";
    if (!value && date && date.qualifier === "about" && rawValue && isPartialSourceDate(rawValue) && rawDescriptor === "partial") return { value: rawValue, descriptor: rawDescriptor };
    return {
      value: value,
      descriptor: value ? (value.length === 4 ? "year" : value.length === 7 ? "month" : "day") : (date && date.qualifier === "about" ? "UNKNOWN" : fallbackDescriptor || "")
    };
  }

  function originalPersonNotes(fields) {
    const notes = originalCsvValue(fields.notes || "");
    const quality = originalCsvValue(fields["data-quality-notes"] || "");
    return [notes, quality ? "Data quality: " + quality : ""].filter(Boolean).join("\n\n");
  }

  function nameFields(prefix, parts) {
    const name = model.nameParts({ names: { [prefix]: parts } }, prefix);
    return {
      ["person-name-" + prefix + "-prefix"]: name.prefix,
      ["person-" + prefix + "-name-first"]: name.first,
      ["person-" + prefix + "-name-middle"]: name.middle,
      ["person-" + prefix + "-name-last"]: name.last,
      ["person-" + prefix + "-name-suffix"]: name.suffix
    };
  }

  function peopleRows(state) {
    return state.workspace.people.slice().sort(function (a, b) { return a.order - b.order; }).map(function (person, index) {
      const fields = Object.assign({}, u.plainObject(person.source && person.source.fields));
      const birth = sourceDateForExport(fields, "person-date-birth", person.birth.date, "UNKNOWN");
      const deathFallback = person.livingStatus === "living" ? "NONE" : person.livingStatus === "deceased" ? "UNKNOWN" : "UNKNOWN";
      const death = sourceDateForExport(fields, "person-date-death", person.death.date, deathFallback);
      const notesUnchanged = person.notes === originalPersonNotes(fields);
      return Object.assign({}, fields, {
        "record-id": person.id, "person-name-maiden-last": person.names.maidenLast, "lineage-id": fields["lineage-id"] || "",
        "person-date-birth-value": birth.value, "person-date-birth-descriptor": birth.descriptor,
        "person-date-death-value": death.value, "person-date-death-descriptor": death.descriptor,
        notes: notesUnchanged ? originalCsvValue(fields.notes || "") : person.notes,
        "source-last-modified-date": person.updatedAt.slice(0, 10),
        "source-last-modified-by": "McFamily",
        "source-row-number": fields["source-row-number"] || String(index + 1),
        "data-quality-notes": notesUnchanged ? originalCsvValue(fields["data-quality-notes"] || "") : ""
      }, nameFields("birth", person.names.birth), nameFields("current", person.names.current), nameFields("preferred", person.names.preferred));
    });
  }

  function placeRows(state) {
    return state.workspace.places.map(function (place) {
      const fields = Object.assign({}, u.plainObject(place.source && place.source.fields));
      return Object.assign({}, fields, {
        "place-id": place.id, "place-label": place.label, "address-line-1": place.line1, "address-line-2": place.line2,
        city: place.city, region: place.region, "postal-code": place.postalCode, country: place.country, notes: place.notes,
        "source-last-modified-date": fields["source-last-modified-date"] || state.meta.updatedAt.slice(0, 10),
        "source-last-modified-by": fields["source-last-modified-by"] || "McFamily"
      });
    });
  }

  function relationshipRows(state) {
    return state.workspace.relationships.map(function (relationship) {
      const fields = Object.assign({}, u.plainObject(relationship.source && relationship.source.fields));
      const start = sourceDateForExport(fields, "date-start", relationship.startDate, "");
      const end = sourceDateForExport(fields, "date-end", relationship.endDate, "");
      const partnerType = relationship.type === "partner" ? (relationship.status === "partnered" ? "partnership" : relationship.status === "unknown" ? "UNKNOWN" : "marriage") : "";
      const endReason = relationship.type === "partner" ? ({ widowed: "death", divorced: "divorce", separated: "separation", former: "UNKNOWN" }[relationship.status] || "") : "";
      return Object.assign({}, fields, {
        "relationship-id": relationship.id, "relationship-type": relationship.type,
        "person-1-id": relationship.type === "parent-child" ? relationship.parentId : relationship.person1Id,
        "person-2-id": relationship.type === "parent-child" ? relationship.childId : relationship.person2Id,
        "parent-lineage": relationship.type === "parent-child" ? relationship.lineage : "",
        "parent-type": relationship.type === "parent-child" ? relationship.kind : "",
        "partner-type": partnerType, "relationship-order": fields["relationship-order"] || relationship.order,
        "date-start-value": start.value, "date-start-descriptor": start.descriptor, "date-end-value": end.value, "date-end-descriptor": end.descriptor,
        "end-reason": endReason, "place-id": fields["place-id"] || "", notes: relationship.notes,
        "source-last-modified-date": relationship.updatedAt.slice(0, 10),
        "source-last-modified-by": "McFamily"
      });
    });
  }

  function residenceRows(state) {
    return state.workspace.residences.map(function (residence) {
      const fields = Object.assign({}, u.plainObject(residence.source && residence.source.fields));
      const start = sourceDateForExport(fields, "date-start", residence.startDate, "");
      const end = sourceDateForExport(fields, "date-end", residence.endDate, "");
      return Object.assign({}, fields, {
        "residence-id": residence.id, "person-id": residence.personId, "place-id": residence.placeId, "residence-label": residence.label,
        "is-current": residence.current ? "TRUE" : "FALSE", "date-start-value": start.value, "date-start-descriptor": start.descriptor,
        "date-end-value": end.value, "date-end-descriptor": end.descriptor, notes: residence.notes,
        "source-last-modified-date": fields["source-last-modified-date"] || state.meta.updatedAt.slice(0, 10),
        "source-last-modified-by": fields["source-last-modified-by"] || "McFamily"
      });
    });
  }

  function metadataRows(state) {
    let serial = 1;
    const rows = [];
    function add(type, subject, key, value, details) {
      rows.push({
        "metadata-id": "M" + String(serial++).padStart(4, "0"), "metadata-type": type, subject: subject, key: key, value: value,
        "recorded-at": state.meta.updatedAt, "recorded-by": "McFamily " + config.identity.version, details: details || ""
      });
    }
    add("package", "McFamily", "package-format", config.packageFormat);
    add("package", "McFamily", "package-version", config.packageVersion);
    add("package", "McFamily", "dataset-version", datasetVersionFor(state));
    add("package", "McFamily", "person-count", state.workspace.people.length);
    add("package", "McFamily", "relationship-count", state.workspace.relationships.length);
    add("package", "McFamily", "place-count", state.workspace.places.length);
    add("package", "McFamily", "residence-count", state.workspace.residences.length);
    add("access", "McFamily", "access-mode", accessModeFor(state));
    add("family", "McFamily", "title", state.workspace.family.title);
    add("family", "McFamily", "initialized-at", state.workspace.family.initializedAt);
    add("family", "McFamily", "home-person-id", state.workspace.family.homePersonId);
    add("family", "McFamily", "created-at", state.meta.createdAt);
    add("family", "McFamily", "updated-at", state.meta.updatedAt);
    add("family", "McFamily", "notes", u.richTextToPlainText(state.workspace.documents[0] && state.workspace.documents[0].html || "", config.controls.maxDocumentHtmlLength));
    const personDetails = {};
    state.workspace.people.forEach(function (person) {
      const details = {
        gender: person.gender || "", pronouns: person.pronouns || "", birthPlace: person.birth.place || "", deathPlace: person.death.place || "",
        heritageNote: person.heritageNote || "", phones: person.phones || [], emails: person.emails || []
      };
      if (details.gender || details.pronouns || details.birthPlace || details.deathPlace || details.heritageNote || details.phones.length || details.emails.length) personDetails[person.id] = details;
    });
    const relationshipDetails = {};
    state.workspace.relationships.forEach(function (relationship) { if (relationship.place) relationshipDetails[relationship.id] = { place: relationship.place }; });
    add("family", "McFamily", "settings-json", JSON.stringify({ preferences: state.preferences, ui: state.ui, modules: state.modules, personDetails: personDetails, relationshipDetails: relationshipDetails }));
    FILE_NAMES.forEach(function (name) { add("schema", name, "schema-version", FILE_SCHEMA_VERSIONS[name]); });
    state.meta.package.auditHistory.forEach(function (audit, index) {
      rows.push({
        "metadata-id": audit.id || "A" + String(index + 1).padStart(4, "0"), "metadata-type": "audit", subject: audit.subject,
        key: "action", value: audit.action, "recorded-at": audit.recordedAt, "recorded-by": audit.recordedBy, details: audit.details
      });
    });
    return rows;
  }

  function packageFiles(state) {
    return {
      "McPeople.csv": encodeCsv(PEOPLE_HEADERS, peopleRows(state)),
      "McPlaces.csv": encodeCsv(PLACE_HEADERS, placeRows(state)),
      "McRelations.csv": encodeCsv(RELATION_HEADERS, relationshipRows(state)),
      "McResidences.csv": encodeCsv(RESIDENCE_HEADERS, residenceRows(state)),
      "McMetadata.csv": encodeCsv(METADATA_HEADERS, metadataRows(state))
    };
  }

  function auditId() {
    return "A" + Date.now().toString(36).toUpperCase();
  }

  function accessModeFor(state) {
    const mode = u.cleanLine(state && state.meta && state.meta.package && state.meta.package.accessMode, 40);
    return Object.prototype.hasOwnProperty.call(config.accessModes, mode) ? mode : "editor";
  }

  function accessState(sourceState, mode) {
    if (!Object.prototype.hasOwnProperty.call(config.accessModes, mode)) throw new Error("Choose a supported McFamily access package.");
    const next = u.clone(sourceState);
    next.meta.package.accessMode = mode;
    if (mode !== "redacted-viewer") return next;
    next.workspace.places = [];
    next.workspace.residences = [];
    next.workspace.documents.forEach(function (documentItem) { documentItem.html = ""; });
    next.workspace.people.forEach(function (person) {
      person.addresses = [];
      person.phones = [];
      person.emails = [];
      person.heritageNote = "";
      person.notes = "";
      person.gender = "";
      person.pronouns = "";
      person.birth.place = "";
      person.death.place = "";
      const fields = u.plainObject(person.source && person.source.fields);
      fields.notes = "";
      fields["data-quality-notes"] = "";
      fields["source-last-modified-by"] = "McFamily";
      person.source.fields = fields;
    });
    next.workspace.relationships.forEach(function (relationship) {
      relationship.place = "";
      relationship.notes = "";
      const fields = u.plainObject(relationship.source && relationship.source.fields);
      fields["place-id"] = "";
      fields.notes = "";
      fields["source-last-modified-by"] = "McFamily";
      relationship.source.fields = fields;
    });
    next.ui.search = "";
    next.ui.directorySearch = "";
    next.ui.favoritePersonIds = [];
    if (next.modules && next.modules.roadmap) next.modules.roadmap.search = "";
    next.meta.package.auditHistory = next.meta.package.auditHistory.map(function (audit) {
      return Object.assign({}, audit, { recordedBy: "McFamily", details: "Details omitted from the Viewer package." });
    });
    return next;
  }

  function packageBytes(state) {
    return encodeZip(packageFiles(state));
  }

  function packageFileName(state, mode) {
    const title = state.workspace.family.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mcfamily";
    const labels = { editor: "editor", "pii-viewer": "member", "redacted-viewer": "viewer" };
    return title + "-" + labels[mode || accessModeFor(state)] + "-" + new Date().toISOString().slice(0, 10) + "-v" + datasetVersionFor(state).replace(/\./g, "-") + ".zip";
  }

  function downloadBytes(bytes, fileName) {
    const blob = new Blob([bytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function exportAccessPackage(mode) {
    if (!storage.getState().workspace.family.initializedAt) {
      App.components.message("No family to export", "Import the initial McFamily data package before creating an export.");
      return;
    }
    if (accessModeFor(storage.getState()) !== "editor") {
      App.components.message("Read-only family", "Only an Editor package can create replacement or handoff packages.");
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(config.accessModes, mode)) {
      App.components.message("Package unavailable", "Choose Editor, Member, or Viewer access.");
      return;
    }
    const profile = config.accessModes[mode];
    storage.mutate(function (state) {
      const ids = new Set(state.meta.package.auditHistory.map(function (audit) { return audit.id; }));
      let id = auditId();
      let suffix = 1;
      while (ids.has(id)) id = auditId() + "_" + suffix++;
      state.meta.package.auditHistory.push({
        id: id, subject: "McFamily", action: "exported-" + mode + "-package", recordedAt: u.isoNow(),
        recordedBy: "McFamily " + config.identity.version, details: "Created a validated " + profile.label + " access package."
      });
    }, { reason: "package-export" });
    storage.saveNow();
    const packagedState = accessState(storage.getState(), mode);
    const bytes = packageBytes(packagedState);
    downloadBytes(bytes, packageFileName(packagedState, mode));
    const privacy = profile.pii ? " It contains private family information, so send and store it securely." : " Address, contact, family Notes, and unstructured record notes were removed.";
    App.components.toast(profile.label + " ZIP downloaded." + privacy, { title: "Access package created", kind: "success", duration: 6000 });
  }

  function exportPackage() {
    exportAccessPackage("editor");
  }

  function readFile(file) {
    if (!file) return Promise.reject(new Error("No file was selected."));
    if (file.size > config.controls.maxImportBytes) return Promise.reject(new Error("That ZIP is larger than the " + u.formatBytes(config.controls.maxImportBytes) + " import limit."));
    if (!/\.zip$/i.test(file.name || "")) return Promise.reject(new Error("Choose the current McFamily .zip data package."));
    return file.arrayBuffer ? file.arrayBuffer() : new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("The selected ZIP could not be read.")); };
      reader.readAsArrayBuffer(file);
    });
  }

  async function prepareBytes(bytes, fileName) {
    const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (source.byteLength > config.controls.maxImportBytes) throw new Error("That ZIP is larger than the " + u.formatBytes(config.controls.maxImportBytes) + " import limit.");
    const buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    return preparePackage(await parseZip(buffer), fileName || "McFamily package");
  }

  async function prepareFile(file) {
    return prepareBytes(await readFile(file), file && file.name);
  }

  function summaryFor(state, candidate) {
    return {
      familyTitle: state.workspace.family.title, initialized: Boolean(state.workspace.family.initializedAt),
      people: state.workspace.people.length, relationships: state.workspace.relationships.length,
      places: state.workspace.places.length, residences: state.workspace.residences.length,
      schemaVersion: state.schemaVersion, appVersion: state.meta.appVersion, updatedAt: state.meta.updatedAt,
      accessMode: accessModeFor(state), accessLabel: config.accessModes[accessModeFor(state)].label,
      formatLabel: candidate && candidate.formatLabel || "Current local family", sourceRows: candidate && candidate.sourceRows || 0,
      checkCount: candidate && candidate.checkCount || 0
    };
  }

  function isInitialImport() {
    return !storage.getState().workspace.family.initializedAt;
  }

  function requireInitialPackage(prepared) {
    if (!prepared.state.workspace.family.initializedAt) throw new Error("McMetadata.csv does not mark this as an initialized family.");
    if (!prepared.state.workspace.people.length) throw new Error("McPeople.csv must contain at least one person.");
  }

  function renderPreview(candidate, fileName) {
    const summary = summaryFor(candidate.state, candidate);
    const current = summaryFor(storage.getState());
    document.querySelector("[data-import-file]").textContent = fileName || "Selected package";
    document.querySelector("[data-import-family]").textContent = summary.familyTitle;
    document.querySelector("[data-import-access]").textContent = summary.accessLabel;
    document.querySelector("[data-import-people]").textContent = String(summary.people) + (candidate.initial ? "" : " (current: " + current.people + ")");
    document.querySelector("[data-import-relationships]").textContent = String(summary.relationships);
    document.querySelector("[data-import-places]").textContent = String(summary.places);
    document.querySelector("[data-import-residences]").textContent = String(summary.residences);
    document.querySelector("[data-import-version]").textContent = summary.formatLabel + " · " + summary.sourceRows + " rows · state v" + summary.schemaVersion;
    document.querySelector("[data-import-updated]").textContent = u.dateLabel(summary.updatedAt);
    document.querySelector("[data-import-checks]").textContent = summary.checkCount + " validation groups passed";
    const warning = document.querySelector("[data-import-warning]");
    warning.hidden = candidate.validation.warnings.length === 0;
    warning.textContent = candidate.validation.warnings.join(" ");
    document.querySelector("[data-import-recovery-note]").hidden = candidate.initial;
    document.querySelector("[data-import-confirm]").textContent = candidate.initial ? "Open " + summary.accessLabel : "Replace local family";
  }

  async function previewFile(file, trigger) {
    try {
      if (!isInitialImport() && accessModeFor(storage.getState()) !== "editor") throw new Error("Recovery-file import is available only to Owner or Editor access.");
      App.components.setLoading(true, "Checking private data package…");
      const prepared = await prepareFile(file);
      const initial = isInitialImport();
      if (initial) requireInitialPackage(prepared);
      pendingImport = Object.assign({}, prepared, { initial: initial });
      renderPreview(pendingImport, file.name);
      App.components.openDialog("#importPreviewDialog", { trigger: trigger, focus: "[data-import-confirm]" });
    } catch (error) {
      pendingImport = null;
      App.components.message("Import unavailable", error.message || "That ZIP package could not be used.", { trigger: trigger });
    } finally {
      App.components.setLoading(false);
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    if (!pendingImport.initial && accessModeFor(storage.getState()) !== "editor") {
      pendingImport = null;
      App.components.closeDialog("#importPreviewDialog", "cancel");
      App.components.message("Read-only access", "Recovery-file import is available only to Owner or Editor access.");
      return;
    }
    if (!pendingImport.initial) {
      const accepted = await App.components.confirm({
        title: "Replace the local family?",
        message: "This validated ZIP will replace all people, places, residences, relationships, contacts, Notes, metadata, and preferences on this browser. A recovery copy will be saved first.",
        confirmLabel: "Replace local family", cancelLabel: "Keep current family", danger: true,
        trigger: document.querySelector("[data-import-confirm]")
      });
      if (!accepted) return;
    }
    const summary = summaryFor(pendingImport.state, pendingImport);
    pendingImport.state.meta.package.auditHistory.push({
      id: auditId(), subject: pendingImport.fileName, action: "imported-package", recordedAt: u.isoNow(),
      recordedBy: "McFamily " + config.identity.version, details: "Validated and imported all five package files."
    });
    storage.replace(pendingImport.state, { recoveryReason: "Before importing " + summary.familyTitle, saveRecovery: !pendingImport.initial, reason: "import" });
    pendingImport = null;
    App.components.closeDialog("#importPreviewDialog", "imported");
    App.components.toast("Opened " + summary.familyTitle + " with " + summary.people + " people after all package checks passed.", { title: "Package imported", kind: "success", duration: 5000 });
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
    exportPackage: exportPackage,
    exportAccessPackage: exportAccessPackage,
    exportCsv: exportPackage,
    previewFile: previewFile,
    preparePackage: preparePackage,
    parseZip: parseZip,
    encodeZip: encodeZip,
    packageFiles: packageFiles,
    packageBytes: packageBytes,
    packageFileName: packageFileName,
    accessModeFor: accessModeFor,
    accessState: accessState,
    downloadBytes: downloadBytes,
    prepareBytes: prepareBytes,
    prepareFile: prepareFile,
    isSupportedDatasetVersion: isSupportedDatasetVersion,
    nextDatasetPatch: nextDatasetPatch,
    auditId: auditId,
    datasetVersionFor: datasetVersionFor,
    summaryFor: summaryFor,
    requireInitialPackage: requireInitialPackage
  };
})();
