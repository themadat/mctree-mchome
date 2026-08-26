import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const PACKAGE_DIR = "package171";
const WORKBOOK_PATH = "../../data/!McDirectory.xlsx";
const REPORT_PATH = "../../data/McDirectory-address-assignment-report.csv";
const OUTPUT_PATH = "../../data/backups/McFamily-17-0-2-2026-08-26.zip";
const VALIDATION_PATH = "../../data/McDirectory-phone-migration-17-0-2.json";
const FILE_NAMES = ["McPeople.csv", "McPlaces.csv", "McRelations.csv", "McResidences.csv", "McMetadata.csv"];
const TARGET_VERSION = "17.0.2";
const RECORDED_AT = new Date().toISOString();
const RECORDED_BY = "Admin";

function clean(value) {
  return String(value == null ? "" : value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function rawPhoneDigits(value) {
  let digits = clean(value).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits;
}

function formatPhone(value) {
  const digits = rawPhoneDigits(value).slice(0, 10);
  return digits.length === 10 ? digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6) : "";
}

function addressKey(source) {
  return [source.Street ?? source["address-line-1"], source.Street2 ?? source["address-line-2"], source.City ?? source.city, source.State ?? source.region, source.Zip ?? source["postal-code"]]
    .map((value) => clean(value).toLowerCase().replace(/[.,]+$/g, ""))
    .filter(Boolean)
    .join("|");
}

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
  if (quoted) throw new Error("CSV ends inside a quoted field.");
  row.push(cell);
  if (row.some((value) => value !== "")) matrix.push(row);
  if (!matrix.length) throw new Error("CSV is empty.");
  const headers = matrix.shift();
  const rows = matrix.map((values, rowIndex) => {
    if (values.length > headers.length || values.slice(headers.length).some(Boolean)) throw new Error("CSV row " + (rowIndex + 2) + " has too many values.");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
  return { headers, rows };
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
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
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
  }
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(FILE_NAMES.length, 8);
  end.writeUInt16LE(FILE_NAMES.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat(localParts.concat(centralParts, end));
}

const parsedFiles = {};
for (const fileName of FILE_NAMES) parsedFiles[fileName] = parseCsv(await fs.readFile(path.join(PACKAGE_DIR, fileName), "utf8"));
const people = parsedFiles["McPeople.csv"].rows;
const places = parsedFiles["McPlaces.csv"].rows;
const metadata = parsedFiles["McMetadata.csv"].rows;
const packageVersionRow = metadata.find((row) => row["metadata-type"] === "package" && row.key === "dataset-version");
if (!packageVersionRow || packageVersionRow.value !== "17.0.1") throw new Error("The private source must be the current hosted dataset 17.0.1 package.");

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(WORKBOOK_PATH));
const worksheetValues = workbook.worksheets.getItem("Directory").getUsedRange(true).values;
const workbookHeaders = worksheetValues[0].map((value) => String(value ?? ""));
const workbookRows = worksheetValues.slice(1).map((values, index) => ({ rowNumber: index + 2, values: Object.fromEntries(workbookHeaders.map((header, column) => [header, values[column] ?? ""])) })).filter((entry) => Object.values(entry.values).some(Boolean));
const phoneRows = workbookRows.filter((entry) => clean(entry.values.Phone));
if (phoneRows.length !== 161) throw new Error("Expected 161 phone-bearing workbook rows; found " + phoneRows.length + ".");

const report = parseCsv(await fs.readFile(REPORT_PATH, "utf8")).rows;
const reportBySourceRow = new Map();
for (const row of report) {
  for (const number of clean(row["source-row-number"]).match(/\d+/g) || []) reportBySourceRow.set(Number(number), row);
}
const placeById = new Map(places.map((place) => [place["place-id"], place]));
const placesBySourceRow = new Map();
const placesByAddress = new Map();
for (const place of places) {
  for (const number of clean(place["source-row-number"]).match(/\d+/g) || []) {
    if (!placesBySourceRow.has(Number(number))) placesBySourceRow.set(Number(number), []);
    placesBySourceRow.get(Number(number)).push(place);
  }
  const key = addressKey(place);
  if (key) {
    if (!placesByAddress.has(key)) placesByAddress.set(key, []);
    placesByAddress.get(key).push(place);
  }
}

const migrations = [];
for (const entry of phoneRows) {
  const source = entry.values;
  const reportRow = reportBySourceRow.get(entry.rowNumber);
  const candidates = new Map();
  const add = (place, evidence) => { if (place) candidates.set(place["place-id"], { place, evidence }); };
  (placesBySourceRow.get(entry.rowNumber) || []).forEach((place) => add(place, "Place source row"));
  if (reportRow && placeById.has(reportRow["proposed-place-id"])) add(placeById.get(reportRow["proposed-place-id"]), "approved address report");
  const key = addressKey(source);
  if (key) (placesByAddress.get(key) || []).forEach((place) => add(place, "exact physical address"));
  if (candidates.size > 1) throw new Error("Workbook row " + entry.rowNumber + " maps to multiple current Places.");
  const rawDigits = rawPhoneDigits(source.Phone);
  const candidate = Array.from(candidates.values())[0] || null;
  migrations.push({
    sourceRow: entry.rowNumber,
    sourcePhone: clean(source.Phone),
    formattedPhone: formatPhone(source.Phone),
    sourceModified: Number(source.Mod_Date) || 0,
    sourcePersonIds: reportRow ? Array.from(new Set((clean(reportRow["phone-assignments"]).match(/P\d{3,}/g) || []))) : [],
    targetPlaceId: candidate && candidate.place["place-id"] || "",
    evidence: candidate && candidate.evidence || "",
    status: rawDigits.length < 10 ? "skipped-incomplete" : candidate ? "candidate" : "skipped-no-current-address"
  });
}

const candidatesByPlace = new Map();
for (const migration of migrations.filter((item) => item.status === "candidate")) {
  if (!candidatesByPlace.has(migration.targetPlaceId)) candidatesByPlace.set(migration.targetPlaceId, []);
  candidatesByPlace.get(migration.targetPlaceId).push(migration);
}
const selectedByPlace = new Map();
for (const [placeId, candidates] of candidatesByPlace) {
  candidates.sort((left, right) => right.sourceModified - left.sourceModified || right.sourceRow - left.sourceRow);
  const selected = candidates[0];
  selected.status = "assigned-to-address";
  selectedByPlace.set(placeId, selected);
  candidates.slice(1).forEach((candidate) => {
    candidate.status = candidate.formattedPhone === selected.formattedPhone ? "duplicate-address-phone" : "superseded-by-newer-address-phone";
  });
}

const settingsRow = metadata.find((row) => row["metadata-type"] === "family" && row.key === "settings-json");
if (!settingsRow) throw new Error("McMetadata.csv has no settings-json row.");
const settings = JSON.parse(settingsRow.value || "{}");
settings.personDetails = settings.personDetails && typeof settings.personDetails === "object" && !Array.isArray(settings.personDetails) ? settings.personDetails : {};
settings.placeDetails = settings.placeDetails && typeof settings.placeDetails === "object" && !Array.isArray(settings.placeDetails) ? settings.placeDetails : {};
const workbookPhoneDigits = new Set(migrations.map((item) => rawPhoneDigits(item.sourcePhone)).filter(Boolean));
let removedPersonPhones = 0;
for (const details of Object.values(settings.personDetails)) {
  if (!details || typeof details !== "object" || !Array.isArray(details.phones)) continue;
  const kept = details.phones.filter((phone) => {
    const remove = workbookPhoneDigits.has(rawPhoneDigits(phone && phone.value));
    if (remove) removedPersonPhones += 1;
    return !remove;
  });
  details.phones = kept.map((phone, index) => Object.assign({}, phone, { value: formatPhone(phone.value) || clean(phone.value), order: index }));
}
for (const [placeId, selected] of selectedByPlace) settings.placeDetails[placeId] = { phone: selected.formattedPhone };
if (removedPersonPhones !== 160) throw new Error("Expected to remove 160 imported person phone records; removed " + removedPersonPhones + ".");

packageVersionRow.value = TARGET_VERSION;
packageVersionRow["recorded-at"] = RECORDED_AT;
packageVersionRow["recorded-by"] = RECORDED_BY;
const familyUpdatedRow = metadata.find((row) => row["metadata-type"] === "family" && row.key === "updated-at");
if (familyUpdatedRow) {
  familyUpdatedRow.value = RECORDED_AT;
  familyUpdatedRow["recorded-at"] = RECORDED_AT;
  familyUpdatedRow["recorded-by"] = RECORDED_BY;
}
settingsRow.value = JSON.stringify(settings);
settingsRow["recorded-at"] = RECORDED_AT;
settingsRow["recorded-by"] = RECORDED_BY;

const usedMetadataIds = new Set(metadata.map((row) => row["metadata-id"]));
function addAudit(idBase, subject, action, details) {
  let id = idBase;
  let suffix = 1;
  while (usedMetadataIds.has(id)) id = idBase + String(suffix++);
  usedMetadataIds.add(id);
  metadata.push({ "metadata-id": id, "metadata-type": "audit", subject, key: "action", value: action, "recorded-at": RECORDED_AT, "recorded-by": RECORDED_BY, details });
}
const skippedNoAddress = migrations.filter((item) => item.status === "skipped-no-current-address").length;
const skippedIncomplete = migrations.filter((item) => item.status === "skipped-incomplete").length;
const superseded = migrations.filter((item) => item.status === "superseded-by-newer-address-phone").length;
addAudit("A17PHONE", "McPlaces.csv", "assigned-directory-address-phones", "Assigned " + selectedByPlace.size + " formatted McDirectory phone numbers to current physical Places. Where duplicate source rows disagreed for one Place, the newest modified row was used (" + superseded + " superseded values).");
addAudit("A17PHONEPERSON", "McPeople.csv", "removed-directory-person-phones", "Removed " + removedPersonPhones + " McDirectory Home/Landline values from individual people so address phone ownership is authoritative.");
addAudit("A17PHONEVALID", "Dataset " + TARGET_VERSION, "validated-address-phone-bulk-update", "Skipped " + skippedNoAddress + " source phone rows whose physical address is not present in the current hosted record and " + skippedIncomplete + " incomplete source value. No Place or relationship reference was invented.");

const outputFiles = Object.fromEntries(FILE_NAMES.map((fileName) => [fileName, encodeCsv(parsedFiles[fileName].headers, parsedFiles[fileName].rows)]));
await fs.writeFile(OUTPUT_PATH, zipStore(outputFiles));

const validation = {
  inputDatasetVersion: "17.0.1",
  outputDatasetVersion: TARGET_VERSION,
  workbookPhoneRows: phoneRows.length,
  placePhonesAssigned: selectedByPlace.size,
  personPhonesRemoved: removedPersonPhones,
  skippedNoCurrentAddress: skippedNoAddress,
  skippedIncomplete,
  supersededConflicts: superseded,
  people: people.length,
  places: places.length,
  residences: parsedFiles["McResidences.csv"].rows.length,
  relationships: parsedFiles["McRelations.csv"].rows.length,
  migrations
};
await fs.writeFile(VALIDATION_PATH, JSON.stringify(validation, null, 2) + "\n");
process.stdout.write(JSON.stringify({ output: OUTPUT_PATH, validation: VALIDATION_PATH, ...Object.fromEntries(Object.entries(validation).filter(([key]) => key !== "migrations")) }, null, 2) + "\n");
