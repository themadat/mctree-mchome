import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const INPUT = process.argv[2] || "data/McFamily-16-0-2-2026-08-25.zip";
const REPORT = process.argv[3] || "data/outputs/mcdirectory-address-report-20260825/McDirectory-address-assignment-report.csv";
const OUTPUT = process.argv[4] || "data/McFamily-17-0-0-2026-08-25.zip";
const SOURCE_DATASET_VERSION = "16.0.2";
const DATASET_VERSION = "17.0.0";
const RECORDED_BY = "Admin";
const RECORDED_AT = new Date().toISOString();
const FILE_NAMES = ["McPeople.csv", "McPlaces.csv", "McRelations.csv", "McResidences.csv", "McMetadata.csv"];

const PEOPLE_HEADERS = [
  "record-id",
  "person-name-birth-prefix", "person-birth-name-first", "person-birth-name-middle", "person-birth-name-last", "person-birth-name-suffix",
  "person-name-current-prefix", "person-current-name-first", "person-current-name-middle", "person-current-name-last", "person-current-name-suffix",
  "person-name-preferred-prefix", "person-preferred-name-first", "person-preferred-name-middle", "person-preferred-name-last", "person-preferred-name-suffix",
  "person-name-maiden-last", "lineage-id", "person-date-birth-value", "person-date-birth-descriptor", "person-date-death-value", "person-date-death-descriptor",
  "notes", "source-last-modified-date", "source-last-modified-by", "source-row-number", "data-quality-notes"
];
const V16_PLACE_HEADERS = [
  "place-id", "place-label", "address-line-1", "address-line-2", "city", "region", "postal-code", "country", "notes",
  "source-last-modified-date", "source-last-modified-by"
];
const PLACE_HEADERS = V16_PLACE_HEADERS.concat(["source-row-number", "source-pcard", "source-notes"]);
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
const REPORT_HEADERS = [
  "report-row", "record-type", "review-status", "place-action", "proposed-place-id", "source-row-number",
  "address-entry", "address-line-1", "address-line-2", "city", "region", "postal-code", "country",
  "assigned-person-ids", "assigned-people-first-last", "assignment-evidence", "residence-actions",
  "phone-assignments", "email-assignments", "pcard", "source-last-modified-date", "source-last-modified-by", "source-notes", "match-notes"
];
const V16_HEADERS = {
  "McPeople.csv": PEOPLE_HEADERS,
  "McPlaces.csv": V16_PLACE_HEADERS,
  "McRelations.csv": RELATION_HEADERS,
  "McResidences.csv": RESIDENCE_HEADERS,
  "McMetadata.csv": METADATA_HEADERS
};
const V17_HEADERS = Object.assign({}, V16_HEADERS, { "McPlaces.csv": PLACE_HEADERS });
const V17_SCHEMAS = {
  "McPeople.csv": "1.0.0", "McPlaces.csv": "2.0.0", "McRelations.csv": "2.0.0", "McResidences.csv": "1.0.0", "McMetadata.csv": "1.0.0"
};

function clean(value) {
  return String(value == null ? "" : value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function parseCsv(text, expectedHeaders, label) {
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
      if (row.some(value => value !== "")) matrix.push(row);
      row = [];
    } else cell += character;
  }
  if (quoted) throw new Error(label + " ends inside a quoted field.");
  row.push(cell);
  if (row.some(value => value !== "")) matrix.push(row);
  if (!matrix.length) throw new Error(label + " is empty.");
  const headers = matrix.shift();
  if (headers.length !== expectedHeaders.length || headers.some((header, index) => header !== expectedHeaders[index])) throw new Error(label + " does not match its expected schema.");
  return matrix.map((values, rowIndex) => {
    if (values.length > headers.length || values.slice(headers.length).some(Boolean)) throw new Error(label + " row " + (rowIndex + 2) + " has too many cells.");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function csvValue(value) {
  let text = String(value == null ? "" : value);
  if (/^[\t ]*[=+\-@]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function encodeCsv(headers, rows) {
  return [headers.join(",")].concat(rows.map(row => headers.map(header => csvValue(row[header])).join(","))).join("\r\n") + "\r\n";
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function unzipArchive(archive) {
  const endSignature = 0x06054b50;
  let endOffset = -1;
  for (let cursor = archive.length - 22; cursor >= Math.max(0, archive.length - 65557); cursor -= 1) {
    if (archive.readUInt32LE(cursor) === endSignature) { endOffset = cursor; break; }
  }
  if (endOffset < 0) throw new Error("The source ZIP directory is missing.");
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  const files = new Map();
  let cursor = centralOffset;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("The source ZIP directory is damaged.");
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const expectedCrc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    if ((flags & 1) || ![0, 8].includes(method)) throw new Error("The source ZIP uses unsupported encryption or compression.");
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (!FILE_NAMES.includes(name) || files.has(name)) throw new Error("Unexpected or duplicate source ZIP entry: " + name + ".");
    if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(name + " has a damaged local header.");
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archive.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : zlib.inflateRawSync(compressed);
    if (data.length !== uncompressedSize || crc32(data) !== expectedCrc) throw new Error(name + " failed ZIP validation.");
    files.set(name, data.toString("utf8"));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (files.size !== FILE_NAMES.length) throw new Error("The source ZIP must contain exactly five files.");
  return files;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  });
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(FILE_NAMES.length, 8);
  end.writeUInt16LE(FILE_NAMES.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat(localParts.concat(centralParts, end));
}

function splitValues(value) {
  return clean(value).split(/;\s*/).map(clean).filter(Boolean);
}

function reportSourceValues(value) {
  return Array.from(new Set(splitValues(value).map(item => item.replace(/^row\s+\d+:\s*/i, "")).filter(Boolean)));
}

function latestDate(value) {
  return reportSourceValues(value).filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item)).sort().at(-1) || "";
}

function assignmentPairs(value) {
  const source = clean(value);
  if (!source) return [];
  return source.split(/;\s+(?=P\d{3,}:)/).map(item => {
    const match = /^(P\d{3,}):\s*(.+)$/.exec(item);
    if (!match) throw new Error("Invalid contact assignment: " + item + ".");
    return { personId: match[1], value: clean(match[2]) };
  });
}

function normalizePhone(value) {
  return clean(value).toLowerCase().replace(/[^0-9a-z]+/g, "");
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

const sourceFiles = unzipArchive(fs.readFileSync(INPUT));
const people = parseCsv(sourceFiles.get("McPeople.csv"), PEOPLE_HEADERS, "McPeople.csv");
const places = parseCsv(sourceFiles.get("McPlaces.csv"), V16_PLACE_HEADERS, "McPlaces.csv");
const relationships = parseCsv(sourceFiles.get("McRelations.csv"), RELATION_HEADERS, "McRelations.csv");
const residences = parseCsv(sourceFiles.get("McResidences.csv"), RESIDENCE_HEADERS, "McResidences.csv");
const metadata = parseCsv(sourceFiles.get("McMetadata.csv"), METADATA_HEADERS, "McMetadata.csv");
const reportRows = parseCsv(fs.readFileSync(REPORT, "utf8"), REPORT_HEADERS, "Address assignment report");
const sourceDatasetRows = metadata.filter(row => row["metadata-type"] === "package" && row.key === "dataset-version");
if (sourceDatasetRows.length !== 1 || sourceDatasetRows[0].value !== SOURCE_DATASET_VERSION) throw new Error("The source package must be dataset " + SOURCE_DATASET_VERSION + ".");

const personIds = new Set(people.map(row => row["record-id"]));
if (personIds.size !== people.length) throw new Error("McPeople.csv contains duplicate record IDs.");
const placeById = new Map(places.map(row => [row["place-id"], row]));
const residenceById = new Map(residences.map(row => [row["residence-id"], row]));
const metadataSettings = metadata.find(row => row["metadata-type"] === "family" && row.key === "settings-json");
if (!metadataSettings) throw new Error("McMetadata.csv has no family settings-json row.");
let settings;
try { settings = JSON.parse(metadataSettings.value || "{}"); }
catch (error) { throw new Error("McMetadata.csv settings-json is invalid."); }
settings.personDetails = settings.personDetails && typeof settings.personDetails === "object" && !Array.isArray(settings.personDetails) ? settings.personDetails : {};

let placesCreated = 0;
let placesUpdated = 0;
let residencesCreated = 0;
let residencesUpdated = 0;
let residencesKept = 0;
let phonesAdded = 0;
let emailsAdded = 0;
let acceptedReviewRows = 0;
let blockedRowsOmitted = 0;

function applyContact(personId, value, kind) {
  if (!personIds.has(personId)) throw new Error("A contact assignment references missing person " + personId + ".");
  const details = settings.personDetails[personId] && typeof settings.personDetails[personId] === "object" ? settings.personDetails[personId] : {};
  const key = kind === "phone" ? "phones" : "emails";
  const normalizer = kind === "phone" ? normalizePhone : normalizeEmail;
  const list = Array.isArray(details[key]) ? details[key].slice() : [];
  if (!list.some(item => normalizer(item && item.value) === normalizer(value))) {
    list.push({
      id: kind + "-mcdirectory-" + personId + "-" + String(list.length + 1).padStart(2, "0"),
      label: "McDirectory", value: value, order: list.length
    });
    if (kind === "phone") phonesAdded += 1;
    else emailsAdded += 1;
  }
  details[key] = list;
  settings.personDetails[personId] = details;
}

function applyResidenceAction(action, expectedPlaceId, sourceDate, sourceBy) {
  const create = /^CREATE\s+(RS\d{4,})\s+(P\d{3,})→(L\d{4,})$/.exec(action);
  if (create) {
    const [, residenceId, personId, placeId] = create;
    if (placeId !== expectedPlaceId || !personIds.has(personId) || !placeById.has(placeId) || residenceById.has(residenceId)) throw new Error("Invalid CREATE residence action: " + action + ".");
    const row = Object.fromEntries(RESIDENCE_HEADERS.map(header => [header, ""]));
    Object.assign(row, {
      "residence-id": residenceId, "person-id": personId, "place-id": placeId, "residence-label": "Home", "is-current": "TRUE",
      "source-last-modified-date": sourceDate || RECORDED_AT.slice(0, 10), "source-last-modified-by": sourceBy || "McDirectory"
    });
    residences.push(row);
    residenceById.set(residenceId, row);
    residencesCreated += 1;
    return;
  }
  const update = /^UPDATE\s+(RS\d{4,})\s+(P\d{3,})\s+(L\d{4,})→(L\d{4,})$/.exec(action);
  if (update) {
    const [, residenceId, personId, oldPlaceId, placeId] = update;
    const row = residenceById.get(residenceId);
    if (!row || row["person-id"] !== personId || row["place-id"] !== oldPlaceId || placeId !== expectedPlaceId || !placeById.has(placeId)) throw new Error("Invalid UPDATE residence action: " + action + ".");
    row["place-id"] = placeId;
    row["is-current"] = "TRUE";
    row["source-last-modified-date"] = sourceDate || RECORDED_AT.slice(0, 10);
    row["source-last-modified-by"] = sourceBy || "McDirectory";
    residencesUpdated += 1;
    return;
  }
  const keep = /^KEEP\s+(RS\d{4,})\s+(P\d{3,})→(L\d{4,})$/.exec(action);
  if (keep) {
    const [, residenceId, personId, placeId] = keep;
    const row = residenceById.get(residenceId);
    if (!row || row["person-id"] !== personId || row["place-id"] !== placeId || placeId !== expectedPlaceId) throw new Error("Invalid KEEP residence action: " + action + ".");
    residencesKept += 1;
    return;
  }
  throw new Error("Unsupported residence action: " + action + ".");
}

for (const reportRow of reportRows) {
  if (!["READY", "REVIEW", "BLOCKED"].includes(reportRow["review-status"])) throw new Error("Invalid review status on " + reportRow["report-row"] + ".");
  if (!["ADDRESS", "CONTACT ONLY"].includes(reportRow["record-type"])) throw new Error("Invalid record type on " + reportRow["report-row"] + ".");
  if (reportRow["review-status"] === "REVIEW") acceptedReviewRows += 1;
  if (reportRow["review-status"] === "BLOCKED") {
    if (reportRow["record-type"] === "ADDRESS") throw new Error("The approved report still contains a blocked address row: " + reportRow["report-row"] + ".");
    blockedRowsOmitted += 1;
    continue;
  }
  assignmentPairs(reportRow["phone-assignments"]).forEach(item => applyContact(item.personId, item.value, "phone"));
  assignmentPairs(reportRow["email-assignments"]).forEach(item => applyContact(item.personId, item.value, "email"));
  if (reportRow["record-type"] !== "ADDRESS") continue;
  const placeId = reportRow["proposed-place-id"];
  if (!/^L\d{4,}$/.test(placeId)) throw new Error("Invalid proposed place ID on " + reportRow["report-row"] + ".");
  let place = placeById.get(placeId);
  if (reportRow["place-action"] === "CREATE") {
    if (place) throw new Error("The report tries to recreate existing place " + placeId + ".");
    place = Object.fromEntries(PLACE_HEADERS.map(header => [header, ""]));
    places.push(place);
    placeById.set(placeId, place);
    placesCreated += 1;
  } else if (reportRow["place-action"] === "UPDATE") {
    if (!place) throw new Error("The report tries to update missing place " + placeId + ".");
    placesUpdated += 1;
  } else throw new Error("Invalid place action on " + reportRow["report-row"] + ".");
  const modifiedBy = reportSourceValues(reportRow["source-last-modified-by"]).join("; ");
  const modifiedDate = latestDate(reportRow["source-last-modified-date"]);
  Object.assign(place, {
    "place-id": placeId, "place-label": "Home", "address-line-1": reportRow["address-line-1"], "address-line-2": reportRow["address-line-2"],
    city: reportRow.city, region: reportRow.region, "postal-code": reportRow["postal-code"], country: reportRow.country, notes: "",
    "source-last-modified-date": modifiedDate, "source-last-modified-by": modifiedBy,
    "source-row-number": reportRow["source-row-number"], "source-pcard": reportSourceValues(reportRow.pcard).join("; "),
    "source-notes": reportSourceValues(reportRow["source-notes"]).join("; ")
  });
  const actions = clean(reportRow["residence-actions"]).split(/;\s+(?=(?:CREATE|UPDATE|KEEP)\s)/).filter(Boolean);
  const assignedIds = splitValues(reportRow["assigned-person-ids"]);
  if (!assignedIds.length || actions.length !== assignedIds.length) throw new Error("Residence actions do not match assigned people on " + reportRow["report-row"] + ".");
  actions.forEach(action => applyResidenceAction(action, placeId, modifiedDate, modifiedBy));
}

const currentResidencePeople = new Set();
for (const residence of residences) {
  if (!personIds.has(residence["person-id"]) || !placeById.has(residence["place-id"])) throw new Error("A residence contains a missing reference.");
  if (residence["is-current"] === "TRUE") {
    if (currentResidencePeople.has(residence["person-id"])) throw new Error(residence["person-id"] + " has more than one current residence.");
    currentResidencePeople.add(residence["person-id"]);
  }
}

function metadataOne(type, key) {
  const matches = metadata.filter(row => row["metadata-type"] === type && row.key === key);
  if (matches.length !== 1) throw new Error("McMetadata.csv requires exactly one " + type + " / " + key + " row.");
  return matches[0];
}

function updateMetadata(type, key, value) {
  const row = metadataOne(type, key);
  row.value = String(value);
  row["recorded-at"] = RECORDED_AT;
  row["recorded-by"] = RECORDED_BY;
}

updateMetadata("package", "dataset-version", DATASET_VERSION);
updateMetadata("package", "person-count", people.length);
updateMetadata("package", "relationship-count", relationships.length);
updateMetadata("package", "place-count", places.length);
updateMetadata("package", "residence-count", residences.length);
updateMetadata("access", "access-mode", "editor");
updateMetadata("family", "updated-at", RECORDED_AT);
metadataSettings.value = JSON.stringify(settings);
metadataSettings["recorded-at"] = RECORDED_AT;
metadataSettings["recorded-by"] = RECORDED_BY;
for (const fileName of FILE_NAMES) {
  const schemaRows = metadata.filter((row) => (
    row["metadata-type"] === "schema"
    && row.subject === fileName
    && row.key === "schema-version"
  ));
  if (schemaRows.length !== 1) throw new Error(`Expected one schema-version row for ${fileName}.`);
  schemaRows[0].value = V17_SCHEMAS[fileName];
  schemaRows[0]["recorded-at"] = RECORDED_AT;
  schemaRows[0]["recorded-by"] = RECORDED_BY;
}

const usedMetadataIds = new Set(metadata.map(row => row["metadata-id"]));
function audit(idBase, subject, action, details) {
  let id = idBase;
  let suffix = 1;
  while (usedMetadataIds.has(id)) id = idBase + "_" + suffix++;
  usedMetadataIds.add(id);
  metadata.push({
    "metadata-id": id, "metadata-type": "audit", subject: subject, key: "action", value: action,
    "recorded-at": RECORDED_AT, "recorded-by": RECORDED_BY, details: details
  });
}

audit("A17ADDR", "McPlaces.csv", "created-directory-places", "Created " + placesCreated + " McDirectory address records with source row, pcard, modification, and source Notes properties; updated " + placesUpdated + " existing places.");
audit("A17RES", "McResidences.csv", "assigned-directory-residences", "Created " + residencesCreated + ", updated " + residencesUpdated + ", and retained " + residencesKept + " current Person-to-Place assignments from the approved report.");
audit("A17CONTACT", "McPeople.csv", "imported-directory-contacts", "Added " + phonesAdded + " phone values and " + emailsAdded + " email values to matched primary people without duplicating existing contacts.");
audit("A17VALID", "Dataset " + DATASET_VERSION, "validated-address-bulk-update", "Executed the approved address report, including " + acceptedReviewRows + " explicitly reviewed rows. Omitted " + blockedRowsOmitted + " blocked contact-only row rather than guessing a person match.");

const outputFiles = {
  "McPeople.csv": encodeCsv(PEOPLE_HEADERS, people),
  "McPlaces.csv": encodeCsv(PLACE_HEADERS, places),
  "McRelations.csv": encodeCsv(RELATION_HEADERS, relationships),
  "McResidences.csv": encodeCsv(RESIDENCE_HEADERS, residences),
  "McMetadata.csv": encodeCsv(METADATA_HEADERS, metadata)
};

const exactIds = (rows, key, expression, label) => {
  const ids = rows.map(row => row[key]);
  if (new Set(ids).size !== ids.length || ids.some(id => !expression.test(id))) throw new Error(label + " IDs are invalid or duplicated.");
};
exactIds(places, "place-id", /^L\d{4,}$/, "Place");
exactIds(residences, "residence-id", /^RS\d{4,}$/, "Residence");
if (metadataOne("package", "dataset-version").value !== DATASET_VERSION) throw new Error("The dataset version did not update.");
if (Number(metadataOne("package", "place-count").value) !== places.length || Number(metadataOne("package", "residence-count").value) !== residences.length) throw new Error("Metadata counts do not match.");

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, zipStore(outputFiles));
const verified = unzipArchive(fs.readFileSync(OUTPUT));
FILE_NAMES.forEach(fileName => parseCsv(verified.get(fileName), V17_HEADERS[fileName], fileName + " output"));

console.log(JSON.stringify({
  output: OUTPUT, datasetVersion: DATASET_VERSION, sourceDataset: SOURCE_DATASET_VERSION, people: people.length, relationships: relationships.length,
  places: places.length, residences: residences.length, placesCreated, placesUpdated, residencesCreated, residencesUpdated, residencesKept,
  phonesAdded, emailsAdded, acceptedReviewRows, blockedRowsOmitted, metadataRows: metadata.length
}, null, 2));
