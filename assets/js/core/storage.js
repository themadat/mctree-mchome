(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const u = App.utils;
  const model = App.stateModel;
  let currentState;
  let persistentStorageAvailable = true;
  let fullStateMemoryOnly = false;
  let lastSavedJson = "";
  let loadReport = { source: "default", warnings: [], recovered: false, error: "" };

  function cleanStringList(values, limit, maxItems) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map(function (value) {
      return u.cleanLine(value, limit);
    }).filter(Boolean))).slice(0, maxItems || 200);
  }

  function normalizeDevicePreferences(input) {
    const source = u.plainObject(input);
    if (Number(source.version) !== 1) return null;
    return {
      version: 1,
      dismissedHintIds: cleanStringList(source.dismissedHintIds, 80),
      dismissedReleaseVersions: cleanStringList(source.dismissedReleaseVersions, 32),
      directoryCollapsed: typeof source.directoryCollapsed === "boolean" ? source.directoryCollapsed : true,
      mobileDirectoryOpen: source.mobileDirectoryOpen === true,
      favoritePersonIds: Array.isArray(source.favoritePersonIds) ? cleanStringList(source.favoritePersonIds, 100, config.controls.maxPeople) : null
    };
  }

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function readLocal(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      persistentStorageAvailable = false;
      return null;
    }
  }

  function writeLocal(key, value) {
    try {
      localStorage.setItem(key, value);
      persistentStorageAvailable = true;
      return true;
    } catch (error) {
      persistentStorageAvailable = false;
      emit("app:storageerror", {
        title: error && error.name === "QuotaExceededError" ? (fullStateMemoryOnly ? "Browser preferences could not save" : "Storage is full") : "Changes are not persistent",
        message: error && error.name === "QuotaExceededError"
          ? (fullStateMemoryOnly
            ? "The family remains saved in GitHub, but favorites and display choices may reset on this device. Free browser storage and try again."
            : "The browser could not save this change. Export a backup, remove unneeded content, or free browser storage.")
          : "Browser storage is unavailable. Changes made in this session may be lost.",
        error: error
      });
      return false;
    }
  }

  function removeLocal(key) {
    try { localStorage.removeItem(key); } catch (error) { persistentStorageAvailable = false; }
  }

  function removeHistoricalStateKeys() {
    try {
      const keep = new Set([config.storage.stateKey, config.storage.recoveryKey]);
      const stale = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (/^mcfamily\.(?:state|recovery)\.v\d+$/.test(key) && !keep.has(key)) stale.push(key);
      }
      stale.forEach(function (key) { localStorage.removeItem(key); });
    } catch (error) {
      persistentStorageAvailable = false;
    }
  }

  function readDevicePreferences() {
    const raw = readLocal(config.storage.devicePreferencesKey);
    if (!raw) return null;
    try { return normalizeDevicePreferences(JSON.parse(raw)); }
    catch (error) { return null; }
  }

  function devicePreferencesFromState(state) {
    const previous = readDevicePreferences();
    const dismissedReleaseVersions = previous ? previous.dismissedReleaseVersions.slice() : [];
    const seenReleaseVersion = u.cleanLine(state.ui.seenReleaseVersion, 32);
    if (seenReleaseVersion && !dismissedReleaseVersions.includes(seenReleaseVersion)) dismissedReleaseVersions.push(seenReleaseVersion);
    return {
      version: 1,
      dismissedHintIds: cleanStringList(state.preferences.hints.dismissed, 80),
      dismissedReleaseVersions: cleanStringList(dismissedReleaseVersions, 32),
      directoryCollapsed: state.ui.directoryCollapsed === true,
      mobileDirectoryOpen: state.ui.directoryCollapsed !== true && state.ui.mobileView === "directory",
      favoritePersonIds: cleanStringList(state.ui.favoritePersonIds, 100, config.controls.maxPeople)
    };
  }

  function saveDevicePreferences(state) {
    const preferences = devicePreferencesFromState(state);
    writeLocal(config.storage.devicePreferencesKey, JSON.stringify(preferences));
    return preferences;
  }

  function applyDevicePreferences(state, preferences) {
    const saved = normalizeDevicePreferences(preferences);
    if (!saved) return state;
    state.preferences.hints.dismissed = saved.dismissedHintIds.slice();
    state.ui.dismissedHints = saved.dismissedHintIds.slice();
    const latestRelease = config.releases[0] && config.releases[0].version || "";
    state.ui.seenReleaseVersion = latestRelease && saved.dismissedReleaseVersions.includes(latestRelease) ? latestRelease : "";
    state.ui.directoryCollapsed = saved.directoryCollapsed;
    if (saved.directoryCollapsed && state.ui.mobileView === "directory") state.ui.mobileView = "tree";
    else if (!saved.directoryCollapsed && saved.mobileDirectoryOpen) state.ui.mobileView = "directory";
    if (saved.favoritePersonIds) {
      const availablePersonIds = new Set(state.workspace.people.map(function (person) { return person.id; }));
      state.ui.favoritePersonIds = saved.favoritePersonIds.filter(function (personId) { return availablePersonIds.has(personId); });
    }
    return state;
  }

  function restoreDevicePreferences(state) {
    const saved = readDevicePreferences() || saveDevicePreferences(state);
    const restored = applyDevicePreferences(state, saved);
    if (saved.favoritePersonIds === null) saveDevicePreferences(restored);
    return restored;
  }

  function readRecovery() {
    const raw = readLocal(config.storage.recoveryKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const prepared = model.prepare(parsed.state || parsed);
      return { state: prepared.state, createdAt: parsed.createdAt || "", reason: parsed.reason || "Recovery snapshot" };
    } catch (error) {
      return null;
    }
  }

  function localDevelopmentMode() {
    return ["127.0.0.1", "localhost", "::1"].includes(location.hostname) && new URLSearchParams(location.search).get("local") === "1";
  }

  function returningHostedSession() {
    return !localDevelopmentMode() && readLocal(config.storage.hostedSeenKey) === "1";
  }

  function useHostedMemory() {
    fullStateMemoryOnly = true;
    scheduleSave.cancel();
    removeLocal(config.storage.stateKey);
    removeLocal(config.storage.recoveryKey);
    removeLocal(config.storage.cloudBaselineKey);
    lastSavedJson = "";
    emit("app:statesaved", { bytes: 0, updatedAt: currentState && currentState.meta.updatedAt || "", memoryOnly: true });
  }

  function load() {
    removeHistoricalStateKeys();
    if (returningHostedSession()) useHostedMemory();
    let parseError = "";
    const raw = readLocal(config.storage.stateKey);
    if (raw) {
      try {
        const prepared = model.prepare(JSON.parse(raw));
        currentState = restoreDevicePreferences(prepared.state);
        loadReport = {
          source: "current",
          warnings: prepared.validation.warnings,
          recovered: false,
          error: ""
        };
        lastSavedJson = JSON.stringify(currentState);
        return currentState;
      } catch (error) {
        parseError = error.message || "Saved state could not be read.";
      }
    }

    const recovery = readRecovery();
    if (recovery) {
      currentState = restoreDevicePreferences(recovery.state);
      loadReport = { source: "recovery", warnings: [], recovered: true, error: parseError };
      saveNow();
      return currentState;
    }

    currentState = restoreDevicePreferences(model.createDefaultState());
    loadReport = { source: "default", warnings: [], recovered: false, error: parseError };
    saveNow();
    return currentState;
  }

  function getState() {
    if (!currentState) return load();
    return currentState;
  }

  function saveNow() {
    if (!currentState) return false;
    const normalized = model.normalize(currentState);
    currentState = normalized;
    const json = JSON.stringify(normalized);
    if (json === lastSavedJson) return true;
    if (fullStateMemoryOnly) {
      lastSavedJson = json;
      emit("app:statesaved", { bytes: new Blob([json]).size, updatedAt: normalized.meta.updatedAt, memoryOnly: true });
      return true;
    }
    const saved = writeLocal(config.storage.stateKey, json);
    if (saved) {
      lastSavedJson = json;
      emit("app:statesaved", { bytes: new Blob([json]).size, updatedAt: normalized.meta.updatedAt });
    }
    return saved;
  }

  const scheduleSave = u.debounce(saveNow, config.controls.autosaveDelayMs);

  function mutate(callback, options) {
    const settings = Object.assign({ touch: true, save: true, reason: "change" }, options || {});
    const state = getState();
    callback(state);
    if (settings.touch) model.touch(state);
    currentState = model.normalize(state);
    saveDevicePreferences(currentState);
    if (settings.save) scheduleSave();
    emit("app:statechange", { reason: settings.reason, state: currentState });
    return currentState;
  }

  function saveRecovery(reason, state) {
    if (fullStateMemoryOnly) return false;
    const snapshot = {
      createdAt: u.isoNow(),
      reason: u.cleanLine(reason || "Before data replacement", 160),
      state: model.normalize(u.clone(state || getState()))
    };
    return writeLocal(config.storage.recoveryKey, JSON.stringify(snapshot));
  }

  function clearRecovery() {
    removeLocal(config.storage.recoveryKey);
  }

  function replace(nextState, options) {
    const settings = Object.assign({ recoveryReason: "Before data replacement", saveRecovery: true, clearRecovery: false, reason: "replace", touch: true, preserveDevicePreferences: true }, options || {});
    const prepared = model.prepare(nextState);
    const savedDevicePreferences = settings.preserveDevicePreferences ? (readDevicePreferences() || (currentState && saveDevicePreferences(currentState))) : null;
    if (settings.clearRecovery) clearRecovery();
    else if (settings.saveRecovery && currentState) saveRecovery(settings.recoveryReason, currentState);
    currentState = settings.preserveDevicePreferences ? applyDevicePreferences(prepared.state, savedDevicePreferences) : prepared.state;
    if (!settings.preserveDevicePreferences) {
      removeLocal(config.storage.devicePreferencesKey);
      saveDevicePreferences(currentState);
    }
    if (settings.touch) model.touch(currentState);
    lastSavedJson = "";
    saveNow();
    emit("app:statechange", { reason: settings.reason, state: currentState });
    return currentState;
  }

  function restoreRecovery() {
    const recovery = readRecovery();
    if (!recovery) throw new Error("No usable recovery snapshot is available.");
    return replace(recovery.state, { saveRecovery: false, reason: "recovery" });
  }

  function recoveryInfo() {
    const recovery = readRecovery();
    if (!recovery) return null;
    return {
      createdAt: recovery.createdAt,
      reason: recovery.reason,
      people: recovery.state.workspace.people.length,
      relationships: recovery.state.workspace.relationships.length,
      documents: recovery.state.workspace.documents.length
    };
  }

  function clearAll(options) {
    const settings = Object.assign({ preserveDevicePreferences: false }, options || {});
    const savedDevicePreferences = settings.preserveDevicePreferences ? (readDevicePreferences() || (currentState && saveDevicePreferences(currentState))) : null;
    scheduleSave.cancel();
    removeHistoricalStateKeys();
    [config.storage.stateKey, config.storage.recoveryKey, config.storage.cloudBaselineKey].filter(Boolean).forEach(removeLocal);
    if (!settings.preserveDevicePreferences) removeLocal(config.storage.devicePreferencesKey);
    lastSavedJson = "";
    currentState = model.createDefaultState({ demo: false });
    if (settings.preserveDevicePreferences) applyDevicePreferences(currentState, savedDevicePreferences);
    saveNow();
    emit("app:statechange", { reason: "erase-all", state: currentState });
    return currentState;
  }

  async function usage() {
    const stateJson = JSON.stringify(getState());
    const localBytes = new Blob([stateJson]).size;
    let estimate = null;
    if (navigator.storage && typeof navigator.storage.estimate === "function") {
      try { estimate = await navigator.storage.estimate(); } catch (error) { estimate = null; }
    }
    return {
      stateBytes: localBytes,
      usage: estimate && Number.isFinite(estimate.usage) ? estimate.usage : null,
      quota: estimate && Number.isFinite(estimate.quota) ? estimate.quota : null,
      persistentStorageAvailable: persistentStorageAvailable,
      memoryOnly: fullStateMemoryOnly
    };
  }

  window.addEventListener("pagehide", function () { scheduleSave.flush(); });
  window.addEventListener("beforeunload", function () { scheduleSave.flush(); });

  App.storage = {
    load: load,
    getState: getState,
    getLoadReport: function () { return u.clone(loadReport); },
    mutate: mutate,
    replace: replace,
    saveNow: saveNow,
    saveRecovery: saveRecovery,
    clearRecovery: clearRecovery,
    restoreRecovery: restoreRecovery,
    recoveryInfo: recoveryInfo,
    readDevicePreferences: readDevicePreferences,
    clearAll: clearAll,
    usage: usage,
    useHostedMemory: useHostedMemory,
    isMemoryOnly: function () { return fullStateMemoryOnly; },
    isPersistent: function () { return persistentStorageAvailable; }
  };
})();
