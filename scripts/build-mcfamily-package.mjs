import fs from "node:fs";
import path from "node:path";

const INPUT = process.argv[2] || "data/McFamily-15-0-0-2026-08-24.zip";
const OUTPUT = process.argv[3] || "data/McFamily-16-0-0-2026-08-24.zip";
const DATASET_VERSION = "16.0.0";
const PACKAGE_VERSION = "1";
const RECORDED_AT = "2026-08-24T04:00:00.000Z";
const RECORDED_BY = "Adam Lauer";
const FILE_NAMES = ["McPeople.csv", "McPlaces.csv", "McRelations.csv", "McResidences.csv", "McMetadata.csv"];
const FILE_SCHEMA_VERSIONS = {
  "McPeople.csv": "1.0.0",
  "McPlaces.csv": "1.0.0",
  "McRelations.csv": "2.0.0",
  "McResidences.csv": "1.0.0",
  "McMetadata.csv": "1.0.0"
};

const PEOPLE_HEADERS = [
  "record-id",
  "person-name-birth-prefix", "person-birth-name-first", "person-birth-name-middle", "person-birth-name-last", "person-birth-name-suffix",
  "person-name-current-prefix", "person-current-name-first", "person-current-name-middle", "person-current-name-last", "person-current-name-suffix",
  "person-name-preferred-prefix", "person-preferred-name-first", "person-preferred-name-middle", "person-preferred-name-last", "person-preferred-name-suffix",
  "person-name-maiden-last", "lineage-id",
  "person-date-birth-value", "person-date-birth-descriptor", "person-date-death-value", "person-date-death-descriptor",
  "notes", "source-last-modified-date", "source-last-modified-by", "source-row-number", "data-quality-notes"
];
const RELATION_HEADERS = [
  "relationship-id", "relationship-type", "person-1-id", "person-2-id", "parent-lineage", "parent-type", "partner-type", "relationship-order",
  "date-start-value", "date-start-descriptor", "date-end-value", "date-end-descriptor", "end-reason", "place-id", "notes",
  "source-last-modified-date", "source-last-modified-by"
];
const V15_RELATION_HEADERS = [
  "relationship-id", "relationship-type", "person-1-id", "person-2-id", "parent-kind", "partner-type", "relationship-order",
  "date-start-value", "date-start-descriptor", "date-end-value", "date-end-descriptor", "end-reason", "place-id", "notes",
  "source-last-modified-date", "source-last-modified-by"
];
const PLACE_HEADERS = [
  "place-id", "place-label", "address-line-1", "address-line-2", "city", "region", "postal-code", "country", "notes",
  "source-last-modified-date", "source-last-modified-by"
];
const RESIDENCE_HEADERS = [
  "residence-id", "person-id", "place-id", "residence-label", "is-current", "date-start-value", "date-start-descriptor",
  "date-end-value", "date-end-descriptor", "notes", "source-last-modified-date", "source-last-modified-by"
];
const METADATA_HEADERS = ["metadata-id", "metadata-type", "subject", "key", "value", "recorded-at", "recorded-by", "details"];

function parseCsv(text, expectedHeaders, fileName) {
  const matrix = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
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
      if (row.some((value) => value !== "")) matrix.push(row);
      row = [];
    } else cell += character;
  }
  if (quoted) throw new Error("The source CSV ends inside a quoted field.");
  row.push(cell);
  if (row.some((value) => value !== "")) matrix.push(row);
  if (!matrix.length) throw new Error(`${fileName} is empty.`);
  const headers = matrix.shift();
  if (headers.length !== expectedHeaders.length || headers.some((header, index) => header !== expectedHeaders[index])) {
    throw new Error(`${fileName} does not use the expected v15 schema and header order.`);
  }
  return matrix.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function csvValue(value) {
  let text = String(value == null ? "" : value);
  if (/^[\t ]*[=+\-@]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function encodeCsv(headers, rows) {
  return [headers.join(",")].concat(rows.map((row) => headers.map((header) => csvValue(row[header])).join(","))).join("\r\n") + "\r\n";
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, Buffer.from(nameBytes), Buffer.from(data));

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, Buffer.from(nameBytes));
    offset += local.length + nameBytes.length + data.length;
  });
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat(localParts.concat(centralParts, end));
}

function unzipStore(archive) {
  const files = new Map();
  let cursor = 0;
  while (cursor + 4 <= archive.length) {
    const signature = archive.readUInt32LE(cursor);
    if ([0x02014b50, 0x06054b50].includes(signature)) break;
    if (signature !== 0x04034b50 || cursor + 30 > archive.length) throw new Error("The input ZIP has a damaged local header.");
    const flags = archive.readUInt16LE(cursor + 6);
    const method = archive.readUInt16LE(cursor + 8);
    const expectedCrc = archive.readUInt32LE(cursor + 14);
    const compressedSize = archive.readUInt32LE(cursor + 18);
    const uncompressedSize = archive.readUInt32LE(cursor + 22);
    const nameLength = archive.readUInt16LE(cursor + 26);
    const extraLength = archive.readUInt16LE(cursor + 28);
    if ((flags & 1) || method !== 0 || compressedSize !== uncompressedSize) throw new Error("The v15 source ZIP must use unencrypted stored entries.");
    const nameStart = cursor + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > archive.length) throw new Error("The input ZIP contains a truncated file.");
    const name = archive.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const data = archive.subarray(dataStart, dataEnd);
    if (!FILE_NAMES.includes(name) || files.has(name)) throw new Error(`The input ZIP contains an unexpected or duplicate file: ${name}.`);
    if (crc32(data) !== expectedCrc) throw new Error(`${name} failed checksum validation.`);
    files.set(name, data.toString("utf8"));
    cursor = dataEnd;
  }
  const missing = FILE_NAMES.filter((name) => !files.has(name));
  if (missing.length) throw new Error(`The input ZIP is missing ${missing.join(", ")}.`);
  return files;
}

function convertRelationships(sourceRows) {
  return sourceRows.map((row) => {
    const parent = row["relationship-type"] === "parent-child";
    return {
      "relationship-id": row["relationship-id"], "relationship-type": row["relationship-type"],
      "person-1-id": row["person-1-id"], "person-2-id": row["person-2-id"],
      "parent-lineage": parent ? row["parent-kind"] : "", "parent-type": parent ? "biological" : "",
      "partner-type": row["partner-type"], "relationship-order": row["relationship-order"],
      "date-start-value": row["date-start-value"], "date-start-descriptor": row["date-start-descriptor"],
      "date-end-value": row["date-end-value"], "date-end-descriptor": row["date-end-descriptor"], "end-reason": row["end-reason"],
      "place-id": row["place-id"], notes: row.notes,
      "source-last-modified-date": row["source-last-modified-date"], "source-last-modified-by": row["source-last-modified-by"]
    };
  });
}

function metadataRows(sourceRows, counts, homePersonId) {
  let serial = 1;
  const rows = [];
  const add = (type, subject, key, value, details = "") => rows.push({
    "metadata-id": "M" + String(serial++).padStart(4, "0"), "metadata-type": type, subject, key, value,
    "recorded-at": RECORDED_AT, "recorded-by": RECORDED_BY, details
  });
  add("package", "McFamily", "package-format", "mcfamily-package");
  add("package", "McFamily", "package-version", PACKAGE_VERSION);
  add("package", "McFamily", "dataset-version", DATASET_VERSION);
  add("package", "McFamily", "person-count", counts.people);
  add("package", "McFamily", "relationship-count", counts.relations);
  add("package", "McFamily", "place-count", counts.places);
  add("package", "McFamily", "residence-count", counts.residences);
  const prior = (type, key, fallback = "") => sourceRows.find((row) => row["metadata-type"] === type && row.key === key)?.value || fallback;
  add("family", "McFamily", "title", prior("family", "title", "McLineage"));
  add("family", "McFamily", "initialized-at", prior("family", "initialized-at", RECORDED_AT));
  add("family", "McFamily", "home-person-id", homePersonId);
  add("family", "McFamily", "created-at", prior("family", "created-at", RECORDED_AT));
  add("family", "McFamily", "updated-at", RECORDED_AT);
  add("family", "McFamily", "notes", prior("family", "notes", ""));
  add("family", "McFamily", "settings-json", prior("family", "settings-json", "{}"));
  FILE_NAMES.forEach((file) => add("schema", file, "schema-version", FILE_SCHEMA_VERSIONS[file]));
  const audits = sourceRows.filter((row) => row["metadata-type"] === "audit").map((row) => ({ ...row }));
  rows.push(...audits);
  let auditSerial = audits.reduce((maximum, row) => Math.max(maximum, Number(String(row["metadata-id"]).replace(/\D/g, "")) || 0), 0) + 1;
  const audit = (subject, action, details) => rows.push({
    "metadata-id": "A" + String(auditSerial++).padStart(4, "0"), "metadata-type": "audit", subject, key: "action", value: action,
    "recorded-at": RECORDED_AT, "recorded-by": RECORDED_BY, details
  });
  audit("McRelations.csv", "parent-schema-v2", "Replaced parent-kind with independent parent-lineage and parent-type fields. Lineal and Non-Lineal supersede the former consanguineal and affinal parent terminology, and multiple Non-Lineal parents are valid.");
  audit("P569", "recorded-adoption", "Recorded P380 as Lineal :: Adopted, P877 and P914 as Non-Lineal :: Biological, and an earlier unknown partner history between P877 and P914.");
  return rows;
}

const sourceFiles = unzipStore(fs.readFileSync(INPUT));
const people = parseCsv(sourceFiles.get("McPeople.csv"), PEOPLE_HEADERS, "McPeople.csv");
const places = parseCsv(sourceFiles.get("McPlaces.csv"), PLACE_HEADERS, "McPlaces.csv");
const relations = convertRelationships(parseCsv(sourceFiles.get("McRelations.csv"), V15_RELATION_HEADERS, "McRelations.csv"));
const residences = parseCsv(sourceFiles.get("McResidences.csv"), RESIDENCE_HEADERS, "McResidences.csv");
const sourceMetadata = parseCsv(sourceFiles.get("McMetadata.csv"), METADATA_HEADERS, "McMetadata.csv");

const unknownPerson = Object.fromEntries(PEOPLE_HEADERS.map((header) => [header, ""]));
Object.assign(unknownPerson, {
  "record-id": "P914",
  "person-birth-name-first": "Name", "person-birth-name-last": "Unknown",
  "person-current-name-first": "Name", "person-current-name-last": "Unknown",
  "person-preferred-name-first": "Name", "person-preferred-name-last": "Unknown",
  "person-date-birth-descriptor": "UNKNOWN", "person-date-death-descriptor": "NONE",
  "source-last-modified-date": "2026-08-24", "source-last-modified-by": RECORDED_BY, "source-row-number": "914"
});
if (people.some((row) => row["record-id"] === unknownPerson["record-id"])) throw new Error("P914 already exists in the v15 source package.");
people.push(unknownPerson);

const r270 = relations.find((row) => row["relationship-id"] === "R270");
if (!r270 || ![r270["person-1-id"], r270["person-2-id"]].includes("P380") || ![r270["person-1-id"], r270["person-2-id"]].includes("P877")) throw new Error("R270 must connect P380 and P877 before the adoption update can be applied.");
r270["relationship-order"] = "2";
r270["source-last-modified-date"] = "2026-08-24";
r270["source-last-modified-by"] = RECORDED_BY;

const rl0569 = relations.find((row) => row["relationship-id"] === "RL0569");
if (!rl0569 || rl0569["person-1-id"] !== "P380" || rl0569["person-2-id"] !== "P569") throw new Error("RL0569 must connect P380 to P569 before the adoption update can be applied.");
rl0569["parent-lineage"] = "lineal";
rl0569["parent-type"] = "adoptive";
rl0569.notes = "Lineal adoptive parent.";
rl0569["source-last-modified-date"] = "2026-08-24";
rl0569["source-last-modified-by"] = RECORDED_BY;

const maximumOrder = relations.reduce((maximum, row) => Math.max(maximum, Number(row["relationship-order"]) || 0), 0);
relations.push(
  {
    "relationship-id": "R307", "relationship-type": "partner", "person-1-id": "P877", "person-2-id": "P914",
    "parent-lineage": "", "parent-type": "", "partner-type": "UNKNOWN", "relationship-order": "1",
    "date-start-value": "", "date-start-descriptor": "UNKNOWN", "date-end-value": "", "date-end-descriptor": "UNKNOWN", "end-reason": "UNKNOWN",
    "place-id": "", notes: "Relationship type and timing are unknown; this relationship precedes R270.",
    "source-last-modified-date": "2026-08-24", "source-last-modified-by": RECORDED_BY
  },
  {
    "relationship-id": "RN0569-01", "relationship-type": "parent-child", "person-1-id": "P877", "person-2-id": "P569",
    "parent-lineage": "non-lineal", "parent-type": "biological", "partner-type": "", "relationship-order": String(maximumOrder + 1),
    "date-start-value": "", "date-start-descriptor": "", "date-end-value": "", "date-end-descriptor": "", "end-reason": "",
    "place-id": "", notes: "", "source-last-modified-date": "2026-08-24", "source-last-modified-by": RECORDED_BY
  },
  {
    "relationship-id": "RN0569-02", "relationship-type": "parent-child", "person-1-id": "P914", "person-2-id": "P569",
    "parent-lineage": "non-lineal", "parent-type": "biological", "partner-type": "", "relationship-order": String(maximumOrder + 2),
    "date-start-value": "", "date-start-descriptor": "", "date-end-value": "", "date-end-descriptor": "", "end-reason": "",
    "place-id": "", notes: "", "source-last-modified-date": "2026-08-24", "source-last-modified-by": RECORDED_BY
  }
);

const ids = people.map((row) => row["record-id"]);
const personIds = new Set(ids);
if (personIds.size !== ids.length || ids.some((id) => !/^P\d{3,}$/.test(id))) throw new Error("McPeople record IDs must be unique P references.");
const relationIds = new Set();
const linealByChild = new Map();
relations.forEach((row) => {
  const id = row["relationship-id"];
  if (!id || relationIds.has(id)) throw new Error(`Duplicate or blank relationship ID ${id || "(blank)"}.`);
  relationIds.add(id);
  if (!personIds.has(row["person-1-id"]) || !personIds.has(row["person-2-id"]) || row["person-1-id"] === row["person-2-id"]) throw new Error(`${id} contains a missing or self person reference.`);
  if (row["relationship-type"] === "parent-child") {
    if (!["lineal", "non-lineal"].includes(row["parent-lineage"]) || !["biological", "adoptive", "step", "foster", "guardian", "unknown"].includes(row["parent-type"])) throw new Error(`${id} contains an invalid parent classification.`);
    if (row["parent-lineage"] === "lineal") {
      if (linealByChild.has(row["person-2-id"])) throw new Error(`${row["person-2-id"]} has more than one Lineal parent.`);
      linealByChild.set(row["person-2-id"], row["person-1-id"]);
    }
  }
});

const homePersonId = sourceMetadata.find((row) => row["metadata-type"] === "family" && row.key === "home-person-id")?.value || people.find((row) => row["lineage-id"] === "01")?.["record-id"] || ids[0];
const metadata = metadataRows(sourceMetadata, { people: people.length, relations: relations.length, places: places.length, residences: residences.length }, homePersonId);
const files = {
  "McPeople.csv": encodeCsv(PEOPLE_HEADERS, people),
  "McPlaces.csv": encodeCsv(PLACE_HEADERS, places),
  "McRelations.csv": encodeCsv(RELATION_HEADERS, relations),
  "McResidences.csv": encodeCsv(RESIDENCE_HEADERS, residences),
  "McMetadata.csv": encodeCsv(METADATA_HEADERS, metadata)
};
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, zipStore(files));
console.log(JSON.stringify({ output: OUTPUT, source: INPUT, datasetVersion: DATASET_VERSION, people: people.length, relations: relations.length, places: places.length, residences: residences.length, metadata: metadata.length, files: Object.keys(files) }, null, 2));
