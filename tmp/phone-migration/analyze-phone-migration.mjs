import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

function clean(value) {
  return String(value == null ? "" : value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
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
  row.push(cell);
  if (row.some((value) => value !== "")) matrix.push(row);
  const headers = matrix.shift();
  return matrix.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function phoneDigits(value) {
  let digits = clean(value).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function reportPhonePersonIds(value) {
  return Array.from(new Set((clean(value).match(/P\d{3,}/g) || [])));
}

function addressKey(source) {
  return [source.Street ?? source["address-line-1"], source.Street2 ?? source["address-line-2"], source.City ?? source.city, source.State ?? source.region, source.Zip ?? source["postal-code"]]
    .map((value) => clean(value).toLowerCase().replace(/[.,]+$/g, ""))
    .filter(Boolean)
    .join("|");
}

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load("../../data/!McDirectory.xlsx"));
const values = workbook.worksheets.getItem("Directory").getUsedRange(true).values;
const headers = values[0].map((value) => String(value ?? ""));
const workbookRows = values.slice(1).map((row, index) => ({ rowNumber: index + 2, values: Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""])) })).filter((entry) => Object.values(entry.values).some(Boolean));
const phoneRows = workbookRows.filter((entry) => clean(entry.values.Phone));

const people = parseCsv(await fs.readFile("package171/McPeople.csv", "utf8"));
const places = parseCsv(await fs.readFile("package171/McPlaces.csv", "utf8"));
const residences = parseCsv(await fs.readFile("package171/McResidences.csv", "utf8"));
const metadata = parseCsv(await fs.readFile("package171/McMetadata.csv", "utf8"));
const report = parseCsv(await fs.readFile("../../data/McDirectory-address-assignment-report.csv", "utf8"));
const settingsRow = metadata.find((row) => row["metadata-type"] === "family" && row.key === "settings-json");
const settings = JSON.parse(settingsRow.value || "{}");
const peopleById = new Map(people.map((row) => [row["record-id"], row]));
const placesById = new Map(places.map((row) => [row["place-id"], row]));
const residencesByPerson = new Map();
for (const residence of residences) {
  if (!residencesByPerson.has(residence["person-id"])) residencesByPerson.set(residence["person-id"], []);
  residencesByPerson.get(residence["person-id"]).push(residence);
}
const placesBySourceRow = new Map();
for (const place of places) {
  const rowNumbers = clean(place["source-row-number"]).match(/\d+/g) || [];
  for (const number of rowNumbers) {
    if (!placesBySourceRow.has(Number(number))) placesBySourceRow.set(Number(number), []);
    placesBySourceRow.get(Number(number)).push(place);
  }
}
const placesByAddress = new Map();
for (const place of places) {
  const key = addressKey(place);
  if (!placesByAddress.has(key)) placesByAddress.set(key, []);
  placesByAddress.get(key).push(place);
}
const reportsBySourceRow = new Map();
for (const reportRow of report) {
  const rowNumbers = clean(reportRow["source-row-number"]).match(/\d+/g) || [];
  for (const number of rowNumbers) reportsBySourceRow.set(Number(number), reportRow);
}

const assignments = [];
for (const entry of phoneRows) {
  const row = entry.values;
  const candidates = new Map();
  const add = (place, evidence) => { if (place) candidates.set(place["place-id"], { place, evidence }); };
  (placesBySourceRow.get(entry.rowNumber) || []).forEach((place) => add(place, "source-row"));
  const key = addressKey(row);
  if (key) (placesByAddress.get(key) || []).forEach((place) => add(place, "address"));
  const reportRow = reportsBySourceRow.get(entry.rowNumber);
  if (reportRow && placesById.has(reportRow["proposed-place-id"])) add(placesById.get(reportRow["proposed-place-id"]), "report");
  if (!candidates.size && reportRow) {
    const ids = Array.from(new Set((clean(reportRow["assigned-person-ids"]).match(/P\d{3,}/g) || []).concat(reportPhonePersonIds(reportRow["phone-assignments"]))));
    for (const personId of ids) {
      const current = (residencesByPerson.get(personId) || []).filter((residence) => residence["is-current"] === "TRUE");
      current.forEach((residence) => add(placesById.get(residence["place-id"]), "assigned-person-current-residence"));
    }
  }
  assignments.push({
    rowNumber: entry.rowNumber,
    phone: clean(row.Phone),
    digits: phoneDigits(row.Phone),
    address: key,
    reportStatus: reportRow && reportRow["review-status"] || "",
    reportType: reportRow && reportRow["record-type"] || "",
    reportPersonIds: reportRow ? reportPhonePersonIds(reportRow["phone-assignments"]) : [],
    sourceModified: row.Mod_Date || "",
    sourceName: [row["Lineage::D_Fname"], row["Lineage::D_Lname"]].map(clean).filter(Boolean).join(" "),
    candidates: Array.from(candidates.values()).map((candidate) => ({ placeId: candidate.place["place-id"], evidence: candidate.evidence })),
  });
}

const byPlace = new Map();
for (const assignment of assignments) {
  if (assignment.candidates.length !== 1) continue;
  const placeId = assignment.candidates[0].placeId;
  if (!byPlace.has(placeId)) byPlace.set(placeId, []);
  byPlace.get(placeId).push(assignment);
}
const conflicts = Array.from(byPlace, ([placeId, rows]) => ({ placeId, phones: Array.from(new Set(rows.map((row) => row.digits))), rows: rows.map((row) => row.rowNumber) })).filter((entry) => entry.phones.length > 1);
const personPhones = [];
for (const [personId, details] of Object.entries(settings.personDetails || {})) {
  for (const phone of Array.isArray(details.phones) ? details.phones : []) personPhones.push({ personId, value: clean(phone.value), digits: phoneDigits(phone.value), label: clean(phone.label) });
}
const workbookDigits = new Set(assignments.map((entry) => entry.digits).filter(Boolean));
const matchingPersonPhones = personPhones.filter((entry) => workbookDigits.has(entry.digits));
const unresolved = assignments.filter((entry) => entry.candidates.length !== 1);
const invalidPhones = assignments.filter((entry) => clean(phoneRows.find((row) => row.rowNumber === entry.rowNumber)?.values.Phone).replace(/\D/g, "").length < 10);
const existingPlaceDetails = settings.placeDetails || {};

process.stdout.write(JSON.stringify({
  dataset: metadata.find((row) => row["metadata-type"] === "package" && row.key === "dataset-version")?.value,
  counts: { workbookRows: workbookRows.length, phoneRows: phoneRows.length, places: places.length, residences: residences.length, personPhoneRecords: personPhones.length, matchingPersonPhones: matchingPersonPhones.length, uniquelyMappedPhoneRows: assignments.length - unresolved.length, uniqueTargetPlaces: byPlace.size, conflicts: conflicts.length, invalidPhones: invalidPhones.length, existingPlacePhones: Object.keys(existingPlaceDetails).length },
  unresolved,
  conflicts,
  invalidPhones,
  matchingPersonPhoneSamples: matchingPersonPhones.slice(0, 15),
  mappedSamples: assignments.filter((entry) => entry.candidates.length === 1).slice(0, 12),
}, null, 2) + "\n");
