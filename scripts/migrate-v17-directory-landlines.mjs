import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const INPUT = process.argv[2] || "data/backups/McFamily-17-0-1-2026-08-26.zip";
const REPORT = process.argv[3] || "data/McDirectory-address-assignment-report.csv";
const OUTPUT = process.argv[4] || "data/backups/McFamily-17-0-2-2026-08-26.zip";
const DATASET_VERSION = process.argv[5] || "17.0.2";
const RECORDED_AT = new Date().toISOString();
const RECORDED_BY = "Admin";
const FILE_NAMES = ["McPeople.csv", "McPlaces.csv", "McRelations.csv", "McResidences.csv", "McMetadata.csv"];

const PLACE_HEADERS = [
  "place-id", "place-label", "address-line-1", "address-line-2", "city", "region", "postal-code", "country", "notes",
  "source-last-modified-date", "source-last-modified-by", "source-row-number", "source-pcard", "source-notes"
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
  let endOffset = -1;
  for (let cursor = archive.length - 22; cursor >= Math.max(0, archive.length - 65557); cursor -= 1) {
    if (archive.readUInt32LE(cursor) === 0x06054b50) { endOffset = cursor; break; }
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

function assignmentPairs(value) {
  const source = clean(value);
  if (!source) return [];
  return source.split(/;\s+(?=P\d{3,}:)/).map(item => {
    const match = /^(P\d{3,}):\s*(.+)$/.exec(item);
    if (!match) throw new Error("Invalid phone assignment: " + item + ".");
    return { personId: match[1], value: clean(match[2]) };
  });
}

function phoneDigits(value) {
  let digits = clean(value).replace(/\D/g, "");
  if (digits.length >= 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits;
}

function formatPhone(value) {
  const digits = phoneDigits(value);
  if (digits.length < 10) return "";
  const number = digits.slice(0, 10);
  return number.slice(0, 3) + "-" + number.slice(3, 6) + "-" + number.slice(6);
}

function hasDetailValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(clean(value));
}

const sourceFiles = unzipArchive(fs.readFileSync(INPUT));
const places = parseCsv(sourceFiles.get("McPlaces.csv"), PLACE_HEADERS, "McPlaces.csv");
const residences = parseCsv(sourceFiles.get("McResidences.csv"), RESIDENCE_HEADERS, "McResidences.csv");
const metadata = parseCsv(sourceFiles.get("McMetadata.csv"), METADATA_HEADERS, "McMetadata.csv");
const reportRows = parseCsv(fs.readFileSync(REPORT, "utf8"), REPORT_HEADERS, "Address assignment report");
const placeIds = new Set(places.map(row => row["place-id"]));
const placeIdByAddress = new Map(places.map(row => [[
  row["address-line-1"], row["address-line-2"], row.city, row.region, row["postal-code"], row.country
].map(value => clean(value).toLowerCase()).join("|"), row["place-id"]]));

function metadataOne(type, key) {
  const matches = metadata.filter(row => row["metadata-type"] === type && row.key === key);
  if (matches.length !== 1) throw new Error("McMetadata.csv requires exactly one " + type + " / " + key + " row.");
  return matches[0];
}

const sourceDataset = metadataOne("package", "dataset-version").value;
if (!/^17\.0\.\d+$/.test(sourceDataset) || !/^17\.0\.\d+$/.test(DATASET_VERSION)) throw new Error("This migration accepts only dataset 17.0.x packages.");
const settingsRow = metadataOne("family", "settings-json");
let settings;
try { settings = JSON.parse(settingsRow.value || "{}"); }
catch (error) { throw new Error("McMetadata.csv settings-json is invalid."); }
settings.personDetails = settings.personDetails && typeof settings.personDetails === "object" && !Array.isArray(settings.personDetails) ? settings.personDetails : {};
settings.placeDetails = settings.placeDetails && typeof settings.placeDetails === "object" && !Array.isArray(settings.placeDetails) ? settings.placeDetails : {};

const sourcePhonesByPerson = new Map();
const phoneByPlace = new Map();
const omitted = [];
const splitPlaceByReportPerson = new Map();
let placesSplit = 0;
let residencesReassigned = 0;
let nextPlaceNumber = Math.max.apply(null, places.map(row => Number(row["place-id"].slice(1)) || 0)) + 1;

function reportAddressKey(reportRow) {
  return [
    reportRow["address-line-1"], reportRow["address-line-2"], reportRow.city, reportRow.region, reportRow["postal-code"], reportRow.country
  ].map(value => clean(value).toLowerCase()).join("|");
}

function resolveReportPlace(reportRow) {
  return placeIds.has(reportRow["proposed-place-id"]) ? reportRow["proposed-place-id"] : placeIdByAddress.get(reportAddressKey(reportRow));
}

for (const reportRow of reportRows) {
  if (reportRow["record-type"] !== "ADDRESS" || reportRow["review-status"] === "BLOCKED") continue;
  const pairs = assignmentPairs(reportRow["phone-assignments"]).filter(pair => formatPhone(pair.value));
  const distinctPhones = new Set(pairs.map(pair => formatPhone(pair.value)));
  if (distinctPhones.size <= 1) continue;
  const basePlaceId = resolveReportPlace(reportRow);
  if (!basePlaceId) {
    pairs.forEach(pair => omitted.push({ reportRow: reportRow["report-row"], personId: pair.personId, reason: "source address is no longer present" }));
    continue;
  }
  const evidenceRowByPerson = new Map();
  clean(reportRow["assignment-evidence"]).split(/;\s+(?=P\d{3,}:)/).forEach(item => {
    const match = /^(P\d{3,}):.*?\brow\s+(\d+)\b/i.exec(item);
    if (match) evidenceRowByPerson.set(match[1], match[2]);
  });
  const groups = new Map();
  pairs.forEach(pair => {
    const sourceRow = evidenceRowByPerson.get(pair.personId);
    if (!sourceRow) throw new Error("Cannot split conflicting phones on " + reportRow["report-row"] + " without source-row evidence.");
    if (!groups.has(sourceRow)) groups.set(sourceRow, { sourceRow: sourceRow, phone: formatPhone(pair.value), people: [] });
    const group = groups.get(sourceRow);
    if (group.phone !== formatPhone(pair.value)) throw new Error("One source row has conflicting phones on " + reportRow["report-row"] + ".");
  });
  const basePlace = places.find(place => place["place-id"] === basePlaceId);
  Array.from(groups.values()).sort(function (a, b) { return Number(a.sourceRow) - Number(b.sourceRow); }).forEach(function (group, index) {
    let targetPlaceId = basePlaceId;
    if (index > 0) {
      do { targetPlaceId = "L" + String(nextPlaceNumber++).padStart(4, "0"); } while (placeIds.has(targetPlaceId));
      const clone = Object.assign({}, basePlace, { "place-id": targetPlaceId, "source-row-number": group.sourceRow });
      places.push(clone);
      placeIds.add(targetPlaceId);
      placesSplit += 1;
    } else basePlace["source-row-number"] = group.sourceRow;
    evidenceRowByPerson.forEach(function (sourceRow, personId) {
      if (sourceRow === group.sourceRow) splitPlaceByReportPerson.set(reportRow["report-row"] + "|" + personId, targetPlaceId);
    });
  });
  residences.forEach(function (residence) {
    if (residence["place-id"] !== basePlaceId) return;
    const targetPlaceId = splitPlaceByReportPerson.get(reportRow["report-row"] + "|" + residence["person-id"]);
    if (targetPlaceId && targetPlaceId !== basePlaceId) {
      residence["place-id"] = targetPlaceId;
      residencesReassigned += 1;
    }
  });
}

const currentPlaceByPerson = new Map();
for (const residence of residences) {
  if (residence["is-current"] !== "TRUE") continue;
  if (currentPlaceByPerson.has(residence["person-id"])) throw new Error(residence["person-id"] + " has more than one current residence.");
  currentPlaceByPerson.set(residence["person-id"], residence["place-id"]);
}

function rememberPersonPhone(personId, value) {
  if (!sourcePhonesByPerson.has(personId)) sourcePhonesByPerson.set(personId, new Set());
  sourcePhonesByPerson.get(personId).add(phoneDigits(value));
}

function rememberPlacePhone(placeId, value, reportRow, omitOnConflict) {
  if (!placeIds.has(placeId)) throw new Error("Phone assignment references missing place " + placeId + ".");
  const formatted = formatPhone(value);
  if (!formatted) {
    omitted.push({ reportRow: reportRow["report-row"], reason: "phone does not contain ten digits" });
    return;
  }
  const existing = phoneByPlace.get(placeId) || settings.placeDetails[placeId] && settings.placeDetails[placeId].phone;
  if (existing && phoneDigits(existing) !== phoneDigits(formatted)) {
    if (omitOnConflict) {
      omitted.push({ reportRow: reportRow["report-row"], reason: "contact-only phone conflicts with the address phone" });
      return;
    }
    throw new Error("Conflicting McDirectory phones resolve to " + placeId + ".");
  }
  phoneByPlace.set(placeId, formatted);
  reportRow._resolvedPlaceId = placeId;
}

for (const reportRow of reportRows) {
  const pairs = assignmentPairs(reportRow["phone-assignments"]);
  if (!pairs.length || reportRow["review-status"] === "BLOCKED") continue;
  pairs.forEach(pair => rememberPersonPhone(pair.personId, pair.value));
  if (reportRow["record-type"] === "ADDRESS") {
    const commonPlaceId = resolveReportPlace(reportRow);
    pairs.forEach(pair => {
      const placeId = splitPlaceByReportPerson.get(reportRow["report-row"] + "|" + pair.personId) || commonPlaceId;
      if (placeId) rememberPlacePhone(placeId, pair.value, reportRow);
      else omitted.push({ reportRow: reportRow["report-row"], personId: pair.personId, reason: "source address is no longer present" });
    });
    continue;
  }
  pairs.forEach(pair => {
    const placeId = currentPlaceByPerson.get(pair.personId);
    if (placeId) rememberPlacePhone(placeId, pair.value, reportRow, true);
    else omitted.push({ reportRow: reportRow["report-row"], personId: pair.personId, reason: "no current address is recorded" });
  });
}

let personPhonesRemoved = 0;
let peopleChanged = 0;
for (const [personId, sourcePhones] of sourcePhonesByPerson) {
  const details = settings.personDetails[personId];
  if (!details || !Array.isArray(details.phones)) continue;
  const retained = details.phones.filter(phone => {
    const remove = sourcePhones.has(phoneDigits(phone && phone.value));
    if (remove) personPhonesRemoved += 1;
    return !remove;
  });
  if (retained.length === details.phones.length) continue;
  peopleChanged += 1;
  if (retained.length) details.phones = retained;
  else delete details.phones;
  if (!Object.values(details).some(hasDetailValue)) delete settings.personDetails[personId];
}

for (const [placeId, phone] of phoneByPlace) settings.placeDetails[placeId] = { phone: phone };
for (const [placeId, details] of Object.entries(settings.placeDetails)) {
  if (!placeIds.has(placeId)) throw new Error("placeDetails contains missing place " + placeId + ".");
  if (!details || Object.keys(details).length !== 1 || formatPhone(details.phone) !== details.phone) throw new Error("placeDetails " + placeId + " must contain one formatted phone.");
}

for (const [personId, sourcePhones] of sourcePhonesByPerson) {
  const remaining = settings.personDetails[personId] && settings.personDetails[personId].phones || [];
  if (remaining.some(phone => sourcePhones.has(phoneDigits(phone && phone.value)))) throw new Error("A migrated McDirectory phone remains attached to " + personId + ".");
}
if (new Set(places.map(place => place["place-id"])).size !== places.length) throw new Error("The migrated places contain duplicate IDs.");
if (residences.some(residence => !placeIds.has(residence["place-id"]))) throw new Error("A migrated residence references a missing place.");

function updateMetadata(type, key, value) {
  const row = metadataOne(type, key);
  row.value = String(value);
  row["recorded-at"] = RECORDED_AT;
  row["recorded-by"] = RECORDED_BY;
}

updateMetadata("package", "dataset-version", DATASET_VERSION);
updateMetadata("package", "place-count", places.length);
updateMetadata("family", "updated-at", RECORDED_AT);
settingsRow.value = JSON.stringify(settings);
settingsRow["recorded-at"] = RECORDED_AT;
settingsRow["recorded-by"] = RECORDED_BY;

const usedMetadataIds = new Set(metadata.map(row => row["metadata-id"]));
let auditId = "A17LANDLINE";
let suffix = 1;
while (usedMetadataIds.has(auditId)) auditId = "A17LANDLINE_" + suffix++;
metadata.push({
  "metadata-id": auditId,
  "metadata-type": "audit",
  subject: "Dataset " + DATASET_VERSION,
  key: "action",
  value: "migrated-directory-landlines",
  "recorded-at": RECORDED_AT,
  "recorded-by": RECORDED_BY,
  details: "Moved " + phoneByPlace.size + " McDirectory home phone values to address records and removed " + personPhonesRemoved + " matching person contact entries across " + peopleChanged + " people. Split " + placesSplit + " ambiguous shared-address records and reassigned " + residencesReassigned + " residences so different household landlines remain address-owned. Omitted " + omitted.length + " source phones whose original address is no longer present or was never recorded."
});

const outputFiles = Object.fromEntries(FILE_NAMES.map(name => [name, sourceFiles.get(name)]));
outputFiles["McPlaces.csv"] = encodeCsv(PLACE_HEADERS, places);
outputFiles["McResidences.csv"] = encodeCsv(RESIDENCE_HEADERS, residences);
outputFiles["McMetadata.csv"] = encodeCsv(METADATA_HEADERS, metadata);
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, zipStore(outputFiles));

const verifiedFiles = unzipArchive(fs.readFileSync(OUTPUT));
const verifiedPlaces = parseCsv(verifiedFiles.get("McPlaces.csv"), PLACE_HEADERS, "McPlaces.csv output");
parseCsv(verifiedFiles.get("McResidences.csv"), RESIDENCE_HEADERS, "McResidences.csv output");
const verifiedMetadata = parseCsv(verifiedFiles.get("McMetadata.csv"), METADATA_HEADERS, "McMetadata.csv output");
const verifiedSettingsRow = verifiedMetadata.find(row => row["metadata-type"] === "family" && row.key === "settings-json");
const verifiedSettings = JSON.parse(verifiedSettingsRow.value);
if (verifiedMetadata.find(row => row["metadata-type"] === "package" && row.key === "dataset-version").value !== DATASET_VERSION) throw new Error("The output dataset version did not verify.");
if (Number(verifiedMetadata.find(row => row["metadata-type"] === "package" && row.key === "place-count").value) !== verifiedPlaces.length) throw new Error("The output place count did not verify.");
if (Object.keys(verifiedSettings.placeDetails || {}).length < phoneByPlace.size) throw new Error("The output place phone count did not verify.");

console.log(JSON.stringify({
  input: INPUT,
  output: OUTPUT,
  sourceDataset: sourceDataset,
  datasetVersion: DATASET_VERSION,
  sourcePhoneAssignments: Array.from(sourcePhonesByPerson.values()).reduce((total, values) => total + values.size, 0),
  addressPhonesWritten: phoneByPlace.size,
  personPhonesRemoved: personPhonesRemoved,
  peopleChanged: peopleChanged,
  placesSplit: placesSplit,
  residencesReassigned: residencesReassigned,
  omittedWithoutAddress: omitted.length
}, null, 2));
