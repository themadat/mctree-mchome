import fs from "node:fs";
import path from "node:path";

const INPUT = process.argv[2] || "data/McLineage-14-0-0-2026-08-24.csv";
const OUTPUT = process.argv[3] || "data/McFamily-15-0-0-2026-08-24.zip";
const PRIVATE_CONFIG = process.argv[4] || "data/McFamily-private-config.json";
const DATASET_VERSION = "15.0.0";
const PACKAGE_VERSION = "1";
const RECORDED_AT = "2026-08-24T00:00:00.000Z";
const RECORDED_BY = "Adam Lauer";

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
const OLD_HEADERS = PEOPLE_HEADERS.slice(0, 18).concat([
  "parent-consanguinity-person-id", "parent-affinal-person-id"
], PEOPLE_HEADERS.slice(18, 22), ["partner-relationships-json"], PEOPLE_HEADERS.slice(22));

function parseCsv(text) {
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
  if (matrix.length < 2) throw new Error("The source CSV must contain people.");
  const headers = matrix.shift();
  if (headers.length !== OLD_HEADERS.length || headers.some((header, index) => header !== OLD_HEADERS[index])) {
    throw new Error("The source must use the exact McLineage v14 header order.");
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

function relationRows(sourceRows) {
  const rows = [];
  const relationIds = new Set();
  const personIds = new Set(sourceRows.map((row) => row["record-id"]));
  sourceRows.forEach((person, personIndex) => {
    const owner = person["record-id"];
    const raw = person["partner-relationships-json"].trim();
    const partners = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(partners)) throw new Error(`Partner relationships on ${owner} must be an array.`);
    partners.forEach((entry) => {
      const id = String(entry.relationship_id || "").toUpperCase();
      const partnerId = String(entry.partner_person_id || "").toUpperCase();
      if (!/^R\d{3,}$/.test(id) || relationIds.has(id)) throw new Error(`Invalid or duplicate partner relationship ID ${id || "(blank)"}.`);
      if (!personIds.has(partnerId) || partnerId === owner) throw new Error(`Partner relationship ${id} has an invalid person reference.`);
      relationIds.add(id);
      rows.push({
        "relationship-id": id, "relationship-type": "partner", "person-1-id": owner, "person-2-id": partnerId,
        "parent-kind": "", "partner-type": entry.relationship_type, "relationship-order": entry.relationship_order,
        "date-start-value": entry.date_start_value, "date-start-descriptor": entry.date_start_descriptor,
        "date-end-value": entry.date_end_value, "date-end-descriptor": entry.date_end_descriptor, "end-reason": entry.end_reason,
        "place-id": "", notes: "", "source-last-modified-date": person["source-last-modified-date"],
        "source-last-modified-by": person["source-last-modified-by"]
      });
    });
    const childDigits = owner.replace(/^P/, "").padStart(4, "0");
    [["parent-consanguinity-person-id", "RL" + childDigits, "lineal"], ["parent-affinal-person-id", "RN" + childDigits, "non-lineal"]].forEach(([field, id, kind]) => {
      const parent = person[field].toUpperCase();
      if (!parent) return;
      if (!personIds.has(parent) || parent === owner || relationIds.has(id)) throw new Error(`Parent relationship ${id} has an invalid person reference.`);
      relationIds.add(id);
      rows.push({
        "relationship-id": id, "relationship-type": "parent-child", "person-1-id": parent, "person-2-id": owner,
        "parent-kind": kind, "partner-type": "", "relationship-order": personIndex + 1,
        "date-start-value": "", "date-start-descriptor": "", "date-end-value": "", "date-end-descriptor": "", "end-reason": "",
        "place-id": "", notes: "", "source-last-modified-date": person["source-last-modified-date"],
        "source-last-modified-by": person["source-last-modified-by"]
      });
    });
  });
  return rows;
}

function metadataRows(counts, homePersonId) {
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
  add("family", "McFamily", "title", "McLineage");
  add("family", "McFamily", "initialized-at", RECORDED_AT);
  add("family", "McFamily", "home-person-id", homePersonId);
  add("family", "McFamily", "created-at", RECORDED_AT);
  add("family", "McFamily", "updated-at", RECORDED_AT);
  add("family", "McFamily", "notes", "");
  add("family", "McFamily", "settings-json", "{}");
  ["McPeople.csv", "McPlaces.csv", "McRelations.csv", "McResidences.csv", "McMetadata.csv"].forEach((file) => add("schema", file, "schema-version", "1.0.0"));
  const audit = (subject, action, details) => rows.push({
    "metadata-id": "A" + String(serial++).padStart(4, "0"), "metadata-type": "audit", subject, key: "action", value: action,
    "recorded-at": RECORDED_AT, "recorded-by": RECORDED_BY, details
  });
  audit("McPeople.csv", "renamed-and-split", "Renamed McLineage v14 to McPeople and removed parent and partner relationship fields.");
  audit("McRelations.csv", "extracted-relations", "Moved Lineal parents, Non-Lineal parents, and partner relationships into explicit Person-to-Person rows.");
  audit("McPlaces.csv", "added-place", "Added the initial private physical place record.");
  audit("McResidences.csv", "assigned-residence", "Assigned the initial private Person-to-Place residence.");
  return rows;
}

const sourceRows = parseCsv(fs.readFileSync(INPUT, "utf8"));
const privateConfig = JSON.parse(fs.readFileSync(PRIVATE_CONFIG, "utf8"));
const initialPlace = privateConfig && privateConfig.initialPlace || {};
[
  "placeId", "residenceId", "personId", "label", "line1", "city", "region", "postalCode"
].forEach((key) => { if (!String(initialPlace[key] || "").trim()) throw new Error(`The private config requires initialPlace.${key}.`); });
if (!/^L\d{4,}$/.test(initialPlace.placeId) || !/^RS\d{4,}$/.test(initialPlace.residenceId) || !/^P\d{3,}$/.test(initialPlace.personId)) {
  throw new Error("The private config requires valid L, RS, and P identifiers.");
}
const ids = sourceRows.map((row) => row["record-id"]);
if (new Set(ids).size !== ids.length || ids.some((id) => !/^P\d{3,}$/.test(id))) throw new Error("McPeople record IDs must be unique P references.");
const people = sourceRows.map((row) => Object.fromEntries(PEOPLE_HEADERS.map((header) => [header, row[header] || ""])));
const relations = relationRows(sourceRows);
const places = [{
  "place-id": initialPlace.placeId, "place-label": initialPlace.label, "address-line-1": initialPlace.line1,
  "address-line-2": initialPlace.line2 || "", city: initialPlace.city, region: initialPlace.region,
  "postal-code": initialPlace.postalCode, country: initialPlace.country || "", notes: initialPlace.notes || "",
  "source-last-modified-date": "2026-08-24", "source-last-modified-by": RECORDED_BY
}];
const residences = [{
  "residence-id": initialPlace.residenceId, "person-id": initialPlace.personId, "place-id": initialPlace.placeId,
  "residence-label": initialPlace.label, "is-current": "TRUE",
  "date-start-value": "", "date-start-descriptor": "", "date-end-value": "", "date-end-descriptor": "", notes: "",
  "source-last-modified-date": "2026-08-24", "source-last-modified-by": RECORDED_BY
}];
if (!ids.includes(initialPlace.personId)) throw new Error("The configured residence person is missing from McPeople.");
const homePersonId = sourceRows.find((row) => row["lineage-id"] === "01")?.["record-id"] || ids[0];
const metadata = metadataRows({ people: people.length, relations: relations.length, places: places.length, residences: residences.length }, homePersonId);
const files = {
  "McPeople.csv": encodeCsv(PEOPLE_HEADERS, people),
  "McPlaces.csv": encodeCsv(PLACE_HEADERS, places),
  "McRelations.csv": encodeCsv(RELATION_HEADERS, relations),
  "McResidences.csv": encodeCsv(RESIDENCE_HEADERS, residences),
  "McMetadata.csv": encodeCsv(METADATA_HEADERS, metadata)
};
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, zipStore(files));
console.log(JSON.stringify({ output: OUTPUT, datasetVersion: DATASET_VERSION, people: people.length, relations: relations.length, places: places.length, residences: residences.length, metadata: metadata.length, files: Object.keys(files) }, null, 2));
