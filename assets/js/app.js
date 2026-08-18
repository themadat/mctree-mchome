(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const icons = App.icons;
  const u = App.utils;
  const model = App.stateModel;
  const storage = App.storage;
  const components = App.components;
  const portability = App.portability;
  const sync = App.sync;
  const pwa = App.pwa;
  let versionView = "released";
  let hintModifierActive = false;
  let appIconHoldTimer = 0;
  let appIconHoldHandled = false;

  const $ = function (selector, root) { return (root || document).querySelector(selector); };
  const $$ = function (selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
  const versionedAsset = function (path) { return path + "?v=" + encodeURIComponent(config.identity.buildId); };

  const SHORTCUTS = [
    { keys: "/", label: "Focus global search", group: "Global" },
    { keys: "Esc", label: "Close a dialog or menu", group: "Global" },
    { keys: "?", label: "Open Help Center", group: "Global" },
    { keys: "2", label: "Open Roadmap in Settings", group: "Navigation" },
    { keys: "N", label: "Open Notes", group: "Actions" },
    { keys: "V", label: "Open What’s New", group: "Actions" },
    { keys: "S", label: "Run the primary sync action", group: "Actions" },
    { keys: "E", label: "Export a JSON backup", group: "Actions" },
    { keys: "T", label: "Switch color theme", group: "Actions" },
    { keys: "D", label: "Toggle hidden Developer Mode", group: "Developer" },
    { keys: "Arrow keys", label: "Move through tabs, menus, and list choices", group: "Navigation" }
  ];

  function state() {
    return storage.getState();
  }

  function setInputValue(input, value) {
    if (input && document.activeElement !== input) input.value = value == null ? "" : String(value);
  }

  function activeModuleEnabled(id) {
    if (id === "roadmap") return config.features.roadmap;
    return false;
  }

  function applyIdentity() {
    icons.mount(document);
    document.title = config.identity.name;
    $("meta[name='description']").content = config.identity.description;
    $("#appName").textContent = config.identity.name;
    $("#notesButton")?.toggleAttribute("hidden", !config.features.documents);
    $("#versionButton").textContent = "v" + config.identity.version;
    $("#versionButton").setAttribute("aria-label", "Open release notes for version " + config.identity.version);
    $("#appIcon").src = versionedAsset(config.identity.assets.appIconLight);
    $("#releaseCurrentVersion").textContent = "v" + config.identity.version;
    if (!config.features.roadmap) {
      $("[data-module='roadmap']")?.setAttribute("hidden", "");
      $("#roadmapModule")?.setAttribute("hidden", "");
      $("#supportRoadmapTab")?.setAttribute("hidden", "");
    }
  }

  function applyAppearance() {
    const appearance = state().preferences.appearance;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = appearance.mode === "dark" || (appearance.mode === "system" && systemDark);
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.buttonStyle = state().preferences.controls.buttonStyle;
    const systemReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reduce = appearance.reducedMotion === "reduce" || (appearance.reducedMotion === "system" && systemReduce);
    root.dataset.motion = reduce ? "reduce" : "full";
    root.style.setProperty("--text-scale", String(appearance.textScale));
    root.style.setProperty("--reading-scale", String(appearance.readingScale));
    root.style.setProperty("--accent", appearance.accent);
    root.style.setProperty("--accent-strong", u.mixColor(appearance.accent, dark ? "#ffffff" : "#000000", dark ? 0.18 : 0.22));
    root.style.setProperty("--accent-soft", u.mixColor(appearance.accent, dark ? "#161c1b" : "#ffffff", dark ? 0.76 : 0.86));
    root.style.setProperty("--accent-2", appearance.accent2);
    root.style.setProperty("--accent-2-soft", u.mixColor(appearance.accent2, dark ? "#161c1b" : "#ffffff", dark ? 0.78 : 0.86));
    root.style.setProperty("--success", appearance.success);
    root.style.setProperty("--warning", appearance.warning);
    root.style.setProperty("--danger", appearance.danger);
    $("#appIcon").src = versionedAsset(dark ? config.identity.assets.appIconDark : config.identity.assets.appIconLight);
    const iconButton = $("#appIconButton");
    const nextTheme = dark ? "light" : "dark";
    iconButton.setAttribute("aria-label", "Switch to " + nextTheme + " theme. Press and hold to toggle Developer Mode");
    iconButton.title = "Switch to " + nextTheme + " theme · Press and hold for Developer Mode";
    pwa.applyAppearanceAssets?.();
  }

  function isBetaDeploy() {
    const path = (location.pathname || "").toLowerCase();
    if (/\/beta(\/|$)/.test(path)) return true;
    const beta = new URLSearchParams(location.search || "").get("beta");
    return beta === "1" || beta === "true";
  }

  function renderHeader() {
    const developerMode = config.features.developerTools && state().preferences.controls.developerMode;
    const versionButton = $("#versionButton");
    versionButton.textContent = "v" + config.identity.version + (developerMode ? " DEV" : "");
    versionButton.dataset.developer = developerMode ? "true" : "false";
    versionButton.setAttribute("aria-label", "Open release notes for version " + config.identity.version + (developerMode ? ". Developer Mode is enabled" : ""));
    $("#betaPill").hidden = !isBetaDeploy();
    document.documentElement.dataset.developer = developerMode ? "on" : "off";
    setInputValue($("#globalSearch"), state().ui.search);
    renderSyncStatus();
    const latest = config.releases[0];
    const unread = latest && state().ui.seenReleaseVersion !== latest.version;
    $("#releaseUnreadDot").hidden = !unread;
    const banner = $("#whatsNewBanner");
    banner.hidden = !unread;
    if (unread) {
      $("[data-whats-new-version]").textContent = "v" + latest.version;
      $("[data-whats-new-title]").textContent = latest.title;
      $("[data-whats-new-summary]").textContent = latest.summary;
    }
    const hint = $("#contextHint");
    const hintHidden = !config.features.hints || !state().preferences.hints.enabled || state().preferences.hints.dismissed.includes("workspace-basics");
    hint.hidden = hintHidden;
  }

  function renderSyncStatus() {
    const info = sync.getInfo();
    const offline = navigator.onLine === false;
    const localAvailable = storage.isPersistent();
    const localLabel = localAvailable ? "Saved locally" : "Storage unavailable";
    const syncLabel = !config.features.cloudSync ? "GitHub disabled" : offline ? "GitHub offline" : !sync.configured() ? "GitHub setup required" : "GitHub · " + info.title;
    const button = $("#floatingStatusButton");
    button.dataset.syncState = localAvailable ? (offline ? "offline" : info.state) : "error";
    button.disabled = info.busy;
    button.title = localLabel + ". " + syncLabel + ". " + info.message;
    button.setAttribute("aria-label", button.title);
    $("[data-floating-local-label]").textContent = localLabel;
    $("[data-floating-sync-label]").textContent = syncLabel;
    $("[data-floating-status-icon]").innerHTML = icons.markup(!localAvailable || info.kind === "danger" ? "close" : sync.configured() || info.busy ? "sync" : "check");
  }

  function documentText(documentItem) {
    return u.richTextToPlainText(documentItem && documentItem.html || "", config.controls.maxDocumentHtmlLength);
  }

  function documentHtml(value) {
    return u.escapeHtml(u.cleanText(value, config.controls.maxDocumentHtmlLength)).replace(/\n/g, "<br>");
  }

  function renderNotesEditor() {
    const documentItem = state().workspace.documents[0];
    setInputValue($("#notesTextarea"), documentText(documentItem));
  }

  function saveNotes(value) {
    const normalized = u.cleanText(value, config.controls.maxDocumentHtmlLength);
    storage.mutate(function (next) {
      const documentItem = next.workspace.documents[0];
      if (!documentItem) return;
      documentItem.html = documentHtml(normalized);
      documentItem.updatedAt = u.isoNow();
    }, { reason: "edit-document" });
    $("[data-floating-local-label]").textContent = "Saving locally…";
    renderGlobalSearchResults();
  }

  function openNotes(trigger) {
    renderNotesEditor();
    components.openDialog("#notesDialog", { trigger: trigger, focus: "#notesTextarea" });
  }

  function filteredRoadmap(overrides) {
    const moduleState = state().modules.roadmap;
    const filters = Object.assign({ search: moduleState.search, state: moduleState.state, sortBy: moduleState.sortBy, sortDirection: moduleState.sortDirection }, overrides || {});
    const query = String(filters.search || "").trim().toLowerCase();
    const direction = filters.sortDirection === "desc" ? -1 : 1;
    const priority = function (item) { return Number(item.priority) || 99; };
    return config.roadmap.filter(function (item) {
      return (filters.state === "all" || item.state === filters.state) && (!query || (item.title + " " + item.description + " " + item.target).toLowerCase().includes(query));
    }).slice().sort(function (a, b) {
      let compared = 0;
      if (filters.sortBy === "priority") compared = priority(a) - priority(b);
      else if (filters.sortBy === "effort") compared = a.effort - b.effort;
      else if (filters.sortBy === "age") compared = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      else if (filters.sortBy === "target") compared = String(a.target).localeCompare(String(b.target), undefined, { numeric: true });
      else compared = a.title.localeCompare(b.title);
      return compared * direction || a.title.localeCompare(b.title);
    });
  }

  function roadmapCard(item) {
    return '<article class="roadmap-card" data-roadmap-state="' + item.state + '"><header><span class="roadmap-state">' + u.escapeHtml(item.state) + '</span><span class="priority-chip">P' + item.priority + '</span></header><h3>' + u.escapeHtml(item.title) + '</h3><p>' + u.escapeHtml(item.description) + '</p><footer><span>Target ' + u.escapeHtml(item.target) + '</span><span>Effort ' + item.effort + '/4</span><span>Added ' + u.dateLabel(item.createdAt) + "</span></footer></article>";
  }

  function globalSearchMatches(query) {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const results = [];
    const notes = state().workspace.documents[0];
    if (config.features.documents && notes && (`notes ${documentText(notes)}`).toLowerCase().includes(needle)) results.push({ type: "notes", id: notes.id, title: "Notes", meta: "Local notes" });
    config.help.forEach(function (topic) {
      if ((topic.title + " " + topic.keywords + " " + u.stripHtml(topic.html)).toLowerCase().includes(needle)) results.push({ type: "help", id: topic.id, title: topic.title, meta: "Help · " + topic.section });
    });
    if (config.features.roadmap) config.roadmap.forEach(function (item) {
      if ((item.title + " " + item.description).toLowerCase().includes(needle)) results.push({ type: "roadmap", id: item.id, title: item.title, meta: "Roadmap · " + item.state });
    });
    config.releases.forEach(function (release) {
      const releaseText = [release.version, release.title, release.summary].concat(release.features || [], release.improvements || [], release.fixes || [], release.knownIssues || []).join(" ");
      if (releaseText.toLowerCase().includes(needle)) results.push({ type: "release", id: release.version, title: release.title, meta: "Release · v" + release.version });
    });
    return results.slice(0, 10);
  }

  function renderGlobalSearchResults() {
    const container = $("#globalSearchResults");
    const query = state().ui.search;
    if (!query || document.activeElement !== $("#globalSearch")) { container.hidden = true; return; }
    const results = globalSearchMatches(query);
    container.hidden = false;
    container.innerHTML = results.length ? results.map(function (result, index) {
      return '<button type="button" role="option" id="global-result-' + index + '" data-search-type="' + result.type + '" data-search-id="' + u.escapeHtml(result.id) + '"><span><strong>' + u.escapeHtml(result.title) + '</strong><small>' + u.escapeHtml(result.meta) + "</small></span><span aria-hidden=\"true\">→</span></button>";
    }).join("") : '<div class="search-empty">No matches across notes, help, releases, or roadmap.</div>';
  }

  function activateGlobalSearchResult(type, id) {
    if (type === "notes") openNotes($("#globalSearch"));
    else if (type === "help") { openSupport("help"); setInputValue($("#helpSearch"), config.help.find(function (topic) { return topic.id === id; })?.title || ""); renderHelp(); }
    else if (type === "roadmap") {
      storage.mutate(function (next) { next.modules.roadmap.search = config.roadmap.find(function (item) { return item.id === id; })?.title || ""; }, { reason: "roadmap-search" });
      openSupport("roadmap", $("#globalSearch"));
    }
    else if (type === "release") { versionView = "released"; openSupport("releases"); }
    $("#globalSearchResults").hidden = true;
  }

  function switchModule(moduleId) {
    if (!activeModuleEnabled(moduleId)) return;
    if (moduleId === "roadmap") openSupport("roadmap");
  }

  function openSupport(tab, trigger) {
    const chosen = tab || state().ui.supportTab || "settings";
    switchSupportTab(chosen);
    components.openDialog("#supportDialog", { trigger: trigger, focus: "[data-support-tab='" + chosen + "']" });
    renderSupport();
  }

  function switchSupportTab(tab) {
    if (tab === "developer" && !state().preferences.controls.developerMode) tab = "settings";
    storage.mutate(function (next) { next.ui.supportTab = tab; }, { touch: false, reason: "support-tab" });
    $$('[data-support-tab]').forEach(function (button) {
      const selected = button.dataset.supportTab === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    $$('[data-support-panel]').forEach(function (panel) { panel.hidden = panel.dataset.supportPanel !== tab; });
    if (tab === "help") renderHelp();
    else if (tab === "releases") renderReleases();
    else if (tab === "shortcuts") renderShortcuts();
    else if (tab === "roadmap") renderSupportRoadmap();
    else if (tab === "developer") renderDeveloper();
    else renderSettings();
    $(".support-panels")?.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderSettings() {
    const preferences = state().preferences;
    const appearance = preferences.appearance;
    $$('[data-theme-mode]').forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.themeMode === appearance.mode)); });
    $("#themePresets").innerHTML = config.themes.map(function (theme) {
      const selected = appearance.preset === theme.id;
      return '<button type="button" class="theme-preset" data-theme-preset="' + theme.id + '" aria-pressed="' + selected + '"><span class="theme-swatches" aria-hidden="true"><i style="--swatch:' + theme.accent + '"></i><i style="--swatch:' + theme.accent2 + '"></i><i style="--swatch:' + theme.success + '"></i><i style="--swatch:' + theme.warning + '"></i></span><strong>' + u.escapeHtml(theme.label) + "</strong></button>";
    }).join("");
    ["accent", "accent2", "success", "warning", "danger"].forEach(function (key) {
      setInputValue($("[data-color-setting='" + key + "']"), appearance[key]);
      setInputValue($("[data-color-text='" + key + "']"), appearance[key]);
    });
    setInputValue($("#appTextScale"), Math.round(appearance.textScale * 100));
    $("#appTextScaleValue").textContent = Math.round(appearance.textScale * 100) + "%";
    setInputValue($("#readingTextScale"), Math.round(appearance.readingScale * 100));
    $("#readingTextScaleValue").textContent = Math.round(appearance.readingScale * 100) + "%";
    $$('[data-button-style]').forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.buttonStyle === preferences.controls.buttonStyle)); });
    $("#motionPreference").value = appearance.reducedMotion;
    $("#hintsToggle").setAttribute("aria-pressed", String(preferences.hints.enabled));
    $("#hintsToggle").textContent = preferences.hints.enabled ? "On" : "Off";
    renderSyncSettings();
  }

  function renderSyncSettings() {
    const localAvailable = storage.isPersistent();
    $("#localStorageSettingsState").textContent = localAvailable ? "Saved locally" : "Unavailable";
    $("#localStorageSettingsState").dataset.kind = localAvailable ? "success" : "danger";
    $("#localStorageSettingsSummary").innerHTML = '<span aria-hidden="true">' + icons.markup(localAvailable ? "check" : "close") + '</span><span><strong>' + (localAvailable ? "Browser storage is working" : "Browser storage is unavailable") + '</strong><small>' + (localAvailable ? "Notes, preferences, and sync metadata save automatically on this device." : "Changes may not survive a reload. Export a backup before continuing.") + "</small></span>";
    if (!config.features.cloudSync) { $("#cloudSyncSettings").hidden = true; return; }
    const cloud = state().modules.cloudSync;
    const info = sync.getInfo();
    $("#cloudSyncSettings").hidden = false;
    $("#syncSettingsState").textContent = info.title;
    $("#syncSettingsState").dataset.kind = info.kind;
    $("#syncSettingsSummary").innerHTML = '<span aria-hidden="true">' + icons.markup(info.kind === "danger" ? "close" : info.kind === "success" ? "check" : "sync") + '</span><span><strong>' + u.escapeHtml(info.title) + '</strong><small>' + u.escapeHtml(info.message) + (info.checkedAt ? " Checked " + u.relativeTime(info.checkedAt) + "." : "") + "</small></span>";
    setInputValue($("#syncOwner"), cloud.owner);
    setInputValue($("#syncRepo"), cloud.repo);
    setInputValue($("#syncBranch"), cloud.branch);
    setInputValue($("#syncPath"), cloud.path);
    $("#syncRememberToken").checked = cloud.rememberToken;
    $("#storedTokenLabel").textContent = storage.hasSecret() ? "A token is stored; enter a value only to replace it." : "Required";
    $("#syncToken").value = "";
    $("#syncAdvancedFields").open = cloud.advancedOpen || !sync.configured();
    $("#syncNowSettingsButton").disabled = info.busy || info.state === "offline";
    $("#syncNowSettingsButton").textContent = info.action;
    $("#forgetSyncButton").disabled = !sync.configured() && !cloud.owner;
  }

  function renderHelp() {
    const query = String($("#helpSearch")?.value || "").trim().toLowerCase();
    const topics = config.help.filter(function (topic) {
      return !query || (topic.title + " " + topic.section + " " + topic.keywords + " " + u.stripHtml(topic.html)).toLowerCase().includes(query);
    });
    $("#helpResultCount").textContent = topics.length + " topic" + (topics.length === 1 ? "" : "s");
    const groups = {};
    topics.forEach(function (topic) { (groups[topic.section] = groups[topic.section] || []).push(topic); });
    $("#helpContent").innerHTML = topics.length ? Object.keys(groups).map(function (section) {
      return '<section class="help-section"><h3>' + u.escapeHtml(section) + '</h3>' + groups[section].map(function (topic) { return '<article id="help-' + topic.id + '"><h4>' + u.escapeHtml(topic.title) + "</h4>" + topic.html + "</article>"; }).join("") + "</section>";
    }).join("") + renderSupportLinks() : emptyState("No help matches", "Try a shorter or broader search.", "Clear help search", "clear-help-search");
  }

  function renderSupportLinks() {
    const links = [config.identity.repository].concat(config.identity.support || []).filter(function (item) { return u.safeUrl(item.url); });
    if (!links.length) return "";
    return '<section class="help-section"><h3>Support links</h3><div class="support-links">' + links.map(function (item) { return '<button type="button" class="safe-link-button" data-open-url="' + u.escapeHtml(u.safeUrl(item.url)) + '">' + u.escapeHtml(item.label) + ' <span aria-hidden="true">↗</span></button>'; }).join("") + "</div></section>";
  }

  function releaseCard(release) {
    const section = function (title, values) {
      return values && values.length ? '<div class="release-section"><h5>' + title + "</h5><ul>" + values.map(function (value) { return "<li>" + u.escapeHtml(value) + "</li>"; }).join("") + "</ul></div>" : "";
    };
    return '<article class="release-card"><header><div class="release-version-line"><span class="version-pill">v' + u.escapeHtml(release.version) + '</span><time datetime="' + u.escapeHtml(release.date) + '">' + u.dateLabel(release.date) + '</time></div><h4>' + u.escapeHtml(release.title) + '</h4></header><p>' + u.escapeHtml(release.summary) + '</p><div class="release-sections">' + section("Features", release.features) + section("Improvements", release.improvements) + section("Fixes", release.fixes) + section("Known issues", release.knownIssues) + "</div></article>";
  }

  function renderReleases() {
    $$('[data-version-view]').forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.versionView === versionView)); });
    if (versionView === "released") $("#releaseContent").innerHTML = config.releases.map(releaseCard).join("");
    else {
      const items = config.roadmap.filter(function (item) { return item.state === versionView; });
      $("#releaseContent").innerHTML = items.length ? items.map(roadmapCard).join("") : emptyState("Nothing here", "This demonstration view has no matching entries.");
    }
  }

  function renderShortcuts() {
    const groups = {};
    SHORTCUTS.forEach(function (shortcut) { (groups[shortcut.group] = groups[shortcut.group] || []).push(shortcut); });
    $("#shortcutContent").innerHTML = '<p class="section-intro">Listed shortcuts also work while Shift, Control, or Option is held. Command-key combinations remain available to the browser.</p>' + Object.keys(groups).map(function (group) {
      return '<section><h3>' + group + "</h3>" + groups[group].map(function (shortcut) { return '<div class="shortcut-row"><kbd>' + u.escapeHtml(shortcut.keys) + '</kbd><span>' + u.escapeHtml(shortcut.label) + "</span></div>"; }).join("") + "</section>";
    }).join("");
  }

  function renderSupportRoadmap() {
    const moduleState = state().modules.roadmap;
    setInputValue($("#supportRoadmapSearch"), moduleState.search);
    $("#supportRoadmapState").value = moduleState.state;
    $("#supportRoadmapSort").value = moduleState.sortBy;
    const items = filteredRoadmap();
    $("#supportRoadmapList").innerHTML = items.length ? items.map(roadmapCard).join("") : emptyState("No roadmap matches", "Try another search or view.");
  }

  async function renderDeveloper() {
    if (!state().preferences.controls.developerMode) return;
    const usage = await storage.usage();
    const info = sync.getInfo();
    const device = pwa.detectDevice();
    const breakpoint = window.innerWidth < 700 ? "Mobile" : window.innerWidth < 960 ? "Tablet" : "Desktop";
    const recovery = storage.recoveryInfo();
    const diagnostics = [
      ["State model", "v" + state().schemaVersion],
      ["Application", "v" + config.identity.version + " · build " + config.identity.buildId],
      ["Device", device.label],
      ["Layout", breakpoint + " · " + window.innerWidth + "×" + window.innerHeight],
      ["State size", u.formatBytes(usage.stateBytes)],
      ["Browser storage", usage.quota ? u.formatBytes(usage.usage) + " of " + u.formatBytes(usage.quota) : (usage.persistentStorageAvailable ? "Available" : "Unavailable")],
      ["Modules", Object.keys(config.features).filter(function (key) { return config.features[key]; }).join(", ")],
      ["Theme", document.documentElement.dataset.theme + " · " + state().preferences.appearance.preset],
      ["Sync", info.title + (info.checkedAt ? " · checked " + u.relativeTime(info.checkedAt) : "")],
      ["Recovery", recovery ? u.dateLabel(recovery.createdAt) + " · " + recovery.reason : "None"]
    ];
    diagnostics.splice(2, 0, ["Notes", documentText(state().workspace.documents[0]).length + " characters"]);
    $("#developerDiagnostics").innerHTML = diagnostics.map(function (row) { return '<div><dt>' + u.escapeHtml(row[0]) + '</dt><dd>' + u.escapeHtml(row[1]) + "</dd></div>"; }).join("");
    $("#developerState").textContent = JSON.stringify(model.exportEnvelope(state()), null, 2);
    $("#restoreRecoveryButton").disabled = !recovery;
  }

  function renderSupport() {
    $("#developerTab").hidden = !state().preferences.controls.developerMode || !config.features.developerTools;
    switchSupportTab(state().ui.supportTab);
  }

  function clearRoadmapFilters() {
    storage.mutate(function (next) { next.modules.roadmap.search = ""; next.modules.roadmap.state = "all"; next.modules.roadmap.sortBy = "priority"; }, { reason: "clear-roadmap-filters" });
    renderSupportRoadmap();
  }

  async function resetPreferences() {
    const accepted = await components.confirm({ title: "Reset preferences?", message: "Appearance, filters, panel layout, view state, and dismissed hints will return to defaults. Notes will be preserved.", confirmLabel: "Reset preferences", danger: true });
    if (!accepted) return;
    storage.replace(model.resetPreferences(state()), { recoveryReason: "Before resetting preferences", reason: "reset-preferences", touch: false });
    renderAll();
    components.toast("Preferences were reset; notes were preserved.", { title: "Preferences reset", kind: "success" });
  }

  async function eraseAllData() {
    const accepted = await components.confirm({ title: "Erase all application data?", message: "This permanently removes notes, preferences, sync settings, the stored token, and recovery data from this browser. Export a backup first if anything should be kept.", confirmLabel: "Erase everything", cancelLabel: "Keep my data", danger: true });
    if (!accepted) return;
    storage.clearAll();
    renderAll();
    components.closeDialog("#supportDialog", "erased");
    $("#assertiveStatus").textContent = "All application data was erased.";
    components.toast("All application data was erased from this browser.", { title: "Data erased", kind: "info", duration: 5000 });
  }

  async function forgetSync() {
    const accepted = await components.confirm({ title: "Forget GitHub on this device?", message: "Repository settings, sync history, and the stored token will be removed. Local notes will stay here.", confirmLabel: "Forget GitHub", danger: true });
    if (!accepted) return;
    await sync.forget();
    renderSyncSettings(); renderSyncStatus();
    components.toast("GitHub settings and token were removed from this device.", { title: "Sync disconnected", kind: "success" });
  }

  function syncFormValues() {
    return {
      owner: $("#syncOwner").value,
      repo: $("#syncRepo").value,
      branch: $("#syncBranch").value,
      path: $("#syncPath").value,
      token: $("#syncToken").value,
      rememberToken: $("#syncRememberToken").checked
    };
  }

  async function saveSyncSettings() {
    try {
      sync.saveConfiguration(syncFormValues());
      $("#syncToken").value = "";
      storage.mutate(function (next) { next.modules.cloudSync.advancedOpen = false; }, { touch: false, reason: "sync-settings-view" });
      renderSyncSettings(); renderSyncStatus();
      components.toast("The GitHub connection settings were saved.", { title: "Sync configured", kind: "success" });
      sync.check(true);
    } catch (error) {
      components.message("Settings not saved", error.message || "Check the GitHub settings and try again.", { trigger: $("#saveSyncButton") });
    }
  }

  async function testSyncSettings() {
    try {
      components.setLoading(true, "Testing GitHub…");
      const result = await sync.testConnection(syncFormValues());
      if (result) components.message("Connection succeeded", result.message, { trigger: $("#testSyncButton") });
    } catch (error) {
      components.message("Connection failed", error.message || "GitHub could not be reached with these settings.", { trigger: $("#testSyncButton") });
    } finally {
      components.setLoading(false);
      renderSyncSettings(); renderSyncStatus();
    }
  }

  async function restoreRecovery() {
    const info = storage.recoveryInfo();
    if (!info) return;
    const accepted = await components.confirm({ title: "Restore recovery copy?", message: "Restore the copy saved " + u.relativeTime(info.createdAt) + " (“" + info.reason + "”). Current data will be replaced.", confirmLabel: "Restore recovery", danger: true });
    if (!accepted) return;
    storage.restoreRecovery(); renderAll();
    components.toast("The recovery copy was restored.", { title: "Recovery complete", kind: "success" });
  }

  function saveRecoveryCopy() {
    const saved = storage.saveRecovery("Manual recovery copy", state());
    if (saved) {
      renderDeveloper();
      components.toast("A recoverable local copy was saved.", { title: "Recovery copy saved", kind: "success" });
    }
  }

  function toggleDeveloperMode(force, options) {
    if (!config.features.developerTools) return;
    storage.mutate(function (next) { next.preferences.controls.developerMode = typeof force === "boolean" ? force : !next.preferences.controls.developerMode; }, { reason: "developer-mode" });
    $("#developerTab").hidden = !state().preferences.controls.developerMode;
    renderHeader();
    if (state().preferences.controls.developerMode) {
      components.toast("Developer Mode is available in Settings & Help.", { title: "Developer Mode on", kind: "info" });
      if (options && options.openPanel) openSupport("developer");
    } else {
      if (state().ui.supportTab === "developer") switchSupportTab("settings");
      components.toast("Developer tools are hidden.", { title: "Developer Mode off", kind: "info" });
    }
  }

  function toggleThemeFromAppIcon() {
    const nextMode = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    storage.mutate(function (next) { next.preferences.appearance.mode = nextMode; }, { reason: "appearance" });
    applyAppearance();
    if ($("#supportDialog").open && state().ui.supportTab === "settings") renderSettings();
    components.toast(nextMode === "dark" ? "Dark theme is active." : "Light theme is active.", { title: "Theme changed", kind: "info", duration: 2200 });
  }

  function bindAppIconGestures() {
    const button = $("#appIconButton");
    let startX = 0;
    let startY = 0;

    function cancelHold() {
      window.clearTimeout(appIconHoldTimer);
      appIconHoldTimer = 0;
      delete button.dataset.holdActive;
    }

    button.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      cancelHold();
      appIconHoldHandled = false;
      startX = event.clientX;
      startY = event.clientY;
      button.dataset.holdActive = "true";
      appIconHoldTimer = window.setTimeout(function () {
        appIconHoldTimer = 0;
        appIconHoldHandled = true;
        delete button.dataset.holdActive;
        toggleDeveloperMode();
        window.setTimeout(function () { appIconHoldHandled = false; }, 900);
      }, 620);
    });
    button.addEventListener("pointermove", function (event) {
      if (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10) cancelHold();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (name) { button.addEventListener(name, cancelHold); });
    button.addEventListener("click", function (event) {
      if (appIconHoldHandled) {
        event.preventDefault();
        appIconHoldHandled = false;
        return;
      }
      toggleThemeFromAppIcon();
    });
  }

  function handleAction(action, trigger) {
    if (action === "clear-roadmap-filters") clearRoadmapFilters();
    else if (action === "clear-help-search") { $("#helpSearch").value = ""; renderHelp(); }
  }

  function bindSupportEvents() {
    const dialog = $("#supportDialog");
    dialog.addEventListener("click", function (event) {
      const tab = event.target.closest("[data-support-tab]");
      if (tab) { switchSupportTab(tab.dataset.supportTab); return; }
      const mode = event.target.closest("[data-theme-mode]");
      if (mode) {
        storage.mutate(function (next) { next.preferences.appearance.mode = mode.dataset.themeMode; }, { reason: "appearance" }); applyAppearance(); renderSettings(); return;
      }
      const presetButton = event.target.closest("[data-theme-preset]");
      if (presetButton) {
        const theme = config.themes.find(function (item) { return item.id === presetButton.dataset.themePreset; });
        if (theme) storage.mutate(function (next) { Object.assign(next.preferences.appearance, { preset: theme.id, accent: theme.accent, accent2: theme.accent2, success: theme.success, warning: theme.warning, danger: theme.danger }); }, { reason: "appearance" });
        applyAppearance(); renderSettings(); return;
      }
      const style = event.target.closest("[data-button-style]");
      if (style) { storage.mutate(function (next) { next.preferences.controls.buttonStyle = style.dataset.buttonStyle; }, { reason: "button-style" }); applyAppearance(); renderSettings(); return; }
      const versionButton = event.target.closest("[data-version-view]");
      if (versionButton) { versionView = versionButton.dataset.versionView; renderReleases(); return; }
    });
    dialog.addEventListener("keydown", function (event) {
      const tab = event.target.closest("[role='tab']");
      if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = $$('[data-support-tab]:not([hidden])');
      const index = tabs.indexOf(tab);
      const target = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      target.focus(); switchSupportTab(target.dataset.supportTab);
    });
    dialog.addEventListener("change", function (event) {
      if (event.target.matches("[data-color-setting]")) {
        const key = event.target.dataset.colorSetting;
        storage.mutate(function (next) { next.preferences.appearance[key] = u.normalizeColor(event.target.value, next.preferences.appearance[key]); }, { reason: "appearance" }); applyAppearance(); renderSettings();
      }
    });
    dialog.addEventListener("blur", function (event) {
      if (!event.target.matches("[data-color-text]")) return;
      const key = event.target.dataset.colorText;
      const previous = state().preferences.appearance[key];
      const normalized = u.normalizeColor(event.target.value, "");
      if (!normalized) { event.target.value = previous; components.toast("Use a six-digit hex value such as #315f73.", { title: "Color not changed", kind: "warning" }); return; }
      storage.mutate(function (next) { next.preferences.appearance[key] = normalized; }, { reason: "appearance" }); applyAppearance(); renderSettings();
    }, true);
    $("#appTextScale").addEventListener("input", function (event) { storage.mutate(function (next) { next.preferences.appearance.textScale = Number(event.target.value) / 100; }, { reason: "appearance" }); applyAppearance(); $("#appTextScaleValue").textContent = event.target.value + "%"; });
    $("#readingTextScale").addEventListener("input", function (event) { storage.mutate(function (next) { next.preferences.appearance.readingScale = Number(event.target.value) / 100; }, { reason: "appearance" }); applyAppearance(); $("#readingTextScaleValue").textContent = event.target.value + "%"; });
    $("#motionPreference").addEventListener("change", function (event) { storage.mutate(function (next) { next.preferences.appearance.reducedMotion = event.target.value; }, { reason: "appearance" }); applyAppearance(); });
    $("#hintsToggle").addEventListener("click", function () { storage.mutate(function (next) { next.preferences.hints.enabled = !next.preferences.hints.enabled; }, { reason: "hints" }); renderHeader(); renderSettings(); });
    $("#restoreHintsButton").addEventListener("click", function () { storage.mutate(function (next) { next.preferences.hints.dismissed = []; next.ui.dismissedHints = []; }, { reason: "hints" }); renderHeader(); renderSettings(); components.toast("All contextual hints are available again.", { title: "Hints restored", kind: "success" }); });
    $("#syncAdvancedFields").addEventListener("toggle", function () { storage.mutate(function (next) { next.modules.cloudSync.advancedOpen = $("#syncAdvancedFields").open; }, { touch: false, reason: "sync-settings-view" }); });
    $("#saveSyncButton").addEventListener("click", saveSyncSettings);
    $("#testSyncButton").addEventListener("click", testSyncSettings);
    $("#forgetSyncButton").addEventListener("click", forgetSync);
    $("#syncNowSettingsButton").addEventListener("click", function (event) { sync.syncNow(event.currentTarget); });
    $("#exportButton").addEventListener("click", portability.exportJson);
    $("#importButton").addEventListener("click", function () { $("#importFileInput").click(); });
    $("#resetPreferencesButton").addEventListener("click", resetPreferences);
    $("#eraseAllButton").addEventListener("click", eraseAllData);
    $("#helpSearch").addEventListener("input", renderHelp);
    $("#supportRoadmapSearch").addEventListener("input", function (event) {
      storage.mutate(function (next) { next.modules.roadmap.search = u.cleanLine(event.target.value, 200); }, { reason: "roadmap-filter" });
      renderSupportRoadmap();
    });
    $("#supportRoadmapState").addEventListener("change", function (event) {
      storage.mutate(function (next) { next.modules.roadmap.state = event.target.value; }, { reason: "roadmap-filter" });
      renderSupportRoadmap();
    });
    $("#supportRoadmapSort").addEventListener("change", function (event) {
      storage.mutate(function (next) { next.modules.roadmap.sortBy = event.target.value; }, { reason: "roadmap-sort" });
      renderSupportRoadmap();
    });
    $("#restoreRecoveryButton").addEventListener("click", restoreRecovery);
    $("#saveRecoveryButton").addEventListener("click", saveRecoveryCopy);
    $("#disableDeveloperButton").addEventListener("click", function () { toggleDeveloperMode(false); });
  }

  function modifierHeld(event) {
    const modifier = state().preferences.controls.shortcutHintModifier;
    return modifier === "Alt" ? event.altKey : modifier === "Shift" ? event.shiftKey : event.ctrlKey;
  }

  function updateShortcutHints(event, forceOff) {
    const active = !forceOff && state().preferences.controls.shortcutHints && modifierHeld(event);
    if (active === hintModifierActive) return;
    hintModifierActive = active;
    document.documentElement.classList.toggle("shortcut-hints-visible", active);
  }

  function handleGlobalKeydown(event) {
    updateShortcutHints(event, false);
    if (event.key === "Escape") {
      $("#globalSearchResults").hidden = true;
      return;
    }
    if (u.isEditableTarget(event.target)) return;
    if (event.metaKey) return;
    if (event.code === "Slash") {
      event.preventDefault();
      if (event.shiftKey) openSupport("help", event.target);
      else { $("#globalSearch").focus(); $("#globalSearch").select(); }
      return;
    }
    if (event.repeat) return;
    if (event.code === "Digit2" && activeModuleEnabled("roadmap")) { event.preventDefault(); openSupport("roadmap", event.target); }
    else if (event.code === "KeyN") { event.preventDefault(); openNotes(event.target); }
    else if (event.code === "KeyV") { event.preventDefault(); openSupport("releases", event.target); }
    else if (event.code === "KeyS") { event.preventDefault(); sync.syncNow(event.target); }
    else if (event.code === "KeyE") { event.preventDefault(); portability.exportJson(); }
    else if (event.code === "KeyT") { event.preventDefault(); toggleThemeFromAppIcon(); }
    else if (event.code === "KeyD") { event.preventDefault(); toggleDeveloperMode(undefined, { openPanel: true }); }
  }

  function bindGeneralEvents() {
    bindAppIconGestures();
    $("#versionButton").addEventListener("click", function (event) { openSupport("releases", event.currentTarget); });
    $("#supportButton").addEventListener("click", function (event) { openSupport(state().ui.supportTab, event.currentTarget); });
    $("#notesButton").addEventListener("click", function (event) { openNotes(event.currentTarget); });
    $("#notesTextarea").addEventListener("input", function (event) { saveNotes(event.target.value); });
    $("#floatingStatusButton").addEventListener("click", function (event) {
      const info = sync.getInfo();
      if (sync.configured() && info.state !== "offline") sync.syncNow(event.currentTarget);
      else {
        openSupport("settings", event.currentTarget);
        requestAnimationFrame(function () { $("#storageSyncSettings").scrollIntoView({ block: "start" }); });
      }
    });
    document.addEventListener("click", function (event) {
      const action = event.target.closest("[data-action]");
      if (action) handleAction(action.dataset.action, action);
      const dismissHint = event.target.closest("[data-dismiss-hint]");
      if (dismissHint) { storage.mutate(function (next) { next.preferences.hints.dismissed = Array.from(new Set(next.preferences.hints.dismissed.concat(dismissHint.dataset.dismissHint))); }, { reason: "dismiss-hint" }); renderHeader(); }
      if (event.target.closest("[data-dismiss-release]")) { storage.mutate(function (next) { next.ui.seenReleaseVersion = config.releases[0].version; }, { reason: "release-seen" }); renderHeader(); }
      if (event.target.closest("[data-open-releases]")) openSupport("releases", event.target.closest("[data-open-releases]"));
      const safeLink = event.target.closest("[data-open-url]");
      if (safeLink && !u.safeExternalOpen(safeLink.dataset.openUrl)) components.toast("That external address is not allowed.", { title: "Link unavailable", kind: "warning" });
    });
    $("#globalSearch").addEventListener("input", function (event) {
      storage.mutate(function (next) { next.ui.search = u.cleanLine(event.target.value, 200); }, { reason: "global-search" });
      renderGlobalSearchResults();
    });
    $("#globalSearch").addEventListener("focus", renderGlobalSearchResults);
    $("#globalSearch").addEventListener("keydown", function (event) {
      const results = $$("button[role='option']", $("#globalSearchResults"));
      if (event.key === "ArrowDown" && results.length) { event.preventDefault(); results[0].focus(); }
      if (event.key === "Escape") { $("#globalSearchResults").hidden = true; event.target.select(); }
    });
    $("#globalSearchResults").addEventListener("click", function (event) { const result = event.target.closest("[data-search-type]"); if (result) activateGlobalSearchResult(result.dataset.searchType, result.dataset.searchId); });
    $("#globalSearchResults").addEventListener("keydown", function (event) {
      const button = event.target.closest("[data-search-type]"); if (!button) return;
      const buttons = $$("[data-search-type]", event.currentTarget); const index = buttons.indexOf(button);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
      else if (event.key === "Escape") { event.preventDefault(); $("#globalSearch").focus(); $("#globalSearchResults").hidden = true; }
    });
    document.addEventListener("focusin", function (event) { if (!event.target.closest(".global-search-wrap")) $("#globalSearchResults").hidden = true; });

    bindSupportEvents();
    document.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("keyup", function (event) { updateShortcutHints(event, false); });
    window.addEventListener("blur", function () { updateShortcutHints({ altKey: false, shiftKey: false, ctrlKey: false }, true); });
  }

  function renderAll() {
    applyAppearance();
    renderHeader();
    renderNotesEditor();
    renderGlobalSearchResults();
    if ($("#supportDialog").open) renderSupport();
  }

  function bindRuntimeEvents() {
    window.addEventListener("app:syncchange", function () {
      renderSyncStatus();
      if ($("#supportDialog").open && state().ui.supportTab === "settings") renderSyncSettings();
      if ($("#supportDialog").open && state().ui.supportTab === "developer") renderDeveloper();
    });
    window.addEventListener("app:opensyncsettings", function (event) {
      openSupport("settings", event.detail && event.detail.trigger);
      $("#syncAdvancedFields").open = true;
      requestAnimationFrame(function () { $("#storageSyncSettings").scrollIntoView({ block: "start" }); $("#syncOwner").focus(); });
    });
    window.addEventListener("app:storageerror", function (event) {
      components.toast(event.detail.message, { title: event.detail.title, kind: "danger", duration: 0, actionLabel: "Export", onAction: portability.exportJson });
      renderSyncStatus();
    });
    window.addEventListener("app:statesaved", renderSyncStatus);
    window.addEventListener("app:networkchange", function () { document.documentElement.classList.toggle("offline", navigator.onLine === false); renderSyncStatus(); });
    window.addEventListener("app:pwaerror", function (event) { components.toast(event.detail.message, { title: "Offline support unavailable", kind: "warning", duration: 5000 }); });
    window.addEventListener("app:statechange", function (event) {
      const reasons = new Set(["import", "sync-download", "sync-merge", "recovery", "erase-all", "reset-preferences", "restore-demo"]);
      if (reasons.has(event.detail.reason)) renderAll();
    });
    window.addEventListener("resize", function () { if ($("#developerPanel") && !$("#developerPanel").hidden) renderDeveloper(); });
    ["(prefers-color-scheme: dark)", "(prefers-reduced-motion: reduce)"].forEach(function (query) {
      const media = window.matchMedia(query);
      if (typeof media.addEventListener === "function") media.addEventListener("change", applyAppearance);
      else if (typeof media.addListener === "function") media.addListener(applyAppearance);
    });
  }

  function showLoadReport() {
    const report = storage.getLoadReport();
    if (report.recovered) {
      components.toast("The saved state was unusable, so the last valid recovery copy was loaded.", { title: "Recovery copy restored", kind: "warning", duration: 6000 });
    } else if (report.error && report.source === "default") {
      components.toast("Saved data could not be read. A fresh default workspace was created without overwriting any imported file.", { title: "Fresh workspace loaded", kind: "warning", duration: 6000 });
    } else if (report.migrations.length) {
      components.toast("Saved data was upgraded through " + report.migrations.join(", ") + ".", { title: "State upgraded", kind: "success" });
    }
  }

  function init() {
    storage.load();
    applyIdentity();
    components.init();
    portability.init();
    bindGeneralEvents();
    bindRuntimeEvents();
    pwa.init();
    sync.init();
    renderAll();
    document.documentElement.classList.toggle("offline", navigator.onLine === false);
    requestAnimationFrame(function () { document.documentElement.classList.add("app-ready"); });
    showLoadReport();
  }

  App.application = {
    render: renderAll,
    switchModule: switchModule,
    openSupport: openSupport,
    openNotes: openNotes,
    shortcuts: SHORTCUTS
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
