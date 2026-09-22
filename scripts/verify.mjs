#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const fail = (message) => { throw new Error(message); };
const filesBelow = (path) => readdirSync(resolve(root, path), { withFileTypes: true }).flatMap((entry) => {
  const child = path + "/" + entry.name;
  return entry.isDirectory() ? filesBelow(child) : [child];
});

const runtimeJs = filesBelow("assets/js").filter((path) => extname(path) === ".js").concat("sw.js");
runtimeJs.forEach((path) => execFileSync(process.execPath, ["--check", resolve(root, path)], { stdio: "pipe" }));

const sandbox = { window: {} };
vm.runInNewContext(read("assets/js/config.js"), sandbox, { filename: "config.js" });
const config = sandbox.window.LocalApp && sandbox.window.LocalApp.config;
if (!config) fail("config.js did not expose LocalApp.config");
if (config.identity.version !== config.identity.buildId) fail("Application version and build id differ");
if (config.releases.length !== 1 || config.releases[0].version !== config.identity.version) fail("Current release metadata is not singular or current");
if (config.parentKinds.map((item) => item.id).join(",") !== "biological,adoptive,step,foster,guardian,unknown") fail("Parent-child statuses no longer match the six supported values");
if (config.parentKinds.filter((item) => item.lineal).map((item) => item.id).join(",") !== "biological,adoptive") fail("Only Biological and Adopted may be Lineal");
if (config.themes.length !== 1) fail("Only the supported McFamily appearance should remain configured");
if (!config.datasetVersion.startsWith(config.datasetSeries + ".")) fail("Dataset version is outside the configured series");
if (config.controls.maxPrintTreeLevels !== 8 || config.controls.maxPrintTreePeopleAcross !== 10) fail("Tree print density must remain eight levels by ten people");
if (config.controls.maxPrintLineageLevels !== 12 || config.controls.maxPrintLineagePeopleAcross !== 16) fail("Lineage print density must remain twelve levels by sixteen people");
if (config.controls.maxPrintOutlineRows !== 44 || config.controls.maxPrintDirectoryFallbackRows !== 14 || config.controls.printGroupColumns !== 6) fail("Paged report preview limits are invalid");
if (!Number.isInteger(config.controls.maxPrintTreePages) || config.controls.maxPrintTreePages < 1) fail("Tree print page limit is invalid");

const documentStub = {
  createElement() {
    return { content: { textContent: "" }, set innerHTML(value) { this.content.textContent = String(value).replace(/<[^>]*>/g, ""); } };
  }
};
const runtime = {
  window: {}, document: documentStub, crypto: globalThis.crypto, structuredClone, TextEncoder, TextDecoder,
  URL, URLSearchParams, Response, Blob, DecompressionStream, setTimeout, clearTimeout, console
};
vm.createContext(runtime);
for (const path of ["assets/js/config.js", "assets/js/core/utils.js", "assets/js/core/state.js"]) vm.runInContext(read(path), runtime, { filename: path });
const App = runtime.window.LocalApp;
const currentState = App.stateModel.createDefaultState();
const oldState = structuredClone(currentState);
oldState.schemaVersion = config.schemaVersion - 1;
let rejectedOldState = false;
try { App.stateModel.prepare(oldState); } catch (error) { rejectedOldState = /no longer supported/.test(error.message); }
if (!rejectedOldState) fail("The prior application state schema was not rejected");
const normalizedDefault = App.stateModel.prepare(currentState).state;
if ("records" in normalizedDefault.workspace || "tombstones" in normalizedDefault.meta) fail("Retired state collections remain normalized");
if (normalizedDefault.ui.ancestorDepth !== 10 || normalizedDefault.ui.descendantDepth !== 10) fail("Tree depths no longer default to ten");
const legacyThreeDepth = structuredClone(currentState);
legacyThreeDepth.meta.buildId = "0.0.1.104";
legacyThreeDepth.meta.appVersion = "0.0.1.104";
legacyThreeDepth.ui.generationDepth = 3;
legacyThreeDepth.ui.descendantDepth = 3;
const migratedThreeDepth = App.stateModel.normalize(legacyThreeDepth);
if (migratedThreeDepth.ui.generationDepth !== 10 || migratedThreeDepth.ui.descendantDepth !== 10) fail("The obsolete three-level descendant default was not migrated to ten");
const currentThreeDepth = structuredClone(currentState);
currentThreeDepth.ui.generationDepth = 10;
currentThreeDepth.ui.descendantDepth = 3;
if (App.stateModel.normalize(currentThreeDepth).ui.descendantDepth !== 3) fail("A current-session descendant depth of three no longer remains user-selectable");

App.storage = {};
vm.runInContext(read("assets/js/core/portability.js"), runtime, { filename: "assets/js/core/portability.js" });
if (App.portability.isSupportedDatasetVersion("16.0.9") || !App.portability.isSupportedDatasetVersion("17.0.9")) fail("Dataset-series validation is not current-only");
const now = new Date().toISOString();
currentState.workspace.family = { title: "Synthetic Family", initializedAt: now, homePersonId: "P001" };
currentState.workspace.people = [{
  id: "P001", names: { birth: { first: "Test", last: "Person" }, current: { first: "Test", last: "Person" }, preferred: {} },
  livingStatus: "living", birth: { date: { value: "2000", qualifier: "exact" }, place: "" }, death: { date: { value: "", qualifier: "exact" }, place: "" },
  addresses: [], phones: [], emails: [], heritageNote: "", notes: "",
  source: { format: "synthetic", fields: { "person-date-birth-descriptor": "year", "person-date-death-descriptor": "NONE", "lineage-id": "01" } },
  createdAt: now, updatedAt: now, order: 0
}];
currentState.meta.package = {
  format: config.packageFormat, version: config.packageVersion, datasetVersion: config.datasetVersion, accessMode: "editor",
  auditHistory: [{ id: "A001", subject: "Synthetic", action: "created", recordedAt: now, recordedBy: "Test", details: "Synthetic fixture" }]
};
const packageBytes = App.portability.packageBytes(App.stateModel.normalize(currentState));
const roundTrip = await App.portability.prepareBytes(packageBytes, "synthetic.zip");
if (roundTrip.state.workspace.people.length !== 1 || roundTrip.state.meta.package.datasetVersion !== config.datasetVersion) fail("Synthetic current-package round trip failed");
// Shared places remain authoritative, with independent residence history and notes.
const sharedAddressFixture = structuredClone(roundTrip.state);
const secondResident = structuredClone(sharedAddressFixture.workspace.people[0]);
secondResident.id = "P002";
secondResident.source.fields["lineage-id"] = "";
sharedAddressFixture.workspace.people.push(secondResident);
sharedAddressFixture.workspace.places = [{ id: "L0001", label: "Home", line1: "1 Synthetic Street", notes: "Shared note" }];
sharedAddressFixture.workspace.residences = sharedAddressFixture.workspace.people.map((person, index) => ({
  id: "RS000" + (index + 1), personId: person.id, placeId: "L0001", current: true,
  startDate: { value: "2020", qualifier: "exact" }, endDate: { value: "", qualifier: "exact" }, notes: "Resident " + index
}));
sharedAddressFixture.workspace.places[0].line1 = "2 Synthetic Street";
const sharedAddressState = App.stateModel.prepare(sharedAddressFixture).state;
if (!sharedAddressState.workspace.people.every((person) => person.addresses[0].line1 === "2 Synthetic Street")) fail("Shared place updates do not reach every resident");
if (sharedAddressState.workspace.people[0].addresses[0].residenceNotes !== "Resident 0") fail("Residence notes are not separate from shared address notes");
sharedAddressState.workspace.residences[1].current = false;
sharedAddressState.workspace.residences[1].endDate = { value: "2026-09", qualifier: "exact" };
const movedResident = App.stateModel.prepare(sharedAddressState).state;
if (!movedResident.workspace.people[0].addresses[0].current || movedResident.workspace.people[1].addresses[0].current) fail("Moving out changes another resident's status");
movedResident.workspace.residences = [];
const unassignedAddress = App.stateModel.prepare(movedResident).state;
if (unassignedAddress.workspace.people.some((person) => person.addresses.length)) fail("Unassigning leaves a stale derived address");
const unassignedRoundTrip = await App.portability.prepareBytes(App.portability.packageBytes(unassignedAddress), "unassigned-synthetic.zip");
if (unassignedRoundTrip.state.workspace.places.length !== 1 || unassignedRoundTrip.state.workspace.residences.length) fail("Unassigned addresses do not survive a current ZIP round trip");

const compatibleParentState = structuredClone(roundTrip.state);
for (const [index, kind] of ["step", "foster", "guardian", "unknown"].entries()) {
  const child = structuredClone(compatibleParentState.workspace.people[0]);
  child.id = "P00" + (index + 2);
  child.names.birth.first = kind;
  child.names.current.first = kind;
  child.source.fields["lineage-id"] = "0" + (index + 2);
  compatibleParentState.workspace.people.push(child);
  compatibleParentState.workspace.relationships.push({ id: "R00" + (index + 1), type: "parent-child", parentId: "P001", childId: child.id, lineage: "non-lineal", kind, startDate: {}, endDate: {}, source: { fields: {} }, order: index + 1, createdAt: now, updatedAt: now });
}
const compatibleParentRoundTrip = await App.portability.prepareBytes(App.portability.packageBytes(compatibleParentState), "compatible-parent-statuses.zip");
if (compatibleParentRoundTrip.state.workspace.relationships.map((item) => item.kind).join(",") !== "step,foster,guardian,unknown") fail("A supported Non-Lineal parent status failed its package round trip");
if (!App.stateModel.relationshipIssues(compatibleParentRoundTrip.state).some((issue) => issue.relationshipId === "R004" && /Parent type is Unknown/.test(issue.reason))) fail("A Non-Lineal Unknown parent is missing from Admin cleanup");
if (!App.stateModel.lineageIssues(compatibleParentRoundTrip.state).some((issue) => issue.personId === "P002" && /only step parent status/.test(issue.reasons.join(" ")))) fail("A Step-only child with a stale Lineage ID is missing from Admin cleanup");
const invalidUnknownState = structuredClone(compatibleParentState);
invalidUnknownState.workspace.relationships.find((item) => item.kind === "unknown").lineage = "lineal";
const legacyUnknownRoundTrip = await App.portability.prepareBytes(App.portability.packageBytes(invalidUnknownState), "legacy-lineal-unknown.zip");
if (!App.stateModel.relationshipIssues(legacyUnknownRoundTrip.state).some((issue) => issue.relationshipId === "R004" && /Unknown parent/.test(issue.reason))) fail("A legacy Lineal Unknown relationship was not preserved for Admin cleanup");

const unknownPersonState = structuredClone(roundTrip.state);
const unknownPerson = structuredClone(unknownPersonState.workspace.people[0]);
unknownPerson.id = "P002";
unknownPerson.unknownPerson = true;
unknownPerson.names = { birth: {}, current: {}, preferred: {}, maidenLast: "" };
unknownPerson.livingStatus = "unknown";
unknownPerson.birth.date = { value: "", qualifier: "about" };
unknownPerson.death.date = { value: "", qualifier: "about" };
unknownPerson.source.fields["lineage-id"] = "";
unknownPerson.source.fields["person-date-birth-value"] = "";
unknownPerson.source.fields["person-date-birth-descriptor"] = "UNKNOWN";
unknownPerson.source.fields["person-date-death-value"] = "";
unknownPerson.source.fields["person-date-death-descriptor"] = "UNKNOWN";
unknownPersonState.workspace.people.push(unknownPerson);
unknownPersonState.workspace.relationships.push({ id: "R001", type: "partner", person1Id: "P001", person2Id: "P002", status: "married", startDate: {}, endDate: {}, source: { format: "mcrelations-v2", fields: { "partner-type": "marriage", "end-reason": "" } }, order: 1, createdAt: now, updatedAt: now });
const unknownPersonRoundTrip = await App.portability.prepareBytes(App.portability.packageBytes(unknownPersonState), "unknown-spouse.zip");
const restoredUnknownPerson = unknownPersonRoundTrip.state.workspace.people.find((person) => person.id === "P002");
if (!restoredUnknownPerson || !restoredUnknownPerson.unknownPerson || restoredUnknownPerson.livingStatus !== "unknown" || App.stateModel.displayName(restoredUnknownPerson) !== "Unknown person" || unknownPersonRoundTrip.state.workspace.relationships[0].status !== "married") fail("An Unknown married partner failed its package round trip");

const cleanupState = structuredClone(unknownPersonRoundTrip.state);
const cleanupFirst = cleanupState.workspace.people.find((person) => person.id === "P001");
const cleanupSecond = cleanupState.workspace.people.find((person) => person.id === "P002");
cleanupFirst.addresses = [{ current: true, line1: "1 Alpha Street", city: "Example", region: "IL", postalCode: "60000", country: "US" }];
cleanupSecond.livingStatus = "living";
cleanupSecond.addresses = [{ current: true, line1: "2 Beta Street", city: "Example", region: "IL", postalCode: "60000", country: "US" }];
const missingDeath = structuredClone(cleanupFirst);
missingDeath.id = "P003";
missingDeath.names.birth.first = "Missing";
missingDeath.names.current.first = "Missing";
missingDeath.livingStatus = "deceased";
missingDeath.birth.date = { value: "1970-01-02", qualifier: "exact" };
missingDeath.death.date = { value: "", qualifier: "exact" };
missingDeath.addresses = [];
missingDeath.source.fields["person-date-birth-value"] = "1970-01-02";
missingDeath.source.fields["person-date-death-value"] = "";
missingDeath.source.fields["lineage-id"] = "";
const partialDeath = structuredClone(missingDeath);
partialDeath.id = "P004";
partialDeath.names.birth.first = "Partial";
partialDeath.names.current.first = "Partial";
partialDeath.death.date = { value: "2020", qualifier: "exact" };
partialDeath.source.fields["person-date-death-value"] = "2020";
const placeholderName = structuredClone(cleanupFirst);
placeholderName.id = "P005";
placeholderName.names.birth.middle = "UNKNOWN";
placeholderName.names.current.middle = "Maiden Name";
placeholderName.names.preferred.first = "Name";
placeholderName.addresses = [];
placeholderName.source.fields["lineage-id"] = "";
cleanupState.workspace.people.push(missingDeath, partialDeath, placeholderName);
const cleanupReport = App.stateModel.dataCleanupIssues(cleanupState);
if (!cleanupReport.partnerAddresses.some((issue) => issue.relationshipId === "R001")) fail("Mismatched current partner addresses are missing from Data Cleanup");
if (cleanupReport.unknownBirthdays.map((issue) => issue.personId).join(",") !== "P002") fail("Unknown birthdays are classified incorrectly in Data Cleanup");
if (!cleanupReport.incompleteBirthdays.some((issue) => issue.personId === "P001")) fail("Year-only birthdays are missing from Data Cleanup");
if (cleanupReport.unknownDeaths.map((issue) => issue.personId).join(",") !== "P003") fail("Unknown deceased-person death dates are classified incorrectly in Data Cleanup");
if (cleanupReport.incompleteDeaths.map((issue) => issue.personId).join(",") !== "P004") fail("Year-only death dates are missing from Data Cleanup");
if (cleanupReport.unknownNames.map((issue) => issue.personId).join(",") !== "P002,P005") fail("Unknown or placeholder names are classified incorrectly in Data Cleanup");
const placeholderNameIssue = cleanupReport.unknownNames.find((issue) => issue.personId === "P005");
if (!placeholderNameIssue || !placeholderNameIssue.reason.includes("Birth middle “UNKNOWN”") || !placeholderNameIssue.reason.includes("Current middle “Maiden Name”") || !placeholderNameIssue.reason.includes("Preferred first “Name”")) fail("Data Cleanup does not identify every placeholder name part");

vm.runInContext(read("assets/js/core/family.js"), runtime, { filename: "assets/js/core/family.js" });
const siblingFixture = {
  workspace: {
    people: ["P001", "P002", "P003", "P004", "P005", "P006", "P010"].map((id) => ({ id, names: { birth: { first: id, last: "Test" }, current: { first: id, last: "Test" } }, birth: { date: {} } })),
    relationships: [
      { id: "R001", type: "parent-child", parentId: "P001", childId: "P002", lineage: "lineal", kind: "biological" },
      { id: "R002", type: "parent-child", parentId: "P001", childId: "P003", lineage: "non-lineal", kind: "step" },
      { id: "R003", type: "parent-child", parentId: "P001", childId: "P004", lineage: "lineal", kind: "adoptive" },
      { id: "R004", type: "parent-child", parentId: "P001", childId: "P005", lineage: "lineal", kind: "biological" },
      { id: "R005", type: "parent-child", parentId: "P001", childId: "P006", lineage: "non-lineal", kind: "step" },
      { id: "R006", type: "parent-child", parentId: "P010", childId: "P002", lineage: "non-lineal", kind: "biological" },
      { id: "R007", type: "parent-child", parentId: "P010", childId: "P003", lineage: "non-lineal", kind: "biological" },
      { id: "R008", type: "parent-child", parentId: "P010", childId: "P004", lineage: "non-lineal", kind: "biological" },
      { id: "R009", type: "parent-child", parentId: "P010", childId: "P005", lineage: "non-lineal", kind: "biological" },
      { id: "R010", type: "parent-child", parentId: "P010", childId: "P006", lineage: "non-lineal", kind: "biological" }
    ]
  }
};
if (App.family.siblingRelationshipKind("P002", "P003", siblingFixture) !== "step" || App.family.siblingRelationshipKind("P003", "P002", siblingFixture) !== "biological" || App.family.siblingRelationshipKind("P003", "P003", siblingFixture) !== "step" || App.family.siblingRelationshipKind("P003", "P004", siblingFixture) !== "adoptive") fail("Lineal-family sibling labels, including Self, regressed");
if (App.family.isLinealRelationship(siblingFixture.workspace.relationships[1]) || !App.family.isLinealRelationship(siblingFixture.workspace.relationships[2])) fail("Only Biological and Adopted Lineal relationships may drive lineage");
if (App.family.isLineageEligiblePerson("P003", siblingFixture) || !App.family.isLineageEligiblePerson("P002", siblingFixture)) fail("A Step child still receives an effective Lineage ID");
const ongoingMarriage = { type: "partner", status: "married", source: { fields: { "partner-type": "marriage", "end-reason": "" } } };
if (App.family.partnerLineKind(ongoingMarriage, false, siblingFixture.workspace.people[1], siblingFixture.workspace.people[2]) !== "married") fail("An ongoing marriage is styled as a previous marriage");
if (App.family.compareBirthOrder({ id: "known", birth: { date: { value: "2000" } } }, { id: "unknown", birth: { date: {} }, source: { fields: { "person-date-birth-value": "????" } } }) >= 0) fail("Unknown birth years no longer sort after known years");
for (const kind of ["step", "foster", "guardian", "unknown"]) {
  if (!/must be Non-Lineal/.test(App.family.validateRelationshipDraft({ type: "parent-child", parentId: "P001", childId: "P003", lineage: "lineal", kind }, siblingFixture, "R002"))) fail("The relationship editor accepts a Lineal " + kind + " link");
}

// Recorded positions must survive all packages and remain independent of lineage IDs.
const orderedFixture = structuredClone(roundTrip.state);
for (const [offset, birth] of ["1980-01-01", "????", "1990-01-01", "????"].entries()) {
  const person = structuredClone(orderedFixture.workspace.people[0]);
  person.id = "P00" + (offset + 2);
  person.names.birth.first = person.names.current.first = "Sibling" + offset;
  person.birth.date = { value: birth === "????" ? "" : birth, qualifier: birth === "????" ? "about" : "exact" };
  person.source.fields["person-date-birth-value"] = birth;
  person.source.fields["person-date-birth-descriptor"] = birth === "????" ? "partial" : "day";
  person.source.fields["lineage-id"] = "01.0" + (offset + 1);
  orderedFixture.workspace.people.push(person);
  orderedFixture.workspace.relationships.push({ id: "R00" + (offset + 1), type: "parent-child", parentId: "P001", childId: person.id, lineage: "lineal", kind: "biological", createdAt: now, updatedAt: now, order: offset + 1, source: { fields: {} } });
}
const orderedIds = (fixture) => App.family.orderedLinealChildren("P001", fixture).map((entry) => entry.person.id).join(",");
App.family.recordBirthOrder(orderedFixture, "P003", 1);
App.family.recordBirthOrder(orderedFixture, "P005", 3);
if (orderedIds(orderedFixture) !== "P003,P002,P005,P004") fail("Unknown birthdays cannot be placed before and between known siblings");
App.family.recordBirthOrder(orderedFixture, "P003", 4);
if (orderedIds(orderedFixture) !== "P002,P005,P004,P003") fail("Moving one unknown sibling did not preserve another's relative position");
if (App.family.sortBirthOrder(orderedFixture.workspace.people.slice(1), orderedFixture).map((person) => person.id).join(",") !== orderedIds(orderedFixture)) fail("Display and Lineal ordering differ");
for (const role of ["editor", "pii-viewer", "redacted-viewer"]) {
  const projection = App.portability.accessState(orderedFixture, role);
  const restored = await App.portability.prepareBytes(App.portability.packageBytes(projection), "ordered-" + role + ".zip");
  if (orderedIds(restored.state) !== orderedIds(orderedFixture)) fail("Birth order was lost in " + role + " package");
}
const completeBirthday = structuredClone(orderedFixture);
completeBirthday.workspace.people[2].birth.date.value = "1970-01-01";
App.family.recordBirthOrder(completeBirthday, "P003", 4);
if (completeBirthday.workspace.relationships[1].birthOrder !== null || orderedIds(completeBirthday).split(",")[0] !== "P003") fail("A complete birthday did not restore date order");
for (const invalid of [0, -1, 1.5, "2", 97]) {
  const bad = structuredClone(orderedFixture);
  bad.workspace.relationships[1].birthOrder = invalid;
  let rejected = false;
  try { App.stateModel.prepare(bad); } catch (_) { rejected = true; }
  if (!rejected) fail("Invalid birth position was accepted: " + invalid);
}
const duplicatePosition = structuredClone(orderedFixture);
duplicatePosition.workspace.relationships[1].birthOrder = duplicatePosition.workspace.relationships[3].birthOrder;
let rejectedPosition = false;
try { await App.portability.prepareBytes(App.portability.packageBytes(duplicatePosition), "duplicate-position.zip"); } catch (_) { rejectedPosition = true; }
if (!rejectedPosition) fail("Duplicate birth position was imported");
// App-created relationship IDs are lowercase UUIDs; CSV and metadata must agree.
const lowercaseRelationships = structuredClone(orderedFixture);
for (const link of lowercaseRelationships.workspace.relationships) {
  link.id = "relationship-" + link.id.toLowerCase();
  link.place = "Synthetic relationship place";
}
const beforeLowercaseExport = JSON.stringify(lowercaseRelationships);
for (const role of ["editor", "pii-viewer", "redacted-viewer"]) {
  const source = App.portability.accessState(lowercaseRelationships, role);
  const result = (await App.portability.prepareBytes(App.portability.packageBytes(source), "lowercase-" + role + ".zip")).state;
  for (const link of source.workspace.relationships) {
    const restored = result.workspace.relationships.find((item) => item.id === link.id.toUpperCase());
    if (!restored || (restored.birthOrder ?? null) !== (link.birthOrder ?? null) || restored.place !== link.place) fail("Lowercase relationship export lost birth order or supplemental place data for " + role);
  }
}
if (JSON.stringify(lowercaseRelationships) !== beforeLowercaseExport) fail("Relationship ID export normalization mutated the working copy");
if ((await App.portability.currentChangesBackup(lowercaseRelationships)).emergency) fail("Lowercase relationship IDs incorrectly require an emergency backup");

const recordedLink = orderedFixture.workspace.relationships.find((link) => link.birthOrder != null);
for (const badId of ["MISSING999", recordedLink.id.toLowerCase()]) {
  const files = App.portability.packageFiles(orderedFixture);
  files["McMetadata.csv"] = files["McMetadata.csv"].replaceAll('""' + recordedLink.id + '"":', '""' + badId + '"":');
  let message = "";
  try { App.portability.preparePackage(new Map(Object.entries(files)), "bad-birth-order.zip"); } catch (error) { message = error.message; }
  if (!message.includes(badId) || !message.includes("McMetadata.csv") || !message.includes("McRelations.csv") || !message.includes("No family data was changed")) fail("Missing birth-order relationships lack actionable diagnostics");
  if (badId === "MISSING999" && !message.includes("cannot be identified")) fail("Missing relationship diagnostics imply unknown people are identifiable");
  if (badId !== "MISSING999" && (!message.includes(recordedLink.childId) || !message.includes(recordedLink.parentId) || !message.includes("IDs must match exactly"))) fail("Case mismatch diagnostics lack the affected people and exact ID repair");
}
let duplicateBirthMessage = "";
try { App.stateModel.prepare(duplicatePosition); } catch (error) { duplicateBirthMessage = error.message; }
if (!duplicateBirthMessage.includes("also assigned to") || !duplicateBirthMessage.includes("McMetadata.csv") || !duplicateBirthMessage.includes(duplicatePosition.workspace.relationships[1].childId)) fail("Duplicate birth-position errors do not identify affected children and repair location");

const backupSource = structuredClone(orderedFixture);
backupSource.ui.search = "private session query";
const beforeBackup = JSON.stringify(backupSource);
const validBackup = await App.portability.currentChangesBackup(backupSource);
if (validBackup.emergency || validBackup.mime !== "application/zip") fail("Valid editor backup did not produce a ZIP");
await App.portability.prepareBytes(validBackup.bytes, validBackup.name);
if (JSON.stringify(backupSource) !== beforeBackup) fail("Exporting changes mutated the working copy");
const invalidBackupSource = structuredClone(duplicatePosition);
invalidBackupSource.ui.search = "private session query";
const invalidBeforeBackup = JSON.stringify(invalidBackupSource);
const emergencyBackup = await App.portability.currentChangesBackup(invalidBackupSource);
const recoveredSnapshot = JSON.parse(new TextDecoder().decode(emergencyBackup.bytes));
if (!emergencyBackup.emergency || emergencyBackup.mime !== "application/json" || !emergencyBackup.name.endsWith(".json")) fail("Invalid changes did not produce an emergency backup");
if (JSON.stringify(recoveredSnapshot.workspace) !== JSON.stringify(invalidBackupSource.workspace) || recoveredSnapshot.ui.search) fail("Emergency backup lost family edits or retained session search");
if (JSON.stringify(invalidBackupSource) !== invalidBeforeBackup) fail("Emergency export changed live data");

const duplicateLineage = structuredClone(orderedFixture);
duplicateLineage.workspace.people[2].source.fields["lineage-id"] = duplicateLineage.workspace.people[1].source.fields["lineage-id"];
let rejectedLineage = false;
try { await App.portability.prepareBytes(App.portability.packageBytes(duplicateLineage), "duplicate-lineage.zip"); } catch (_) { rejectedLineage = true; }
if (!rejectedLineage) fail("Duplicate Lineage IDs were imported");

const layoutPerson = (id, lineage, primary = true) => ({
  id,
  names: { birth: { first: id, last: "Layout" }, current: { first: id, last: "Layout" }, preferred: {} },
  birth: { date: {} }, livingStatus: "living",
  source: { format: primary ? "mclineage-cleaned" : "manual", fields: lineage ? { "lineage-id": lineage } : {} }
});
const layoutPeople = [layoutPerson("A", "01"), layoutPerson("B", "", false), layoutPerson("C1", "01.01"), layoutPerson("S1", "", false), layoutPerson("C2", "01.02"), layoutPerson("S2", "", false), layoutPerson("G1", "01.01.01"), layoutPerson("G2", "01.02.01"), layoutPerson("G3", "01.02.02"), layoutPerson("G4", "01.02.03")];
let layoutRelationshipId = 0;
const layoutParent = (parentId, childId, lineage) => ({ id: "LP" + (++layoutRelationshipId), type: "parent-child", parentId, childId, lineage, kind: "biological" });
const layoutPartner = (person1Id, person2Id) => ({ id: "LS" + (++layoutRelationshipId), type: "partner", person1Id, person2Id, status: "married", startDate: {}, endDate: {}, source: { fields: { "partner-type": "marriage" } } });
const layoutRelationships = [
  layoutPartner("A", "B"), layoutParent("A", "C1", "lineal"), layoutParent("B", "C1", "non-lineal"), layoutParent("A", "C2", "lineal"), layoutParent("B", "C2", "non-lineal"),
  layoutPartner("C1", "S1"), layoutPartner("C2", "S2"), layoutParent("C1", "G1", "lineal"), layoutParent("S1", "G1", "non-lineal"),
  layoutParent("C2", "G2", "lineal"), layoutParent("S2", "G2", "non-lineal"), layoutParent("C2", "G3", "lineal"), layoutParent("S2", "G3", "non-lineal"), layoutParent("C2", "G4", "lineal"), layoutParent("S2", "G4", "non-lineal")
];
const parentCenteredLayout = App.family.layout({ workspace: { people: layoutPeople, relationships: layoutRelationships } }, { mode: "overview", nodeView: "condensed", nameBasis: "lineal", nameLength: "short" });
const layoutNodes = new Map(parentCenteredLayout.nodes.map((node) => [node.id, node]));
const layoutCenter = (id) => layoutNodes.get(id).x + layoutNodes.get(id).width / 2;
if (Math.abs((layoutCenter("C1") + layoutCenter("C2")) / 2 - (layoutCenter("A") + layoutCenter("B")) / 2) > 0.01) fail("A child generation is no longer centered beneath its parents");
if (Math.abs(layoutCenter("G1") - (layoutCenter("C1") + layoutCenter("S1")) / 2) > 0.01 || Math.abs((layoutCenter("G2") + layoutCenter("G4")) / 2 - (layoutCenter("C2") + layoutCenter("S2")) / 2) > 0.01) fail("A descendant branch is no longer centered beneath its specific parent couple");
for (const generation of new Set(parentCenteredLayout.nodes.map((node) => node.generation))) {
  const row = parentCenteredLayout.nodes.filter((node) => node.generation === generation).sort((first, second) => first.x - second.x);
  if (row.some((node, index) => index && row[index - 1].x + row[index - 1].width > node.x + 0.01)) fail("Parent-centered Tree branches overlap");
}
const orderedBranchPeople = [layoutPerson("OR", "01"), layoutPerson("ORS", "", false)];
const orderedBranchRelationships = [layoutPartner("OR", "ORS")];
for (let branch = 1; branch <= 3; branch += 1) {
  orderedBranchPeople.push(layoutPerson("OC" + branch, "01.0" + branch), layoutPerson("OCS" + branch, "", false));
  orderedBranchRelationships.push(layoutParent("OR", "OC" + branch, "lineal"), layoutParent("ORS", "OC" + branch, "non-lineal"), layoutPartner("OC" + branch, "OCS" + branch));
  const childCount = branch === 3 ? 6 : 1;
  for (let child = 1; child <= childCount; child += 1) {
    orderedBranchPeople.push(layoutPerson("OG" + branch + "-" + child, "01.0" + branch + ".0" + child));
    orderedBranchRelationships.push(layoutParent("OC" + branch, "OG" + branch + "-" + child, "lineal"), layoutParent("OCS" + branch, "OG" + branch + "-" + child, "non-lineal"));
  }
}
const orderedBranchState = { workspace: { people: orderedBranchPeople, relationships: orderedBranchRelationships } };
const orderedBranchLayouts = [
  App.family.layout(orderedBranchState, { mode: "overview", nodeView: "condensed", nameBasis: "lineal", nameLength: "short" }),
  App.family.layout(orderedBranchState, { mode: "focus", focusId: "OR", ancestorDepth: 10, descendantDepth: 10, nodeView: "condensed", nameBasis: "lineal", nameLength: "short" })
];
orderedBranchLayouts.forEach((orderedBranchLayout) => {
  const orderedBranchNodes = new Map(orderedBranchLayout.nodes.map((node) => [node.id, node]));
  const orderedCenter = (id) => orderedBranchNodes.get(id).x + orderedBranchNodes.get(id).width / 2;
  if (!(orderedCenter("OC1") < orderedCenter("OC2") && orderedCenter("OC2") < orderedCenter("OC3") && orderedCenter("OG1-1") < orderedCenter("OG2-1") && orderedCenter("OG2-1") < orderedCenter("OG3-1"))) fail("A wide later descendant branch crossed ahead of an earlier parent branch");
});
const remarriagePeople = [layoutPerson("RA", "01"), layoutPerson("RB", "", false), layoutPerson("RC", "", false), layoutPerson("RD", "01.01")];
remarriagePeople[0].livingStatus = "deceased";
const remarriageLinks = [
  { id: "RM1", type: "partner", person1Id: "RA", person2Id: "RB", status: "widowed", source: { fields: { "partner-type": "marriage", "end-reason": "death" } } },
  { id: "RM2", type: "partner", person1Id: "RB", person2Id: "RC", status: "married", source: { fields: { "partner-type": "marriage" } } },
  { id: "RM3", type: "parent-child", parentId: "RA", childId: "RD", lineage: "lineal", kind: "biological" },
  { id: "RM4", type: "parent-child", parentId: "RB", childId: "RD", lineage: "non-lineal", kind: "biological" }
];
const remarriageLayout = App.family.layout({ workspace: { people: remarriagePeople, relationships: remarriageLinks } }, { mode: "overview", nodeView: "detailed" });
const remarriageNodes = new Map(remarriageLayout.nodes.map((node) => [node.id, node]));
const remarriageGap = remarriageNodes.get("RC").x - remarriageNodes.get("RB").x - remarriageNodes.get("RB").width;
if (remarriageGap < 0 || remarriageGap > 50) fail("A partner's new spouse became a detached Tree block");

const printPackingNodes = [
  { id: "A", generation: 1, x: 0, width: 100 },
  { id: "B", generation: 1, x: 126, width: 100 },
  { id: "C", generation: 1, x: 190, width: 100 },
  { id: "D", generation: 1, x: 270, width: 100 }
];
const printPackingEdges = [{ relationship: { type: "partner" }, from: printPackingNodes[0], to: printPackingNodes[1] }];
const packedPrintNodes = App.family.packHorizontalNodeClusters(printPackingNodes, printPackingEdges, 26).sort((first, second) => first.x - second.x);
if (packedPrintNodes.some((node, index) => index && packedPrintNodes[index - 1].x + packedPrintNodes[index - 1].width + 26 > node.x + 0.01)) fail("Tree print context cards overlap");
if (Math.abs((packedPrintNodes.find((node) => node.id === "B").x - packedPrintNodes.find((node) => node.id === "A").x) - 126) > 0.01 || printPackingNodes[2].x !== 190) fail("Tree print packing broke partner spacing or mutated the live Tree");

const index = read("index.html");
const css = read("assets/css/app.css");
const sw = read("sw.js");
const cloud = read("assets/js/core/cloud.js");
const pwa = read("assets/js/core/pwa.js");
const appSource = read("assets/js/app.js");
const familySource = read("assets/js/core/family.js");
const componentsSource = read("assets/js/core/components.js");
const iconsSource = read("assets/js/icons.js");
const pagesWorkflow = read(".github/workflows/deploy-pages.yml");
if (!index.includes('id="relationPerson1Search"') || !index.includes('id="relationPerson2Search"') || !appSource.includes("model.fuzzySearchMatch(query, searchText)")) fail("Connect Existing People search controls are missing");
if (!index.includes('id="unknownPerson"') || !appSource.includes('data-rebuild-lineage="') || !appSource.includes("family.isLineageEligiblePerson(root.id, sourceState)")) fail("Unknown person or Editor lineage repair controls are missing");
if (!index.includes('id="dataCleanupTab"') || !index.includes('data-support-tab="cleanup" data-editor-only') || !index.includes('id="dataCleanupGroups"') || index.includes('id="adminIntegritySection"') || !appSource.includes("renderDataCleanup();") || !appSource.includes('cleanupGroupHtml("unknown-names"') || !appSource.includes('cleanupGroupHtml("lineage"') || !css.includes(".data-cleanup-group[open]") || !css.includes(".data-cleanup-grid")) fail("Editor Data Cleanup sidebar or collapsible issue groups are missing");
if (!cloud.includes("if (!definition.canManage) prepared.state.preferences.controls.developerMode = false;")) fail("Non-Admin hosted access no longer defaults Developer Mode off");
const toolbarOrder = ["cloudAuditButton", "addPersonButton", "directoryButton", "printButton"].map((id) => index.indexOf(`id="${id}"`));
if (toolbarOrder.some((position) => position < 0) || !(toolbarOrder[0] < toolbarOrder[1] && toolbarOrder[1] < toolbarOrder[2] && toolbarOrder[2] < toolbarOrder[3])) fail("Header actions are no longer ordered Save, Add, List, Directory");
const searchCluster = (index.match(/<div class="header-search-cluster">([\s\S]*?)<\/div>\s*<\/div>/) || [])[1] || "";
const searchActionOrder = ['id="globalSearch"', "<kbd", 'id="favoritesButton"'].map((needle) => searchCluster.indexOf(needle));
if (searchActionOrder.some((position) => position < 0) || !(searchActionOrder[0] < searchActionOrder[1] && searchActionOrder[1] < searchActionOrder[2]) || /id="(?:directoryButton|cloudAuditButton)"/.test(searchCluster)) fail("Favorites is no longer anchored after the search shortcut");
const savePublishOrder = ["hostedPublishTitle", "hostedRecordedBy", "hostedVersionChange", "hostedBulkUploadButton", "hostedPublishButton", "hostedAuditSummary", "hostedChangeList"].map((id) => index.indexOf(`id="${id}"`));
if (savePublishOrder.some((position) => position < 0) || savePublishOrder.some((position, item) => item && position <= savePublishOrder[item - 1])) fail("Save publication controls no longer follow the compact publishing order");
if (!(index.indexOf('id="currentAccessSummary"') < index.indexOf('class="dialog-body cloud-audit-body"')) || !(index.indexOf('id="cloudVaultSummary"') < index.indexOf('class="dialog-body cloud-audit-body"')) || !(index.indexOf('id="githubConnectionSummary"') < index.indexOf('class="dialog-body cloud-audit-body"'))) fail("Save status summaries are no longer in the dialog header");
if (!appSource.includes('relationshipMaritalStatus(person, entry) + " :: " + years') || !appSource.includes('data-add-person-relationship=') || !appSource.includes('data-edit-person-relationships=') || !appSource.includes('data-delete-person-relationships=') || appSource.includes('class="relationship-edit-button"')) fail("Person-level relationship management or partner status display regressed");
for (const group of ['group: "New person with relationship"', 'group: "Relationship to existing person"', 'group: "Parents"', 'group: "Partners"', 'group: "Children"']) if (!appSource.includes(group)) fail("A grouped relationship decision is missing");
if (!componentsSource.includes('group.className = "choice-group"') || !componentsSource.includes('groupActions.className = "choice-group-actions"')) fail("Choice dialogs no longer support grouped decisions");
if (!css.includes("justify-content: stretch") || !css.includes(".choice-actions .button > strong") || !css.includes(".relationship-section-heading { display: flex;")) fail("Relationship choices or heading actions are no longer fully left-aligned");
if (!index.includes('id="relationshipFixedSummary"') || !index.includes('id="pendingRelativeSummary"') || !appSource.includes('const guidedAdd = Boolean(!relationship && personId && relationshipRole)') || !appSource.includes('$("#relationshipTypeField").hidden = focusedRelationship') || !appSource.includes('classList.toggle("full"') || !appSource.includes('$("#pendingRelativeSummary").hidden = !pendingContext') || !appSource.includes('relationship ? initialEditField : initialSearch')) fail("Add or Edit relationship flows are no longer type-aware");
const relatedAddressAutofillPosition = index.indexOf('id="relatedAddressAutofill"');
if (relatedAddressAutofillPosition < 0 || relatedAddressAutofillPosition > index.indexOf('id="addressEditor"') || !index.includes("Autofill from related person") || !appSource.includes("function relatedPersonAddressDraft") || !appSource.includes('$("#relatedAddressAutofill").checked = Boolean(autofilledAddress)') || !appSource.includes('addresses: person ? u.clone(person.addresses || []) : autofilledAddress ? [autofilledAddress] : []') || !appSource.includes('if (event.target.id === "relatedAddressAutofill") applyRelatedAddressAutofill(event.target.checked)') || !css.includes(".related-address-autofill-field { align-items: flex-start;")) fail("New people added by relationship must default to the related person's current address with a visible opt-out");
if (!css.includes('body[data-onboarding="false"] { display: flex; flex-direction: column; height: 100svh; overflow-y: hidden; }') || !css.includes('body[data-onboarding="false"] > main { display: flex; flex: 1 1 auto; min-height: 0; overflow: hidden; padding-bottom: max(.75rem, var(--safe-bottom)); }') || !css.includes('body[data-onboarding="false"] .family-workspace-grid { flex: 1 1 auto; height: auto; min-height: 0; }')) fail("The initialized application can regain a second vertical scrollbar or bottom buffer");
const profileActionSource = appSource.slice(appSource.indexOf("const recordActions ="), appSource.indexOf("container.innerHTML =", appSource.indexOf("const recordActions =")));
const profileActionOrder = ['actionButton("Edit"', 'actionButton("Delete"', "favoriteButton", "data-close-profile"].map((needle) => profileActionSource.indexOf(needle));
if (profileActionOrder.some((position) => position < 0) || profileActionOrder.some((position, item) => item && position <= profileActionOrder[item - 1]) || !profileActionSource.includes("recordActions + favoriteButton")) fail("Profile actions are no longer ordered Edit, Delete, Favorite, Close");
for (const symbol of ["relationshipAdd", "relationshipEdit", "relationshipDelete", "lineageCheck"]) if (!iconsSource.includes(symbol)) fail("A requested relationship or lineage icon is missing");
if (!appSource.includes('data-symbol="lineageCheck"') || !iconsSource.includes("M32.1954 13.4214") || !iconsSource.includes("M10.0732 18.4521") || !css.includes(".relationship-actions .profile-action-icon .sf-symbol { width: 2rem;") || !css.includes(".profile-header-actions .profile-action-icon") || !css.includes(".profile-action.danger-text:hover")) fail("The requested profile, relationship, or Check & Update icon treatment regressed");
for (const label of ["Lineal biological", "Lineal adopted", "Non-Lineal biological", "Non-Lineal adopted", "Non-Lineal other"]) if (!appSource.includes(label)) fail("The parent relationship key is incomplete");
if (appSource.includes("Non-Lineal Other") || appSource.includes('"Non-Lineal unknown"') || !appSource.includes("groups.children.filter(childUsesBirthOrder)") || !appSource.includes("function childContext")) fail("The parent key or Step child numbering regressed");
if (!appSource.includes('name = entry.self ? "Self"') || !appSource.includes("function siblingUsesBirthOrder") || !appSource.includes("kind && !kind.lineal")) fail("Sibling Self or relationship context display regressed");
for (const style of ['data-kind="biological"', 'data-kind="adoptive"', 'data-kind="step"', 'data-kind="foster"', 'data-kind="guardian"', 'data-kind="unknown"']) if (!css.includes(".tree-edge.parent-child[" + style + "]")) fail("A parent relationship line style is missing");
if (!appSource.includes('kind === "unknown" ? unknownRelationshipMarks(edge, pathId)') || !css.includes(".tree-edge-marks.parent-child-marks") || !css.includes('.print-tree-svg .tree-edge[data-kind="unknown"] { stroke: none; }')) fail("Unknown relationships no longer render with question marks in screen and print trees");
if (!pwa.includes('serviceWorker.register("sw.js", { updateViaCache: "none" })') || pwa.includes('serviceWorker.register(versionedAsset("sw.js")')) fail("The service worker registration URL must remain stable across builds");
if (!index.includes('id="hostedAuditSummary" type="text" placeholder="Summary of what changed"') || !css.includes('.hosted-publish-toolbar .status-pill { align-self: center; min-height: 36px; height: 36px;')) fail("The compact publishing inputs regressed");
if (!appSource.includes('mode === "outline"') || !appSource.includes('? "@page { size: letter portrait; margin: .5in .1875in; }"') || !appSource.includes('? "@page { size: letter landscape; margin: .5in; }"') || !appSource.includes(': "@page { size: letter portrait; margin: .5in; }"') || appSource.includes('mode === "tree" || mode === "outline"')) fail("Outline must share portrait page margins while Tree remains landscape");
for (const previewCall of ['printPreviewPageTitle("Directory", result.pageCount), "directory")', 'printPreviewPageTitle("Groups", result.pageCount), "groups")', 'openPrintPreview(trigger, "Labels Preview", "labels")', 'printPreviewPageTitle("Outline", result.pageCount), "outline")', 'printPreviewPageTitle("Tree", result.pageCount), "tree")']) if (!appSource.includes(previewCall)) fail("A print action no longer opens the shared preview first");
if (!index.includes('id="printPreviewPrintButton"') || !index.includes('<span class="eyebrow">Print Preview</span>') || !appSource.includes('if (activePrintPreviewMode) invokeNativePrint(activePrintPreviewMode)') || !css.includes('.print-preview-actions { display: flex;')) fail("The print preview header action is missing");
if (!appSource.includes('data-zoom-step="5" aria-label="Increase zoom by five percent"') || !appSource.includes('data-zoom-step="-5" aria-label="Decrease zoom by five percent"') || !read("assets/js/core/family.js").includes("const verticalGap = 40;") || !appSource.includes("+ 40 * Math.max(0, plannedLevels - 1) + 40")) fail("Tree spacing or five-percent zoom stepping regressed");
const treeZoomActionOrder = ['data-zoom="in"', "data-reset-tree", "data-fit-tree"].map((needle) => appSource.indexOf(needle));
if (treeZoomActionOrder.some((position) => position < 0) || !(treeZoomActionOrder[0] < treeZoomActionOrder[1] && treeZoomActionOrder[1] < treeZoomActionOrder[2]) || !iconsSource.includes("resetZoom: __RESET_ZOOM") || !iconsSource.includes("M12.5537 14.7678L6.38935 20.9304") || !appSource.includes('data-symbol="resetZoom"') || !appSource.includes('if (target.closest("[data-reset-tree]")) { resetTreeView(); return; }')) fail("The requested 100% Reset action is missing or out of order");
const treeReportSource = appSource.slice(appSource.indexOf("function buildTreeReport"), appSource.indexOf("function openPrintPreview"));
if (!treeReportSource.includes("const printZoom = 1;") || !treeReportSource.includes('Math.round(printZoom * 100) + "% Zoom"') || treeReportSource.includes("treeTransform.scale")) fail("Tree print must always render at 100% independently of live zoom");
if (!appSource.includes("function printTreeGenerationBands") || !appSource.includes("function printTreeHorizontalBands") || !appSource.includes("function printTreePartnerClusters") || !appSource.includes("function printTreeContextNodes") || !appSource.includes("family.packHorizontalNodeClusters(contextNodes, contextEdges, 26)") || !appSource.includes("const maximumLevels = fullTree ? config.controls.maxPrintTreeLevels : config.controls.maxPrintLineageLevels") || appSource.includes("zoomForCapacity") || !appSource.includes('settings.push(maximumLevels + " Levels / " + maximumPeopleAcross + " People Maximum")')) fail("Semantic, stable-density, or collision-free Tree print pagination is missing");
if (!appSource.includes("function ancestorAtGeneration") || !appSource.includes("family.isLinealRelationship(b.relationship)") || !appSource.includes("return assignments.flatMap(function (ids) { return splitCandidate(ids, depth + 1); })")) fail("Tree print pages no longer keep descendant branches with their parents");
if (!appSource.includes('width="9" height="9"') || !appSource.includes('(lifeY - 8)') || !read("assets/js/core/family.js").includes('(detailed ? 26 : 12) + Math.max(1, lineCount) * 14 + (detailed && settings.showDeveloperScale ? 13 : 0)')) fail("Detailed Tree cards are no longer using the compact shared metadata row");
const printActionOrder = ["printButton", "groupsButton", "labelsButton"].map((id) => index.indexOf(`id="${id}"`));
if (printActionOrder.some((position) => position < 0) || printActionOrder.some((position, item) => item && position <= printActionOrder[item - 1])) fail("Directory, Groups, and Labels are no longer ordered together");
if (index.includes('id="outlineButton"') || !appSource.includes('class="segmented workspace-view-switch"') || !appSource.includes('data-workspace-view="outline"')) fail("Outline must be available beside Tree in the central view switch, not the application toolbar");
if (!iconsSource.includes("outline: __OUTLINE") || !iconsSource.includes("M14.7217 19.0625L31.7969 19.0625")) fail("The requested Outline symbol is missing");
if (!iconsSource.includes("print: __PRINTER_FILL") || !iconsSource.includes("M25.615 5.30273L7.05176 5.30273") || !appSource.includes('data-print-tree aria-label="Print the current Family Tree"') || !appSource.includes('data-symbol="print"') || !appSource.includes('<span>Print</span></button>') || !appSource.includes('outlineActionHtml("data-print-outline", "print", "Print")')) fail("Tree and Outline no longer share the requested Print action");
if (!iconsSource.includes("outlineRoot: __OUTLINE_ROOT") || !iconsSource.includes("M9.77051 24.947L33.7012 24.947") || !appSource.includes('"outlineRoot", "Reset Root"')) fail("The requested Outline root symbol or Reset Root action is missing");
if (!iconsSource.includes("outlineExpand: __OUTLINE_EXPAND") || !iconsSource.includes("M0.523688 14.043L11.0999 20.2344") || !iconsSource.includes("outlineCondense: __OUTLINE_CONDENSE") || !iconsSource.includes("M1.68945 20.2344L12.2656 14.043") || !css.includes('[data-symbol="outlineExpand"] .sf-symbol') || !css.includes("transform: rotate(90deg)")) fail("The requested rotated and directionally distinct Outline expand and condense symbols are missing");
if (!appSource.includes("function buildOutlineRows") || !appSource.includes("function buildOutlineReport") || !appSource.includes("buildOutlineRows({ print: true })") || appSource.includes("buildOutlineRows({ print: true, ignoreCollapsed: true })") || !appSource.includes('data-outline-branch=') || !appSource.includes('data-outline-highlight')) fail("Interactive or expanded-state printable Outline behavior is missing");
if (!appSource.includes("function paginateOutlineRows") || !appSource.includes("pageRows.length >= config.controls.maxPrintOutlineRows") || !appSource.includes("usedHeight + rowHeight > availableHeight") || !css.includes(".print-outline-measure { position: fixed; top: 0; left: -200vw; width: 8.5in; visibility: hidden; pointer-events: none; }") || !css.includes(".print-outline-measure > .print-outline-page { height: calc(11in - 2px); }")) fail("Outline print pagination no longer fills pages by the guarded native sheet height");
if (!css.includes('#printReport { display: block !important; margin: 0; padding: 0; color: #111;')) fail("The print report can inherit screen padding and enlarge its page margins");
if (!appSource.includes("const generationNumber = relationshipGeneration(person)") || !appSource.includes("G' + generationNumber") || !appSource.includes("function outlineLifeDatesHtml") || !appSource.includes('class="outline-life-dates is-stacked"') || !css.includes(".outline-life-dates.is-stacked { display: grid; justify-items: center; line-height: .96; }") || !css.includes(".outline-life-dates.is-stacked span:first-child { transform: translateY(-.5px); }") || !css.includes(".outline-life-dates.is-stacked span:last-child { transform: translateY(.5px); }") || !css.includes(".print-outline .outline-life-dates.is-stacked { line-height: .96; }")) fail("Outline generation labels or compact stacked life dates regressed");
if (!appSource.includes('outlineActionHtml("data-outline-expand-all", "outlineExpand", "Expand<br>All")') || !appSource.includes('outlineActionHtml("data-outline-collapse-all", "outlineCondense", "Condense<br>All")') || !appSource.includes('outlineActionHtml("data-outline-condense-lineage", "outlineCondenseLineage", "Condense<br>Lineage")') || !iconsSource.includes("outlineCondenseLineage: __OUTLINE_CONDENSE_LINEAGE") || !iconsSource.includes("M4.4873 9.0332C6.97266 9.0332")) fail("The requested two-line All labels or Condense Lineage control is missing");
if (!appSource.includes("function revealOutlinePerson") || !appSource.includes("function centerSelectedOutlinePerson") || !appSource.includes("selectedPerson.closest(\".outline-row\")") || !appSource.includes("selectedRow.offsetTop - (scroller.clientHeight - selectedRow.offsetHeight) / 2")) fail("Outline selection must reveal and vertically center visible people");
if (!appSource.includes('target.closest("[data-outline-condense-lineage]")') || !appSource.includes('const selectedDescendantPrefix = selectedKey + "|"') || !appSource.includes("!key.startsWith(selectedDescendantPrefix)") || !appSource.includes("condenseLineage.disabled = !result.availableHighlightPath")) fail("Condense Lineage behavior or availability regressed");
if (appSource.includes('settings.print\n        ? \'<span class="outline-toggle-placeholder"') || !css.includes("grid-template-columns: .22in var(--outline-person-width)") || css.includes(".print-outline .outline-toggle-placeholder")) fail("Outline print must omit the chevron gutter and keep Generation close to the person card");
if (!appSource.includes(".partners.slice(0, 1)") || appSource.includes("No spouse recorded")) fail("Outline must show only the latest partner without empty partner copy");
if (!appSource.includes("function outlineLineagePeople") || !appSource.includes("family.isLinealRelationship(entry.relationship)") || !appSource.includes('id="outlineRootSearch"') || !appSource.includes("data-outline-root-option") || appSource.includes("outlineRootSelect")) fail("Outline root search must offer only Root Ancestor Lineage people");
if (!appSource.includes("data-outline-reset-root") || !appSource.includes("outlineRootId = state().workspace.family.homePersonId") || appSource.includes("data-outline-selected-root")) fail("Reset Root must return the Outline to the Root Ancestor");
if (!appSource.includes("outlinePanelHtml(treeNameControls)") || !appSource.includes("model.treeName(person, current.ui.treeNameBasis, length || current.ui.treeNameLength)")) fail("Outline must retain and apply Name Preferences");
if (!appSource.includes('class="count-pill outline-root-count"') || !appSource.includes('family.descendantsOf(root.id, relationshipGraph(state())).length + 1') || !css.includes(".outline-root-setting { flex: 0 1 250px; width: 250px; }")) fail("Outline Root must stay compact and show the selected root's people count");
if (!appSource.includes("u.escapeHtml(label.type)") || !appSource.includes("u.escapeHtml(label.date)") || !css.includes("grid-template-columns: minmax(10px, 1fr) auto minmax(10px, 1fr)") || !css.includes(".outline-relationship small { display: grid;")) fail("Outline relationship labels must center Type and Date on separate lines");
if (!css.includes(".outline-person.outline-spouse { box-sizing: border-box; width: 100%; border-left-width: 1px; border-left-color: var(--line);") || !css.includes("grid-template-columns: 160px var(--outline-person-width)") || !css.includes(".print-outline .outline-person.outline-spouse { border-left-width: .6pt; border-left-color: #aaa;")) fail("Outline spouse cards must match Lineal card widths without using the Lineal accent");
if (!appSource.includes('class="outline-action"') || !appSource.includes('(collapsed ? "chevronRight" : "chevronDown")') || !iconsSource.includes("chevronRight: __CHEVRON_RIGHT") || !iconsSource.includes("chevronDown: __CHEVRON_DOWN")) fail("Outline controls must use the shared icon catalog and chevron branch states");
if (appSource.includes("Descendant view") || !appSource.includes('class="tree-toolbar outline-toolbar"') || !appSource.includes('class="tree-view-controls outline-view-controls"')) fail("Tree and Outline must switch the available shared-style toolbar without a separate Outline heading");
if (!css.includes(".outline-row") || !css.includes(".outline-scan-bar") || !css.includes(".outline-action { appearance: none; display: inline-flex; flex-direction: column;") || !css.includes(".print-outline .outline-row") || !css.includes(".workspace-view-switch .tree-option-action { display: inline-flex; flex-direction: column;")) fail("Outline screen, controls, or stacked toolbar styling is missing");
if (!css.includes(".print-outline .outline-person strong { flex: 1 1 auto; min-width: 0; max-width: none; overflow: visible; overflow-wrap: anywhere;") || !css.includes("text-overflow: clip; white-space: normal;")) fail("Outline print names must remain complete instead of being clipped or ellipsized");
if (!appSource.includes('class="print-directory print-directory-page print-sheet-page"') || !appSource.includes('class="print-atlas print-atlas-page print-sheet-page"') || !appSource.includes('class="print-outline print-outline-page print-sheet-page"') || !appSource.includes("function printReportMetaHtml") || !appSource.includes("function paginateDirectoryHouseholds") || !css.includes(".print-preview-document > .print-directory-page") || !css.includes(".print-preview-document > .print-outline-page { box-sizing: border-box; width: min(8.5in, 100%); height: 11in;") || !css.includes("body.printing-outline .print-outline-page { box-sizing: border-box; display: flow-root; width: 7.5in; padding: 0; break-after: page;") || css.includes("body.printing-directory .print-directory-page, body.printing-groups .print-atlas-page { box-sizing: border-box; width: 7.5in; height:") || !css.includes("}\n\n.print-groups-page-body")) fail("Directory, Groups, or Outline no longer expose accurate portrait preview page breaks without native blank sheets");
const directoryBuilderStart = appSource.indexOf("function buildDirectoryReport");
const treeBuilderStart = appSource.indexOf("function buildTreeReport");
const groupsBuilderStart = appSource.indexOf("function buildGroupsReport");
if (directoryBuilderStart < 0 || treeBuilderStart < 0 || groupsBuilderStart < 0 || !appSource.includes("data-print-tree")) fail("Separated Directory, Groups, and Tree print paths are missing");
if (appSource.slice(directoryBuilderStart, treeBuilderStart).includes("print-atlas")) fail("Directory once again includes generation maps");
const indexVersion = (index.match(/id="versionButton"[^>]*>v([^<]+)/) || [])[1];
const swVersion = (sw.match(/ASSET_VERSION = "([^"]+)"/) || [])[1];
if (indexVersion !== config.identity.version || swVersion !== config.identity.version) fail("HTML, config, and service-worker versions differ");
const queryVersions = Array.from(index.matchAll(/\?v=([0-9.]+)/g), (match) => match[1]);
if (!queryVersions.length || queryVersions.some((version) => version !== config.identity.version)) fail("HTML asset query versions differ");
if (!pagesWorkflow.includes("name: Deploy " + config.identity.name + " v" + config.identity.version)) fail("Pages workflow name does not identify the current app version");
if (!pagesWorkflow.includes('run-name: Deploy ${{ github.event.head_commit.message }}')) fail("Pages run title no longer mirrors the versioned commit subject");
for (const contract of ["actions/checkout@v6", "actions/configure-pages@v5", "actions/upload-pages-artifact@v4", "actions/deploy-pages@v4", "path: ."]) if (!pagesWorkflow.includes(contract)) fail("Pages workflow is missing " + contract);

const manifests = ["manifest.webmanifest", "manifest-dark.webmanifest"].map((path) => [path, JSON.parse(read(path))]);
for (const [path, manifest] of manifests) {
  if (manifest.name !== config.identity.name) fail(path + " has the wrong application name");
  for (const icon of manifest.icons || []) if (!existsSync(resolve(root, icon.src))) fail(path + " references missing " + icon.src);
}

const referenced = new Set();
for (const match of index.matchAll(/(?:src|href)="([^"]+)"/g)) referenced.add(match[1]);
for (const match of css.matchAll(/url\((?:"|')?([^"')]+)(?:"|')?\)/g)) referenced.add("assets/css/" + match[1]);
for (const match of sw.matchAll(/(?:versioned\()?"(\.\/[^"?]+)(?:\?[^"\)]*)?"/g)) referenced.add(match[1]);
for (const raw of referenced) {
  if (!raw || raw === "./" || raw.startsWith("#") || /^(?:https?:|data:|mailto:|tel:)/.test(raw)) continue;
  const clean = raw.split("?")[0].replace(/^\.\//, "").replace(/^assets\/css\/\.\.\//, "assets/");
  if (!existsSync(resolve(root, clean))) fail("Missing referenced asset: " + clean);
}

const forbidden = ["allowUpgradeSource", "requiresBulkUpgrade", "isUpgradeSourceDatasetVersion", "mcfamily.state.v13", "app-icon-light.png", "app-icon-dark.png", "betaPill"];
const currentSources = ["index.html", "sw.js"].concat(filesBelow("assets/js"));
for (const token of forbidden) {
  const hit = currentSources.find((path) => read(path).includes(token));
  if (hit) fail("Retired token " + token + " remains in " + hit);
}

const pagesPublishers = filesBelow(".github/workflows").filter((path) => /\.ya?ml$/.test(path) && read(path).includes("actions/deploy-pages@"));
if (pagesPublishers.length !== 1 || pagesPublishers[0] !== ".github/workflows/deploy-pages.yml") fail("Exactly one checked-in Pages publisher must remain configured");
for (const path of ["index.html", "manifest.webmanifest", "manifest-dark.webmanifest", "sw.js", "assets/css", "assets/js", "assets/icons"]) {
  if (!existsSync(resolve(root, path)) || statSync(resolve(root, path)).size === 0) fail("Required runtime path is missing: " + path);
}

execFileSync("git", ["diff", "--check"], { cwd: root, stdio: "pipe" });
console.log(`McFamily ${config.identity.version}: ${runtimeJs.length} scripts, 2 manifests, asset references, current-only contracts, single-source deployment, and diff checks passed.`);
