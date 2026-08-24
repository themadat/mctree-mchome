(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const u = App.utils;
  const storage = App.storage;
  const portability = App.portability;
  const components = App.components;
  let busy = false;
  let pendingUpload = null;
  let remoteCache = null;

  function $(selector) { return document.querySelector(selector); }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch (error) { return null; }
  }

  function settingsDefaults() {
    return {
      editor: "",
      owner: config.cloud.owner,
      repository: config.cloud.repository,
      branch: config.cloud.branch,
      path: config.cloud.path
    };
  }

  function storedSettings() {
    return Object.assign(settingsDefaults(), u.plainObject(readJson(config.storage.cloudSettingsKey)));
  }

  function storedToken() {
    try { return localStorage.getItem(config.storage.cloudTokenKey) || sessionStorage.getItem(config.storage.cloudTokenKey) || ""; }
    catch (error) { return ""; }
  }

  function configured() {
    const settings = storedSettings();
    return Boolean(settings.owner && settings.repository && settings.branch && settings.path && storedToken());
  }

  function cleanSettings(source) {
    const settings = {
      editor: u.cleanLine(source.editor, 160),
      owner: u.cleanLine(source.owner, 39),
      repository: u.cleanLine(source.repository, 100).replace(/\.git$/i, ""),
      branch: u.cleanLine(source.branch, 100) || "main",
      path: u.cleanLine(source.path, 300).replace(/^\/+/, "")
    };
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(settings.owner)) throw new Error("Enter a valid GitHub user or organization.");
    if (!/^[A-Za-z0-9._-]+$/.test(settings.repository)) throw new Error("Enter a valid GitHub repository name.");
    if (!settings.branch || /[\s~^:?*[\]\\/]/.test(settings.branch) || settings.branch.includes("..")) throw new Error("Enter a valid Git branch name.");
    if (!settings.path || !/\.zip$/i.test(settings.path) || settings.path.split("/").some(function (part) { return !part || part === "." || part === ".."; })) throw new Error("Enter a valid .zip path inside the repository.");
    return settings;
  }

  function formCredentials() {
    const settings = cleanSettings({
      editor: $("#cloudEditorName").value,
      owner: $("#cloudOwner").value,
      repository: $("#cloudRepository").value,
      branch: $("#cloudBranch").value,
      path: $("#cloudPath").value
    });
    const token = $("#cloudToken").value.trim() || storedToken();
    if (!token) throw new Error("Enter a fine-grained GitHub access token.");
    return { settings: settings, token: token };
  }

  function activeCredentials() {
    const settings = cleanSettings(storedSettings());
    const token = storedToken();
    if (!token) throw new Error("Open GitHub Connection and enter a fine-grained access token.");
    return { settings: settings, token: token };
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

  function populateSettings() {
    const settings = storedSettings();
    $("#cloudEditorName").value = settings.editor;
    $("#cloudRecordedBy").value = settings.editor;
    $("#cloudOwner").value = settings.owner;
    $("#cloudRepository").value = settings.repository;
    $("#cloudBranch").value = settings.branch;
    $("#cloudPath").value = settings.path;
    $("#cloudToken").value = storedToken();
    $("#cloudRememberToken").checked = Boolean(localStorage.getItem(config.storage.cloudTokenKey));
  }

  function repositoryUrl(settings) {
    return "https://api.github.com/repos/" + encodeURIComponent(settings.owner) + "/" + encodeURIComponent(settings.repository);
  }

  function contentsUrl(settings) {
    const path = settings.path.split("/").map(encodeURIComponent).join("/");
    return repositoryUrl(settings) + "/contents/" + path;
  }

  function githubHeaders(token) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": config.cloud.apiVersion
    };
  }

  async function responseError(response) {
    let detail = "";
    try { detail = (await response.json()).message || ""; }
    catch (error) { detail = ""; }
    if (response.status === 401) return new Error("GitHub rejected this token. Create a new fine-grained token and try again.");
    if (response.status === 403) return new Error("GitHub denied access. Give the token Contents read/write permission for this private repository.");
    if (response.status === 404) return new Error("GitHub could not find this repository, branch, or file, or the token cannot access it.");
    if ([409, 422].includes(response.status)) return new Error("The cloud package changed while you were publishing. Download Latest before editing again.");
    return new Error(detail ? "GitHub: " + detail : "GitHub request failed (" + response.status + ").");
  }

  async function verifyTarget(settings, token) {
    const repoResponse = await fetch(repositoryUrl(settings), { headers: githubHeaders(token), cache: "no-store" });
    if (!repoResponse.ok) throw await responseError(repoResponse);
    const repository = await repoResponse.json();
    if (!repository.private) throw new Error("McFamily cloud records must use a private GitHub repository.");
    const branchResponse = await fetch(repositoryUrl(settings) + "/branches/" + encodeURIComponent(settings.branch), { headers: githubHeaders(token), cache: "no-store" });
    if (!branchResponse.ok) throw await responseError(branchResponse);
    return repository;
  }

  function decodeBase64(value) {
    const binary = atob(String(value || "").replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function encodeBase64(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 32768));
    return btoa(binary);
  }

  async function readLatest(settings, token, allowMissing) {
    const response = await fetch(contentsUrl(settings) + "?ref=" + encodeURIComponent(settings.branch), { headers: githubHeaders(token), cache: "no-store" });
    if (response.status === 404 && allowMissing) return null;
    if (!response.ok) throw await responseError(response);
    const file = await response.json();
    if (!file || file.type !== "file" || !file.sha) throw new Error("The configured GitHub path is not a file.");
    if (Number(file.size) > config.controls.maxImportBytes) throw new Error("The cloud ZIP is larger than McFamily's " + u.formatBytes(config.controls.maxImportBytes) + " limit.");
    let bytes;
    if (file.encoding === "base64" && file.content) {
      bytes = decodeBase64(file.content);
    } else {
      const blobResponse = await fetch(file.git_url, { headers: githubHeaders(token), cache: "no-store" });
      if (!blobResponse.ok) throw await responseError(blobResponse);
      const blob = await blobResponse.json();
      if (blob.encoding !== "base64" || !blob.content) throw new Error("GitHub did not return a readable package blob.");
      bytes = decodeBase64(blob.content);
    }
    const prepared = await portability.prepareBytes(bytes, settings.path);
    portability.requireInitialPackage(prepared);
    return { sha: file.sha, bytes: bytes, prepared: prepared };
  }

  async function writeLatest(settings, token, bytes, sha, version, summary) {
    const body = {
      message: "McFamily data " + version + " — " + summary.slice(0, 160),
      content: encodeBase64(bytes),
      branch: settings.branch
    };
    if (sha) body.sha = sha;
    const response = await fetch(contentsUrl(settings), {
      method: "PUT",
      headers: Object.assign({}, githubHeaders(token), { "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });
    if (!response.ok) throw await responseError(response);
    const saved = await response.json();
    return saved.content && saved.content.sha || sha || "";
  }

  function setStatus(kind, title, message) {
    const pill = $("#cloudStatusPill");
    pill.dataset.kind = kind;
    pill.textContent = title;
    $("#cloudStatusText").textContent = message;
    const button = $("#cloudAuditButton");
    if (button) {
      button.dataset.cloudState = kind;
      button.setAttribute("aria-label", "Open cloud records and audit log. " + title + ".");
    }
  }

  function setBusy(value, message) {
    busy = value;
    ["cloudDownloadButton", "cloudUploadButton", "cloudPublishButton", "cloudCancelUpload", "cloudForgetButton", "cloudTestButton", "cloudSaveButton"].forEach(function (id) {
      const button = $("#" + id);
      if (button) button.disabled = value;
    });
    components.setLoading(value, message || "Working with the private cloud package…");
  }

  function displayAction(value) {
    return String(value || "Change").replace(/[-_]+/g, " ").replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function auditDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function renderAudit(state) {
    const list = $("#cloudAuditList");
    list.replaceChildren();
    const audits = state && state.meta && state.meta.package ? state.meta.package.auditHistory || [] : [];
    $("#cloudAuditCount").textContent = String(audits.length);
    if (!audits.length) {
      const empty = document.createElement("li");
      empty.className = "cloud-audit-empty";
      empty.textContent = "No local audit history is available yet.";
      list.appendChild(empty);
      return;
    }
    audits.slice().reverse().forEach(function (audit) {
      const item = document.createElement("li");
      const header = document.createElement("div");
      const action = document.createElement("strong");
      const version = document.createElement("span");
      action.textContent = displayAction(audit.action);
      version.textContent = audit.subject || "McFamily";
      header.append(action, version);
      const meta = document.createElement("small");
      meta.textContent = auditDate(audit.recordedAt) + (audit.recordedBy ? " · " + audit.recordedBy : "");
      const details = document.createElement("p");
      details.textContent = audit.details || "No details recorded.";
      item.append(header, meta, details);
      list.appendChild(item);
    });
  }

  function auditFingerprint(audit) {
    return JSON.stringify([audit.id, audit.subject, audit.action, audit.recordedAt, audit.recordedBy, audit.details]);
  }

  function requireAuditContinuity(remoteState, candidateState) {
    const remoteAudits = remoteState.meta.package.auditHistory;
    const candidateAudits = candidateState.meta.package.auditHistory;
    if (candidateAudits.length < remoteAudits.length) throw new Error("The edited ZIP is missing cloud audit events. Download Latest and make the edits again.");
    for (let index = 0; index < remoteAudits.length; index += 1) {
      if (auditFingerprint(remoteAudits[index]) !== auditFingerprint(candidateAudits[index])) throw new Error("The edited ZIP does not continue the current cloud audit history. Download Latest and make the edits again.");
    }
  }

  function comparableRecord(record) {
    const copy = u.clone(record);
    delete copy.createdAt;
    delete copy.updatedAt;
    return copy;
  }

  function collectionDiff(label, before, after) {
    const previous = new Map((before || []).map(function (record) { return [record.id, JSON.stringify(comparableRecord(record))]; }));
    const next = new Map((after || []).map(function (record) { return [record.id, JSON.stringify(comparableRecord(record))]; }));
    let added = 0;
    let changed = 0;
    let removed = 0;
    next.forEach(function (value, id) { if (!previous.has(id)) added += 1; else if (previous.get(id) !== value) changed += 1; });
    previous.forEach(function (value, id) { if (!next.has(id)) removed += 1; });
    return { label: label, added: added, changed: changed, removed: removed };
  }

  function packageDiff(before, after) {
    const empty = { workspace: { people: [], relationships: [], places: [], residences: [], family: {}, documents: [] }, preferences: {}, modules: {} };
    const previous = before || empty;
    const rows = [
      collectionDiff("People", previous.workspace.people, after.workspace.people),
      collectionDiff("Relationships", previous.workspace.relationships, after.workspace.relationships),
      collectionDiff("Places", previous.workspace.places, after.workspace.places),
      collectionDiff("Residences", previous.workspace.residences, after.workspace.residences)
    ];
    const previousFamily = JSON.stringify({ family: previous.workspace.family, documents: previous.workspace.documents, preferences: previous.preferences, modules: previous.modules });
    const nextFamily = JSON.stringify({ family: after.workspace.family, documents: after.workspace.documents, preferences: after.preferences, modules: after.modules });
    if (previousFamily !== nextFamily) rows.push({ label: "Family metadata, Notes, or settings", added: 0, changed: 1, removed: 0 });
    return rows;
  }

  function diffText(row) {
    const parts = [];
    if (row.added) parts.push(row.added + " added");
    if (row.changed) parts.push(row.changed + " changed");
    if (row.removed) parts.push(row.removed + " removed");
    return row.label + ": " + (parts.join(", ") || "no changes");
  }

  function automaticSummary(rows) {
    const changes = rows.filter(function (row) { return row.added || row.changed || row.removed; }).map(diffText);
    return changes.length ? changes.join("; ") + "." : "Validated package metadata update.";
  }

  function renderUploadReview() {
    const candidate = pendingUpload.candidate.state;
    const summary = portability.summaryFor(candidate, pendingUpload.candidate);
    $("#cloudVersionChange").textContent = pendingUpload.baseVersion + " → " + pendingUpload.nextVersion;
    $("#cloudCandidateSummary").textContent = pendingUpload.fileName + " passed " + summary.checkCount + " validation groups: " + summary.people + " people, " + summary.relationships + " relationships, " + summary.places + " places, and " + summary.residences + " residences.";
    const list = $("#cloudChangeList");
    list.replaceChildren();
    pendingUpload.diffs.forEach(function (row) {
      const item = document.createElement("li");
      item.classList.toggle("no-change", !(row.added || row.changed || row.removed));
      item.textContent = diffText(row);
      list.appendChild(item);
    });
    $("#cloudRecordedBy").value = pendingUpload.settings.editor || "";
    $("#cloudAuditSummary").value = automaticSummary(pendingUpload.diffs);
    $("#cloudUploadReview").hidden = false;
    $("#cloudUploadReview").scrollIntoView({ block: "start", behavior: "auto" });
    $("#cloudRecordedBy").focus({ preventScroll: true });
  }

  function cancelUpload() {
    pendingUpload = null;
    $("#cloudUploadReview").hidden = true;
    $("#cloudUploadInput").value = "";
  }

  async function refreshRemote(options) {
    const settings = options && options.settings || activeCredentials().settings;
    const token = options && options.token || activeCredentials().token;
    setStatus("warning", "Checking", "Validating the private GitHub connection and latest package…");
    await verifyTarget(settings, token);
    const remote = await readLatest(settings, token, true);
    remoteCache = remote;
    if (!remote) {
      renderAudit(storage.getState());
      setStatus("warning", "Ready to publish", "The private repository is connected, but no latest package exists at " + settings.path + ".");
      return null;
    }
    const version = portability.datasetVersionFor(remote.prepared.state);
    renderAudit(remote.prepared.state);
    setStatus("success", "Dataset " + version, "Latest validated package: " + version + " · " + remote.prepared.state.workspace.people.length + " people · " + auditDate(remote.prepared.state.meta.updatedAt) + ".");
    return remote;
  }

  async function openDialog() {
    populateSettings();
    cancelUpload();
    renderAudit(remoteCache ? remoteCache.prepared.state : storage.getState());
    $("#cloudSettingsDetails").open = !configured();
    components.openDialog("#cloudAuditDialog", { trigger: $("#cloudAuditButton"), focus: configured() ? "#cloudDownloadButton" : "#cloudEditorName" });
    if (!configured() || busy) {
      setStatus("warning", "Setup needed", "Connect a private GitHub repository to publish and download validated packages.");
      return;
    }
    try { await refreshRemote(); }
    catch (error) { setStatus("danger", "Connection error", error.message || "The private GitHub package could not be checked."); }
  }

  function saveSettings() {
    try {
      const credentials = formCredentials();
      saveCredentials(credentials.settings, credentials.token);
      $("#cloudRecordedBy").value = credentials.settings.editor;
      setStatus("warning", "Settings saved", "Connection settings were saved on this device. Test the connection or download the latest package.");
      components.toast("GitHub connection settings were saved.", { title: "Cloud settings", kind: "success" });
    } catch (error) {
      setStatus("danger", "Settings error", error.message || "The GitHub settings are not valid.");
    }
  }

  async function testConnection() {
    try {
      const credentials = formCredentials();
      saveCredentials(credentials.settings, credentials.token);
      setBusy(true, "Testing the private GitHub connection…");
      await refreshRemote(credentials);
      components.toast("The private GitHub repository and branch are accessible.", { title: "Connection verified", kind: "success" });
    } catch (error) {
      setStatus("danger", "Connection error", error.message || "The GitHub connection could not be verified.");
    } finally { setBusy(false); }
  }

  function forgetConnection() {
    localStorage.removeItem(config.storage.cloudSettingsKey);
    localStorage.removeItem(config.storage.cloudTokenKey);
    localStorage.removeItem(config.storage.cloudBaselineKey);
    sessionStorage.removeItem(config.storage.cloudTokenKey);
    remoteCache = null;
    cancelUpload();
    populateSettings();
    $("#cloudSettingsDetails").open = true;
    setStatus("warning", "Setup needed", "The GitHub connection and token were removed from this device.");
  }

  async function selectUpload(file) {
    if (!file) return;
    try {
      const credentials = activeCredentials();
      setBusy(true, "Validating every file and checking the latest cloud package…");
      const candidate = await portability.prepareFile(file);
      portability.requireInitialPackage(candidate);
      await verifyTarget(credentials.settings, credentials.token);
      const remote = await readLatest(credentials.settings, credentials.token, true);
      const candidateVersion = portability.datasetVersionFor(candidate.state);
      if (remote) {
        const remoteVersion = portability.datasetVersionFor(remote.prepared.state);
        if (candidateVersion !== remoteVersion) throw new Error("This edited ZIP is dataset " + candidateVersion + ", but the cloud is " + remoteVersion + ". Download Latest before making more edits.");
        requireAuditContinuity(remote.prepared.state, candidate.state);
      }
      const nextVersion = portability.nextDatasetPatch(candidateVersion);
      pendingUpload = {
        candidate: candidate,
        remote: remote,
        baseVersion: candidateVersion,
        nextVersion: nextVersion,
        diffs: packageDiff(remote && remote.prepared.state, candidate.state),
        settings: credentials.settings,
        token: credentials.token,
        fileName: file.name
      };
      remoteCache = remote;
      renderUploadReview();
      setStatus("success", "Validated", file.name + " is ready for audit review and publication as dataset " + nextVersion + ".");
    } catch (error) {
      cancelUpload();
      setStatus("danger", "Upload rejected", error.message || "The selected package did not pass validation.");
      components.message("Upload rejected", error.message || "The selected package did not pass validation.", { trigger: $("#cloudUploadButton") });
    } finally { setBusy(false); }
  }

  function uniqueAuditId(state) {
    const ids = new Set(state.meta.package.auditHistory.map(function (audit) { return audit.id; }));
    let id = portability.auditId();
    let suffix = 1;
    while (ids.has(id)) id = portability.auditId() + "_" + suffix++;
    return id;
  }

  function versionedFileName(state) {
    const title = state.workspace.family.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "McFamily";
    return title + "-" + portability.datasetVersionFor(state).replace(/\./g, "-") + ".zip";
  }

  async function publishUpload() {
    if (!pendingUpload || busy) return;
    const actor = u.cleanLine($("#cloudRecordedBy").value, 160);
    const summary = u.cleanText($("#cloudAuditSummary").value, 4000).trim();
    if (!actor || !summary) {
      setStatus("danger", "Audit required", "Recorded by and Audit summary are required before publication.");
      (!actor ? $("#cloudRecordedBy") : $("#cloudAuditSummary")).focus();
      return;
    }
    try {
      setBusy(true, "Rechecking the cloud version and building the audited package…");
      const currentRemote = await readLatest(pendingUpload.settings, pendingUpload.token, true);
      const expectedSha = pendingUpload.remote && pendingUpload.remote.sha || "";
      const currentSha = currentRemote && currentRemote.sha || "";
      if (currentSha !== expectedSha) throw new Error("Someone published a newer package after your review. Download Latest before editing again.");
      const nextState = u.clone(pendingUpload.candidate.state);
      const now = u.isoNow();
      nextState.meta.updatedAt = now;
      nextState.meta.package.datasetVersion = pendingUpload.nextVersion;
      nextState.meta.package.auditHistory.push({
        id: uniqueAuditId(nextState),
        subject: "Dataset " + pendingUpload.nextVersion,
        action: "published-cloud-package",
        recordedAt: now,
        recordedBy: actor,
        details: summary + " Machine summary: " + automaticSummary(pendingUpload.diffs)
      });
      const bytes = portability.packageBytes(nextState);
      const verified = await portability.prepareBytes(bytes, pendingUpload.settings.path);
      const sha = await writeLatest(pendingUpload.settings, pendingUpload.token, bytes, expectedSha, pendingUpload.nextVersion, summary);
      const localInitialized = Boolean(storage.getState().workspace.family.initializedAt);
      storage.replace(verified.state, { recoveryReason: "Before cloud dataset " + pendingUpload.nextVersion, saveRecovery: localInitialized, reason: "cloud-publish", touch: false });
      localStorage.setItem(config.storage.cloudBaselineKey, JSON.stringify({
        target: pendingUpload.settings.owner + "/" + pendingUpload.settings.repository + ":" + pendingUpload.settings.branch + ":" + pendingUpload.settings.path,
        sha: sha,
        datasetVersion: pendingUpload.nextVersion,
        publishedAt: now
      }));
      remoteCache = { sha: sha, bytes: bytes, prepared: verified };
      pendingUpload.settings.editor = actor;
      localStorage.setItem(config.storage.cloudSettingsKey, JSON.stringify(pendingUpload.settings));
      portability.downloadBytes(bytes, versionedFileName(verified.state));
      const publishedVersion = pendingUpload.nextVersion;
      cancelUpload();
      renderAudit(verified.state);
      setStatus("success", "Dataset " + publishedVersion, "Published, opened locally, and downloaded the validated dataset " + publishedVersion + " package.");
      components.toast("Dataset " + publishedVersion + " is now the latest cloud package and was downloaded for the next edit.", { title: "Changes published", kind: "success", duration: 6000 });
    } catch (error) {
      setStatus("danger", "Publish failed", error.message || "The package could not be published.");
      components.message("Changes not published", error.message || "The package could not be published.", { trigger: $("#cloudPublishButton") });
    } finally { setBusy(false); }
  }

  async function downloadLatest() {
    if (busy) return;
    try {
      const credentials = activeCredentials();
      if (storage.getState().workspace.family.initializedAt) {
        const accepted = await components.confirm({
          title: "Download and open the latest package?",
          message: "McFamily will validate the cloud ZIP, download it, save the current local family as recovery, and replace this browser's workspace.",
          confirmLabel: "Download Latest",
          cancelLabel: "Keep local copy",
          trigger: $("#cloudDownloadButton")
        });
        if (!accepted) return;
      }
      setBusy(true, "Downloading and validating the latest private package…");
      await verifyTarget(credentials.settings, credentials.token);
      const remote = await readLatest(credentials.settings, credentials.token, false);
      const version = portability.datasetVersionFor(remote.prepared.state);
      const localInitialized = Boolean(storage.getState().workspace.family.initializedAt);
      storage.replace(remote.prepared.state, { recoveryReason: "Before downloading cloud dataset " + version, saveRecovery: localInitialized, reason: "cloud-download", touch: false });
      portability.downloadBytes(remote.bytes, versionedFileName(remote.prepared.state));
      localStorage.setItem(config.storage.cloudBaselineKey, JSON.stringify({
        target: credentials.settings.owner + "/" + credentials.settings.repository + ":" + credentials.settings.branch + ":" + credentials.settings.path,
        sha: remote.sha,
        datasetVersion: version,
        downloadedAt: u.isoNow()
      }));
      remoteCache = remote;
      renderAudit(remote.prepared.state);
      setStatus("success", "Dataset " + version, "Downloaded, validated, and opened dataset " + version + ". The prior local workspace is available as recovery.");
      components.toast("The latest validated package was downloaded and opened.", { title: "Dataset " + version, kind: "success", duration: 5000 });
    } catch (error) {
      setStatus("danger", "Download failed", error.message || "The latest cloud package could not be downloaded.");
      components.message("Download unavailable", error.message || "The latest cloud package could not be downloaded.", { trigger: $("#cloudDownloadButton") });
    } finally { setBusy(false); }
  }

  function init() {
    if (!config.features.cloudPackages) {
      $("#cloudAuditButton").hidden = true;
      return;
    }
    $("#cloudAuditButton").addEventListener("click", openDialog);
    $("#cloudSaveButton").addEventListener("click", saveSettings);
    $("#cloudTestButton").addEventListener("click", testConnection);
    $("#cloudForgetButton").addEventListener("click", forgetConnection);
    $("#cloudUploadButton").addEventListener("click", function () {
      if (!configured()) {
        $("#cloudSettingsDetails").open = true;
        setStatus("warning", "Setup needed", "Save a private GitHub connection before uploading changes.");
        $("#cloudEditorName").focus();
        return;
      }
      $("#cloudUploadInput").click();
    });
    $("#cloudUploadInput").addEventListener("change", function (event) {
      selectUpload(event.target.files && event.target.files[0]);
      event.target.value = "";
    });
    $("#cloudCancelUpload").addEventListener("click", cancelUpload);
    $("#cloudPublishButton").addEventListener("click", publishUpload);
    $("#cloudDownloadButton").addEventListener("click", downloadLatest);
    $("#cloudAuditDialog").addEventListener("close", cancelUpload);
    window.addEventListener("app:statechange", function () {
      if ($("#cloudAuditDialog").open && !remoteCache) renderAudit(storage.getState());
    });
    populateSettings();
    if (!configured()) setStatus("warning", "Setup needed", "Connect a private GitHub repository to publish and download validated packages.");
  }

  App.cloud = { init: init, open: openDialog, refresh: refreshRemote };
})();
