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

const index = read("index.html");
const css = read("assets/css/app.css");
const sw = read("sw.js");
const cloud = read("assets/js/core/cloud.js");
const pwa = read("assets/js/core/pwa.js");
const appSource = read("assets/js/app.js");
const componentsSource = read("assets/js/core/components.js");
const iconsSource = read("assets/js/icons.js");
if (!index.includes('id="relationPerson1Search"') || !index.includes('id="relationPerson2Search"') || !appSource.includes("model.fuzzySearchMatch(query, searchText)")) fail("Connect Existing People search controls are missing");
if (!index.includes('id="unknownPerson"') || !appSource.includes('data-rebuild-lineage="') || !appSource.includes("family.isLineageEligiblePerson(root.id, sourceState)")) fail("Unknown person or Editor lineage repair controls are missing");
if (!index.includes('id="adminIntegritySection"') || !index.includes("Bad Lineage IDs") || !index.includes("Unknown or Invalid Relationships") || !appSource.includes("renderIntegrityIssues();")) fail("Admin Data Cleanup lists are missing from Settings");
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
if (!appSource.includes('? "@page { size: letter landscape; margin: .5in; }"')) fail("Tree printing no longer explicitly requests letter landscape");
const printActionOrder = ["printButton", "outlineButton", "groupsButton", "labelsButton"].map((id) => index.indexOf(`id="${id}"`));
if (printActionOrder.some((position) => position < 0) || printActionOrder.some((position, item) => item && position <= printActionOrder[item - 1])) fail("Directory, Outline, Groups, and Labels are no longer ordered together");
if (!iconsSource.includes("outline: __OUTLINE") || !iconsSource.includes("M14.7217 19.0625L31.7969 19.0625")) fail("The requested Outline symbol is missing");
if (!appSource.includes("function buildOutlineRows") || !appSource.includes("function buildOutlineReport") || !appSource.includes("ignoreCollapsed: true") || !appSource.includes('data-outline-branch=') || !appSource.includes('data-outline-highlight')) fail("Interactive or printable Outline behavior is missing");
if (!css.includes(".outline-row") || !css.includes(".outline-scan-bar") || !css.includes(".print-outline .outline-row")) fail("Outline screen or print styling is missing");
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

if (existsSync(resolve(root, ".github/workflows/deploy.yml"))) fail("The redundant gh-pages publisher must remain removed");
for (const path of ["index.html", "manifest.webmanifest", "manifest-dark.webmanifest", "sw.js", "assets/css", "assets/js", "assets/icons"]) {
  if (!existsSync(resolve(root, path)) || statSync(resolve(root, path)).size === 0) fail("Required runtime path is missing: " + path);
}

execFileSync("git", ["diff", "--check"], { cwd: root, stdio: "pipe" });
console.log(`McFamily ${config.identity.version}: ${runtimeJs.length} scripts, 2 manifests, asset references, current-only contracts, single-source deployment, and diff checks passed.`);
