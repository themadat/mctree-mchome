(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const u = App.utils;
  const model = App.stateModel;
  const storage = App.storage;
  const runtime = {
    busy: false,
    operation: "",
    checking: false,
    remoteSha: "",
    remoteHash: "",
    remoteState: null,
    remoteMissing: false,
    checkedAt: "",
    error: "",
    offline: navigator.onLine === false,
    requestSequence: 0,
    controller: null
  };

  function emit() {
    window.dispatchEvent(new CustomEvent("app:syncchange", { detail: { info: getInfo() } }));
  }

  function settings() {
    return storage.getState().modules.cloudSync;
  }

  function target(cloud) {
    const value = cloud || settings();
    return [value.owner, value.repo, value.branch, value.path].join("/");
  }

  function configured() {
    const cloud = settings();
    return Boolean(cloud.enabled && cloud.owner && cloud.repo && cloud.branch && cloud.path && storage.hasSecret());
  }

  function validateConfiguration(input, token) {
    const source = u.plainObject(input);
    const next = {
      owner: u.cleanLine(source.owner, 39),
      repo: u.cleanLine(source.repo, 100).replace(/\.git$/i, ""),
      branch: u.cleanLine(source.branch || "main", 250) || "main",
      path: u.cleanLine(source.path || "data/workspace.json", 500).replace(/^\/+/, "")
    };
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(next.owner)) throw new Error("Enter a valid GitHub owner or organization.");
    if (!/^[A-Za-z0-9._-]+$/.test(next.repo)) throw new Error("Enter a valid repository name.");
    if (!next.branch || /[\u0000-\u001f\u007f ~^:?*\[]/.test(next.branch) || next.branch.includes("..")) throw new Error("Enter a valid branch name.");
    const pathParts = next.path.split("/");
    if (!next.path || pathParts.some(function (part) { return !part || part === "." || part === ".."; }) || !/\.json$/i.test(next.path)) throw new Error("Enter a safe JSON data-file path.");
    if (!token && !storage.hasSecret()) throw new Error("Enter a fine-grained GitHub access token.");
    return next;
  }

  function saveConfiguration(input) {
    const token = u.cleanLine(input.token, 500);
    const next = validateConfiguration(input, token);
    const rememberToken = input.rememberToken !== false;
    const secret = token || storage.getSecret();
    const previousTarget = target();
    storage.mutate(function (state) {
      const cloud = state.modules.cloudSync;
      cloud.owner = next.owner;
      cloud.repo = next.repo;
      cloud.branch = next.branch;
      cloud.path = next.path;
      cloud.rememberToken = rememberToken;
      cloud.enabled = true;
      if (previousTarget !== target(cloud)) {
        cloud.baselineTarget = "";
        cloud.baselineSha = "";
        cloud.baselineHash = "";
        cloud.lastSyncedAt = "";
        cloud.lastCheckedAt = "";
      }
    }, { reason: "sync-settings" });
    storage.setSecret(secret, rememberToken);
    resetRuntime();
    emit();
    return next;
  }

  function resetRuntime() {
    if (runtime.controller) runtime.controller.abort();
    Object.assign(runtime, {
      busy: false,
      operation: "",
      checking: false,
      remoteSha: "",
      remoteHash: "",
      remoteState: null,
      remoteMissing: false,
      checkedAt: "",
      error: "",
      offline: navigator.onLine === false,
      requestSequence: runtime.requestSequence + 1,
      controller: null
    });
  }

  function apiRepositoryUrl(cloud) {
    return "https://api.github.com/repos/" + encodeURIComponent(cloud.owner) + "/" + encodeURIComponent(cloud.repo);
  }

  function apiContentsUrl(cloud) {
    return apiRepositoryUrl(cloud) + "/contents/" + cloud.path.split("/").map(encodeURIComponent).join("/");
  }

  function headers(token) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  async function responseError(response) {
    let detail = "";
    try { detail = u.cleanLine((await response.json()).message, 300); } catch (error) { detail = ""; }
    if (response.status === 401) return new Error("GitHub rejected the token. Create a new fine-grained token and try again.");
    if (response.status === 403) return new Error("GitHub denied access. Confirm that the token has Contents read and write permission.");
    if (response.status === 404) return new Error("GitHub could not find the repository or branch, or the token cannot access it.");
    if (response.status === 409 || response.status === 422) return new Error("The GitHub copy changed while syncing. Check again before choosing a copy.");
    return new Error(detail ? "GitHub: " + detail : "GitHub request failed (" + response.status + ").");
  }

  function requestContext(operation) {
    if (runtime.controller) runtime.controller.abort();
    runtime.requestSequence += 1;
    runtime.controller = typeof AbortController === "function" ? new AbortController() : null;
    runtime.operation = operation || "checking";
    return { sequence: runtime.requestSequence, signal: runtime.controller ? runtime.controller.signal : undefined };
  }

  function currentRequest(context) {
    return context.sequence === runtime.requestSequence;
  }

  function networkError(error) {
    return navigator.onLine === false || error instanceof TypeError || /failed to fetch|network|load failed/i.test(String(error && error.message || error));
  }

  async function verifyTarget(cloud, token, context) {
    const repositoryUrl = apiRepositoryUrl(cloud);
    const repository = await fetch(repositoryUrl, { headers: headers(token), signal: context.signal });
    if (!repository.ok) throw await responseError(repository);
    const branch = await fetch(repositoryUrl + "/branches/" + encodeURIComponent(cloud.branch), { headers: headers(token), signal: context.signal });
    if (!branch.ok) throw await responseError(branch);
  }

  async function readRemote(cloud, token, context, allowMissing) {
    const response = await fetch(apiContentsUrl(cloud) + "?ref=" + encodeURIComponent(cloud.branch), { headers: headers(token), signal: context.signal, cache: "no-store" });
    if (response.status === 404 && allowMissing) return null;
    if (!response.ok) throw await responseError(response);
    const file = await response.json();
    if (!file || file.type !== "file" || typeof file.content !== "string" || typeof file.sha !== "string") throw new Error("The configured GitHub path is not a readable file.");
    let decoded;
    try {
      const binary = atob(file.content.replace(/\s/g, ""));
      decoded = new TextDecoder().decode(Uint8Array.from(binary, function (character) { return character.charCodeAt(0); }));
    } catch (error) {
      throw new Error("The GitHub file could not be decoded.");
    }
    let parsed;
    try { parsed = JSON.parse(decoded); } catch (error) { throw new Error("The GitHub data file is not valid JSON."); }
    const prepared = model.prepare(parsed);
    return { state: prepared.state, sha: file.sha, migrations: prepared.migrations };
  }

  function utf8Base64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 32768));
    return btoa(binary);
  }

  async function writeRemote(cloud, token, context, state, sha) {
    const body = {
      message: "Update " + config.identity.shortName + " data (v" + config.identity.version + ")",
      content: utf8Base64(JSON.stringify(model.syncPayload(state), null, 2)),
      branch: cloud.branch
    };
    if (sha) body.sha = sha;
    const response = await fetch(apiContentsUrl(cloud), {
      method: "PUT",
      headers: Object.assign({}, headers(token), { "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      signal: context.signal
    });
    if (!response.ok) throw await responseError(response);
    const result = await response.json();
    return result && result.content && result.content.sha ? result.content.sha : sha;
  }

  function localHash() {
    return u.fingerprint(model.syncPayload(storage.getState()));
  }

  function rememberBaseline(sha, hash) {
    const now = u.isoNow();
    storage.mutate(function (state) {
      const cloud = state.modules.cloudSync;
      cloud.baselineTarget = target(cloud);
      cloud.baselineSha = sha || "";
      cloud.baselineHash = hash || localHash();
      cloud.lastSyncedAt = now;
      cloud.lastCheckedAt = now;
    }, { touch: false, reason: "sync-baseline" });
    Object.assign(runtime, { remoteSha: sha || "", remoteHash: hash || localHash(), checkedAt: now, error: "", remoteMissing: false, offline: false });
  }

  function classification() {
    if (!settings().enabled || !configured()) return "setup";
    if (runtime.offline || navigator.onLine === false) return "offline";
    if (runtime.busy) return runtime.operation === "uploading" ? "uploading" : runtime.operation === "downloading" ? "downloading" : "checking";
    if (runtime.checking) return "checking";
    if (runtime.error) return "error";
    const cloud = settings();
    const hash = localHash();
    const baselineMatchesTarget = cloud.baselineTarget === target(cloud) && Boolean(cloud.baselineHash);
    if (runtime.remoteMissing) return baselineMatchesTarget ? "local" : "first-sync";
    if (!runtime.remoteSha || !runtime.remoteHash) return baselineMatchesTarget && hash !== cloud.baselineHash ? "local" : "checking";
    if (hash === runtime.remoteHash) return "current";
    if (!baselineMatchesTarget) return "first-sync";
    const localChanged = hash !== cloud.baselineHash;
    const remoteChanged = runtime.remoteHash !== cloud.baselineHash;
    if (localChanged && remoteChanged) return "conflict";
    if (localChanged) return "local";
    if (remoteChanged) return "remote";
    return "conflict";
  }

  function newerCopyText() {
    if (!runtime.remoteState) return "The remote file has not been created yet.";
    const localTime = Date.parse(storage.getState().meta.updatedAt);
    const remoteTime = Date.parse(runtime.remoteState.meta.updatedAt);
    if (!Number.isFinite(localTime) || !Number.isFinite(remoteTime) || localTime === remoteTime) return "The copies have the same recorded update time.";
    return localTime > remoteTime
      ? "This device is newer by its recorded update time (" + u.relativeTime(storage.getState().meta.updatedAt) + ")."
      : "The GitHub copy is newer by its recorded update time (" + u.relativeTime(runtime.remoteState.meta.updatedAt) + ").";
  }

  function getInfo() {
    const state = classification();
    const map = {
      setup: { icon: "○", title: "Setup required", message: "Configure optional GitHub sync.", action: "Set up sync", kind: "neutral" },
      checking: { icon: "↻", title: "Checking", message: "Comparing this device with GitHub.", action: "Checking…", kind: "progress" },
      uploading: { icon: "↑", title: "Uploading", message: "Sending this device’s data to GitHub.", action: "Uploading…", kind: "progress" },
      downloading: { icon: "↓", title: "Downloading", message: "Preparing the GitHub copy for this device.", action: "Downloading…", kind: "progress" },
      current: { icon: "✓", title: "Current", message: "This device matches GitHub.", action: "Check again", kind: "success" },
      local: { icon: "↑", title: "Local changes", message: "This device has changes ready to upload.", action: "Sync changes", kind: "warning" },
      remote: { icon: "↓", title: "Remote changes", message: "GitHub has changes ready to download.", action: "Sync changes", kind: "info" },
      "first-sync": { icon: "◇", title: "First-sync decision", message: runtime.remoteMissing ? "The configured GitHub file does not exist yet." : "Choose which copy should start this sync connection.", action: "Choose first copy", kind: "warning" },
      conflict: { icon: "!", title: "Conflict", message: "This device and GitHub both changed.", action: "Resolve conflict", kind: "danger" },
      offline: { icon: "∕", title: "Offline", message: "Reconnect before using GitHub sync.", action: "Offline", kind: "neutral" },
      error: { icon: "×", title: "Sync error", message: runtime.error || "GitHub sync is unavailable.", action: "Try again", kind: "danger" }
    };
    return Object.assign({ state: state, checkedAt: runtime.checkedAt || settings().lastCheckedAt, busy: runtime.busy || runtime.checking, newer: newerCopyText() }, map[state]);
  }

  async function check(force) {
    if (!configured() || runtime.busy || runtime.checking) { emit(); return getInfo(); }
    if (navigator.onLine === false) { runtime.offline = true; emit(); return getInfo(); }
    const last = Date.parse(runtime.checkedAt || "");
    if (!force && Number.isFinite(last) && Date.now() - last < config.controls.syncCheckIntervalMs) return getInfo();
    runtime.checking = true;
    runtime.error = "";
    runtime.offline = false;
    emit();
    const context = requestContext("checking");
    const cloud = settings();
    try {
      const remote = await readRemote(cloud, storage.getSecret(), context, true);
      if (!currentRequest(context)) return getInfo();
      const checkedAt = u.isoNow();
      if (remote) {
        runtime.remoteSha = remote.sha;
        runtime.remoteState = remote.state;
        runtime.remoteHash = u.fingerprint(model.syncPayload(remote.state));
        runtime.remoteMissing = false;
      } else {
        runtime.remoteSha = "";
        runtime.remoteState = null;
        runtime.remoteHash = "";
        runtime.remoteMissing = true;
      }
      runtime.checkedAt = checkedAt;
      storage.mutate(function (state) { state.modules.cloudSync.lastCheckedAt = checkedAt; }, { touch: false, reason: "sync-check" });
    } catch (error) {
      if (error && error.name === "AbortError") return getInfo();
      runtime.error = error.message || "Could not check GitHub.";
      runtime.offline = networkError(error);
      runtime.checkedAt = u.isoNow();
    } finally {
      if (currentRequest(context)) {
        runtime.checking = false;
        runtime.operation = "";
        emit();
      }
    }
    return getInfo();
  }

  async function testConnection(input) {
    const tokenInput = u.cleanLine(input.token, 500);
    const cloud = validateConfiguration(input, tokenInput);
    const token = tokenInput || storage.getSecret();
    const context = requestContext("checking");
    runtime.checking = true;
    runtime.error = "";
    emit();
    try {
      await verifyTarget(cloud, token, context);
      const remote = await readRemote(cloud, token, context, true);
      if (!currentRequest(context)) return null;
      return { ok: true, remoteExists: Boolean(remote), message: remote ? "Connection succeeded and the data file is readable." : "Connection succeeded. The data file will be created on first upload." };
    } catch (error) {
      if (error && error.name === "AbortError") return null;
      throw error;
    } finally {
      if (currentRequest(context)) { runtime.checking = false; runtime.operation = ""; emit(); }
    }
  }

  async function performUpload() {
    const context = requestContext("uploading");
    runtime.busy = true;
    runtime.operation = "uploading";
    runtime.error = "";
    emit();
    try {
      const state = storage.getState();
      const hash = localHash();
      const sha = await writeRemote(settings(), storage.getSecret(), context, state, runtime.remoteSha);
      if (!currentRequest(context)) return false;
      rememberBaseline(sha, hash);
      runtime.remoteState = model.normalize(u.clone(state));
      App.components.toast("This device’s latest data is now on GitHub.", { title: "Sync complete", kind: "success" });
      return true;
    } catch (error) {
      if (error && error.name === "AbortError") return false;
      runtime.error = error.message || "Upload failed.";
      runtime.offline = networkError(error);
      App.components.toast(runtime.error, { title: "Upload failed", kind: "danger", duration: 6000 });
      return false;
    } finally {
      if (currentRequest(context)) { runtime.busy = false; runtime.operation = ""; emit(); }
    }
  }

  async function performDownload() {
    if (!runtime.remoteState) throw new Error("No remote data is available to download.");
    const context = requestContext("downloading");
    runtime.busy = true;
    runtime.operation = "downloading";
    runtime.error = "";
    emit();
    try {
      const localCloud = u.clone(settings());
      const next = model.normalize(u.clone(runtime.remoteState));
      next.modules.cloudSync = localCloud;
      storage.replace(next, { recoveryReason: "Before downloading GitHub data", reason: "sync-download", touch: false });
      const hash = u.fingerprint(model.syncPayload(storage.getState()));
      rememberBaseline(runtime.remoteSha, hash);
      App.components.toast("This device now uses the GitHub copy. The previous local copy is recoverable in Developer Tools.", { title: "Sync complete", kind: "success", duration: 5000 });
      return true;
    } finally {
      if (currentRequest(context)) { runtime.busy = false; runtime.operation = ""; emit(); }
    }
  }

  async function performMerge() {
    if (!runtime.remoteState) return performUpload();
    const merged = model.merge(storage.getState(), runtime.remoteState);
    const localCloud = u.clone(settings());
    merged.modules.cloudSync = localCloud;
    storage.replace(merged, { recoveryReason: "Before merging GitHub data", reason: "sync-merge", touch: false });
    return performUpload();
  }

  async function syncNow(trigger) {
    if (!configured()) {
      window.dispatchEvent(new CustomEvent("app:opensyncsettings", { detail: { trigger: trigger } }));
      return;
    }
    if (navigator.onLine === false) {
      App.components.toast("Reconnect to the internet before syncing.", { title: "Offline", kind: "warning" });
      return;
    }
    await check(true);
    const state = classification();
    if (state === "error" || state === "offline") return;
    if (state === "current") {
      App.components.toast("This device already matches GitHub.", { title: "Up to date", kind: "success" });
      return;
    }
    if (state === "local") return performUpload();
    if (state === "remote") return performDownload();
    if (state === "first-sync" || state === "conflict") {
      const choices = runtime.remoteMissing
        ? [{ value: "upload", label: "Upload this device", description: "Create the GitHub data file from this device.", kind: "primary" }]
        : [
            { value: "merge", label: "Merge both copies", description: "Keep the newest version of each saved item.", kind: "primary" },
            { value: "upload", label: "Upload this device", description: "Replace the GitHub copy with this device.", kind: "secondary" },
            { value: "download", label: "Download GitHub", description: "Replace this device after saving a recovery copy.", kind: "secondary" }
          ];
      const choice = await App.components.choose({
        title: state === "conflict" ? "Resolve sync conflict" : "Choose the first sync copy",
        message: getInfo().newer + " Nothing will be overwritten until you choose.",
        choices: choices,
        cancelLabel: "Cancel sync",
        trigger: trigger
      });
      if (choice === "upload") return performUpload();
      if (choice === "download") return performDownload();
      if (choice === "merge") return performMerge();
    }
  }

  async function forget() {
    storage.clearSecret();
    storage.mutate(function (state) {
      state.modules.cloudSync = model.createDefaultState({ demo: false }).modules.cloudSync;
    }, { reason: "sync-forget" });
    resetRuntime();
    emit();
  }

  function init() {
    window.addEventListener("online", function () {
      runtime.offline = false;
      runtime.error = "";
      emit();
      check(true);
    });
    window.addEventListener("offline", function () { runtime.offline = true; emit(); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") check(false); });
    window.setInterval(function () { check(false); }, config.controls.syncCheckIntervalMs);
    window.setTimeout(function () { check(false); }, 700);
    emit();
  }

  App.sync = {
    init: init,
    getInfo: getInfo,
    configured: configured,
    saveConfiguration: saveConfiguration,
    testConnection: testConnection,
    check: check,
    syncNow: syncNow,
    forget: forget
  };
})();
