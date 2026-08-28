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
if (config.themes.length !== 1) fail("Only the supported McFamily appearance should remain configured");
if (!config.datasetVersion.startsWith(config.datasetSeries + ".")) fail("Dataset version is outside the configured series");

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

const index = read("index.html");
const sw = read("sw.js");
const cloud = read("assets/js/core/cloud.js");
if (!cloud.includes("if (!definition.canManage) prepared.state.preferences.controls.developerMode = false;")) fail("Non-Admin hosted access no longer defaults Developer Mode off");
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
for (const match of read("assets/css/app.css").matchAll(/url\((?:"|')?([^"')]+)(?:"|')?\)/g)) referenced.add("assets/css/" + match[1]);
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
