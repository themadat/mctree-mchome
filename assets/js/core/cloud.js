(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const u = App.utils;
  const storage = App.storage;
  const portability = App.portability;
  const components = App.components;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const ROLE_DEFINITIONS = {
    owner: { mode: "owner", label: "Owner", stateMode: "editor", fullKey: true, redactedKey: true, canManage: true, canPublish: true },
    editor: { mode: "editor", label: "Editor", stateMode: "editor", fullKey: true, redactedKey: true, canManage: false, canPublish: true },
    "pii-viewer": { mode: "pii-viewer", label: "Private Viewer", stateMode: "pii-viewer", fullKey: true, redactedKey: false, canManage: false, canPublish: false },
    "redacted-viewer": { mode: "redacted-viewer", label: "Redacted Viewer", stateMode: "redacted-viewer", fullKey: false, redactedKey: true, canManage: false, canPublish: false }
  };
  const FIXED_GRANT_MODES = { owner: "owner", pii: "pii-viewer", redacted: "redacted-viewer" };
  const PASSPHRASE_WORDS = [
    "amber", "apple", "atlas", "basil", "beacon", "birch", "bluebird", "brook", "cedar", "clover", "copper", "cove",
    "dahlia", "ember", "fern", "field", "garden", "harbor", "hazel", "hickory", "iris", "juniper", "lantern", "laurel",
    "maple", "meadow", "moon", "moss", "oak", "orchard", "paintrock", "pebble", "pine", "river", "robin", "sage",
    "silver", "sparrow", "stone", "sunrise", "thistle", "valley", "violet", "willow", "woodland", "wren"
  ];
  let busy = false;
  let currentVault = null;
  let activeSession = null;
  let gateResolve = null;

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.from((root || document).querySelectorAll(selector)); }
  function initialized() { return Boolean(storage.getState().workspace.family.initializedAt); }

  function settingsDefaults() {
    return { owner: config.cloud.owner, repository: config.cloud.repository, branch: config.cloud.branch, path: config.cloud.path };
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch (error) { return null; }
  }

  function storedSettings() {
    return Object.assign(settingsDefaults(), u.plainObject(readJson(config.storage.cloudSettingsKey)));
  }

  function storedToken() {
    try { return localStorage.getItem(config.storage.cloudTokenKey) || sessionStorage.getItem(config.storage.cloudTokenKey) || ""; }
    catch (error) { return ""; }
  }

  function saveCredentials(settings, token) {
    localStorage.setItem(config.storage.cloudSettingsKey, JSON.stringify(settings));
    if ($("#cloudRememberToken").checked) {
      localStorage.setItem(config.storage.cloudTokenKey, token);
      sessionStorage.removeItem(config.storage.cloudTokenKey);
    } else {
      sessionStorage.setItem(config.storage.cloudTokenKey, token);
      localStorage.removeItem(config.storage.cloudTokenKey);
    }
  }

  function cleanSettings(source) {
    const settings = {
      owner: u.cleanLine(source.owner, 39),
      repository: u.cleanLine(source.repository, 100).replace(/\.git$/i, ""), branch: u.cleanLine(source.branch, 100) || "main",
      path: u.cleanLine(source.path, 300).replace(/^\/+/, "")
    };
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(settings.owner)) throw new Error("Enter a valid GitHub user or organization.");
    if (!/^[A-Za-z0-9._-]+$/.test(settings.repository)) throw new Error("Enter a valid GitHub repository name.");
    if (!settings.branch || /[\s~^:?*[\]\\/]/.test(settings.branch) || settings.branch.includes("..")) throw new Error("Enter a valid Git branch name.");
    if (!settings.path || !/\.json$/i.test(settings.path) || settings.path.split("/").some(function (part) { return !part || part === "." || part === ".."; })) throw new Error("Enter a valid .json vault path inside the repository.");
    const deployed = settingsDefaults();
    if (["owner", "repository", "branch", "path"].some(function (key) { return settings[key] !== deployed[key]; })) {
      throw new Error("This deployed app is fixed to " + deployed.owner + "/" + deployed.repository + " · " + deployed.branch + " · " + deployed.path + ". Update config.js and deploy before changing that public location.");
    }
    return settings;
  }

  function formCredentials() {
    const settings = cleanSettings({
      owner: $("#cloudOwner").value, repository: $("#cloudRepository").value,
      branch: $("#cloudBranch").value, path: $("#cloudPath").value
    });
    const token = $("#cloudToken").value.trim() || storedToken();
    if (!token) throw new Error("Enter a fine-grained GitHub token with Contents read/write access to the public encrypted-data repository.");
    return { settings: settings, token: token };
  }

  function populateSettings() {
    const settings = storedSettings();
    $("#cloudOwner").value = settings.owner;
    $("#cloudRepository").value = settings.repository;
    $("#cloudBranch").value = settings.branch;
    $("#cloudPath").value = settings.path;
    $("#cloudToken").value = storedToken();
    $("#cloudRememberToken").checked = Boolean(localStorage.getItem(config.storage.cloudTokenKey));
    $("#cloudSettingsSummary").textContent = settings.owner + "/" + settings.repository + " · " + settings.branch + " · " + settings.path;
  }

  function repositoryUrl(settings) {
    return "https://api.github.com/repos/" + encodeURIComponent(settings.owner) + "/" + encodeURIComponent(settings.repository);
  }

  function contentsUrl(settings) {
    return repositoryUrl(settings) + "/contents/" + settings.path.split("/").map(encodeURIComponent).join("/");
  }

  function publicVaultUrl() {
    const localOverride = new URLSearchParams(location.search).get("vault");
    if (["127.0.0.1", "localhost", "::1"].includes(location.hostname) && localOverride && /^\/[A-Za-z0-9._/-]+\.json$/.test(localOverride)) {
      return new URL(localOverride, location.origin).href;
    }
    const settings = settingsDefaults();
    return "https://raw.githubusercontent.com/" + encodeURIComponent(settings.owner) + "/" + encodeURIComponent(settings.repository) + "/" + encodeURIComponent(settings.branch) + "/" + settings.path.split("/").map(encodeURIComponent).join("/");
  }

  function githubHeaders(token) {
    return { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "X-GitHub-Api-Version": config.cloud.apiVersion };
  }

  async function responseError(response) {
    let message = "";
    try { message = u.cleanText((await response.json()).message, 500); } catch (error) { message = ""; }
    if (response.status === 401) return new Error("GitHub rejected this token. Create a new fine-grained token and try again.");
    if (response.status === 403) return new Error("GitHub denied access. Give the token Contents read/write permission for this repository.");
    if (response.status === 404) return new Error("GitHub could not find the repository, branch, or encrypted vault path, or the token cannot access it.");
    if ([409, 422].includes(response.status)) return new Error("The hosted vault changed while you were publishing. Reload and sign in again before publishing.");
    return new Error(message || "GitHub returned " + response.status + ".");
  }

  async function verifyTarget(settings, token) {
    const repoResponse = await fetch(repositoryUrl(settings), { headers: githubHeaders(token), cache: "no-store" });
    if (!repoResponse.ok) throw await responseError(repoResponse);
    const repository = await repoResponse.json();
    if (repository.private) throw new Error("Link-only passphrase access requires a public repository containing encrypted ciphertext only. Make " + settings.owner + "/" + settings.repository + " public first.");
    const branchResponse = await fetch(repositoryUrl(settings) + "/branches/" + encodeURIComponent(settings.branch), { headers: githubHeaders(token), cache: "no-store" });
    if (!branchResponse.ok) throw await responseError(branchResponse);
    return repository;
  }

  function bytesToBase64(bytes) {
    let result = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) result += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
    return btoa(result);
  }

  function base64ToBytes(value, label) {
    const clean = String(value || "");
    if (!clean || clean.length > config.cloud.maxVaultBytes * 2 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) throw new Error(label + " is damaged.");
    let binary;
    try { binary = atob(clean); } catch (error) { throw new Error(label + " is damaged."); }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  async function importDataKey(raw) {
    if (!(raw instanceof Uint8Array) || raw.length !== 32) throw new Error("An encrypted family key is damaged.");
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }

  async function derivePassphraseKey(passphrase, salt, iterations) {
    const normalized = String(passphrase || "").trim().normalize("NFKC");
    const material = await crypto.subtle.importKey("raw", encoder.encode(normalized), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function encryptBytes(bytes, key, context) {
    const iv = randomBytes(12);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv, additionalData: encoder.encode(context), tagLength: 128 }, key, bytes));
    return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
  }

  async function decryptBytes(payload, key, context) {
    try {
      const iv = base64ToBytes(payload.iv, "Encryption nonce");
      if (iv.length !== 12) throw new Error("bad nonce");
      const ciphertext = base64ToBytes(payload.ciphertext, "Encrypted family data");
      return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv, additionalData: encoder.encode(context), tagLength: 128 }, key, ciphertext));
    } catch (error) {
      throw new Error("The passphrase is incorrect or the encrypted family record is damaged.");
    }
  }

  function modeForGrant(id, suppliedMode) {
    const cleanId = u.cleanLine(id, 64);
    const expectedMode = FIXED_GRANT_MODES[cleanId] || (/^editor(?:-[a-f0-9]{16})?$/.test(cleanId) ? "editor" : "");
    if (!expectedMode || (suppliedMode && suppliedMode !== expectedMode)) throw new Error("The encrypted vault contains an invalid access grant.");
    return expectedMode;
  }

  function definitionForGrant(grantOrId, suppliedMode) {
    const id = typeof grantOrId === "string" ? grantOrId : grantOrId && grantOrId.id;
    const mode = typeof grantOrId === "string" ? suppliedMode : grantOrId && grantOrId.mode;
    return ROLE_DEFINITIONS[modeForGrant(id, mode)];
  }

  function validatePassphrase(passphrase) {
    const clean = String(passphrase || "").trim();
    if (clean.length < config.cloud.minPassphraseLength) throw new Error("Use a passphrase containing at least " + config.cloud.minPassphraseLength + " characters.");
    return clean;
  }

  async function wrapGrant(id, label, passphrase, keys, mode) {
    const definition = definitionForGrant(id, mode);
    const salt = randomBytes(16);
    const iterations = config.cloud.passphraseIterations;
    const passphraseKey = await derivePassphraseKey(validatePassphrase(passphrase), salt, iterations);
    const payload = { version: 1 };
    if (definition.fullKey) payload.fullKey = bytesToBase64(keys.full);
    if (definition.redactedKey) payload.redactedKey = bytesToBase64(keys.redacted);
    const wrapped = await encryptBytes(encoder.encode(JSON.stringify(payload)), passphraseKey, config.cloud.vaultFormat + ":grant:" + id);
    return { id: id, label: u.cleanLine(label, 80) || definition.label, mode: definition.mode, iterations: iterations, salt: bytesToBase64(salt), wrapped: wrapped };
  }

  async function unwrapGrant(grant, passphrase) {
    const passphraseKey = await derivePassphraseKey(passphrase, base64ToBytes(grant.salt, "Passphrase salt"), grant.iterations);
    const bytes = await decryptBytes(grant.wrapped, passphraseKey, config.cloud.vaultFormat + ":grant:" + grant.id);
    let payload;
    try { payload = JSON.parse(decoder.decode(bytes)); } catch (error) { throw new Error("The passphrase is incorrect or its access grant is damaged."); }
    if (Number(payload.version) !== 1) throw new Error("The passphrase access grant uses an unsupported key format.");
    const definition = definitionForGrant(grant);
    const keys = {};
    if (definition.fullKey) keys.full = base64ToBytes(payload.fullKey, "Full-data key");
    if (definition.redactedKey) keys.redacted = base64ToBytes(payload.redactedKey, "Redacted-data key");
    return keys;
  }

  async function decryptVaultRecord(vaultInput, grantId, passphrase) {
    const vault = validateVault(vaultInput);
    const grant = vault.grants.find(function (item) { return item.id === grantId; });
    if (!grant) throw new Error("That access grant is no longer active.");
    const keys = await unwrapGrant(grant, passphrase);
    const definition = definitionForGrant(grant);
    const dataKind = definition.stateMode === "redacted-viewer" ? "redacted" : "full";
    const rawKey = dataKind === "redacted" ? keys.redacted : keys.full;
    const bytes = await decryptBytes(vault.data[dataKind], await importDataKey(rawKey), config.cloud.vaultFormat + ":data:" + dataKind);
    const prepared = await portability.prepareBytes(bytes, "Encrypted McFamily " + dataKind + " record");
    const packageMode = portability.accessModeFor(prepared.state);
    if (dataKind === "full" && packageMode !== "editor") throw new Error("The full encrypted record is not an Editor dataset.");
    if (dataKind === "redacted" && packageMode !== "redacted-viewer") throw new Error("The redacted encrypted record is incorrectly labelled.");
    if (portability.datasetVersionFor(prepared.state) !== vault.datasetVersion) throw new Error("The encrypted vault and family package versions do not match.");
    prepared.state.meta.package.accessMode = definition.stateMode;
    return { vault: vault, grant: grant, keys: keys, prepared: prepared };
  }

  function validateEncryptedPayload(payload, label) {
    const source = u.plainObject(payload);
    const iv = base64ToBytes(source.iv, label + " nonce");
    if (iv.length !== 12) throw new Error(label + " nonce is damaged.");
    base64ToBytes(source.ciphertext, label + " ciphertext");
    return { iv: source.iv, ciphertext: source.ciphertext };
  }

  function validateVault(input) {
    const source = u.plainObject(input);
    if (source.format !== config.cloud.vaultFormat || Number(source.version) !== config.cloud.vaultVersion) throw new Error("The hosted file is not a supported McFamily encrypted vault.");
    const revision = Number(source.revision);
    if (!Number.isInteger(revision) || revision < 1) throw new Error("The encrypted vault revision is invalid.");
    const grants = Array.isArray(source.grants) ? source.grants : [];
    if (!grants.length || grants.length > config.cloud.maxAccessGrants) throw new Error("The encrypted vault contains too many access grants.");
    const used = new Set();
    const usedLabels = new Set();
    let editorCount = 0;
    const normalizedGrants = grants.map(function (item) {
      const grant = u.plainObject(item);
      const id = u.cleanLine(grant.id, 64);
      const definition = definitionForGrant(id, grant.mode);
      if (used.has(id)) throw new Error("The encrypted vault contains a duplicate access grant.");
      used.add(id);
      if (definition.mode === "editor") editorCount += 1;
      const label = u.cleanLine(grant.label, 80);
      const normalizedLabel = label.toLowerCase();
      if (!label || usedLabels.has(normalizedLabel)) throw new Error("Every access grant must have a unique shown name.");
      usedLabels.add(normalizedLabel);
      const iterations = Number(grant.iterations);
      if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) throw new Error("An access grant uses an unsupported passphrase strength.");
      const salt = base64ToBytes(grant.salt, "Passphrase salt");
      if (salt.length !== 16) throw new Error("An access grant salt is damaged.");
      return { id: id, label: label, mode: definition.mode, iterations: iterations, salt: grant.salt, wrapped: validateEncryptedPayload(grant.wrapped, "Access grant") };
    });
    if (!used.has("owner")) throw new Error("The encrypted vault has no Owner grant.");
    if (editorCount > config.cloud.maxEditors) throw new Error("The encrypted vault contains more editors than McFamily allows.");
    const datasetVersion = u.cleanLine(source.datasetVersion, 40);
    if (!portability.isSupportedDatasetVersion(datasetVersion)) throw new Error("The encrypted vault dataset version is not supported.");
    const updatedAtValue = u.cleanLine(source.updatedAt, 80);
    if (!Number.isFinite(Date.parse(updatedAtValue))) throw new Error("The encrypted vault update time is invalid.");
    return {
      format: source.format, version: Number(source.version), revision: revision,
      datasetVersion: datasetVersion, updatedAt: new Date(updatedAtValue).toISOString(),
      data: { full: validateEncryptedPayload(u.plainObject(source.data).full, "Full family"), redacted: validateEncryptedPayload(u.plainObject(source.data).redacted, "Redacted family") },
      grants: normalizedGrants
    };
  }

  async function fetchPublicVault() {
    const response = await fetch(publicVaultUrl() + "?revision=" + Date.now(), { cache: "no-store", headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("The encrypted family record could not be reached (" + response.status + ").");
    const text = await response.text();
    if (encoder.encode(text).length > config.cloud.maxVaultBytes) throw new Error("The encrypted family record is larger than McFamily allows.");
    let parsed;
    try { parsed = JSON.parse(text); } catch (error) { throw new Error("The hosted encrypted family record is not valid JSON."); }
    return validateVault(parsed);
  }

  async function readVaultApi(settings, token, allowMissing) {
    const response = await fetch(contentsUrl(settings) + "?ref=" + encodeURIComponent(settings.branch), { headers: githubHeaders(token), cache: "no-store" });
    if (response.status === 404 && allowMissing) return null;
    if (!response.ok) throw await responseError(response);
    const file = await response.json();
    if (!file || file.type !== "file" || !file.sha) throw new Error("The configured encrypted vault path is not a file.");
    if (Number(file.size) > config.cloud.maxVaultBytes) throw new Error("The hosted encrypted vault is too large.");
    let bytes;
    if (file.content) bytes = base64ToBytes(String(file.content).replace(/\s/g, ""), "GitHub vault content");
    else {
      const blobResponse = await fetch(file.git_url, { headers: githubHeaders(token), cache: "no-store" });
      if (!blobResponse.ok) throw await responseError(blobResponse);
      const blob = await blobResponse.json();
      bytes = base64ToBytes(String(blob.content || "").replace(/\s/g, ""), "GitHub vault content");
    }
    let parsed;
    try { parsed = JSON.parse(decoder.decode(bytes)); } catch (error) { throw new Error("GitHub contains a damaged encrypted vault JSON file."); }
    return { sha: file.sha, vault: validateVault(parsed) };
  }

  async function writeVault(settings, token, vault, sha, message) {
    const validated = validateVault(vault);
    const bytes = encoder.encode(JSON.stringify(validated));
    if (bytes.length > config.cloud.maxVaultBytes) throw new Error("The encrypted vault is too large to publish.");
    const body = { message: "McFamily: " + u.cleanLine(message, 120), content: bytesToBase64(bytes), branch: settings.branch };
    if (sha) body.sha = sha;
    const response = await fetch(contentsUrl(settings), {
      method: "PUT", headers: Object.assign({}, githubHeaders(token), { "Content-Type": "application/json" }), body: JSON.stringify(body)
    });
    if (!response.ok) throw await responseError(response);
    const result = await response.json();
    return { sha: result.content && result.content.sha || "", vault: validated };
  }

  function uniqueAuditId(state) {
    const ids = new Set(state.meta.package.auditHistory.map(function (audit) { return audit.id; }));
    let id = portability.auditId();
    let suffix = 1;
    while (ids.has(id)) id = portability.auditId() + "_" + suffix++;
    return id;
  }

  function publishedState(action, actor, details) {
    const next = u.clone(storage.getState());
    const now = u.isoNow();
    const nextVersion = portability.nextDatasetPatch(portability.datasetVersionFor(next));
    next.meta.updatedAt = now;
    next.meta.package.accessMode = "editor";
    next.meta.package.datasetVersion = nextVersion;
    next.meta.package.auditHistory.push({ id: uniqueAuditId(next), subject: "Dataset " + nextVersion, action: action, recordedAt: now, recordedBy: actor, details: details });
    return next;
  }

  async function buildVault(state, keys, grants, revision) {
    const fullState = u.clone(state);
    fullState.meta.package.accessMode = "editor";
    const fullBytes = portability.packageBytes(fullState);
    await portability.prepareBytes(fullBytes, "McFamily full encrypted record");
    const redactedState = portability.accessState(fullState, "redacted-viewer");
    const redactedBytes = portability.packageBytes(redactedState);
    await portability.prepareBytes(redactedBytes, "McFamily redacted encrypted record");
    const fullKey = await importDataKey(keys.full);
    const redactedKey = await importDataKey(keys.redacted);
    return validateVault({
      format: config.cloud.vaultFormat, version: config.cloud.vaultVersion, revision: revision,
      datasetVersion: portability.datasetVersionFor(fullState), updatedAt: fullState.meta.updatedAt,
      data: {
        full: await encryptBytes(fullBytes, fullKey, config.cloud.vaultFormat + ":data:full"),
        redacted: await encryptBytes(redactedBytes, redactedKey, config.cloud.vaultFormat + ":data:redacted")
      },
      grants: grants
    });
  }

  function accessProfile() {
    if (!activeSession) return null;
    const definition = definitionForGrant(activeSession.grant);
    return { id: activeSession.grant.id, mode: definition.stateMode, label: activeSession.grant.label || definition.label, canManage: definition.canManage, canPublish: definition.canPublish };
  }

  function setStatus(kind, title, message) {
    const pill = $("#cloudStatusPill");
    pill.textContent = title;
    pill.dataset.kind = kind;
    $("#cloudHeaderStatus").textContent = title;
    $("#cloudStatusText").textContent = message;
    const summary = $(".cloud-connection-summary");
    if (summary) summary.dataset.kind = kind;
  }

  function renderConnection() {
    const target = settingsDefaults();
    $("#cloudConnectionTarget").textContent = target.owner + "/" + target.repository + " · " + target.branch + " · " + target.path;
    if (currentVault) {
      $("#cloudConnectionState").textContent = "Encrypted vault revision " + currentVault.revision;
      setStatus("success", "Dataset " + currentVault.datasetVersion, "Latest encrypted family record: dataset " + currentVault.datasetVersion + " · published " + new Date(currentVault.updatedAt).toLocaleString() + ".");
    } else {
      $("#cloudConnectionState").textContent = "Not published yet";
      setStatus("warning", "Owner setup", "Connect the public encrypted-data repository and publish the first passphrase vault.");
    }
  }

  function displayAction(value) {
    return ({
      "published-hosted-family": "Published family update", "updated-hosted-access": "Changed passphrase access",
      "created-hosted-access": "Created hosted access", "imported-package": "Opened recovery file", "exported-package": "Downloaded recovery file"
    })[value] || String(value || "Updated family").replace(/[-_]+/g, " ");
  }

  function renderAudit() {
    const audits = storage.getState().meta.package.auditHistory.slice().reverse();
    const list = $("#cloudAuditList");
    list.replaceChildren();
    $("#cloudAuditCount").textContent = audits.length + " change" + (audits.length === 1 ? "" : "s");
    if (!audits.length) {
      const empty = document.createElement("li");
      empty.className = "cloud-audit-empty";
      empty.textContent = "No published changes are recorded yet.";
      list.appendChild(empty);
      return;
    }
    audits.slice(0, 250).forEach(function (audit) {
      const item = document.createElement("li");
      const header = document.createElement("div");
      const action = document.createElement("strong");
      const subject = document.createElement("span");
      action.textContent = displayAction(audit.action);
      subject.textContent = audit.subject || "McFamily";
      header.append(action, subject);
      const meta = document.createElement("small");
      meta.textContent = new Date(audit.recordedAt).toLocaleString() + (audit.recordedBy ? " · " + audit.recordedBy : "");
      const details = document.createElement("p");
      details.textContent = audit.details || "No additional description.";
      item.append(header, meta, details);
      list.appendChild(item);
    });
  }

  function uniqueEditorGrantId() {
    const existing = new Set($$("[data-grant-row]").map(function (row) { return row.dataset.grantRow; }));
    let id = "";
    do { id = "editor-" + Array.from(randomBytes(8), function (byte) { return byte.toString(16).padStart(2, "0"); }).join(""); }
    while (existing.has(id));
    return id;
  }

  function createEditorGrantRow(grant) {
    const fragment = $("#hostedEditorGrantTemplate").content.cloneNode(true);
    const row = $("[data-grant-row]", fragment);
    const id = grant && grant.id || uniqueEditorGrantId();
    row.dataset.grantRow = id;
    row.dataset.grantMode = "editor";
    $("[data-grant-label]", row).value = grant && grant.label || "";
    const passphrase = $("[data-grant-passphrase]", row);
    passphrase.placeholder = grant ? "Keep current passphrase" : "Enter 8+ characters";
    $("[data-remove-editor]", row).textContent = grant ? "Revoke" : "Remove";
    return row;
  }

  function addEditorGrantRow(grant) {
    const list = $("#hostedEditorGrantList");
    const row = createEditorGrantRow(grant);
    list.appendChild(row);
    $("#hostedEditorEmpty").hidden = true;
    return row;
  }

  function updateDraftGrantCount() {
    const enabledFixed = $$("[data-grant-row]:not([data-grant-mode='editor'])").filter(function (row) {
      return row.dataset.grantRow === "owner" || $("[data-grant-enabled]", row).checked;
    }).length;
    $("#hostedGrantCount").textContent = (enabledFixed + $$("#hostedEditorGrantList [data-grant-row]").length) + " active after publishing";
  }

  function renderGrantRows() {
    const allGrants = currentVault && currentVault.grants || [];
    const grants = new Map(allGrants.map(function (grant) { return [grant.id, grant]; }));
    ["owner", "pii", "redacted"].forEach(function (id) {
      const row = $('[data-grant-row="' + id + '"]');
      const grant = grants.get(id);
      const enabled = $("[data-grant-enabled]", row);
      enabled.checked = id === "owner" || (currentVault ? Boolean(grant) : true);
      const label = $("[data-grant-label]", row);
      label.value = grant && grant.label || definitionForGrant(id).label;
      const passphrase = $("[data-grant-passphrase]", row);
      passphrase.value = "";
      passphrase.placeholder = grant ? "Keep current passphrase" : "Enter 8+ characters";
    });
    const editorList = $("#hostedEditorGrantList");
    editorList.replaceChildren();
    allGrants.filter(function (grant) { return grant.mode === "editor"; }).forEach(addEditorGrantRow);
    $("#hostedEditorEmpty").hidden = Boolean(editorList.children.length);
    $("#hostedGrantCount").textContent = (currentVault ? allGrants.length : 0) + " active";
  }

  function renderAccessState() {
    const profile = accessProfile();
    const editor = Boolean(profile && profile.canPublish);
    const owner = Boolean(profile && profile.canManage);
    document.querySelectorAll("[data-editor-only]").forEach(function (element) { element.classList.toggle("access-hidden", !editor); });
    document.querySelectorAll("[data-owner-only]").forEach(function (element) { element.classList.toggle("access-hidden", !owner); });
    const pill = $("#currentAccessName");
    pill.textContent = profile ? profile.label : "Locked";
    pill.dataset.kind = owner ? "success" : editor ? "success" : profile && profile.mode === "pii-viewer" ? "warning" : "neutral";
    if (!profile) $("#currentAccessDescription").textContent = "Enter an active passphrase to open the encrypted family record.";
    else if (owner) $("#currentAccessDescription").textContent = "Owner access can view and edit the full family, publish changes, and add, rotate, or revoke passphrases.";
    else if (editor) $("#currentAccessDescription").textContent = "Editor access can view and edit the full family and publish an audited update. Passphrase management is reserved for the Owner.";
    else if (profile.mode === "pii-viewer") $("#currentAccessDescription").textContent = "Private read-only access includes addresses and contacts. Editing, recovery files, PDF, developer data, and publishing are unavailable.";
    else $("#currentAccessDescription").textContent = "Redacted read-only access includes lineage and family relationships without addresses, contacts, or private notes. Editing and exports are unavailable.";
    $("#hostedPublishSection").classList.toggle("access-hidden", !editor || !currentVault);
    $("#hostedVersionChange").textContent = currentVault ? currentVault.datasetVersion + " → next patch" : "First publication";
    renderConnection();
    renderAudit();
    if (owner) renderGrantRows();
  }

  function setBusy(value, message) {
    busy = value;
    components.setLoading(value, message || "Working with the encrypted family record…");
    ["hostedPublishButton", "hostedAccessPublishButton", "cloudTestButton", "cloudSaveButton", "cloudForgetButton", "hostedLockButton"].forEach(function (id) {
      const button = $("#" + id);
      if (button) button.disabled = value;
    });
  }

  function gateStatus(message, kind) {
    const status = $("#accessGateStatus");
    status.textContent = message;
    status.className = "inline-status" + (kind ? " " + kind : "");
  }

  function showGate(vault, error) {
    const select = $("#accessGrantSelect");
    select.replaceChildren();
    if (vault) {
      const prompt = document.createElement("option");
      prompt.value = "";
      prompt.textContent = "Choose your access";
      select.appendChild(prompt);
      vault.grants.forEach(function (grant) {
        const option = document.createElement("option");
        option.value = grant.id;
        option.textContent = grant.label;
        select.appendChild(option);
      });
      select.disabled = false;
      $("#accessPassphrase").disabled = false;
      $("#accessUnlockButton").disabled = false;
      $("#accessRetryButton").hidden = true;
      $("#accessOwnerRecovery").hidden = true;
      gateStatus("The latest encrypted family record is ready. Your passphrase stays on this device.", "success");
    } else {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Access is not available";
      select.appendChild(option);
      select.disabled = true;
      $("#accessPassphrase").disabled = true;
      $("#accessUnlockButton").disabled = true;
      $("#accessRetryButton").hidden = false;
      $("#accessOwnerRecovery").hidden = false;
      gateStatus(error || "The Owner has not published the encrypted family record yet.", "warning");
    }
    const dialog = $("#accessGateDialog");
    if (!dialog.open) dialog.showModal();
  }

  function finishUnlock() {
    document.body.classList.remove("access-locked");
    const dialog = $("#accessGateDialog");
    if (dialog.open) dialog.close("unlocked");
    if (gateResolve) { const resolve = gateResolve; gateResolve = null; resolve(); }
  }

  async function unlockSelected(event) {
    event.preventDefault();
    if (busy || !currentVault) return;
    const id = $("#accessGrantSelect").value;
    const grant = currentVault.grants.find(function (item) { return item.id === id; });
    if (!grant) { gateStatus("Choose your name first.", "danger"); return; }
    const passphrase = $("#accessPassphrase").value;
    if (!passphrase) { gateStatus("Enter your passphrase.", "danger"); return; }
    try {
      setBusy(true, "Opening the encrypted family record…");
      const opened = await decryptVaultRecord(currentVault, grant.id, passphrase);
      activeSession = { grant: opened.grant, keys: opened.keys };
      localStorage.setItem(config.storage.hostedSeenKey, "1");
      storage.replace(opened.prepared.state, { saveRecovery: false, reason: "hosted-unlock", touch: false });
      $("#accessPassphrase").value = "";
      renderAccessState();
      finishUnlock();
    } catch (error) {
      gateStatus(error.message || "McFamily could not open that access.", "danger");
      $("#accessPassphrase").select();
    } finally { setBusy(false); }
  }

  function generatePassphrase() {
    const words = [];
    for (let index = 0; index < 3; index += 1) words.push(PASSPHRASE_WORDS[randomBytes(1)[0] % PASSPHRASE_WORDS.length]);
    return words.join("-");
  }

  async function collectGrants(keys) {
    const existing = new Map((currentVault && currentVault.grants || []).map(function (grant) { return [grant.id, grant]; }));
    const grants = [];
    const usedLabels = new Set();
    for (const row of $$("[data-grant-row]")) {
      const id = row.dataset.grantRow;
      const mode = row.dataset.grantMode || modeForGrant(id);
      const enabledControl = $("[data-grant-enabled]", row);
      const enabled = id === "owner" || !enabledControl || enabledControl.checked;
      if (!enabled) continue;
      const label = u.cleanLine($("[data-grant-label]", row).value, 80);
      if (!label) throw new Error((mode === "editor" ? "Every editor needs a username" : definitionForGrant(id, mode).label + " needs a shown name") + ".");
      const normalizedLabel = label.toLowerCase();
      if (usedLabels.has(normalizedLabel)) throw new Error("Each person needs a unique shown name for sign-in and auditing.");
      usedLabels.add(normalizedLabel);
      const passphrase = $("[data-grant-passphrase]", row).value;
      if (!passphrase && existing.has(id)) grants.push(Object.assign({}, existing.get(id), { label: label }));
      else if (passphrase) grants.push(await wrapGrant(id, label, passphrase, keys, mode));
      else throw new Error(label + " needs a new passphrase before it can be enabled.");
    }
    if (!grants.some(function (grant) { return grant.id === "owner"; })) throw new Error("Owner access cannot be removed.");
    return grants;
  }

  async function publishAccessChanges() {
    const profile = accessProfile();
    if (busy || !profile || !profile.canManage) return;
    const visiblePassphrases = new Map($$("[data-grant-row]").map(function (row) {
      return [row.dataset.grantRow, $("[data-grant-passphrase]", row).value];
    }));
    try {
      const credentials = formCredentials();
      saveCredentials(credentials.settings, credentials.token);
      setBusy(true, currentVault ? "Encrypting new access grants…" : "Creating the first encrypted family vault…");
      await verifyTarget(credentials.settings, credentials.token);
      const remote = await readVaultApi(credentials.settings, credentials.token, true);
      if (currentVault && (!remote || remote.vault.revision !== currentVault.revision)) throw new Error("The hosted vault changed. Reload and sign in again before changing access.");
      if (!currentVault && remote) throw new Error("An encrypted vault already exists. Reload and sign in as Owner before replacing it.");
      const keys = activeSession && activeSession.keys && activeSession.keys.full && activeSession.keys.redacted
        ? activeSession.keys : { full: randomBytes(32), redacted: randomBytes(32) };
      const grants = await collectGrants(keys);
      const ownerGrant = grants.find(function (grant) { return grant.id === "owner"; });
      const actor = currentVault ? profile.label : ownerGrant.label;
      const action = currentVault ? "updated-hosted-access" : "created-hosted-access";
      const nextState = publishedState(action, actor, currentVault ? "Added, rotated, or revoked hosted passphrase access. Secret values are not recorded." : "Created the encrypted hosted family record and its first access grants.");
      const nextVault = await buildVault(nextState, keys, grants, (currentVault ? currentVault.revision : 0) + 1);
      const written = await writeVault(credentials.settings, credentials.token, nextVault, remote && remote.sha || "", currentVault ? "update passphrase access" : "create encrypted family vault");
      currentVault = written.vault;
      activeSession = { grant: currentVault.grants.find(function (grant) { return grant.id === "owner"; }), keys: keys };
      localStorage.setItem(config.storage.hostedSeenKey, "1");
      storage.replace(nextState, { saveRecovery: true, recoveryReason: "Before hosted access publication", reason: "hosted-access-publish", touch: false });
      renderAccessState();
      visiblePassphrases.forEach(function (value, id) {
        if (value) $("[data-grant-passphrase]", $('[data-grant-row="' + id + '"]')).value = value;
      });
      components.toast("The encrypted hosted vault is live. Copy any newly generated passphrases before closing this window.", { title: currentVault.revision === 1 ? "Hosted access created" : "Access updated", kind: "success", duration: 8000 });
    } catch (error) {
      setStatus("danger", "Access not published", error.message || "The passphrase changes could not be published.");
      components.message("Access changes not published", error.message || "The passphrase changes could not be published.", { trigger: $("#hostedAccessPublishButton") });
    } finally { setBusy(false); }
  }

  async function publishCurrentFamily() {
    const profile = accessProfile();
    if (busy || !profile || !profile.canPublish || !currentVault || !activeSession.keys.full || !activeSession.keys.redacted) return;
    const actor = profile.label;
    const summary = u.cleanText($("#hostedAuditSummary").value, 4000).trim();
    if (!summary) {
      components.message("Audit summary required", "Enter a short description of what changed before publishing.", { trigger: $("#hostedPublishButton") });
      $("#hostedAuditSummary").focus();
      return;
    }
    try {
      const credentials = formCredentials();
      saveCredentials(credentials.settings, credentials.token);
      setBusy(true, "Validating and encrypting the family update…");
      await verifyTarget(credentials.settings, credentials.token);
      const remote = await readVaultApi(credentials.settings, credentials.token, false);
      if (remote.vault.revision !== currentVault.revision) throw new Error("Someone published a newer vault. Reload and sign in again before publishing your changes.");
      const nextState = publishedState("published-hosted-family", actor, summary);
      const nextVault = await buildVault(nextState, activeSession.keys, currentVault.grants, currentVault.revision + 1);
      const written = await writeVault(credentials.settings, credentials.token, nextVault, remote.sha, "publish dataset " + portability.datasetVersionFor(nextState));
      currentVault = written.vault;
      activeSession.grant = currentVault.grants.find(function (grant) { return grant.id === activeSession.grant.id; });
      storage.replace(nextState, { saveRecovery: true, recoveryReason: "Before hosted dataset " + portability.datasetVersionFor(nextState), reason: "hosted-family-publish", touch: false });
      $("#hostedAuditSummary").value = "";
      renderAccessState();
      components.toast("Everyone can open dataset " + currentVault.datasetVersion + " with their existing active passphrase.", { title: "Family update published", kind: "success", duration: 7000 });
    } catch (error) {
      setStatus("danger", "Publish failed", error.message || "The encrypted family update could not be published.");
      components.message("Family update not published", error.message || "The encrypted family update could not be published.", { trigger: $("#hostedPublishButton") });
    } finally { setBusy(false); }
  }

  function saveSettings() {
    try {
      const credentials = formCredentials();
      saveCredentials(credentials.settings, credentials.token);
      populateSettings();
      components.toast("GitHub connection settings were saved on this device.", { title: "Connection saved", kind: "success" });
    } catch (error) { components.message("Connection not saved", error.message, { trigger: $("#cloudSaveButton") }); }
  }

  async function testConnection() {
    try {
      const credentials = formCredentials();
      saveCredentials(credentials.settings, credentials.token);
      setBusy(true, "Testing the public encrypted-data repository…");
      await verifyTarget(credentials.settings, credentials.token);
      const remote = await readVaultApi(credentials.settings, credentials.token, true);
      components.toast(remote ? "The public repository and encrypted vault are accessible." : "The public repository is ready for the first encrypted vault.", { title: "Connection verified", kind: "success" });
    } catch (error) { components.message("Connection error", error.message, { trigger: $("#cloudTestButton") }); }
    finally { setBusy(false); }
  }

  function forgetConnection() {
    localStorage.removeItem(config.storage.cloudSettingsKey);
    localStorage.removeItem(config.storage.cloudTokenKey);
    sessionStorage.removeItem(config.storage.cloudTokenKey);
    populateSettings();
    components.toast("The GitHub token and local connection settings were removed from this device.", { title: "Connection forgotten", kind: "success" });
  }

  async function lockApplication() {
    if (busy) return;
    const profile = accessProfile();
    if (profile && profile.canPublish) {
      const accepted = await components.confirm({
        title: "Lock McFamily?", message: "Any changes that have not been published will be removed from this browser. The encrypted hosted record will not change.",
        confirmLabel: "Lock McFamily", cancelLabel: "Keep working", danger: true, trigger: $("#hostedLockButton")
      });
      if (!accepted) return;
    }
    activeSession = null;
    currentVault = null;
    storage.clearAll();
    location.reload();
  }

  function openDialog() {
    populateSettings();
    if (activeSession && activeSession.grant) $("#hostedRecordedBy").value = activeSession.grant.label;
    renderAccessState();
    components.openDialog("#cloudAuditDialog", { trigger: $("#cloudAuditButton"), focus: currentVault ? "#hostedLockButton" : "#cloudToken" });
  }

  async function loadHostedGate() {
    gateStatus("Checking for the latest encrypted family record…", "");
    $("#accessRetryButton").hidden = true;
    const localDevelopment = ["127.0.0.1", "localhost", "::1"].includes(location.hostname) && new URLSearchParams(location.search).get("local") === "1";
    if (localDevelopment && initialized()) {
      const mode = portability.accessModeFor(storage.getState());
      const id = mode === "pii-viewer" ? "pii" : mode === "redacted-viewer" ? "redacted" : "owner";
      const definition = definitionForGrant(id);
      activeSession = { grant: { id: id, mode: definition.mode, label: "Local " + definition.label }, keys: {} };
      renderAccessState();
      finishUnlock();
      return;
    }
    try {
      const vault = await fetchPublicVault();
      if (vault) {
        currentVault = vault;
        localStorage.setItem(config.storage.hostedSeenKey, "1");
        showGate(vault);
        return;
      }
      const seen = localStorage.getItem(config.storage.hostedSeenKey) === "1";
      const localOwner = initialized() && portability.accessModeFor(storage.getState()) === "editor" && !seen;
      if (localOwner) {
        activeSession = { grant: { id: "owner", mode: "owner", label: "Owner Setup" }, keys: {} };
        renderAccessState();
        finishUnlock();
        return;
      }
      showGate(null, "The Owner has not published the encrypted family record yet.");
    } catch (error) {
      showGate(null, error.message || "The encrypted family record could not be reached. Check the connection and try again.");
    }
  }

  function bindEvents() {
    $("#accessGateForm").addEventListener("submit", unlockSelected);
    $("#accessRetryButton").addEventListener("click", loadHostedGate);
    $("#accessOwnerRecoveryButton").addEventListener("click", function () { $("#accessOwnerRecoveryInput").click(); });
    $("#accessPassphraseVisibility").addEventListener("click", function () {
      const input = $("#accessPassphrase");
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      this.textContent = showing ? "Show" : "Hide";
      this.setAttribute("aria-pressed", String(!showing));
    });
    $("#cloudAuditButton").addEventListener("click", openDialog);
    $("#hostedLockButton").addEventListener("click", lockApplication);
    $("#hostedPublishButton").addEventListener("click", publishCurrentFamily);
    $("#hostedAccessPublishButton").addEventListener("click", publishAccessChanges);
    $("#cloudSaveButton").addEventListener("click", saveSettings);
    $("#cloudTestButton").addEventListener("click", testConnection);
    $("#cloudForgetButton").addEventListener("click", forgetConnection);
    $("#hostedAccessManager").addEventListener("click", function (event) {
      const addEditor = event.target.closest("#hostedAddEditorButton");
      if (addEditor) {
        if ($$("#hostedEditorGrantList [data-grant-row]").length >= config.cloud.maxEditors) {
          components.message("Editor limit reached", "McFamily allows up to " + config.cloud.maxEditors + " separately named editors.", { trigger: addEditor });
          return;
        }
        const row = addEditorGrantRow();
        updateDraftGrantCount();
        $("[data-grant-label]", row).focus();
        return;
      }
      const removeEditor = event.target.closest("[data-remove-editor]");
      if (removeEditor) {
        removeEditor.closest("[data-grant-row]").remove();
        $("#hostedEditorEmpty").hidden = Boolean($("#hostedEditorGrantList").children.length);
        updateDraftGrantCount();
        return;
      }
      const generate = event.target.closest("[data-generate-passphrase]");
      if (!generate) return;
      const input = $("[data-grant-passphrase]", generate.closest("[data-grant-row]"));
      input.value = generatePassphrase();
      input.focus();
      input.select();
    });
    $("#hostedAccessManager").addEventListener("change", function (event) {
      if (event.target.matches("[data-grant-enabled]")) updateDraftGrantCount();
    });
    window.addEventListener("app:statechange", function () {
      if (activeSession) { renderAccessState(); return; }
      if (currentVault || !initialized() || portability.accessModeFor(storage.getState()) !== "editor") return;
      activeSession = { grant: { id: "owner", mode: "owner", label: "Owner Setup" }, keys: {} };
      renderAccessState();
      finishUnlock();
    });
  }

  async function init() {
    if (!window.crypto || !crypto.subtle) throw new Error("This browser does not support the encryption required by McFamily.");
    bindEvents();
    populateSettings();
    renderAccessState();
    const unlocked = new Promise(function (resolve) { gateResolve = resolve; });
    await loadHostedGate();
    if (activeSession) return;
    await unlocked;
  }

  App.cloud = {
    init: init,
    open: openDialog,
    currentAccess: accessProfile,
    canManageAccess: function () { const profile = accessProfile(); return Boolean(profile && profile.canManage); },
    canPublish: function () { const profile = accessProfile(); return Boolean(profile && profile.canPublish); },
    generatePassphrase: generatePassphrase,
    validateVault: validateVault,
    buildVault: buildVault,
    wrapGrant: wrapGrant,
    unwrapGrant: unwrapGrant,
    decryptVaultRecord: decryptVaultRecord
  };
})();
