(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const icons = App.icons;
  const u = App.utils;
  const model = App.stateModel;
  const storage = App.storage;
  const components = App.components;
  const family = App.family;
  const portability = App.portability;
  const pwa = App.pwa;
  const $ = function (selector, root) { return (root || document).querySelector(selector); };
  const $$ = function (selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
  const versionedAsset = function (path) { return path + "?v=" + encodeURIComponent(config.identity.buildId); };
  let versionView = "released";
  let hintModifierActive = false;
  let appIconHoldTimer = 0;
  let appIconHoldHandled = false;
  let personDraft = { addresses: [], phones: [], emails: [] };
  let pendingRelative = null;
  let currentTreeLayout = null;
  let treeNeedsFit = true;
  let treeSurfaceMode = "natural";
  let treeTransform = { x: 24, y: 24, scale: 1 };
  let favoritesPreviewOpen = false;
  let personNameOverrides = new Set();
  let activePrintLocation = "";
  let activePrintTitle = "";
  const FAVORITES_BACKUP_FORMAT = "mcfamily-favorites";
  const FAVORITES_BACKUP_VERSION = 1;
  const NAME_PARTS = ["Prefix", "First", "Middle", "Last", "Suffix"];
  const DATE_INPUT_HELP = "Use YYYY, YYYY-MM, or YYYY-MM-DD. Any digit may be ?. Examples: 1984 · 19?? · ???? · 1984-07 · 1984-?? · ????-?? · 1984-07-23 · 1984-07-?? · 1984-??-?? · ????-??-??. Known months must be 01–12 and known days must be valid for the month.";

  const SHORTCUTS = [
    { keys: "/", label: "Focus global search", group: "Global" },
    { keys: "Esc", label: "Close a dialog or menu", group: "Global" },
    { keys: "?", label: "Open Help Center", group: "Global" },
    { keys: "A", label: "Add a person", group: "Family" },
    { keys: "D", label: "Toggle the list", group: "Family" },
    { keys: "F", label: "Show favorite people", group: "Family" },
    { keys: "K", label: "Toggle the Family Tree key", group: "Family" },
    { keys: "P", label: "Open the printable Directory", group: "Family" },
    { keys: "V", label: "Open What’s New", group: "Actions" },
    { keys: "W", label: "Open View As in Developer Mode", group: "Actions" },
    { keys: "|", label: "Toggle Developer Mode", group: "Actions" },
    { keys: "X", label: "Close the active pop-up or update notice", group: "Actions" },
    { keys: "R", label: "Reload when a new version is available", group: "Actions" },
    { keys: "E", label: "Open Save", group: "Actions" },
    { keys: "T", label: "Switch color theme", group: "Actions" },
    { keys: "Arrow keys", label: "Move through tree relatives, tabs, menus, and choices", group: "Navigation" }
  ];

  function state() {
    return storage.getState();
  }

  function initialized() {
    return Boolean(state().workspace.family.initializedAt);
  }

  function fullStructuredName(person, kind) {
    const parts = model.nameParts(person, kind);
    return [parts.prefix, parts.first, parts.middle, parts.last, parts.suffix].filter(Boolean).join(" ");
  }

  function personAlternateNames(person) {
    const display = model.displayName(person).replace(/\s+/g, " ").trim().toLocaleLowerCase();
    const seen = new Set([display]);
    return [fullStructuredName(person, "birth"), fullStructuredName(person, "current")].map(function (value) {
      return value.replace(/\s+/g, " ").trim();
    }).filter(function (value) {
      const normalized = value.toLocaleLowerCase();
      if (!value || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  function accessMode() {
    const runtimeAccess = App.cloud && App.cloud.currentAccess ? App.cloud.currentAccess() : null;
    return runtimeAccess && runtimeAccess.mode || portability.accessModeFor(state());
  }

  function accessProfile() {
    return config.accessModes[accessMode()];
  }

  function familyEditingEnabled() {
    return config.features.familyEditing !== false && accessProfile().editable;
  }

  function hostedVaultActive() {
    return Boolean(App.cloud && App.cloud.hasHostedVault && App.cloud.hasHostedVault());
  }

  function piiVisible() {
    return accessProfile().pii;
  }

  function developerModeAuthorized() {
    const actualAccess = App.cloud && App.cloud.actualAccess ? App.cloud.actualAccess() : null;
    return Boolean(config.features.developerTools && initialized() && actualAccess && actualAccess.canPublish && state().preferences.controls.developerMode);
  }

  function developerReferencesEnabled() {
    return developerModeAuthorized() && familyEditingEnabled();
  }

  function adminFavoritesRestoreEnabled() {
    return Boolean(initialized() && App.cloud && App.cloud.canManageAccess && App.cloud.canManageAccess());
  }

  function rolePreviewAvailable() {
    const actualAccess = App.cloud && App.cloud.actualAccess ? App.cloud.actualAccess() : null;
    return Boolean(developerModeAuthorized() && actualAccess && actualAccess.canManage);
  }

  function openRolePreviewMenu(trigger) {
    if (!rolePreviewAvailable()) return;
    const current = App.cloud.currentAccess();
    const selectedRole = current.previewRole || "owner";
    const roles = [
      { id: "owner", label: "Admin" },
      { id: "editor", label: "Editor" },
      { id: "pii-viewer", label: "Member" },
      { id: "redacted-viewer", label: "Viewer" }
    ];
    components.openMenu(trigger, roles.map(function (role) {
      return {
        value: role.id,
        label: (role.id === selectedRole ? "Current: " : "Preview: ") + role.label,
        symbol: role.id === selectedRole ? "check" : "detail",
        disabled: role.id === selectedRole,
        action: function () {
          App.cloud.setRolePreview(role.id);
          treeNeedsFit = true;
          renderAll();
          components.toast(role.id === "owner" ? "Admin view restored." : role.label + " behavior is being previewed. Data and sign-in access were not changed.", { title: role.id === "owner" ? "Role preview ended" : role.label + " preview", kind: "info" });
        }
      };
    }), { focus: true });
  }

  function setInputValue(input, value) {
    if (input && document.activeElement !== input) input.value = value == null ? "" : String(value);
  }

  function announce(text, assertive) {
    const target = $(assertive ? "#assertiveStatus" : "#politeStatus");
    if (!target) return;
    target.textContent = "";
    window.setTimeout(function () { target.textContent = text; }, 20);
  }

  function applyIdentity() {
    icons.mount(document);
    document.title = config.identity.name;
    $("meta[name='description']").content = config.identity.description;
    $("#appName").textContent = config.identity.name;
    $("#versionButton").textContent = "v" + config.identity.version;
    $("#versionButton").setAttribute("aria-label", "Open release notes for version " + config.identity.version);
    $("#appIcon").src = versionedAsset(config.identity.assets.appIconLight);
    $("#releaseCurrentVersion").textContent = "v" + config.identity.version;
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
    root.style.setProperty("--accent", appearance.accent);
    root.style.setProperty("--accent-strong", u.mixColor(appearance.accent, dark ? "#ffffff" : "#000000", dark ? 0.18 : 0.22));
    root.style.setProperty("--accent-soft", u.mixColor(appearance.accent, dark ? "#161c1b" : "#ffffff", dark ? 0.76 : 0.86));
    root.style.setProperty("--accent-2", appearance.accent2);
    root.style.setProperty("--accent-2-soft", u.mixColor(appearance.accent2, dark ? "#161c1b" : "#ffffff", dark ? 0.78 : 0.86));
    root.style.setProperty("--success", appearance.success);
    root.style.setProperty("--warning", appearance.warning);
    root.style.setProperty("--danger", appearance.danger);
    const iconAsset = dark ? config.identity.assets.appIconDark : config.identity.assets.appIconLight;
    $("#appIcon").src = versionedAsset(iconAsset);
    const onboardingIcon = $(".onboarding-icon");
    if (onboardingIcon) onboardingIcon.src = versionedAsset(iconAsset);
    const nextTheme = dark ? "light" : "dark";
    $("#appIconButton").setAttribute("aria-label", "Switch to " + nextTheme + " theme. Press and hold or press vertical bar to toggle Developer Mode");
    $("#appIconButton").title = "Switch to " + nextTheme + " theme · Press and hold or press | for Developer Mode";
    pwa.applyAppearanceAssets?.();
  }

  function renderHeader() {
    const isInitialized = initialized();
    document.body.dataset.onboarding = isInitialized ? "false" : "true";
    document.body.dataset.accessMode = isInitialized ? accessMode() : "uninitialized";
    const developerReferences = developerReferencesEnabled();
    const developerMode = developerReferences;
    const versionButton = $("#versionButton");
    versionButton.textContent = "v" + config.identity.version + (developerMode ? " DEV" : "");
    versionButton.dataset.developer = developerMode ? "true" : "false";
    versionButton.setAttribute("aria-label", "Open release notes for version " + config.identity.version + (developerMode ? ". Developer Mode is enabled" : ""));
    const accessPill = $("#accessModePill");
    const runtimeAccess = App.cloud && App.cloud.currentAccess ? App.cloud.currentAccess() : null;
    accessPill.hidden = !isInitialized;
    accessPill.textContent = isInitialized ? String(runtimeAccess && runtimeAccess.roleLabel || accessProfile().shortLabel).toUpperCase() : "";
    accessPill.dataset.accessMode = isInitialized ? accessMode() : "";
    accessPill.dataset.preview = runtimeAccess && runtimeAccess.preview ? "true" : "false";
    accessPill.disabled = !rolePreviewAvailable();
    accessPill.title = rolePreviewAvailable() ? "Quick change the role preview" : (runtimeAccess ? runtimeAccess.roleLabel + " access" : "Access role");
    accessPill.setAttribute("aria-label", runtimeAccess && runtimeAccess.preview ? "Previewing " + runtimeAccess.roleLabel + ". Quick change role preview" : rolePreviewAvailable() ? runtimeAccess.roleLabel + ". Quick change role preview" : (runtimeAccess ? runtimeAccess.roleLabel + " access" : "Access role"));
    if (rolePreviewAvailable()) {
      accessPill.setAttribute("aria-keyshortcuts", "W");
      accessPill.dataset.shortcut = "W";
    } else {
      accessPill.removeAttribute("aria-keyshortcuts");
      delete accessPill.dataset.shortcut;
    }
    document.documentElement.dataset.developer = developerReferences ? "on" : "off";
    setInputValue($("#globalSearch"), state().ui.search);
    $("#supportButton").disabled = !isInitialized;
    const searchLabel = "Search people, contacts, Help, releases, and Roadmap";
    $("label[for='globalSearch']").textContent = searchLabel;
    $("#globalSearch").setAttribute("aria-label", searchLabel);
    ["#printButton", "#labelsButton", "#directoryCsvButton"].forEach(function (selector) {
      $(selector).disabled = !isInitialized || !familyEditingEnabled();
      $(selector).hidden = isInitialized && !familyEditingEnabled();
    });
    $("#addPersonButton").disabled = !isInitialized || !familyEditingEnabled();
    $("#addPersonButton").hidden = isInitialized && !familyEditingEnabled();
    $("#addPersonButton").title = isInitialized && familyEditingEnabled() ? "Add person" : "Family editing is unavailable";
    $("#directoryButton").disabled = !isInitialized;
    const directoryIsOpen = isInitialized && !state().ui.directoryCollapsed && (!window.matchMedia("(max-width: 699px)").matches || state().ui.mobileView === "directory");
    $("#directoryButton").setAttribute("aria-pressed", String(directoryIsOpen));
    $("#directoryButton").setAttribute("aria-label", directoryIsOpen ? "Close list" : "Open list");
    $("#directoryButton").title = directoryIsOpen ? "Close list" : "Open list";
    const favoriteCount = state().ui.favoritePersonIds.length;
    const favoriteCountLabel = favoriteCount + " favorite " + (favoriteCount === 1 ? "person" : "people");
    $("#favoritesButton").disabled = !isInitialized;
    $("#favoritesButton").setAttribute("aria-expanded", String(isInitialized && favoritesPreviewOpen));
    $("#favoritesButton").title = (favoritesPreviewOpen ? "Hide " : "Show ") + favoriteCountLabel;
    $("#favoritesButton").setAttribute("aria-label", (favoritesPreviewOpen ? "Hide " : "Show ") + favoriteCountLabel);
    const restoreFavoritesHeaderButton = $("#restoreFavoritesHeaderButton");
    const adminFavoritesRestore = developerReferences && adminFavoritesRestoreEnabled();
    restoreFavoritesHeaderButton.hidden = !adminFavoritesRestore;
    restoreFavoritesHeaderButton.disabled = !adminFavoritesRestore;
    $("#globalSearch").disabled = !isInitialized;
    $("#globalSearch").placeholder = "Search family";
    renderLocalStatus();
  }

  function renderLocalStatus() {
    const button = $("#cloudAuditButton");
    const available = storage.isPersistent();
    const memoryOnly = storage.isMemoryOnly();
    const accessAvailable = initialized() && Boolean(App.cloud && App.cloud.canPublish && App.cloud.canPublish());
    button.dataset.storageState = memoryOnly || available ? "saved" : "error";
    button.hidden = !accessAvailable;
    button.disabled = !accessAvailable;
    const pill = $("#localStorageSettingsState");
    const summary = $("#localStorageSettingsSummary");
    if (pill) {
      pill.textContent = memoryOnly ? "GitHub-backed" : (available ? "Saved locally" : "Unavailable");
      pill.dataset.kind = memoryOnly ? (available ? "success" : "warning") : (available ? "success" : "danger");
    }
    if (summary) {
      const statusIcon = memoryOnly || available ? "check" : "close";
      const title = memoryOnly ? "GitHub is the saved copy" : (available ? "Browser storage is working" : "Browser storage is unavailable");
      const detail = memoryOnly
        ? "The decrypted family stays only in this open session. Use Update before reloading; favorites and display choices " + (available ? "stay on this device." : "may reset because browser preferences are unavailable.")
        : (available ? state().workspace.people.length + " people and " + state().workspace.relationships.length + " relationships save automatically on this browser." : "Changes may not survive a reload. Download a private backup before continuing.");
      summary.innerHTML = '<span aria-hidden="true">' + icons.markup(statusIcon) + '</span><span><strong>' + title + '</strong><small>' + detail + "</small></span>";
    }
  }

  function renderOnboarding() {
    const icon = document.documentElement.dataset.theme === "dark" ? config.identity.assets.appIconDark : config.identity.assets.appIconLight;
    $("#mainContent").innerHTML = '<section class="onboarding-screen" aria-labelledby="onboardingTitle"><div class="onboarding-card"><img src="' + u.escapeHtml(versionedAsset(icon)) + '" alt="" class="onboarding-icon"><span class="eyebrow">Owner recovery</span><h1 id="onboardingTitle">Open the initial family record</h1><p>This screen is only for the Owner before the first encrypted vault is published. Open the latest validated recovery ZIP, then use Save to create the passphrase sign-in used by everyone else.</p><div class="privacy-callout"><strong>Recipients do not need a ZIP.</strong><span>After Owner setup, they use the normal McFamily link and their assigned passphrase.</span></div><button id="firstImportButton" type="button" class="button primary large-button">Open Owner Recovery ZIP</button><input id="onboardingImportInput" type="file" accept="application/zip,.zip" data-import-file-input hidden><small>McFamily validates all five internal CSV files before opening this private recovery copy.</small></div></section>';
    icons.mount($("#mainContent"));
  }

  function directoryPeople() {
    const current = state();
    const query = state().ui.directorySearch.trim();
    const activeFilters = new Set(current.ui.directoryFilters);
    const statusFilters = config.directoryFilters.filter(function (filter) { return filter.group === "status" && activeFilters.has(filter.id); }).map(function (filter) { return filter.id; });
    const kinshipFilters = config.directoryFilters.filter(function (filter) { return filter.group === "kinship" && activeFilters.has(filter.id); }).map(function (filter) { return filter.id; });
    const contactFilters = config.directoryFilters.filter(function (filter) { return filter.group === "contact" && activeFilters.has(filter.id); }).map(function (filter) { return filter.id; });
    const graph = family.indexes(current);
    const sortMode = current.ui.directorySort;
    return current.workspace.people.filter(function (person) {
      const kinship = directoryKinship(person, graph, current.workspace.family.homePersonId);
      const statusMatches = !statusFilters.length || statusFilters.includes(person.livingStatus);
      const kinshipMatches = !kinshipFilters.length || kinshipFilters.some(function (filter) { return kinship[filter]; });
      const contactMatches = !contactFilters.length || contactFilters.some(function (filter) {
        if (filter === "has-address") return Boolean(person.addresses && person.addresses.length);
        if (filter === "has-phone") return personHasPhone(person);
        if (filter === "has-email") return Boolean(person.emails && person.emails.length);
        return false;
      });
      return statusMatches && kinshipMatches && contactMatches && model.fuzzySearchMatch(query, model.personSearchText(person, { includeNotes: familyEditingEnabled(), includeSource: developerReferencesEnabled() }));
    }).sort(function (a, b) { return directorySortName(a, sortMode).localeCompare(directorySortName(b, sortMode)) || a.id.localeCompare(b.id); });
  }

  function personHasPhone(person) {
    return Boolean(person && ((person.phones || []).some(function (item) { return Boolean(u.cleanLine(item && item.value, 240)); })
      || (person.addresses || []).some(function (address) { return Boolean(u.cleanLine(address && address.phone, 240)); })));
  }

  function directoryKinship(person, graph, homePersonId) {
    const fields = u.plainObject(person && person.source && person.source.fields);
    const importedMcLineage = ["mclineage-cleaned", "mcpeople-v1"].includes(String(person && person.source && person.source.format || ""));
    if (importedMcLineage && Object.prototype.hasOwnProperty.call(fields, "lineage-id")) {
      const consanguineal = Boolean(u.cleanLine(fields["lineage-id"], 200));
      return { consanguineal: consanguineal, affinal: !consanguineal };
    }
    return {
      consanguineal: person.id === homePersonId || Boolean((graph.parents.get(person.id) || []).length || (graph.children.get(person.id) || []).length),
      affinal: Boolean((graph.partners.get(person.id) || []).length)
    };
  }

  function isLinealPerson(person) {
    const fields = u.plainObject(person && person.source && person.source.fields);
    return Boolean(u.cleanLine(fields["lineage-id"], 200));
  }

  function directoryFilterSummary() {
    const active = new Set(state().ui.directoryFilters);
    const labels = config.directoryFilters.filter(function (filter) { return active.has(filter.id); }).map(function (filter) { return filter.label; });
    if (!labels.length) return "All people";
    return labels.length === 1 ? labels[0] : labels.length + " selected";
  }

  function directoryFilterOptionsHtml() {
    const active = new Set(state().ui.directoryFilters);
    return config.directoryFilters.map(function (filter) {
      return '<label class="directory-filter-option"><input type="checkbox" name="directoryFilter" value="' + u.escapeHtml(filter.id) + '"' + (active.has(filter.id) ? " checked" : "") + '><span>' + u.escapeHtml(filter.label) + "</span></label>";
    }).join("");
  }

  function directorySortName(person, mode) {
    const names = person.names || {};
    const preferred = model.nameParts(person, "preferred");
    const current = model.nameParts(person, "current");
    const birth = model.nameParts(person, "birth");
    const first = preferred.first || current.first || birth.first;
    const middle = preferred.middle || current.middle || birth.middle;
    const last = preferred.last || current.last || birth.last || names.maidenLast || "";
    return (mode === "last" ? [last, first, middle] : [first, middle, last]).filter(Boolean).join(", ").toLowerCase();
  }

  function directoryLetter(person) {
    const preferred = model.nameParts(person, "preferred");
    const current = model.nameParts(person, "current");
    const birth = model.nameParts(person, "birth");
    const value = state().ui.directorySort === "last" ? (preferred.last || current.last || birth.last) : (preferred.first || current.first || birth.first);
    const letter = String(value || "#").slice(0, 1).toUpperCase();
    return /^[A-Z]$/.test(letter) ? letter : "#";
  }



  function directoryPersonMeta(person) {
    const years = "[" + family.lifespan(person) + "]";
    const sourceId = lineageId(person).join(".") || "No Lineage ID";
    return [years, sourceId].concat(developerReferencesEnabled() ? [person.reference] : []).join(" · ");
  }

  function renderDirectoryList() {
    const container = $("#directoryList");
    if (!container) return;
    const people = directoryPeople();
    const totalPeople = state().workspace.people.length;
    $("#directoryCount").textContent = people.length === totalPeople ? String(totalPeople) : people.length + " of " + totalPeople;
    $("#directoryCount").title = people.length + " of " + totalPeople + " people shown";
    const filterSummary = $("#directoryFilterSummary");
    if (filterSummary) filterSummary.textContent = directoryFilterSummary();
    const availableLetters = new Set(people.map(directoryLetter));
    const rail = $("#directoryAlphaRail");
    if (rail) rail.innerHTML = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(function (letter) { return '<button type="button" data-directory-letter="' + letter + '" aria-label="Jump to ' + letter + '" title="Jump to ' + letter + '" ' + (availableLetters.has(letter) ? "" : "disabled") + '><span>' + letter + "</span></button>"; }).join("");
    let lastLetter = "";
    container.innerHTML = people.length ? people.map(function (person) {
      const letter = directoryLetter(person);
      const heading = letter !== lastLetter ? '<h3 id="directory-letter-' + u.escapeHtml(letter) + '" class="directory-letter">' + u.escapeHtml(letter) + "</h3>" : "";
      lastLetter = letter;
      const address = person.addresses.find(function (item) { return item.current; }) || person.addresses[0];
      return heading + '<button type="button" class="directory-person' + (state().ui.selectedPersonId === person.id ? " selected" : "") + '" data-select-person="' + u.escapeHtml(person.id) + '" aria-pressed="' + String(state().ui.selectedPersonId === person.id) + '"><span><strong>' + u.escapeHtml(model.displayName(person)) + '</strong><small>' + u.escapeHtml(directoryPersonMeta(person)) + '</small>' + (address ? '<small>' + u.escapeHtml([address.city, address.region, address.country].filter(Boolean).join(", ")) + "</small>" : "") + "</span></button>";
    }).join("") : '<div class="empty-state compact-empty"><h3>No people match</h3><p>Try another search or filter combination.</p><button type="button" class="button" data-clear-directory>Clear list filters</button></div>';
  }

  function partialDateLabel(value) {
    const raw = u.cleanLine(value, 40);
    if (!raw.includes("?")) return "";
    const parts = raw.split("-");
    const year = parts[0] || "????";
    const month = parts[1] || "";
    const day = parts[2] || "";
    if (!month || month.includes("?")) return year;
    const monthName = new Intl.DateTimeFormat(undefined, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, Number(month) - 1, 1)));
    if (!day) return monthName + " " + year;
    return monthName + " " + (day.includes("?") ? "??" : String(Number(day))) + ", " + year;
  }

  function lifeDateValue(person, kind) {
    const normalized = String(person && person[kind] && person[kind].date && person[kind].date.value || "");
    if (normalized) return normalized;
    return sourceField(person, "person-date-" + kind + "-value");
  }

  function lifeDateLabel(person, kind) {
    const event = person && person[kind];
    return model.formatFlexibleDate(event && event.date) || partialDateLabel(lifeDateValue(person, kind));
  }

  function formatEvent(label, person, kind) {
    const event = person && person[kind];
    const date = lifeDateLabel(person, kind);
    const place = event && event.place || "";
    const fallback = kind === "death" && person && person.livingStatus === "living" ? "----" : "UNKNOWN";
    return '<div><dt>' + label + '</dt><dd>' + u.escapeHtml([date, place].filter(Boolean).join(" · ") || fallback) + "</dd></div>";
  }

  function knownDatePrefix(value) {
    const raw = u.cleanLine(value, 40);
    if (!raw) return "";
    const known = raw.includes("?") ? raw.slice(0, raw.indexOf("?")).replace(/-$/, "") : raw;
    return /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(known) ? known : "";
  }

  function approximateDate(value) {
    const match = String(value || "").match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
    if (!match) return null;
    return new Date(Number(match[1]), match[2] ? Number(match[2]) - 1 : 6, match[3] ? Number(match[3]) : 1);
  }

  function ageInMonths(birthValue, endValue) {
    const birth = approximateDate(birthValue);
    const end = endValue instanceof Date ? endValue : approximateDate(endValue);
    if (!birth || !end || end < birth) return null;
    let months = (end.getFullYear() - birth.getFullYear()) * 12 + end.getMonth() - birth.getMonth();
    if (end.getDate() < birth.getDate()) months -= 1;
    return Math.max(0, months);
  }

  function personStatusLabel(person) {
    if (person.livingStatus === "deceased") return sourceField(person, "person-date-death-descriptor") === "UNKNOWN PRESUMED" ? "Presumed deceased" : "Deceased";
    if (person.livingStatus === "living") return "Living";
    return "Unknown";
  }

  function ageValue(birthValue, endValue) {
    const birth = knownDatePrefix(birthValue);
    const end = endValue instanceof Date ? endValue : knownDatePrefix(endValue);
    const months = ageInMonths(birth, end);
    if (!Number.isFinite(months)) return null;
    const approximate = String(birthValue || "").includes("?") || (!(endValue instanceof Date) && String(endValue || "").includes("?"));
    if (months < 24) return { amount: months || "<1", unit: months <= 1 ? "month" : "months", approximate: approximate };
    return { amount: Math.floor(months / 12), unit: "years", approximate: approximate };
  }

  function ageDetail(person, plainText) {
    const birthValue = lifeDateValue(person, "birth");
    const deathValue = lifeDateValue(person, "death");
    if (!birthValue) return '<div><dt>Age</dt><dd>UNKNOWN</dd></div>';
    const deceased = person.livingStatus === "deceased";
    const primary = ageValue(birthValue, deceased ? deathValue : new Date());
    const current = deceased ? ageValue(birthValue, new Date()) : null;
    const naturalAge = function (value) { return value ? (value.approximate ? "~" : "") + value.amount + " " + value.unit : ""; };
    let primaryText = primary ? naturalAge(primary) + (deceased ? " old at death" : " old") : "";
    if (deceased && !primaryText) primaryText = "UNKNOWN at death";
    if (plainText) {
      const currentText = current ? "Would be " + (current.approximate ? "~" : "") + current.amount + " today" : "";
      return '<div class="age-row"><dt>Age</dt><dd>' + u.escapeHtml([primaryText, currentText].filter(Boolean).join(" · ") || "UNKNOWN") + "</dd></div>";
    }
    const context = current ? ' · <em>Would be</em> <strong><em>' + u.escapeHtml((current.approximate ? "~" : "") + current.amount) + '</em></strong> <em>today</em>' : "";
    return '<div class="age-row"><dt>Age</dt><dd>' + u.escapeHtml(primaryText || "UNKNOWN") + context + "</dd></div>";
  }

  function livingStatusDetail(person) {
    const label = personStatusLabel(person);
    return '<div><dt>Living Status</dt><dd>' + u.escapeHtml(label === "Unknown" ? "UNKNOWN" : label) + "</dd></div>";
  }

  function statusDetails(person, plainText) {
    const rows = [];
    const age = ageDetail(person, plainText);
    if (age) rows.push(age);
    rows.push(livingStatusDetail(person));
    return rows.join("");
  }

  function relationshipLabel(relationship, personId, other, entry) {
    if (relationship.type === "parent-child") {
      const type = config.parentKinds.find(function (item) { return item.id === relationship.kind; });
      return personId === relationship.parentId ? "Child" : (type ? type.label + " parent" : "Parent");
    }
    const person = state().workspace.people.find(function (item) { return item.id === personId; });
    return relationshipMaritalStatus(person, { person: other, relationship: relationship, current: entry && entry.current });
  }

  function relationshipMeta(relationship) {
    const dates = [model.formatFlexibleDate(relationship.startDate), model.formatFlexibleDate(relationship.endDate)].filter(Boolean).join(" – ");
    return [dates, relationship.place, relationship.notes].filter(Boolean).join(" · ");
  }

  function relationshipDescription(edge) {
    const first = profileName(edge.from.person);
    const second = profileName(edge.to.person);
    if (edge.relationship.type === "parent-child") {
      const kind = config.parentKinds.find(function (item) { return item.id === edge.relationship.kind; });
      const lineage = config.parentLineages.find(function (item) { return item.id === edge.relationship.lineage; });
      return first + " is the " + (lineage ? lineage.label.toLowerCase() + " " : "") + (kind ? kind.label.toLowerCase() + " parent" : "parent") + " of " + second + (relationshipMeta(edge.relationship) ? ". " + relationshipMeta(edge.relationship) : "");
    }
    const status = maritalStatusLabel(family.partnerMaritalStatusId(edge.from.person, { person: edge.to.person, relationship: edge.relationship, current: edge.current }));
    return first + " and " + second + ": " + status + (relationshipMeta(edge.relationship) ? ". " + relationshipMeta(edge.relationship) : "");
  }

  function relationshipGeneration(person) {
    if (lineageSegments(person).length) {
      const member = lineageChain(person).members[0];
      if (member) return member.generation;
    }
    return family.generationMap(state().workspace.people, state().workspace.relationships).get(person.id) || 0;
  }

  function relationshipGroupLabel(label, generation) {
    return generation == null ? label : label + " · Gen " + generation;
  }

  function relationshipBirthValue(person) {
    return sourceField(person, "person-date-birth-value")
      || String(person && person.birth && person.birth.date && person.birth.date.value || "");
  }

  function relationshipBirthYear(person) {
    const match = relationshipBirthValue(person).match(/^[\d?]{4}/);
    return match ? match[0] : "????";
  }

  function birthOrderMap(entries) {
    const people = [];
    const seen = new Set();
    entries.filter(Boolean).forEach(function (entry) {
      const person = entry.person || entry;
      if (!person || seen.has(person.id)) return;
      seen.add(person.id);
      people.push(person);
    });
    people.sort(function (first, second) {
      const firstDate = relationshipBirthValue(first);
      const secondDate = relationshipBirthValue(second);
      if (firstDate && secondDate && firstDate !== secondDate) return firstDate.localeCompare(secondDate);
      if (firstDate !== secondDate) return firstDate ? -1 : 1;
      return model.sortName(first).localeCompare(model.sortName(second)) || first.id.localeCompare(second.id);
    });
    return new Map(people.map(function (person, index) { return [person.id, index + 1]; }));
  }

  function birthOrderContext(person, orderMap) {
    const order = String(orderMap.get(person.id) || 0).padStart(2, "0");
    return "(" + order + " :: " + relationshipBirthYear(person) + ")";
  }

  function parentContext(child, entry) {
    const relationship = entry && entry.relationship || {};
    const lineage = config.parentLineages.find(function (item) { return item.id === relationship.lineage; });
    const kind = config.parentKinds.find(function (item) { return item.id === relationship.kind; });
    return "(" + (lineage ? lineage.label : "Non-Lineal") + " :: " + (kind ? kind.label : "Unknown") + ")";
  }

  function maritalStatusLabel(id) {
    const found = config.maritalStatuses.find(function (item) { return item.id === id; });
    return found ? found.label : "Unknown";
  }

  function relationshipMaritalStatus(person, entry) {
    return maritalStatusLabel(family.partnerMaritalStatusId(person, entry));
  }

  function relationshipDateValue(relationship, kind) {
    const fields = relationship && relationship.source && relationship.source.fields || {};
    const sourceValue = String(fields["date-" + kind + "-value"] || fields["date_" + kind + "_value"] || "");
    return sourceValue || String(relationship && relationship[kind + "Date"] && relationship[kind + "Date"].value || "");
  }

  function partnerStartYear(relationship) {
    const value = relationshipDateValue(relationship, "start");
    const year = value.match(/^[\d?]{4}/);
    return year ? year[0] : "????";
  }

  function partnerEndYear(relationship) {
    const value = relationshipDateValue(relationship, "end");
    const year = value.match(/^[\d?]{4}/);
    return year ? year[0] : "";
  }

  function partnerContext(entry, person) {
    const years = [partnerStartYear(entry.relationship), partnerEndYear(entry.relationship)].filter(Boolean).join("–");
    return "(" + years + " :: " + relationshipMaritalStatus(person, entry) + ")";
  }

  function maritalStatusDetail(person, partners) {
    const current = partners.filter(Boolean)[0];
    const label = current ? relationshipMaritalStatus(person, current) : maritalStatusLabel("unknown");
    return '<div><dt>Marital Status</dt><dd>' + u.escapeHtml(label === "Unknown" ? "UNKNOWN" : label) + "</dd></div>";
  }

  function relationshipNameList(entries, emptyText, contextForEntry, editable) {
    const unique = [];
    const seen = new Set();
    entries.filter(Boolean).forEach(function (entry) {
      const person = entry.person || entry;
      const uniqueKey = editable && entry.relationship && entry.relationship.id ? entry.relationship.id : person && person.id;
      if (!person || seen.has(uniqueKey)) return;
      seen.add(uniqueKey);
      unique.push({ person: person, relationship: entry.relationship, current: entry.current });
    });
    return unique.length ? unique.map(function (entry, index) {
      const partnerClass = entry.current === true ? " current-partner" : entry.current === false ? " previous-partner" : "";
      const context = contextForEntry ? contextForEntry(entry, index, unique) : "";
      const partnerStatus = entry.current === true ? ", current partner" : entry.current === false ? ", previous partner" : "";
      const name = profileName(entry.person);
      const accessibleLabel = ' aria-label="' + u.escapeHtml(name + (context ? ", " + context.replace(/[()]/g, "") : "") + partnerStatus) + '"';
      const personButton = '<button type="button" class="relationship-name' + partnerClass + '" data-select-person="' + u.escapeHtml(entry.person.id) + '"' + accessibleLabel + '><span>' + u.escapeHtml(name) + '</span>' + (context ? '<small class="relationship-context">' + u.escapeHtml(context) + "</small>" : "") + "</button>";
      const editButton = editable && familyEditingEnabled() && entry.relationship && entry.relationship.id ? '<button type="button" class="relationship-edit-button" data-edit-relationship="' + u.escapeHtml(entry.relationship.id) + '" aria-label="Edit partner relationship with ' + u.escapeHtml(name) + '" title="Edit partner relationship"><span data-symbol="editPerson" aria-hidden="true"></span></button>' : "";
      return '<div class="relationship-name-row">' + personButton + editButton + "</div>";
    }).join("") : '<span class="relationship-empty">' + u.escapeHtml(emptyText) + "</span>";
  }

  function relationshipGroup(label, generation, entries, emptyText, contextForEntry, editable) {
    const count = new Set(entries.filter(Boolean).map(function (entry) {
      const person = entry.person || entry;
      return editable && entry.relationship && entry.relationship.id ? entry.relationship.id : person && person.id;
    }).filter(Boolean)).size;
    return '<details class="relationship-group" open><summary><span>' + u.escapeHtml(relationshipGroupLabel(label, generation)) + '</span><span class="count-pill">' + count + '</span></summary><div class="relationship-names">' + relationshipNameList(entries, emptyText, contextForEntry, editable) + "</div></details>";
  }

  function relationshipRows(person) {
    const groups = family.relationGroups(person.id, state());
    const parents = groups.parents;
    const generation = relationshipGeneration(person);
    const siblingOrder = birthOrderMap([person].concat(groups.siblings));
    const childOrder = birthOrderMap(groups.children);
    return relationshipGroup("Parents", Math.max(0, generation - 1), parents, "No parents recorded", function (entry) { return parentContext(person, entry); })
      + relationshipGroup("Siblings", generation, groups.siblings, "No siblings recorded", function (entry) { return birthOrderContext(entry.person, siblingOrder); })
      + relationshipGroup("Partners", null, groups.partners, "No partners recorded", function (entry) { return partnerContext(entry, person); }, true)
      + relationshipGroup("Children", generation + 1, groups.children, "No children recorded", function (entry) { return birthOrderContext(entry.person, childOrder); });
  }

  function sourceEntries(source) {
    return Object.entries(u.plainObject(source && source.fields)).filter(function (entry) { return String(entry[1] || "").trim(); });
  }

  function sourceDisplayValue(entry) {
    if (entry[0] !== "lineage-id") return entry[1];
    return String(entry[1] || "").split(".").map(displayLineageSegment).join(".");
  }

  function sourceLabel(key) {
    return String(key || "").replace(/[-_]/g, " ").replace(/\b\w/g, function (character) { return character.toUpperCase(); });
  }

  function sourceField(person, key) {
    return u.cleanLine(person && person.source && person.source.fields && person.source.fields[key], 4000);
  }

  function lineageSegments(person) {
    const raw = sourceField(person, "lineage-id");
    if (!raw) return [];
    return raw.split(".").map(function (part) { return u.cleanLine(part, 20); }).filter(Boolean).map(function (part) {
      return /^\d+$/.test(part) ? String(Number(part)).padStart(2, "0") : part.padStart(2, "0");
    });
  }

  function storedLineageValue(person) {
    const value = u.cleanLine(person && person.source && person.source.fields && person.source.fields["lineage-id"], 100);
    return /^(?:\d{2})(?:\.\d{2})*$/.test(value) ? value : "";
  }

  function lineageValueTaken(sourceState, value, personId) {
    return sourceState.workspace.people.some(function (person) {
      return person.id !== personId && storedLineageValue(person) === value && value !== "99";
    });
  }

  function nextRootLineageValue(sourceState, personId) {
    const used = new Set(sourceState.workspace.people.filter(function (person) { return person.id !== personId; }).map(function (person) {
      return storedLineageValue(person).split(".")[0];
    }).filter(Boolean));
    for (let number = 1; number <= 98; number += 1) {
      const segment = String(number).padStart(2, "0");
      if (!used.has(segment)) return segment;
    }
    throw new Error("No root lineage number is available.");
  }

  function nextChildLineageSegment(sourceState, parentLineage, childId) {
    const prefix = parentLineage + ".";
    const depth = parentLineage.split(".").length + 1;
    const used = new Set(sourceState.workspace.people.filter(function (person) { return person.id !== childId; }).map(function (person) {
      const value = storedLineageValue(person);
      return value.startsWith(prefix) && value.split(".").length === depth ? value.slice(prefix.length) : "";
    }).filter(Boolean));
    for (let number = 1; number <= 98; number += 1) {
      const segment = String(number).padStart(2, "0");
      if (!used.has(segment)) return segment;
    }
    throw new Error("This parent already uses every available child lineage number.");
  }

  function setPersonLineageValue(person, value) {
    if (storedLineageValue(person) === value) return;
    person.source = u.plainObject(person.source);
    person.source.format = person.source.format || "mcpeople-v1";
    person.source.fields = Object.assign({}, u.plainObject(person.source.fields), { "lineage-id": value });
    person.updatedAt = u.isoNow();
  }

  function assignLineageBranch(sourceState, personId, parentLineage, visited) {
    if (visited.has(personId)) throw new Error("The Lineal links would create a lineage cycle.");
    visited.add(personId);
    const person = sourceState.workspace.people.find(function (candidate) { return candidate.id === personId; });
    if (!person) throw new Error("The person receiving the lineage ID could not be found.");
    const oldLineage = storedLineageValue(person);
    const prefix = parentLineage + ".";
    const expectedDepth = parentLineage.split(".").length + 1;
    let newLineage = oldLineage.startsWith(prefix) && oldLineage.split(".").length === expectedDepth && !lineageValueTaken(sourceState, oldLineage, personId) ? oldLineage : "";
    const oldLastSegment = oldLineage.split(".").slice(-1)[0];
    if (!newLineage && /^(?:0[1-9]|[1-8]\d|9[0-8])$/.test(oldLastSegment || "")) {
      const candidate = prefix + oldLastSegment;
      if (!lineageValueTaken(sourceState, candidate, personId)) newLineage = candidate;
    }
    if (!newLineage) newLineage = prefix + nextChildLineageSegment(sourceState, parentLineage, personId);
    setPersonLineageValue(person, newLineage);
    sourceState.workspace.relationships.filter(function (relationship) {
      return relationship.type === "parent-child" && relationship.lineage === "lineal" && relationship.parentId === personId;
    }).forEach(function (relationship) {
      assignLineageBranch(sourceState, relationship.childId, newLineage, visited);
    });
    visited.delete(personId);
    return newLineage;
  }

  function ensurePersonLineageValue(sourceState, personId, visited) {
    const person = sourceState.workspace.people.find(function (candidate) { return candidate.id === personId; });
    if (!person) throw new Error("The Lineal parent could not be found.");
    const existing = storedLineageValue(person);
    if (existing && existing !== "99") return existing;
    if (visited.has(personId)) throw new Error("The Lineal links would create a lineage cycle.");
    visited.add(personId);
    const parentRelationship = sourceState.workspace.relationships.find(function (relationship) {
      return relationship.type === "parent-child" && relationship.lineage === "lineal" && relationship.childId === personId;
    });
    if (parentRelationship) {
      const parentLineage = ensurePersonLineageValue(sourceState, parentRelationship.parentId, visited);
      visited.delete(personId);
      return assignLineageBranch(sourceState, personId, parentLineage, new Set());
    }
    const rootLineage = nextRootLineageValue(sourceState, personId);
    setPersonLineageValue(person, rootLineage);
    visited.delete(personId);
    return rootLineage;
  }

  function assignLineageForRelationship(sourceState, relationship) {
    if (!relationship || relationship.type !== "parent-child" || relationship.lineage !== "lineal") return "";
    const parentLineage = ensurePersonLineageValue(sourceState, relationship.parentId, new Set());
    return assignLineageBranch(sourceState, relationship.childId, parentLineage, new Set());
  }

  function displayLineageSegment(segment) {
    return String(segment || "") === "99" ? "??" : String(segment || "");
  }

  function lineageId(person) {
    return lineageSegments(person).map(displayLineageSegment);
  }

  function lineageOwnNumber(person) {
    const segments = lineageSegments(person);
    return displayLineageSegment(segments[segments.length - 1] || "");
  }

  function ordinalLineageNumber(value) {
    if (!/^\d+$/.test(String(value || "")) || Number(value) < 1) return "";
    const number = Number(value);
    const lastTwo = number % 100;
    const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th");
    return number + suffix;
  }

  function profileName(person) {
    return model.treeName(person, state().ui.treeNameBasis, "full");
  }

  function lineageName(person) {
    return model.treeName(person, "lineal", "full");
  }

  function lineageChain(person) {
    const current = state();
    const numbers = lineageId(person);
    const graph = family.indexes(current);
    const members = [];
    const used = new Set();
    let cursor = person;
    while (cursor && !used.has(cursor.id) && members.length <= config.controls.maxPeople) {
      used.add(cursor.id);
      members.push({ name: lineageName(cursor), person: cursor, number: lineageOwnNumber(cursor) });
      const parentEntry = (graph.parents.get(cursor.id) || []).find(function (entry) { return entry.relationship && entry.relationship.lineage === "lineal"; });
      const parent = parentEntry && parentEntry.person;
      if (!parent || used.has(parent.id)) break;
      cursor = parent;
    }
    const selectedGeneration = Math.max(0, members.length - 1);
    members.forEach(function (member, index) { member.generation = Math.max(0, selectedGeneration - index); });
    return { numbers: numbers, members: members };
  }

  function firstName(value) {
    return u.cleanLine(value, 200).split(/\s+/)[0] || "Unknown";
  }

  function lineagePersonLink(member, includeLineageMeta, visibleName) {
    const lineageMeta = (member.number || "—") + " | G" + member.generation;
    const label = u.escapeHtml(visibleName || member.name) + (includeLineageMeta ? ' <span class="lineage-bracket">[' + u.escapeHtml(lineageMeta) + "]</span>" : "");
    const accessibleLabel = visibleName && visibleName !== member.name ? ' aria-label="Select ' + u.escapeHtml(member.name) + '"' : "";
    return member.person ? '<button type="button" class="lineage-person-link" data-select-person="' + u.escapeHtml(member.person.id) + '"' + accessibleLabel + '>' + label + "</button>" : '<span class="lineage-unlinked-name">' + label + "</span>";
  }

  function lineageIdHtml(numbers) {
    if (!numbers.length) return '<span class="muted-copy">None</span>';
    return '<code class="lineage-id">' + numbers.map(function (number, index) {
      let value = u.escapeHtml(number);
      if (index === numbers.length - 1) value = "<strong>" + value + "</strong>";
      if (index < 3) value = "<em>" + value + "</em>";
      return (index ? "." : "") + value;
    }).join("") + "</code>";
  }

  function lineageSummaryText(person) {
    const summary = family.lineageSummary(person.id, state());
    return [
      summary.ancestors + " ancestor" + (summary.ancestors === 1 ? "" : "s"),
      summary.siblings + " sibling" + (summary.siblings === 1 ? "" : "s"),
      summary.descendants + " descendant" + (summary.descendants === 1 ? "" : "s")
    ].join(" · ");
  }

  function lineageReadingCell(member, parent, hasRecordedLineage) {
    const generation = "<strong>Gen " + member.generation + "</strong>, ";
    if (!parent && !hasRecordedLineage) return '<span class="muted-copy">' + generation + "No parent lineage.</span>";
    if (!parent) return '<span class="lineage-root">' + generation + "Root ancestor</span>";
    const ordinalLabel = ordinalLineageNumber(member.number);
    const ordinal = ordinalLabel ? "<strong>" + u.escapeHtml(ordinalLabel) + "</strong> " : "";
    return "<span>" + generation + ordinal + "Child of " + lineagePersonLink(parent, false, firstName(parent.name)) + "</span>";
  }

  function profileLineage(person) {
    const chain = lineageChain(person);
    const background = person.heritageNote && !sourceField(person, "lineage-id") ? '<div class="lineage-background"><h4>Background</h4><p class="preserve-lines">' + u.escapeHtml(person.heritageNote) + "</p></div>" : "";
    const hasRecordedLineage = chain.members.length > 1 || chain.numbers.length > 0;
    return '<section class="profile-section lineage-section"><h3>Lineage</h3><div class="lineage-id-row"><span>ID</span>' + lineageIdHtml(chain.numbers) + '</div><div class="lineage-columns"><h4>Family Line</h4><ol class="lineage-paired-list">' + chain.members.map(function (member, index) {
      return '<li><div class="lineage-name-cell">' + lineagePersonLink(member, true) + '</div><div class="lineage-reading-cell">' + lineageReadingCell(member, chain.members[index + 1], hasRecordedLineage) + "</div></li>";
    }).join("") + '</ol><p class="lineage-summary">' + u.escapeHtml(lineageSummaryText(person)) + "</p></div>" + background + "</section>";
  }

  function profileNames(person) {
    function fullName(kind) {
      const parts = model.nameParts(person, kind);
      return [parts.prefix, parts.first, parts.middle, parts.last, parts.suffix].filter(Boolean).join(" ") || "----";
    }
    const rows = [
      ["Preferred (Display)", fullName("preferred")],
      ["Legal (Current)", fullName("current")],
      ["Lineal (Birth)", fullName("birth")],
      ["Maiden", person.names.maidenLast || "----"]
    ];
    return '<section class="profile-section names-section"><h3>Names</h3><dl class="profile-list profile-names-list">' + rows.map(function (entry) {
      return '<div><dt>' + u.escapeHtml(entry[0]) + '</dt><dd>' + u.escapeHtml(entry[1]) + "</dd></div>";
    }).join("") + "</dl></section>";
  }

  function profileSource(person) {
    if (!developerReferencesEnabled()) return "";
    const entries = sourceEntries(person.source);
    if (!entries.length) return "";
    return '<section class="profile-section source-section"><details><summary>Imported Source · ' + entries.length + ' populated fields</summary><p class="source-format">' + u.escapeHtml(person.source.format || "Imported CSV") + '</p><dl class="profile-list source-list">' + entries.map(function (entry) { return '<div><dt>' + u.escapeHtml(sourceLabel(entry[0])) + '</dt><dd>' + u.escapeHtml(sourceDisplayValue(entry)) + "</dd></div>"; }).join("") + "</dl></details></section>";
  }

  function addressSourceDetails(address) {
    if (!developerReferencesEnabled()) return "";
    const entries = sourceEntries(address && address.placeSource);
    if (!entries.length) return "";
    return '<details class="address-source-details"><summary>Imported Source · ' + entries.length + ' populated fields</summary><p class="source-format">' + u.escapeHtml(address.placeSource.format || "Imported place") + '</p><dl class="profile-list source-list">' + entries.map(function (entry) {
      return '<div><dt>' + u.escapeHtml(sourceLabel(entry[0])) + '</dt><dd>' + u.escapeHtml(sourceDisplayValue(entry)) + "</dd></div>";
    }).join("") + "</dl></details>";
  }

  function profileAddressCard(address) {
    const start = addressDateLabel(address, "start");
    const end = addressDateLabel(address, "end");
    const phone = address.phone ? '<p class="address-phone">' + u.escapeHtml(address.phone) + "</p>" : "";
    return '<article class="contact-card"><header><strong>' + u.escapeHtml(address.label) + '</strong><span class="status-pill" data-kind="' + (address.current ? "success" : "neutral") + '">' + (address.current ? "Current" : "Former") + '</span></header><address>' + u.escapeHtml(model.formatAddress(address)).replace(/\n/g, "<br>") + '</address>' + phone + ((start || end) ? '<small>' + u.escapeHtml([start, end].filter(Boolean).join(" – ")) + "</small>" : "") + (address.notes ? "<p>" + u.escapeHtml(address.notes) + "</p>" : "") + addressSourceDetails(address) + "</article>";
  }

  function printSource(person) {
    if (!developerReferencesEnabled()) return "";
    const entries = sourceEntries(person.source);
    if (!entries.length) return "";
    return '<section class="print-wide print-source"><h3>Imported Source Fields</h3><p>' + u.escapeHtml(person.source.format || "Imported CSV") + '</p><dl>' + entries.map(function (entry) { return '<div><dt>' + u.escapeHtml(sourceLabel(entry[0])) + '</dt><dd>' + u.escapeHtml(sourceDisplayValue(entry)) + "</dd></div>"; }).join("") + "</dl></section>";
  }

  function printLineage(person) {
    const chain = lineageChain(person);
    const nameList = chain.members.map(function (member) { return u.escapeHtml(member.name) + " [" + u.escapeHtml((member.number || "—") + " | G" + member.generation) + "]"; }).join(" → ");
    const reading = chain.members.map(function (member, index) {
      const parent = chain.members[index + 1];
      if (!parent) return "Gen " + member.generation + ", Root ancestor";
      const ordinalLabel = ordinalLineageNumber(member.number);
      const ordinal = ordinalLabel ? u.escapeHtml(ordinalLabel) + " " : "";
      return "Gen " + member.generation + ", " + ordinal + "Child of " + u.escapeHtml(firstName(parent.name));
    }).join("<br>");
    const background = person.heritageNote && !sourceField(person, "lineage-id") ? '<div><dt>Background</dt><dd>' + u.escapeHtml(person.heritageNote).replace(/\n/g, "<br>") + "</dd></div>" : "";
    return '<section class="print-wide"><h3>Lineage</h3><dl><div><dt>ID</dt><dd>' + lineageIdHtml(chain.numbers) + '</dd></div><div><dt>Family Line</dt><dd>' + nameList + '</dd></div><div><dt>Reading</dt><dd>' + reading + '</dd></div><div><dt>Family</dt><dd>' + u.escapeHtml(lineageSummaryText(person)) + "</dd></div>" + background + "</dl></section>";
  }

  function renderProfile() {
    const container = $("#profilePanelContent");
    if (!container) return;
    const editing = familyEditingEnabled();
    const person = state().workspace.people.find(function (item) { return item.id === state().ui.selectedPersonId; });
    if (!person) {
      const addButton = editing ? '<button type="button" class="button primary" data-add-person>Add person</button>' : "";
      container.innerHTML = '<div class="empty-state"><h2>No person selected</h2><p>Select someone in the list or tree.</p>' + addButton + "</div>";
      return;
    }
    const isHome = state().workspace.family.homePersonId === person.id;
    const isFavorite = state().ui.favoritePersonIds.includes(person.id);
    const profileLabels = (developerReferencesEnabled() ? [person.reference] : []).concat(isHome ? ["Root Ancestor"] : []);
    const profileEyebrow = profileLabels.length ? '<span class="eyebrow">' + u.escapeHtml(profileLabels.join(" · ")) + "</span>" : "";
    const contactBlocks = [];
    if (piiVisible() && person.addresses.length) contactBlocks.push('<section class="profile-section"><h3>Addresses</h3>' + person.addresses.slice().sort(function (a, b) { return a.order - b.order; }).map(profileAddressCard).join("") + "</section>");
    if (piiVisible() && (person.phones.length || person.emails.length)) contactBlocks.push('<section class="profile-section"><h3>Contact</h3><dl class="profile-list">' + person.phones.map(function (item) { return '<div><dt>' + u.escapeHtml(item.label) + '</dt><dd>' + u.escapeHtml(item.value) + "</dd></div>"; }).join("") + person.emails.map(function (item) { return '<div><dt>' + u.escapeHtml(item.label) + '</dt><dd>' + u.escapeHtml(item.value) + "</dd></div>"; }).join("") + "</dl></section>");
    const actionButton = function (label, symbol, attribute, danger) {
      return '<button type="button" class="profile-action' + (danger ? " danger-text" : "") + '" ' + attribute + ' aria-label="' + u.escapeHtml(label + " person") + '"><span class="profile-action-icon" data-symbol="' + symbol + '" aria-hidden="true"></span><span>' + u.escapeHtml(label) + "</span></button>";
    };
    const relationshipActions = editing ? '<div class="relationship-actions">' + actionButton("Add", "addRelative", 'data-add-relative="' + u.escapeHtml(person.id) + '"', false) + actionButton("Connect", "connectPerson", 'data-add-relationship="' + u.escapeHtml(person.id) + '"', false) + "</div>" : "";
    const relationships = '<section class="profile-section"><div class="relationship-section-heading"><h3>Relationships</h3>' + relationshipActions + '</div><div class="relationship-list">' + relationshipRows(person) + "</div></section>";
    const selectedName = profileName(person);
    const favoriteAction = (isFavorite ? "Remove " : "Add ") + selectedName + (isFavorite ? " from" : " to") + " favorites";
    const favoriteButton = '<button type="button" class="profile-action profile-favorite-action" data-toggle-favorite="' + u.escapeHtml(person.id) + '" aria-pressed="' + String(isFavorite) + '" aria-label="' + u.escapeHtml(favoriteAction) + '" title="' + u.escapeHtml(favoriteAction) + '"><span class="profile-action-icon" data-symbol="favorite" aria-hidden="true"></span><span>Favorite</span></button>';
    const recordActions = editing ? actionButton("Delete", "deletePerson", 'data-delete-person="' + u.escapeHtml(person.id) + '"', true) + actionButton("Edit", "editPerson", 'data-edit-person="' + u.escapeHtml(person.id) + '"', false) : "";
    const headerActions = '<div class="profile-header-actions">' + favoriteButton + recordActions + '<button type="button" class="icon-button profile-close" data-close-profile aria-controls="profilePanel" aria-label="Close and deselect person" title="Close and deselect person"><span data-symbol="close" aria-hidden="true"></span></button></div>';
    container.innerHTML = '<article class="person-profile"><header class="profile-header"><div class="profile-title">' + profileEyebrow + '<h2>' + u.escapeHtml(selectedName) + '</h2><p>' + u.escapeHtml(family.lifespan(person)) + "</p></div>" + headerActions + '</header><dl class="profile-list identity-list">' + formatEvent("Born", person, "birth") + formatEvent("Died", person, "death") + ageDetail(person, false) + livingStatusDetail(person) + maritalStatusDetail(person, family.relationGroups(person.id, state()).partners) + "</dl>" + profileNames(person) + profileLineage(person) + relationships + contactBlocks.join("") + (familyEditingEnabled() && person.notes ? '<section class="profile-section"><h3>Notes</h3><p class="preserve-lines">' + u.escapeHtml(person.notes) + "</p></section>" : "") + profileSource(person) + "</article>";
    icons.mount(container);
  }

  function isNonLinealParentEdge(edge) {
    return Boolean(edge && edge.relationship && edge.relationship.type === "parent-child" && edge.relationship.lineage === "non-lineal");
  }

  function unknownPartnerMarks(edge, pathId) {
    const left = edge.from.x <= edge.to.x ? edge.from : edge.to;
    const right = left === edge.from ? edge.to : edge.from;
    const length = Math.max(0, right.x - (left.x + left.width));
    const inset = Math.min(1, length / 4);
    const visibleLength = Math.max(0, length - inset * 2);
    const marks = new Array(Math.max(3, Math.ceil(visibleLength / 7))).fill("?").join("");
    return '<text class="tree-edge-marks" aria-hidden="true"><textPath href="#' + pathId + '" startOffset="' + inset + '" textLength="' + visibleLength + '" lengthAdjust="spacingAndGlyphs">' + marks + "</textPath></text>";
  }

  function edgePath(edge) {
    if (edge.relationship.type === "partner") {
      const left = edge.from.x <= edge.to.x ? edge.from : edge.to;
      const right = left === edge.from ? edge.to : edge.from;
      const alignedPartner = left.partnerPlacement === "left" ? left : right.partnerPlacement === "right" ? right : null;
      let y = alignedPartner ? alignedPartner.y + alignedPartner.height / 2 : ((left.y + left.height / 2) + (right.y + right.height / 2)) / 2;
      if (alignedPartner && alignedPartner.partnerPlacement === "left" && alignedPartner.partnerCount > 1) {
        y = alignedPartner.y + alignedPartner.height * (alignedPartner.partnerAlign === "top" ? 0.25 : 0.75);
      }
      return "M" + (left.x + left.width) + " " + y + " L" + right.x + " " + y;
    }
    const x1 = edge.from.x + edge.from.width / 2;
    const y1 = edge.from.y + edge.from.height;
    const x2 = edge.to.x + edge.to.width / 2;
    const y2 = edge.to.y;
    const middle = (y1 + y2) / 2;
    return "M" + x1 + " " + y1 + " C" + x1 + " " + middle + " " + x2 + " " + middle + " " + x2 + " " + y2;
  }

  function developerTreeScaleHtml() {
    if (!developerReferencesEnabled() || !currentTreeLayout || !currentTreeLayout.generationMetrics) return "";
    return '<g class="tree-generation-scale" aria-hidden="true"><text class="tree-generation-scale-title" x="8" y="20">Bubble scale</text>' + currentTreeLayout.generationMetrics.map(function (metric) {
      const top = metric.y;
      const bottom = metric.y + metric.height;
      const middle = top + metric.height / 2;
      return '<path d="M10 ' + top + ' H20 M15 ' + top + ' V' + bottom + ' M10 ' + bottom + ' H20"></path><text x="26" y="' + middle + '">Gen ' + metric.generation + ' · ' + metric.nodeWidth + '×' + metric.nodeHeight + 'px</text>';
    }).join("") + "</g>";
  }

  function sizeTreeSurface() {
    const svg = $("#familyTreeSvg");
    const canvas = svg && svg.parentElement;
    if (!svg || !canvas || !currentTreeLayout) return;
    if (treeSurfaceMode === "fit") {
      svg.style.width = Math.max(320, canvas.clientWidth) + "px";
      svg.style.height = Math.max(280, canvas.clientHeight) + "px";
      return;
    }
    svg.style.width = Math.max(canvas.clientWidth, currentTreeLayout.width * treeTransform.scale + 80) + "px";
    svg.style.height = Math.max(canvas.clientHeight, currentTreeLayout.height * treeTransform.scale + 80) + "px";
  }

  function applyTreeTransform() {
    const viewport = $("#treeViewport");
    if (!viewport) return;
    sizeTreeSurface();
    viewport.setAttribute("transform", "translate(" + treeTransform.x + " " + treeTransform.y + ") scale(" + treeTransform.scale + ")");
    const input = $("#zoomValue");
    if (input && document.activeElement !== input) input.value = String(Math.round(treeTransform.scale * 100));
    const status = $("#zoomStatus");
    if (status) status.textContent = Math.round(treeTransform.scale * 100) + "% zoom";
  }

  function fitTree() {
    const svg = $("#familyTreeSvg");
    if (!svg || !currentTreeLayout) return;
    const canvas = svg.parentElement;
    const width = Math.max(320, canvas && canvas.clientWidth || 800);
    const height = Math.max(280, canvas && canvas.clientHeight || 600);
    treeSurfaceMode = "fit";
    const scale = Math.min((width - 44) / currentTreeLayout.width, (height - 44) / currentTreeLayout.height, 1.2);
    treeTransform.scale = u.clamp(scale, 0.01, 2.5, 1);
    treeTransform.x = (width - currentTreeLayout.width * treeTransform.scale) / 2;
    treeTransform.y = (height - currentTreeLayout.height * treeTransform.scale) / 2;
    applyTreeTransform();
    if (canvas) { canvas.scrollLeft = 0; canvas.scrollTop = 0; }
  }

  function resetTreeView() {
    const svg = $("#familyTreeSvg");
    const canvas = svg && svg.parentElement;
    if (!svg || !canvas || !currentTreeLayout) return;
    treeSurfaceMode = "natural";
    treeTransform = { x: 40, y: 40, scale: 1 };
    applyTreeTransform();
    const focusId = state().ui.treeFocusId || state().workspace.family.homePersonId;
    const focusNode = currentTreeLayout.nodes.find(function (node) { return node.id === focusId; });
    if (focusNode) {
      canvas.scrollLeft = Math.max(0, focusNode.x + focusNode.width / 2 + treeTransform.x - canvas.clientWidth / 2);
      canvas.scrollTop = Math.max(0, focusNode.y + focusNode.height / 2 + treeTransform.y - canvas.clientHeight / 2);
    } else {
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
    }
  }

  function centerUnplacedLineage() {
    const svg = $("#familyTreeSvg");
    const canvas = svg && svg.parentElement;
    if (!svg || !canvas || !currentTreeLayout) return;
    const unplacedIds = family.unplacedLineageIds(state());
    const nodes = currentTreeLayout.nodes.filter(function (node) { return unplacedIds.has(node.id); });
    if (!nodes.length) return;
    treeSurfaceMode = "natural";
    treeTransform = { x: 40, y: 40, scale: 1 };
    applyTreeTransform();
    const left = Math.min.apply(null, nodes.map(function (node) { return node.x; }));
    const right = Math.max.apply(null, nodes.map(function (node) { return node.x + node.width; }));
    const top = Math.min.apply(null, nodes.map(function (node) { return node.y; }));
    const bottom = Math.max.apply(null, nodes.map(function (node) { return node.y + node.height; }));
    canvas.scrollLeft = Math.max(0, (left + right) / 2 + treeTransform.x - canvas.clientWidth / 2);
    canvas.scrollTop = Math.max(0, (top + bottom) / 2 + treeTransform.y - canvas.clientHeight / 2);
    announce("Centered " + nodes.length + " unresolved Lineal " + (nodes.length === 1 ? "person." : "people."));
  }

  function renderTree() {
    const svg = $("#familyTreeSvg");
    if (!svg) return;
    const focusId = state().ui.treeFocusId || state().workspace.family.homePersonId || (state().workspace.people[0] && state().workspace.people[0].id);
    currentTreeLayout = family.layout(state(), { mode: state().ui.treeMode, focusId: focusId, ancestorDepth: state().ui.ancestorDepth, descendantDepth: state().ui.descendantDepth, nodeView: state().ui.treeNodeView, nameBasis: state().ui.treeNameBasis, nameLength: state().ui.treeNameLength, hideUnplacedLineage: state().ui.hideUnplacedLineage, showDeveloperScale: developerReferencesEnabled() });
    if (!currentTreeLayout.nodes.length) {
      svg.innerHTML = '<text class="tree-empty-text" x="50%" y="46%" text-anchor="middle">No people yet</text><text class="tree-empty-subtext" x="50%" y="54%" text-anchor="middle">Family editing is paused while McFamily is being built.</text>';
      return;
    }
    const showAffinalLines = state().ui.showInferredParentLines;
    const edges = currentTreeLayout.edges.filter(function (edge) {
      return showAffinalLines || !isNonLinealParentEdge(edge);
    }).map(function (edge) {
      const relationship = edge.relationship;
      const kind = relationship.type === "parent-child" ? relationship.kind : family.partnerLineKind(relationship, edge.current, edge.from.person, edge.to.person);
      const description = relationshipDescription(edge);
      const affinal = isNonLinealParentEdge(edge) ? " affinal-parent" : "";
      const lineage = relationship.type === "parent-child" ? ' data-lineage="' + u.escapeHtml(relationship.lineage) + '"' : "";
      const pathId = "tree-edge-" + u.escapeHtml(relationship.id);
      const path = '<path id="' + pathId + '" class="tree-edge ' + u.escapeHtml(relationship.type) + affinal + '" role="img" aria-label="' + u.escapeHtml(description) + '" data-kind="' + u.escapeHtml(kind) + '"' + lineage + ' d="' + edgePath(edge) + '"><title>' + u.escapeHtml(description) + "</title></path>";
      return path + (relationship.type === "partner" && kind === "unknown" ? unknownPartnerMarks(edge, pathId) : "");
    }).join("");
    const nodes = currentTreeLayout.nodes.map(function (node) {
      const person = node.person;
      const selected = state().ui.selectedPersonId === person.id;
      const home = state().workspace.family.homePersonId === person.id;
      const name = model.treeName(person, currentTreeLayout.nameBasis, currentTreeLayout.nameLength);
      const renderWidth = node.renderWidth || node.width;
      const renderHeight = node.renderHeight || node.height;
      const scale = node.scale || 1;
      const detailed = currentTreeLayout.nodeView === "detailed";
      const nameLines = family.treeNameLines(person, { basis: currentTreeLayout.nameBasis, length: currentTreeLayout.nameLength });
      const contactAvailability = detailed && piiVisible() && person.livingStatus === "living" ? [
        person.addresses && person.addresses.length ? { symbol: "addressAvailable", label: "address" } : null,
        personHasPhone(person) ? { symbol: "phoneAvailable", label: "phone" } : null,
        person.emails && person.emails.length ? { symbol: "emailAvailable", label: "email" } : null
      ].filter(Boolean) : [];
      const contactLabel = contactAvailability.length ? " Recorded " + contactAvailability.map(function (item) { return item.label; }).join(", ") + "." : "";
      const accessibleDetails = detailed ? ", " + family.lifespan(person) + "." + contactLabel : ".";
      const shell = '<g class="tree-node' + (selected ? " selected" : "") + (home ? " home" : "") + (node.partnerPlacement === "left" ? " compact-partner" : "") + (isLinealPerson(person) ? " lineal" : "") + (person.livingStatus === "deceased" ? " deceased" : "") + '" data-view="' + u.escapeHtml(currentTreeLayout.nodeView) + '" tabindex="0" role="button" aria-label="' + u.escapeHtml(name + accessibleDetails + " Select to focus.") + '" data-tree-person="' + u.escapeHtml(person.id) + '" transform="translate(' + node.x + " " + node.y + ") scale(" + scale + ')"><rect width="' + renderWidth + '" height="' + renderHeight + '" rx="10"></rect>';
      const nameHtml = nameLines.map(function (line, index) {
        const familyClass = currentTreeLayout.nameLength === "short" && index === nameLines.length - 1 ? " tree-family" : "";
        const densityClass = line.length > 20 ? " tree-name-tight" : line.length > 14 ? " tree-name-compact" : "";
        const fit = line.length > 18 ? ' textLength="' + (renderWidth - 14) + '" lengthAdjust="spacingAndGlyphs"' : "";
        return '<text class="tree-name-line' + familyClass + densityClass + '" x="' + (renderWidth / 2) + '" y="' + (16 + index * 14) + '" text-anchor="middle"' + fit + '>' + u.escapeHtml(line) + "</text>";
      }).join("");
      const lifeY = 21 + nameLines.length * 14;
      const reference = detailed && developerReferencesEnabled() ? '<text class="tree-reference" x="' + (renderWidth / 2) + '" y="' + (lifeY + 13) + '" text-anchor="middle">' + u.escapeHtml(person.reference) + "</text>" : "";
      const life = detailed ? '<text class="tree-life" x="' + (renderWidth / 2) + '" y="' + lifeY + '" text-anchor="middle">' + u.escapeHtml(family.lifespan(person)) + "</text>" : "";
      const linealMark = detailed && isLinealPerson(person) ? icons.markup("lineal").replace('<svg class="sf-symbol"', '<svg class="sf-symbol tree-lineal-mark" x="' + (renderWidth - 14) + '" y="' + (lifeY - 9) + '" width="7" height="10"') : "";
      const contactMarks = contactAvailability.map(function (item, index) {
        return icons.markup(item.symbol).replace('<svg class="sf-symbol"', '<svg class="sf-symbol tree-contact-mark" x="' + (6 + index * 22) + '" y="' + (renderHeight - 21) + '" width="18" height="18"');
      }).join("");
      return shell + nameHtml + life + reference + contactMarks + linealMark + "</g>";
    }).join("");
    svg.innerHTML = '<g id="treeViewport">' + developerTreeScaleHtml() + '<g class="tree-edges">' + edges + '</g><g class="tree-nodes">' + nodes + "</g></g>";
    bindTreeInteractions(svg);
    if (treeNeedsFit) {
      treeNeedsFit = false;
      requestAnimationFrame(resetTreeView);
    } else applyTreeTransform();
  }

  function relativeForArrow(personId, key) {
    const groups = family.relationGroups(personId, state());
    if (key === "ArrowUp") return groups.parents[0] && groups.parents[0].person;
    if (key === "ArrowDown") return groups.children[0] && groups.children[0].person;
    if (key === "ArrowLeft") return (groups.partners[0] && groups.partners[0].person) || groups.siblings[0];
    if (key === "ArrowRight") return groups.siblings[0] || (groups.partners[0] && groups.partners[0].person);
    return null;
  }

  function bindTreeInteractions(svg) {
    let drag = null;
    let pinch = null;
    const pointers = new Map();
    svg.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || event.target.closest("[data-tree-person]")) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      svg.setPointerCapture(event.pointerId);
      svg.classList.add("dragging");
      if (pointers.size === 1) {
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: treeTransform.x, startY: treeTransform.y };
        pinch = null;
      } else if (pointers.size === 2) {
        const values = Array.from(pointers.values());
        const centerX = (values[0].x + values[1].x) / 2;
        const centerY = (values[0].y + values[1].y) / 2;
        pinch = {
          distance: Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y) || 1,
          scale: treeTransform.scale,
          worldX: (centerX - treeTransform.x) / treeTransform.scale,
          worldY: (centerY - treeTransform.y) / treeTransform.scale
        };
        drag = null;
      }
    });
    svg.addEventListener("pointermove", function (event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && pointers.size >= 2) {
        const values = Array.from(pointers.values()).slice(0, 2);
        const centerX = (values[0].x + values[1].x) / 2;
        const centerY = (values[0].y + values[1].y) / 2;
        const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y) || 1;
        treeTransform.scale = u.clamp(pinch.scale * distance / pinch.distance, 0.01, 2.5, pinch.scale);
        treeSurfaceMode = "natural";
        treeTransform.x = centerX - pinch.worldX * treeTransform.scale;
        treeTransform.y = centerY - pinch.worldY * treeTransform.scale;
      } else if (drag && drag.id === event.pointerId) {
        treeTransform.x = drag.startX + event.clientX - drag.x;
        treeTransform.y = drag.startY + event.clientY - drag.y;
      }
      applyTreeTransform();
    });
    function endDrag(event) {
      pointers.delete(event.pointerId);
      pinch = null;
      if (pointers.size === 1) {
        const remaining = Array.from(pointers.entries())[0];
        drag = { id: remaining[0], x: remaining[1].x, y: remaining[1].y, startX: treeTransform.x, startY: treeTransform.y };
      } else {
        drag = null;
        svg.classList.remove("dragging");
      }
    }
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("wheel", function (event) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const oldScale = treeTransform.scale;
      const nextScale = u.clamp(oldScale * (event.deltaY < 0 ? 1.12 : 0.89), 0.01, 2.5, oldScale);
      treeTransform.x = cursorX - (cursorX - treeTransform.x) * (nextScale / oldScale);
      treeTransform.y = cursorY - (cursorY - treeTransform.y) * (nextScale / oldScale);
      treeTransform.scale = nextScale;
      treeSurfaceMode = "natural";
      applyTreeTransform();
    }, { passive: false });
  }

  function bindFamilyResize() {
    const grid = $(".family-workspace-grid");
    if (!grid || window.matchMedia("(max-width: 959px)").matches) return;
    const directory = $("#directoryPanel");
    const profile = $("#profilePanel");
    const directoryDivider = $("#directoryTreeDivider");
    const profileDivider = $("#treeProfileDivider");

    function visible(element) {
      return Boolean(element && !element.hidden && getComputedStyle(element).display !== "none");
    }

    function remainingWidth(excludedPanel) {
      const children = Array.from(grid.children).filter(visible);
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      return children.reduce(function (total, child) {
        return child === excludedPanel || child.classList.contains("tree-panel") ? total : total + child.getBoundingClientRect().width;
      }, gap * Math.max(0, children.length - 1));
    }

    function updatePercentage(divider) {
      if (!visible(divider)) return;
      const gridRect = grid.getBoundingClientRect();
      const dividerRect = divider.getBoundingClientRect();
      const percent = Math.round((dividerRect.left - gridRect.left + dividerRect.width / 2) / Math.max(1, gridRect.width) * 100);
      const output = $(".family-divider-percentage", divider);
      if (output) output.textContent = percent + "%";
      divider.setAttribute("aria-valuetext", percent + "% position");
    }

    function bindDivider(options) {
      const divider = options.divider;
      const panel = options.panel;
      if (!visible(divider) || !visible(panel)) return;
      let drag = null;
      function bounds() {
        const narrowDesktop = window.matchMedia("(max-width: 1180px)").matches;
        const minimumTreeWidth = !visible(profile) ? 520 : (!visible(directory) ? (narrowDesktop ? 390 : 520) : (narrowDesktop ? 390 : 420));
        const maximum = grid.clientWidth - remainingWidth(panel) - minimumTreeWidth;
        return { min: options.min, max: Math.max(options.min, Math.min(options.max, maximum)) };
      }
      function applyWidth(value, persist) {
        const limits = bounds();
        const width = Math.round(u.clamp(value, limits.min, limits.max, state().ui[options.stateKey]));
        grid.style.setProperty(options.cssProperty, width + "px");
        divider.setAttribute("aria-valuemax", String(limits.max));
        divider.setAttribute("aria-valuenow", String(width));
        updatePercentage(directoryDivider);
        updatePercentage(profileDivider);
        sizeTreeSurface();
        if (persist) storage.mutate(function (next) {
          next.ui.panelSizingCustomized = true;
          next.ui.directoryPanelWidth = visible(directory) ? Math.round(directory.getBoundingClientRect().width) : (next.ui.directoryPanelWidth || Math.round(grid.clientWidth * .2));
          next.ui.profilePanelWidth = visible(profile) ? Math.round(profile.getBoundingClientRect().width) : (next.ui.profilePanelWidth || Math.round(grid.clientWidth * .3));
          next.ui[options.stateKey] = width;
        }, { touch: false, reason: "workspace-resize" });
      }
      if (state().ui.panelSizingCustomized) applyWidth(state().ui[options.stateKey], false);
      else {
        const width = Math.round(panel.getBoundingClientRect().width);
        divider.setAttribute("aria-valuenow", String(width));
        updatePercentage(directoryDivider);
        updatePercentage(profileDivider);
      }
      divider.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        drag = { x: event.clientX, width: panel.getBoundingClientRect().width };
        divider.setPointerCapture(event.pointerId);
        divider.classList.add("is-dragging");
        document.body.classList.add("resizing-family");
        event.preventDefault();
      });
      divider.addEventListener("pointermove", function (event) {
        if (!drag) return;
        applyWidth(drag.width + options.direction * (event.clientX - drag.x), false);
      });
      function finishResize(event) {
        if (!drag) return;
        drag = null;
        if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId);
        divider.classList.remove("is-dragging");
        document.body.classList.remove("resizing-family");
        applyWidth(Number(divider.getAttribute("aria-valuenow")), true);
      }
      divider.addEventListener("pointerup", finishResize);
      divider.addEventListener("pointercancel", finishResize);
      divider.addEventListener("keydown", function (event) {
        const current = Number(divider.getAttribute("aria-valuenow"));
        const limits = bounds();
        let next = current;
        if (event.key === "ArrowLeft") next -= options.direction * 24;
        else if (event.key === "ArrowRight") next += options.direction * 24;
        else if (event.key === "Home") next = options.direction === 1 ? limits.min : limits.max;
        else if (event.key === "End") next = options.direction === 1 ? limits.max : limits.min;
        else return;
        event.preventDefault();
        applyWidth(next, true);
      });
    }

    bindDivider({ divider: directoryDivider, panel: directory, stateKey: "directoryPanelWidth", cssProperty: "--directory-panel-width", min: 220, max: 480, direction: 1 });
    bindDivider({ divider: profileDivider, panel: profile, stateKey: "profilePanelWidth", cssProperty: "--profile-panel-width", min: 240, max: 600, direction: -1 });
  }

  function treeKeySwatch(type, kind, extraClass, lineage) {
    return '<svg class="tree-key-swatch" viewBox="0 0 30 8" aria-hidden="true"><path class="tree-edge ' + type + (extraClass ? " " + extraClass : "") + '" data-kind="' + kind + '"' + (lineage ? ' data-lineage="' + lineage + '"' : "") + ' d="M1 4 H29"></path></svg>';
  }

  function treeKeyCardSwatch(kind) {
    return '<svg class="tree-key-card" viewBox="0 0 30 12" aria-hidden="true"><rect class="' + kind + '" x="2" y="1" width="26" height="10" rx="2"></rect></svg>';
  }

  function treeKeyHtml() {
    const rows = [
      [treeKeySwatch("partner", "married"), "Current marriage"],
      [treeKeySwatch("partner", "previous-marriage"), "Previous marriage"],
      [treeKeySwatch("partner", "never-married"), "Never married"],
      ['<span class="tree-key-marks" aria-hidden="true">????</span>', "Unknown status"],
      [treeKeyCardSwatch("deceased"), "Deceased"],
      [treeKeyCardSwatch("lineal"), "Bloodline"],
      [treeKeySwatch("parent-child", "biological", "", "lineal"), "Lineal parent"],
      [treeKeySwatch("parent-child", "adoptive", "", "lineal"), "Lineal adoption"],
      [treeKeySwatch("parent-child", "biological", "affinal-parent", "non-lineal"), "Non-Lineal parent"]
    ];
    return '<aside class="tree-key"><details open><summary aria-keyshortcuts="K" data-shortcut="K">Key</summary><dl>' + rows.map(function (row) {
      return "<div><dt>" + row[0] + "</dt><dd>" + u.escapeHtml(row[1]) + "</dd></div>";
    }).join("") + "</dl></details></aside>";
  }

  function renderWorkspace() {
    const directoryCollapsed = state().ui.directoryCollapsed;
    const profileCollapsed = state().ui.profileCollapsed;
    const overviewDisabled = state().ui.treeMode === "overview" ? "disabled" : "";
    const lineageDisabled = state().ui.selectedPersonId ? "" : " disabled";
    const personTabDisabled = state().ui.selectedPersonId ? "" : " disabled";
    const directoryHeader = '<header class="directory-module-bar"><label class="directory-search-field"><span class="visually-hidden">Search family list</span><input id="directorySearch" type="search" aria-label="Search family list" placeholder="Search List…" value="' + u.escapeHtml(state().ui.directorySearch) + '"><span id="directoryCount" class="count-pill" role="status" aria-live="polite"></span></label><button type="button" class="icon-button" data-toggle-pane="directory" aria-controls="directoryPanel" aria-expanded="true" aria-label="Close list" title="Close list"><span data-symbol="close" aria-hidden="true"></span></button></header>';
    const directoryControls = '<div class="directory-controls"><div class="directory-filter-row"><div class="field directory-filter-control"><span id="directoryFilterLabel">Filter By</span><details class="directory-filter-menu"><summary aria-labelledby="directoryFilterLabel directoryFilterSummary"><span id="directoryFilterSummary">' + u.escapeHtml(directoryFilterSummary()) + '</span></summary><div class="directory-filter-options" role="group" aria-label="Filter list by">' + directoryFilterOptionsHtml() + '</div></details></div><label class="field"><span>Sort By</span><select id="directorySort"><option value="first">First name</option><option value="last">Last name</option></select></label></div></div>';
    const treeNameOption = function (basis, symbol, label, detail) {
      return '<button type="button" class="tree-name-option" data-tree-name-basis="' + basis + '" aria-pressed="' + String(state().ui.treeNameBasis === basis) + '"><span class="tree-name-option-icon" data-symbol="' + symbol + '" aria-hidden="true"></span><span>' + label + (detail ? '<small class="tree-name-detail">(' + detail + ")</small>" : "") + "</span></button>";
    };
    const treeLengthOption = function (length, symbol, label) {
      return '<button type="button" class="tree-name-option" data-tree-name-length="' + length + '" aria-pressed="' + String(state().ui.treeNameLength === length) + '"><span class="tree-name-option-icon" data-symbol="' + symbol + '" aria-hidden="true"></span><span>' + label + "</span></button>";
    };
    const treeNameControls = '<div class="tree-control-section tree-name-preferences"><span class="tree-control-heading">Name Preferences</span><div class="tree-name-controls" role="group" aria-label="Tree name preferences"><div class="tree-name-setting tree-name-source"><div class="segmented" aria-label="Tree name source">' + treeNameOption("preferred", "preferredName", "Preferred", "Display") + treeNameOption("legal", "legalName", "Legal", "Current") + treeNameOption("lineal", "linealName", "Lineal", "Birth") + '</div></div><div class="tree-name-setting tree-name-length"><div class="segmented" aria-label="Tree name length">' + treeLengthOption("short", "shortName", "Short") + treeLengthOption("full", "fullName", "Full") + "</div></div></div></div>";
    $("#mainContent").innerHTML = '<section class="family-workspace" aria-label="Family workspace"><nav class="mobile-workspace-tabs segmented" aria-label="Workspace views"><button type="button" data-mobile-view="directory" aria-pressed="' + String(state().ui.mobileView === "directory") + '">Directory</button><button type="button" data-mobile-view="tree" aria-pressed="' + String(state().ui.mobileView === "tree") + '">Family Tree</button><button type="button" data-mobile-view="profile" aria-pressed="' + String(state().ui.mobileView === "profile") + '"' + personTabDisabled + '>Person</button></nav><div class="family-workspace-grid" data-mobile-view="' + u.escapeHtml(state().ui.mobileView) + '" data-directory-collapsed="' + String(directoryCollapsed) + '" data-profile-collapsed="' + String(profileCollapsed) + '"><aside id="directoryPanel" class="directory-panel workspace-card' + (directoryCollapsed ? " is-collapsed" : "") + '" aria-label="Family directory">' + directoryHeader + directoryControls + '<div class="directory-body"><div id="directoryList" class="directory-list"></div><nav id="directoryAlphaRail" class="directory-alpha-rail" aria-label="Jump to directory letter"></nav></div></aside><section class="tree-panel workspace-card" aria-label="Family Tree"><header class="tree-toolbar"><div class="tree-view-controls"><div class="segmented" aria-label="Tree mode"><button type="button" data-tree-mode="focus" aria-pressed="' + String(state().ui.treeMode === "focus") + '"' + lineageDisabled + '>Focus</button><button type="button" data-tree-mode="overview" aria-pressed="' + String(state().ui.treeMode === "overview") + '">Overview</button></div><div class="segmented" aria-label="Person card detail"><button type="button" data-tree-node-view="condensed" aria-pressed="' + String(state().ui.treeNodeView === "condensed") + '">Condensed</button><button type="button" data-tree-node-view="detailed" aria-pressed="' + String(state().ui.treeNodeView === "detailed") + '">Detailed</button></div><label class="depth-control"><span>Ancestors</span><input id="ancestorDepth" type="number" min="0" max="' + config.controls.maxTreeDepth + '" step="1" value="' + state().ui.ancestorDepth + '" inputmode="numeric" ' + overviewDisabled + '></label><label class="depth-control"><span>Descendants</span><input id="descendantDepth" type="number" min="0" max="' + config.controls.maxTreeDepth + '" step="1" value="' + state().ui.descendantDepth + '" inputmode="numeric" ' + overviewDisabled + '></label><div class="zoom-controls" role="group" aria-label="Tree zoom controls"><button type="button" class="zoom-action" data-zoom="out" aria-label="Zoom out" title="Zoom out"><span class="zoom-action-icon" data-symbol="zoomOut" aria-hidden="true"></span><span>Out</span></button><label class="zoom-value-control"><span class="visually-hidden">Zoom percentage</span><span class="zoom-value-box"><input id="zoomValue" type="text" pattern="[0-9]{1,3}" maxlength="3" value="100" inputmode="numeric" autocomplete="off"><span class="zoom-percent" aria-hidden="true">%</span><span class="zoom-stepper"><button type="button" data-zoom-step="1" aria-label="Increase zoom by one percent" title="Increase zoom"><span data-symbol="up" aria-hidden="true"></span></button><button type="button" data-zoom-step="-1" aria-label="Decrease zoom by one percent" title="Decrease zoom"><span data-symbol="down" aria-hidden="true"></span></button></span></span></label><button type="button" class="zoom-action" data-zoom="in" aria-label="Zoom in" title="Zoom in"><span class="zoom-action-icon" data-symbol="zoomIn" aria-hidden="true"></span><span>In</span></button><button type="button" class="zoom-action" data-fit-tree aria-label="Fit tree" title="Fit tree"><span class="zoom-action-icon" data-symbol="fit" aria-hidden="true"></span><span>Fit</span></button><span id="zoomStatus" class="visually-hidden" aria-live="polite">100% zoom</span></div></div></header><div class="tree-canvas"><svg id="familyTreeSvg" role="group" aria-label="Interactive Family Tree. Scroll horizontally or vertically, drag to pan, use the zoom controls, and select a person to focus." tabindex="0"></svg></div>' + treeKeyHtml() + '</section><aside id="profilePanel" class="profile-panel workspace-card' + (profileCollapsed ? " is-collapsed" : "") + '" aria-label="Selected person profile"><div id="profilePanelContent" class="profile-panel-content"></div></aside></div></section>';
    $("[data-mobile-view='directory']", $("#mainContent")).textContent = "List";
    $("#directoryPanel").setAttribute("aria-label", "Family list");
    $("#directoryAlphaRail").setAttribute("aria-label", "Jump to list letter");
    const zoomValueLabel = $(".zoom-value-control", $("#mainContent"));
    const zoomValueBox = $(".zoom-value-box", zoomValueLabel);
    const zoomValueControl = document.createElement("div");
    const zoomValueAccessibleLabel = document.createElement("label");
    zoomValueControl.className = "zoom-value-control";
    zoomValueAccessibleLabel.className = "visually-hidden";
    zoomValueAccessibleLabel.htmlFor = "zoomValue";
    zoomValueAccessibleLabel.textContent = "Zoom percentage";
    zoomValueLabel.replaceWith(zoomValueControl);
    zoomValueControl.append(zoomValueAccessibleLabel, zoomValueBox);
    const treeStage = document.createElement("div");
    treeStage.className = "tree-stage";
    const treeCanvas = $(".tree-canvas", $("#mainContent"));
    const treeKey = $(".tree-key", $("#mainContent"));
    treeCanvas.before(treeStage);
    treeStage.append(treeCanvas, treeKey);
    const workspaceGrid = $(".family-workspace-grid", $("#mainContent"));
    workspaceGrid.style.setProperty("--directory-panel-width", state().ui.panelSizingCustomized ? state().ui.directoryPanelWidth + "px" : "20%");
    workspaceGrid.style.setProperty("--profile-panel-width", state().ui.panelSizingCustomized ? state().ui.profilePanelWidth + "px" : "30%");
    const treeControls = $(".tree-view-controls", workspaceGrid);
    const treeModeGroup = $('[aria-label="Tree mode"]', treeControls);
    const cardDetailGroup = $('[aria-label="Person card detail"]', treeControls);
    cardDetailGroup.insertAdjacentHTML("afterend", treeNameControls);
    const wrapTreeControl = function (control, title, className) {
      const group = document.createElement("div");
      const heading = document.createElement("span");
      group.className = "tree-control-section " + className;
      heading.className = "tree-control-heading";
      heading.textContent = title;
      control.insertAdjacentElement("beforebegin", group);
      group.append(heading, control);
      return group;
    };
    const decorateTreeOption = function (button, symbol, label) {
      button.classList.add("tree-option-action");
      button.innerHTML = '<span class="tree-option-icon" data-symbol="' + symbol + '" aria-hidden="true"></span><span>' + label + "</span>";
    };
    const fullTreeButton = $('[data-tree-mode="overview"]', treeModeGroup);
    const lineageButton = $('[data-tree-mode="focus"]', treeModeGroup);
    decorateTreeOption(fullTreeButton, "fullTreeView", "Full Tree");
    decorateTreeOption(lineageButton, "lineageView", "Lineage");
    treeModeGroup.append(fullTreeButton, lineageButton);
    treeModeGroup.classList.add("tree-option-group");
    wrapTreeControl(treeModeGroup, "Tree View", "tree-view-setting");
    const detailsButton = $('[data-tree-node-view="detailed"]', cardDetailGroup);
    const summaryButton = $('[data-tree-node-view="condensed"]', cardDetailGroup);
    decorateTreeOption(detailsButton, "detailsView", "Details");
    decorateTreeOption(summaryButton, "summaryView", "Summary");
    cardDetailGroup.append(detailsButton, summaryButton);
    cardDetailGroup.classList.add("tree-option-group");
    wrapTreeControl(cardDetailGroup, "Card View", "tree-card-setting");
    const ancestorControl = $("#ancestorDepth", treeControls).closest(".depth-control");
    const descendantControl = $("#descendantDepth", treeControls).closest(".depth-control");
    [[ancestorControl, "ancestorsDepth"], [descendantControl, "descendantsDepth"]].forEach(function (entry) {
      const control = entry[0];
      const label = control.querySelector("span");
      const input = control.querySelector("input");
      const icon = document.createElement("span");
      const copy = document.createElement("span");
      icon.className = "depth-control-icon";
      icon.dataset.symbol = entry[1];
      icon.setAttribute("aria-hidden", "true");
      label.className = "depth-control-title";
      copy.className = "depth-control-body";
      copy.append(icon, input);
      control.replaceChildren(label, copy);
    });
    const depthControls = document.createElement("div");
    depthControls.className = "tree-depth-controls";
    depthControls.setAttribute("role", "group");
    depthControls.setAttribute("aria-label", "Visible generations");
    ancestorControl.insertAdjacentElement("beforebegin", depthControls);
    depthControls.append(ancestorControl, descendantControl);
    wrapTreeControl(depthControls, "Levels", "tree-level-setting");
    const zoomControls = $(".zoom-controls", treeControls);
    const unplacedLineageControl = state().ui.treeMode === "overview" ? '<button type="button" class="tree-line-toggle action-button" data-toggle-unplaced-lineage aria-pressed="' + String(!state().ui.hideUnplacedLineage) + '" title="Toggle unresolved Lineal people"><span class="tree-toggle-symbol" data-symbol="unknownLineal" aria-hidden="true"></span><span class="button-label">?? Lineal</span></button>' : "";
    zoomControls.insertAdjacentHTML("beforebegin", '<button type="button" class="tree-line-toggle tree-line-toggle-stacked action-button" data-toggle-non-lineal aria-pressed="' + String(state().ui.showInferredParentLines) + '" title="Toggle Non-Lineal parent lines"><span class="tree-toggle-symbol" data-symbol="nonLinealLinesFill" aria-hidden="true"></span><span class="button-label">Non-Lineal<br>Lines</span></button>' + unplacedLineageControl);
    wrapTreeControl(zoomControls, "Zoom", "tree-zoom-setting");
    $("#directoryPanel", workspaceGrid).insertAdjacentHTML("afterend", '<button id="directoryTreeDivider" class="family-resize-handle" type="button" role="separator" aria-orientation="vertical" aria-label="Resize list and Family Tree" aria-valuemin="220" aria-valuemax="480" aria-valuenow="' + state().ui.directoryPanelWidth + '"' + (directoryCollapsed ? " hidden" : "") + '><span aria-hidden="true"></span><output class="family-divider-percentage" aria-hidden="true"></output></button>');
    $(".tree-panel", workspaceGrid).insertAdjacentHTML("afterend", '<button id="treeProfileDivider" class="family-resize-handle" type="button" role="separator" aria-orientation="vertical" aria-label="Resize Family Tree and selected person" aria-valuemin="240" aria-valuemax="600" aria-valuenow="' + state().ui.profilePanelWidth + '"' + (profileCollapsed ? " hidden" : "") + '><span aria-hidden="true"></span><output class="family-divider-percentage" aria-hidden="true"></output></button>');
    $("#directorySort").value = state().ui.directorySort;
    renderDirectoryList();
    renderProfile();
    renderTree();
    bindFamilyResize();
    icons.mount($("#mainContent"));
  }

  function renderMain() {
    if (initialized()) renderWorkspace();
    else renderOnboarding();
  }

  function selectPerson(id, options) {
    if (!state().workspace.people.some(function (person) { return person.id === id; })) return;
    const settings = Object.assign({ focus: true, mobileProfile: false, focusMode: false }, options || {});
    storage.mutate(function (next) {
      next.ui.selectedPersonId = id;
      next.ui.profileCollapsed = false;
      if (settings.focus) next.ui.treeFocusId = id;
      if (settings.focusMode) next.ui.treeMode = "focus";
      if (settings.mobileProfile) next.ui.mobileView = "profile";
    }, { touch: false, reason: "select-person" });
    treeNeedsFit = settings.focus;
    renderWorkspace();
    announce("Selected " + model.displayName(state().workspace.people.find(function (person) { return person.id === id; })) + ".");
  }

  function addressDateValue(address, kind) {
    const normalized = String(address && address[kind + "Date"] && address[kind + "Date"].value || "");
    if (normalized) return normalized;
    return String(address && address.source && address.source.fields && address.source.fields["date-" + kind + "-value"] || "");
  }

  function addressDateLabel(address, kind) {
    return model.formatFlexibleDate(address && address[kind + "Date"]) || partialDateLabel(addressDateValue(address, kind));
  }

  function addressRow(address, index) {
    return '<fieldset class="repeatable-card" data-address-index="' + index + '"><legend>Address ' + (index + 1) + '</legend><div class="repeatable-card-actions"><button type="button" class="button small danger-text" data-remove-address="' + index + '">Remove</button></div><div class="address-editor-grid"><label class="field"><span>Label</span><input data-address-field="label" value="' + u.escapeHtml(address.label || "Home") + '"></label><label class="field"><span>Address line 1</span><input data-address-field="line1" value="' + u.escapeHtml(address.line1 || "") + '"></label><label class="field"><span>Address line 2</span><input data-address-field="line2" value="' + u.escapeHtml(address.line2 || "") + '"></label><label class="field"><span>City / locality</span><input data-address-field="city" value="' + u.escapeHtml(address.city || "") + '"></label><label class="field"><span>State / region</span><input data-address-field="region" value="' + u.escapeHtml(address.region || "") + '"></label><label class="field"><span>Postal code</span><input data-address-field="postalCode" value="' + u.escapeHtml(address.postalCode || "") + '"></label><label class="field"><span>Country</span><input data-address-field="country" value="' + u.escapeHtml(address.country || "") + '"></label><label class="field address-phone-field"><span>Phone</span><input type="tel" inputmode="numeric" autocomplete="tel" maxlength="12" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" data-phone-input data-address-field="phone" value="' + u.escapeHtml(u.formatPhoneNumber(address.phone || "")) + '"></label><label class="check-field address-current-field"><input type="checkbox" data-address-field="current" ' + (address.current !== false ? "checked" : "") + '><span>Current<br>address</span></label><label class="field address-start-field date-input-field"><span>Start date</span><input data-address-field="startDate" data-date-input placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" inputmode="text" maxlength="10" autocomplete="off" spellcheck="false" aria-describedby="addressStartDateError' + index + '" value="' + u.escapeHtml(addressDateValue(address, "start")) + '"><small id="addressStartDateError' + index + '" class="date-validation-message" data-date-error hidden>' + DATE_INPUT_HELP + '</small></label><label class="field address-end-field date-input-field"><span>End date</span><input data-address-field="endDate" data-date-input placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" inputmode="text" maxlength="10" autocomplete="off" spellcheck="false" aria-describedby="addressEndDateError' + index + '" value="' + u.escapeHtml(addressDateValue(address, "end")) + '"><small id="addressEndDateError' + index + '" class="date-validation-message" data-date-error hidden>' + DATE_INPUT_HELP + '</small></label><label class="field address-notes-field"><span>Address notes</span><textarea data-address-field="notes" rows="1">' + u.escapeHtml(address.notes || "") + '</textarea></label></div><small class="address-validation-message" data-address-error hidden>Add at least one physical address field, or remove this address.</small></fieldset>';
  }

  function contactRow(item, index, type) {
    const inputType = type === "email" ? "email" : "tel";
    const phoneAttributes = type === "phone" ? ' inputmode="numeric" autocomplete="tel" maxlength="12" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" data-phone-input' : "";
    const value = type === "phone" ? u.formatPhoneNumber(item.value || "") : item.value || "";
    return '<div class="repeatable-contact" data-contact-index="' + index + '" data-contact-type="' + type + '"><label class="field"><span>Label</span><input data-contact-field="label" value="' + u.escapeHtml(item.label || (type === "phone" ? "Mobile" : "Personal")) + '"></label><label class="field grow-control"><span>' + (type === "phone" ? "Number" : "Address") + '</span><input type="' + inputType + '"' + phoneAttributes + ' data-contact-field="value" value="' + u.escapeHtml(value) + '"></label><button type="button" class="button small danger-text" data-remove-contact="' + type + ':' + index + '">Remove</button></div>';
  }

  function renderPersonRepeatables() {
    $("#addressEditor").innerHTML = personDraft.addresses.length ? personDraft.addresses.map(addressRow).join("") : '<p class="muted-copy">No addresses recorded.</p>';
    $("#phoneEditor").innerHTML = personDraft.phones.length ? personDraft.phones.map(function (item, index) { return contactRow(item, index, "phone"); }).join("") : '<p class="muted-copy">No phone numbers recorded.</p>';
    $("#emailEditor").innerHTML = personDraft.emails.length ? personDraft.emails.map(function (item, index) { return contactRow(item, index, "email"); }).join("") : '<p class="muted-copy">No email addresses recorded.</p>';
  }

  function selectedNewPersonRelationshipIds(kind) {
    return $$('[data-new-person-relationship="' + kind + '"]:checked', $("#personRelationshipsSection")).map(function (input) { return input.value; });
  }

  function newPartnerStatusDetails(status) {
    return {
      partnered: { type: "partnership", endReason: "" },
      married: { type: "marriage", endReason: "" },
      separated: { type: "marriage", endReason: "separation" },
      divorced: { type: "marriage", endReason: "divorce" },
      widowed: { type: "marriage", endReason: "death" },
      annulled: { type: "marriage", endReason: "annulment" },
      former: { type: "UNKNOWN", endReason: "UNKNOWN" },
      unknown: { type: "UNKNOWN", endReason: "" }
    }[status] || { type: "UNKNOWN", endReason: "" };
  }

  function selectedNewPartnerDetails(personId) {
    const checkbox = $$('[data-new-person-relationship="partners"]', $("#personRelationshipsSection")).find(function (input) { return input.value === personId; });
    const row = checkbox && checkbox.closest("[data-new-person-relationship-row]");
    return {
      status: row && $("[data-new-partner-status]", row)?.value || "unknown",
      startDate: row && $("[data-new-partner-start-date]", row)?.value.trim() || "",
      endDate: row && $("[data-new-partner-end-date]", row)?.value.trim() || ""
    };
  }

  function validateNewPartnerRow(row) {
    const checkbox = $('[data-new-person-relationship="partners"]', row);
    const details = $("[data-new-partner-details]", row);
    const status = $("[data-new-partner-status]", row);
    const start = $("[data-new-partner-start-date]", row);
    const end = $("[data-new-partner-end-date]", row);
    const message = $("[data-new-partner-validation]", row);
    const selected = Boolean(checkbox && checkbox.checked);
    if (details) details.hidden = !selected;
    if (!selected) {
      [status, start, end].filter(Boolean).forEach(function (input) { input.setAttribute("aria-invalid", "false"); });
      $$('[data-date-error]', details).forEach(function (dateError) { dateError.hidden = true; });
      if (message) message.hidden = true;
      return true;
    }
    const startValid = validateDateInputControl(start);
    const endValid = validateDateInputControl(end);
    const endedStatus = ["separated", "divorced", "widowed", "annulled", "former"].includes(status && status.value);
    const statusValid = !String(end && end.value || "").trim() || endedStatus;
    if (start) start.setAttribute("aria-invalid", String(!startValid));
    if (end) end.setAttribute("aria-invalid", String(!endValid));
    if (status) status.setAttribute("aria-invalid", String(!statusValid));
    if (message) {
      message.textContent = !statusValid ? "Choose an ended status when an end date is entered." : "";
      message.hidden = startValid && endValid && statusValid;
    }
    return startValid && endValid && statusValid;
  }

  function validateNewPartnerRows() {
    return $$('[data-new-person-relationship-row="partners"]', $("#personRelationshipsSection")).map(validateNewPartnerRow).every(Boolean);
  }

  function filterNewPersonRelationshipPicker(input) {
    const picker = input.closest("[data-new-person-relationship-picker]");
    const needle = u.cleanLine(input.value, 120).toLocaleLowerCase();
    let visible = 0;
    $$('[data-new-person-relationship-row]', picker).forEach(function (row) {
      const name = $(".relationship-picker-choice span", row)?.textContent.toLocaleLowerCase() || "";
      row.hidden = Boolean(needle && !name.includes(needle));
      if (!row.hidden) visible += 1;
    });
    const empty = $("[data-relationship-search-empty]", picker);
    if (empty) empty.hidden = visible > 0;
  }

  function updateNewPersonRelationshipCounts() {
    $$('[data-new-person-relationship-picker]', $("#personRelationshipsSection")).forEach(function (picker) {
      const selected = selectedNewPersonRelationshipIds(picker.dataset.newPersonRelationshipPicker);
      const count = $("[data-relationship-selection-count]", picker);
      if (count) count.textContent = selected.length ? selected.length + " selected" : "None";
    });
    validateNewPartnerRows();
    updatePersonLineagePreview();
  }

  function renderNewPersonRelationshipPickers(person) {
    const section = $("#personRelationshipsSection");
    const hidden = Boolean(person || pendingRelative);
    section.hidden = hidden;
    const people = hidden ? [] : state().workspace.people.slice().sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)); });
    ["parents", "partners", "children"].forEach(function (kind) {
      const container = $("#newPerson" + kind[0].toUpperCase() + kind.slice(1));
      const partnerStatusOptions = config.partnerStatuses.map(function (item) {
        const label = item.id === "partnered" ? "Unmarried partners" : item.id === "unknown" ? "Unknown" : item.label;
        return '<option value="' + u.escapeHtml(item.id) + '" ' + (item.id === "unknown" ? "selected" : "") + '>' + u.escapeHtml(label) + "</option>";
      }).join("");
      container.innerHTML = people.length ? people.map(function (candidate, index) {
        const id = "new-person-" + kind + "-" + index;
        const label = model.displayName(candidate) + (developerReferencesEnabled() ? " · " + candidate.reference : "");
        const partnerDetails = kind === "partners" ? '<div class="new-partner-details" data-new-partner-details="' + u.escapeHtml(candidate.id) + '" hidden><label class="field"><span>Status</span><select data-new-partner-status>' + partnerStatusOptions + '</select></label><label class="field date-input-field"><span>Start date</span><input data-new-partner-start-date data-date-input placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" inputmode="text" maxlength="10" autocomplete="off" spellcheck="false" aria-describedby="newPartnerStartDateError' + index + '"><small id="newPartnerStartDateError' + index + '" class="date-validation-message" data-date-error hidden>' + DATE_INPUT_HELP + '</small></label><label class="field date-input-field"><span>End date</span><input data-new-partner-end-date data-date-input placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" inputmode="text" maxlength="10" autocomplete="off" spellcheck="false" aria-describedby="newPartnerEndDateError' + index + '"><small id="newPartnerEndDateError' + index + '" class="date-validation-message" data-date-error hidden>' + DATE_INPUT_HELP + '</small></label><p class="new-partner-validation" data-new-partner-validation role="alert" hidden></p></div>' : "";
        return '<div class="relationship-picker-option" data-new-person-relationship-row="' + kind + '"><label class="relationship-picker-choice" for="' + id + '"><input id="' + id + '" type="checkbox" value="' + u.escapeHtml(candidate.id) + '" data-new-person-relationship="' + kind + '"><span>' + u.escapeHtml(label) + "</span></label>" + partnerDetails + "</div>";
      }).join("") : '<p class="relationship-picker-empty">No existing people available.</p>';
    });
    $$('[data-new-person-relationship-picker]', section).forEach(function (picker) { picker.open = false; });
    updateNewPersonRelationshipCounts();
  }

  function addressEditorRowValid(row) {
    return ["line1", "line2", "city", "region", "postalCode", "country"].some(function (field) {
      return Boolean(String(row.querySelector('[data-address-field="' + field + '"]')?.value || "").trim());
    });
  }

  function formatPhoneInput(input) {
    if (!input) return;
    const before = input.value;
    const selection = Number.isInteger(input.selectionStart) ? input.selectionStart : before.length;
    const digitOffset = before.slice(0, selection).replace(/\D/g, "").length;
    const formatted = u.formatPhoneNumber(before, { partial: true });
    input.value = formatted;
    if (typeof input.setSelectionRange !== "function") return;
    let digitsSeen = 0;
    let caret = formatted.length;
    if (digitOffset === 0) caret = 0;
    else {
      for (let index = 0; index < formatted.length; index += 1) {
        if (/\d/.test(formatted[index])) digitsSeen += 1;
        if (digitsSeen >= Math.min(digitOffset, 10)) { caret = index + 1; break; }
      }
    }
    input.setSelectionRange(caret, caret);
  }

  function updatePersonFormValidity() {
    const firstNamePresent = ["birthNameFirst", "currentNameFirst", "preferredNameFirst"].some(function (id) { return Boolean($("#" + id).value.trim()); });
    const datesValid = $$('[data-date-input]', $("#personDialog")).filter(function (input) {
      const partnerDetails = input.closest("[data-new-partner-details]");
      return !partnerDetails || !partnerDetails.hidden;
    }).map(validateDateInputControl).every(Boolean);
    const emailsValid = $$('input[type="email"]', $("#personDialog")).every(function (input) { return input.checkValidity(); });
    const phonesValid = $$('[data-phone-input]', $("#personDialog")).every(function (input) { return input.checkValidity(); });
    const addressesValid = $$('[data-address-index]', $("#addressEditor")).map(function (row) {
      const valid = addressEditorRowValid(row);
      row.classList.toggle("is-invalid", !valid);
      const message = $("[data-address-error]", row);
      if (message) message.hidden = valid;
      return valid;
    }).every(Boolean);
    const partnerRelationshipsValid = validateNewPartnerRows();
    const valid = firstNamePresent && datesValid && emailsValid && phonesValid && addressesValid && partnerRelationshipsValid;
    $("#savePersonButton").disabled = !valid;
    return valid;
  }

  function syncPersonRepeatables() {
    personDraft.addresses = $$("[data-address-index]", $("#addressEditor")).map(function (row, index) {
      const value = function (name) { return row.querySelector('[data-address-field="' + name + '"]')?.value || ""; };
      const previous = personDraft.addresses[index] || {};
      const startValue = value("startDate").trim();
      const endValue = value("endDate").trim();
      const source = u.clone(previous.source || { format: "mcresidences-v1", fields: {} });
      source.format = source.format || "mcresidences-v1";
      source.fields = Object.assign({}, u.plainObject(source.fields), {
        "date-start-value": startValue,
        "date-start-descriptor": automaticDateDescriptor(startValue, "optional", ""),
        "date-end-value": endValue,
        "date-end-descriptor": automaticDateDescriptor(endValue, "optional", "")
      });
      return {
        id: previous.id || u.uid("address"), placeId: previous.placeId || "", residenceId: previous.residenceId || "",
        label: value("label"), current: row.querySelector('[data-address-field="current"]')?.checked !== false,
        line1: value("line1"), line2: value("line2"), city: value("city"), region: value("region"), postalCode: value("postalCode"), country: value("country"), phone: u.formatPhoneNumber(value("phone")),
        startDate: normalizedPersonDate(startValue, source.fields["date-start-descriptor"]), endDate: normalizedPersonDate(endValue, source.fields["date-end-descriptor"]), notes: value("notes"), source: source,
        placeSource: u.clone(previous.placeSource || { format: "mcplaces-v2", fields: {} }), order: index
      };
    });
    ["phone", "email"].forEach(function (type) {
      personDraft[type + "s"] = $$('.repeatable-contact[data-contact-type="' + type + '"]', $("#" + type + "Editor")).map(function (row, index) {
        const value = row.querySelector('[data-contact-field="value"]').value;
        return { id: personDraft[type + "s"][index] && personDraft[type + "s"][index].id || u.uid(type), label: row.querySelector('[data-contact-field="label"]').value, value: type === "phone" ? u.formatPhoneNumber(value) : value, order: index };
      });
    });
  }

  function nextNumericRecordId(prefix, records, minimumDigits) {
    const expression = new RegExp("^" + prefix + "(\\d+)$", "i");
    const highest = records.reduce(function (maximum, record) {
      const match = String(record.id || "").match(expression);
      return match ? Math.max(maximum, Number(match[1])) : maximum;
    }, 0);
    return prefix + String(highest + 1).padStart(minimumDigits, "0");
  }

  function referencedPlaceIds(sourceState) {
    const ids = new Set(sourceState.workspace.residences.map(function (residence) { return residence.placeId; }));
    sourceState.workspace.relationships.forEach(function (relationship) {
      const placeId = u.cleanLine(relationship.source && relationship.source.fields && relationship.source.fields["place-id"], 100);
      if (placeId) ids.add(placeId);
    });
    return ids;
  }

  function removeUnreferencedPlaces(sourceState) {
    const referenced = referencedPlaceIds(sourceState);
    sourceState.workspace.places = sourceState.workspace.places.filter(function (place) { return referenced.has(place.id); });
  }

  function syncPersonAddressRecords(sourceState, person) {
    const previousResidences = sourceState.workspace.residences.filter(function (residence) { return residence.personId === person.id; });
    const previousById = new Map(previousResidences.map(function (residence) { return [residence.id, residence]; }));
    sourceState.workspace.residences = sourceState.workspace.residences.filter(function (residence) { return residence.personId !== person.id; });
    person.addresses.forEach(function (address, index) {
      let residenceId = /^RS\d{4,}$/i.test(address.residenceId || address.id || "") ? (address.residenceId || address.id).toUpperCase() : "";
      if (!residenceId || sourceState.workspace.residences.some(function (residence) { return residence.id === residenceId; })) residenceId = nextNumericRecordId("RS", sourceState.workspace.residences.concat(previousResidences), 4);
      const previousResidence = previousById.get(residenceId);
      let placeId = /^L\d{4,}$/i.test(address.placeId || "") ? address.placeId.toUpperCase() : previousResidence && previousResidence.placeId || "";
      if (!placeId || !sourceState.workspace.places.some(function (place) { return place.id === placeId; })) placeId = nextNumericRecordId("L", sourceState.workspace.places, 4);
      let place = sourceState.workspace.places.find(function (item) { return item.id === placeId; });
      if (!place) {
        place = { id: placeId, source: { format: "mcplaces-v2", fields: {} }, order: sourceState.workspace.places.length };
        sourceState.workspace.places.push(place);
      }
      if (address.placeSource && Object.keys(u.plainObject(address.placeSource.fields)).length) place.source = u.clone(address.placeSource);
      Object.assign(place, {
        label: address.label || "Home", line1: address.line1 || "", line2: address.line2 || "", city: address.city || "",
        region: address.region || "", postalCode: address.postalCode || "", country: address.country || "", phone: address.phone || "", notes: ""
      });
      const residence = {
        id: residenceId, personId: person.id, placeId: placeId, label: address.label || "Home", current: address.current !== false,
        startDate: address.startDate, endDate: address.endDate, notes: address.notes || "", source: u.clone(address.source || previousResidence && previousResidence.source || { format: "mcresidences-v1", fields: {} }), order: index
      };
      sourceState.workspace.residences.push(residence);
      Object.assign(address, { id: residenceId, residenceId: residenceId, placeId: placeId });
    });
    removeUnreferencedPlaces(sourceState);
  }

  function targetNameInputId(group, part) {
    return group + "Name" + part;
  }

  function syncBirthNamePart(part) {
    const source = $("#birthName" + part);
    ["current", "preferred"].forEach(function (group) {
      const targetId = targetNameInputId(group, part);
      if (!personNameOverrides.has(targetId)) $("#" + targetId).value = source.value;
    });
    if (part === "Last") $("#maidenLastName").value = source.value;
  }

  function syncCurrentNamePart(part) {
    const targetId = targetNameInputId("preferred", part);
    $("#" + targetId).value = $("#currentName" + part).value;
    personNameOverrides.add(targetId);
  }

  function selectedNewPersonParentIds() {
    const ids = selectedNewPersonRelationshipIds("parents");
    if (pendingRelative && pendingRelative.role === "child") ids.push(pendingRelative.sourceId);
    return Array.from(new Set(ids));
  }

  function automaticLinealParentId() {
    return selectedNewPersonParentIds().find(function (id) {
      const parent = state().workspace.people.find(function (person) { return person.id === id; });
      return Boolean(sourceField(parent, "lineage-id"));
    }) || "";
  }

  function updatePersonLineagePreview() {
    const output = $("#personLineagePreview");
    if (!output) return "";
    const existingId = $("#personId").value;
    const existing = existingId && state().workspace.people.find(function (person) { return person.id === existingId; });
    if (existing) {
      const saved = storedLineageValue(existing);
      output.classList.remove("danger-text");
      output.innerHTML = saved ? lineageIdHtml(saved.split(".").map(displayLineageSegment)) : "None";
      return saved;
    }
    const parentId = automaticLinealParentId();
    if (!parentId) {
      output.classList.remove("danger-text");
      output.textContent = "None";
      return "";
    }
    const previewState = u.clone(state());
    const personId = nextNumericRecordId("P", previewState.workspace.people, 3);
    previewState.workspace.people.push({ id: personId, source: { format: "mcpeople-v1", fields: {} }, updatedAt: u.isoNow() });
    const relationship = { id: "new-person-lineage-preview", type: "parent-child", parentId: parentId, childId: personId, lineage: "lineal", kind: "unknown" };
    previewState.workspace.relationships.push(relationship);
    try {
      const value = assignLineageForRelationship(previewState, relationship);
      output.classList.remove("danger-text");
      output.innerHTML = lineageIdHtml(value.split(".").map(displayLineageSegment));
      return value;
    } catch (error) {
      output.classList.add("danger-text");
      output.textContent = error.message;
      return "";
    }
  }

  function validateDateSegment(segment, minimum, maximum) {
    if (!segment || !/^[\d?]+$/.test(segment)) return false;
    const unknowns = (segment.match(/\?/g) || []).length;
    const combinations = Math.pow(10, unknowns);
    for (let index = 0; index < combinations; index += 1) {
      let replacement = String(index).padStart(unknowns, "0");
      const value = Number(segment.replace(/\?/g, function () { const digit = replacement[0]; replacement = replacement.slice(1); return digit; }));
      if (value >= minimum && value <= maximum) return true;
    }
    return false;
  }

  function validDateInput(value) {
    const clean = String(value || "").trim();
    if (!clean) return true;
    const match = /^([\d?]{4})(?:-([\d?]{2})(?:-([\d?]{2}))?)?$/.exec(clean);
    if (!match) return false;
    if (match[2] && !validateDateSegment(match[2], 1, 12)) return false;
    if (match[3] && !validateDateSegment(match[3], 1, 31)) return false;
    if (match[2] && match[3] && !match[2].includes("?")) {
      const year = match[1].includes("?") ? 2000 : Number(match[1]);
      const maximumDay = new Date(Date.UTC(year, Number(match[2]), 0)).getUTCDate();
      if (!validateDateSegment(match[3], 1, maximumDay)) return false;
    }
    return true;
  }

  function validateDateInputControl(input) {
    if (!input) return true;
    const valid = validDateInput(input.value);
    input.setAttribute("aria-invalid", String(!valid));
    const message = input.closest("label") && $("[data-date-error]", input.closest("label"));
    if (message) message.hidden = valid;
    return valid;
  }

  function automaticDateDescriptor(value, kind, livingStatus) {
    if (value.includes("?")) return "partial";
    if (value.length === 4) return "year";
    if (value.length === 7) return "month";
    if (value.length === 10) return "day";
    if (kind === "birth") return "UNKNOWN";
    if (kind === "death") return livingStatus === "living" ? "NONE" : "UNKNOWN";
    return "";
  }

  function normalizedPersonDate(value, descriptor) {
    if (descriptor === "partial") return { value: "", qualifier: "about" };
    if (["UNKNOWN", "UNKNOWN PRESUMED"].includes(descriptor)) return { value: "", qualifier: "about" };
    return { value: value, qualifier: "exact" };
  }

  function fillPersonForm(person) {
    const birthName = model.nameParts(person, "birth");
    const currentName = model.nameParts(person, "current");
    const preferredName = model.nameParts(person, "preferred");
    const values = {
      personId: person && person.id,
      birthNamePrefix: birthName.prefix, birthNameFirst: birthName.first, birthNameMiddle: birthName.middle, birthNameLast: birthName.last, birthNameSuffix: birthName.suffix,
      currentNamePrefix: currentName.prefix, currentNameFirst: currentName.first, currentNameMiddle: currentName.middle, currentNameLast: currentName.last, currentNameSuffix: currentName.suffix,
      preferredNamePrefix: preferredName.prefix, preferredNameFirst: preferredName.first, preferredNameMiddle: preferredName.middle, preferredNameLast: preferredName.last, preferredNameSuffix: preferredName.suffix,
      maidenLastName: person && person.names.maidenLast,
      livingStatus: person && person.livingStatus || "living",
      birthDate: person && lifeDateValue(person, "birth"),
      deathDate: person && lifeDateValue(person, "death"),
      personNotes: person && person.notes
    };
    Object.keys(values).forEach(function (id) { const input = $("#" + id); if (input) input.value = values[id] || ""; });
    personNameOverrides = new Set(person ? ["current", "preferred"].flatMap(function (group) { return NAME_PARTS.map(function (part) { return targetNameInputId(group, part); }); }) : []);
    personDraft = {
      addresses: u.clone(person && person.addresses || []),
      phones: u.clone(person && person.phones || []),
      emails: u.clone(person && person.emails || [])
    };
    renderPersonRepeatables();
    renderNewPersonRelationshipPickers(person);
    $$('[data-date-input]', $("#personDialog")).forEach(function (input) { input.setAttribute("aria-invalid", "false"); });
    $$('[data-date-error]', $("#personDialog")).forEach(function (message) { message.hidden = true; });
    $("#personFormError").hidden = true;
    updatePersonFormValidity();
  }

  function openPersonEditor(id, trigger) {
    if (!familyEditingEnabled()) return;
    const person = id ? state().workspace.people.find(function (item) { return item.id === id; }) : null;
    $("#personDialogTitle").textContent = person ? "Edit " + model.displayName(person) : pendingRelative ? "Add " + pendingRelative.role : "Add Person";
    fillPersonForm(person);
    components.openDialog("#personDialog", { trigger: trigger, focus: "#birthNameFirst" });
  }

  function showPersonError(message) {
    const error = $("#personFormError");
    error.textContent = message;
    error.hidden = false;
    error.scrollIntoView({ block: "nearest" });
  }

  function collectPersonForm(existing) {
    syncPersonRepeatables();
    const now = u.isoNow();
    const birthValue = $("#birthDate").value.trim();
    const deathValue = $("#deathDate").value.trim();
    const livingStatus = deathValue ? "deceased" : $("#livingStatus").value;
    const birthDescriptor = automaticDateDescriptor(birthValue, "birth", livingStatus);
    const deathDescriptor = automaticDateDescriptor(deathValue, "death", livingStatus);
    const source = existing ? u.clone(existing.source) : { format: "mcpeople-v1", fields: {} };
    source.format = source.format || "mcpeople-v1";
    source.fields = Object.assign({}, u.plainObject(source.fields), {
      "person-date-birth-value": birthValue,
      "person-date-birth-descriptor": birthDescriptor,
      "person-date-death-value": deathValue,
      "person-date-death-descriptor": deathDescriptor
    });
    return {
      id: existing ? existing.id : nextNumericRecordId("P", state().workspace.people, 3),
      names: {
        birth: { prefix: $("#birthNamePrefix").value, first: $("#birthNameFirst").value, middle: $("#birthNameMiddle").value, last: $("#birthNameLast").value, suffix: $("#birthNameSuffix").value },
        current: { prefix: $("#currentNamePrefix").value, first: $("#currentNameFirst").value, middle: $("#currentNameMiddle").value, last: $("#currentNameLast").value, suffix: $("#currentNameSuffix").value },
        preferred: { prefix: $("#preferredNamePrefix").value, first: $("#preferredNameFirst").value, middle: $("#preferredNameMiddle").value, last: $("#preferredNameLast").value, suffix: $("#preferredNameSuffix").value },
        maidenLast: $("#maidenLastName").value
      },
      livingStatus: livingStatus,
      gender: existing ? existing.gender : "",
      pronouns: existing ? existing.pronouns : "",
      birth: { date: normalizedPersonDate(birthValue, birthDescriptor), place: existing ? existing.birth.place : "" },
      death: { date: normalizedPersonDate(deathValue, deathDescriptor), place: existing ? existing.death.place : "" },
      addresses: personDraft.addresses,
      phones: personDraft.phones,
      emails: personDraft.emails,
      heritageNote: existing ? existing.heritageNote : "",
      notes: $("#personNotes").value,
      source: source,
      order: existing ? existing.order : state().workspace.people.length,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
  }

  function newPersonRelationshipDrafts(person) {
    if (!person || ($("#personRelationshipsSection").hidden && !pendingRelative)) return [];
    const choices = [];
    selectedNewPersonRelationshipIds("parents").forEach(function (id) { choices.push({ kind: "parent", id: id }); });
    selectedNewPersonRelationshipIds("partners").forEach(function (id) { choices.push({ kind: "partner", id: id, details: selectedNewPartnerDetails(id) }); });
    selectedNewPersonRelationshipIds("children").forEach(function (id) { choices.push({ kind: "child", id: id }); });
    if (pendingRelative) {
      choices.push({ kind: pendingRelative.role === "parent" ? "child" : pendingRelative.role === "child" ? "parent" : "partner", id: pendingRelative.sourceId });
    }
    const linealParentId = automaticLinealParentId();
    const seen = new Set();
    const now = u.isoNow();
    return choices.map(function (choice) {
      const parentId = choice.kind === "parent" ? choice.id : person.id;
      const childId = choice.kind === "child" ? choice.id : person.id;
      const pair = [person.id, choice.id].sort();
      const key = choice.kind === "partner" ? "partner|" + pair.join("|") : "parent-child|" + parentId + "|" + childId;
      if (seen.has(key)) return null;
      seen.add(key);
      const relationship = {
        id: u.uid("relationship"), type: choice.kind === "partner" ? "partner" : "parent-child",
        startDate: { value: "", qualifier: "exact" }, endDate: { value: "", qualifier: "exact" }, place: "", notes: "",
        source: { format: "mcrelations-v2", fields: {} }, order: state().workspace.relationships.length + seen.size, createdAt: now, updatedAt: now
      };
      if (choice.kind === "partner") {
        const details = choice.details || { status: "unknown", startDate: "", endDate: "" };
        const sourceDetails = newPartnerStatusDetails(details.status);
        relationship.startDate = normalizedPersonDate(details.startDate, automaticDateDescriptor(details.startDate, "optional", ""));
        relationship.endDate = normalizedPersonDate(details.endDate, automaticDateDescriptor(details.endDate, "optional", ""));
        relationship.source.fields = {
          "partner-type": sourceDetails.type,
          "end-reason": sourceDetails.endReason,
          "date-start-value": details.startDate,
          "date-start-descriptor": automaticDateDescriptor(details.startDate, "optional", ""),
          "date-end-value": details.endDate,
          "date-end-descriptor": automaticDateDescriptor(details.endDate, "optional", "")
        };
        Object.assign(relationship, { person1Id: person.id, person2Id: choice.id, status: details.status });
      }
      else Object.assign(relationship, { parentId: parentId, childId: childId, lineage: choice.kind === "parent" && choice.id === linealParentId ? "lineal" : "non-lineal", kind: "unknown" });
      return relationship;
    }).filter(Boolean);
  }

  function savePerson(event) {
    event.preventDefault();
    if (!familyEditingEnabled()) return;
    const id = $("#personId").value;
    const existing = id ? state().workspace.people.find(function (person) { return person.id === id; }) : null;
    const firstNamePresent = ["birthNameFirst", "currentNameFirst", "preferredNameFirst"].some(function (idValue) { return $("#" + idValue).value.trim(); });
    if (!firstNamePresent) return showPersonError("Enter at least one First name in Birth, Current, or Preferred.");
    syncPersonRepeatables();
    const dateInputs = $$('[data-date-input]', $("#personDialog")).filter(function (input) {
      const partnerDetails = input.closest("[data-new-partner-details]");
      return !partnerDetails || !partnerDetails.hidden;
    });
    if (!dateInputs.map(validateDateInputControl).every(Boolean)) return showPersonError("Correct every date marked in red. The examples below each date show every accepted format.");
    if (!validateNewPartnerRows()) return showPersonError("Correct the selected partner status or dates marked in red.");
    if (!$$('input[type="email"]', $("#personDialog")).every(function (input) { return input.checkValidity(); })) return showPersonError("Correct the email address marked as invalid.");
    if (personDraft.addresses.some(function (address) { return ![address.line1, address.line2, address.city, address.region, address.postalCode, address.country].some(function (value) { return Boolean(String(value || "").trim()); }); })) return showPersonError("Every address needs at least one physical address field, or remove the empty address.");
    const person = collectPersonForm(existing);
    const relationshipDrafts = existing ? [] : newPersonRelationshipDrafts(person);
    if (relationshipDrafts.length) {
      const validationState = u.clone(state());
      validationState.workspace.people.push(person);
      for (const relationship of relationshipDrafts) {
        const relationshipError = family.validateRelationshipDraft(relationship, validationState);
        if (relationshipError) return showPersonError("The selected relationships cannot be added: " + relationshipError);
        validationState.workspace.relationships.push(relationship);
        if (relationship.lineage === "lineal") {
          try { assignLineageForRelationship(validationState, relationship); }
          catch (lineageError) { return showPersonError("The Lineage ID could not be calculated: " + lineageError.message); }
        }
      }
    }
    storage.mutate(function (next) {
      if (existing) next.workspace.people[next.workspace.people.findIndex(function (item) { return item.id === existing.id; })] = person;
      else next.workspace.people.push(person);
      syncPersonAddressRecords(next, person);
      if (!next.workspace.family.homePersonId) next.workspace.family.homePersonId = person.id;
      next.ui.selectedPersonId = person.id;
      next.ui.treeFocusId = person.id;
      relationshipDrafts.forEach(function (relationship) { next.workspace.relationships.push(relationship); });
      relationshipDrafts.filter(function (relationship) { return relationship.lineage === "lineal"; }).forEach(function (relationship) { assignLineageForRelationship(next, relationship); });
    }, { reason: existing ? "edit-person" : "add-person" });
    const message = existing ? "Updated " + model.displayName(person) + "." : "Added " + model.displayName(person) + ".";
    pendingRelative = null;
    treeNeedsFit = true;
    components.closeDialog("#personDialog", "saved");
    renderAll();
    components.toast(message + (relationshipDrafts.length ? " Added " + relationshipDrafts.length + " relationship" + (relationshipDrafts.length === 1 ? "." : "s.") : ""), { title: existing ? "Person updated" : "Person added", kind: "success" });
  }

  function personOptions(selectedId) {
    return state().workspace.people.slice().sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)); }).map(function (person) { return '<option value="' + u.escapeHtml(person.id) + '" ' + (person.id === selectedId ? "selected" : "") + '>' + u.escapeHtml(model.displayName(person) + (developerReferencesEnabled() ? " · " + person.reference : "")) + "</option>"; }).join("");
  }

  function partnerSourceValue(relationship, key) {
    return u.cleanLine(relationship && relationship.source && relationship.source.fields && relationship.source.fields[key], 80);
  }

  function partnerTypeValue(relationship) {
    const saved = partnerSourceValue(relationship, "partner-type");
    if (config.partnerTypes.some(function (item) { return item.id === saved; })) return saved;
    if (!relationship) return "UNKNOWN";
    if (relationship && relationship.status === "partnered") return "partnership";
    if (relationship && relationship.status === "unknown") return "UNKNOWN";
    return "marriage";
  }

  function partnerEndReasonValue(relationship) {
    const saved = partnerSourceValue(relationship, "end-reason");
    const fields = relationship && relationship.source && relationship.source.fields || {};
    if (Object.prototype.hasOwnProperty.call(fields, "end-reason") && config.partnerEndReasons.some(function (item) { return item.id === saved; })) return saved;
    return { widowed: "death", divorced: "divorce", separated: "separation", annulled: "annulment", former: "UNKNOWN" }[relationship && relationship.status] || "";
  }

  function partnerStatusFromDetails(type, endReason) {
    if (endReason === "death") return "widowed";
    if (endReason === "divorce") return "divorced";
    if (endReason === "separation") return "separated";
    if (endReason === "annulment") return "annulled";
    if (endReason === "UNKNOWN") return "former";
    if (type === "marriage") return "married";
    if (type === "partnership") return "partnered";
    return "unknown";
  }

  function updateRelationshipLineagePreview() {
    const field = $("#relationshipLineagePreviewField");
    const output = $("#relationshipLineagePreview");
    const lineal = $("#relationshipType").value === "parent-child" && $("#parentLineage").value === "lineal";
    field.hidden = !lineal;
    if (!lineal) return;
    const parentId = $("#relationPerson1").value;
    const childId = $("#relationPerson2").value;
    const previewState = u.clone(state());
    const existingId = $("#relationshipId").value;
    const relationship = {
      id: existingId || "lineage-preview", type: "parent-child", parentId: parentId, childId: childId,
      lineage: "lineal", kind: $("#parentKind").value || "unknown"
    };
    const existingIndex = previewState.workspace.relationships.findIndex(function (item) { return item.id === existingId; });
    if (existingIndex >= 0) previewState.workspace.relationships[existingIndex] = relationship;
    else previewState.workspace.relationships.push(relationship);
    try {
      const value = assignLineageForRelationship(previewState, relationship);
      output.classList.remove("danger-text");
      output.innerHTML = lineageIdHtml(value.split(".").map(displayLineageSegment));
    } catch (error) {
      output.classList.add("danger-text");
      output.textContent = error.message;
    }
  }

  function updateRelationshipFormType() {
    const partner = $("#relationshipType").value === "partner";
    $("#relationPerson1Label").textContent = partner ? "First partner" : "Parent";
    $("#relationPerson2Label").textContent = partner ? "Second partner" : "Child";
    $("#parentLineageField").hidden = partner;
    $("#parentKindField").hidden = partner;
    $("#partnerTypeField").hidden = !partner;
    $("#partnerEndReasonField").hidden = !partner;
    updateRelationshipLineagePreview();
  }

  function openRelationshipEditor(id, personId, trigger) {
    if (!familyEditingEnabled()) return;
    const relationship = id ? state().workspace.relationships.find(function (item) { return item.id === id; }) : null;
    $("#relationshipDialogTitle").textContent = relationship ? "Edit Relationship" : "Connect Existing People";
    $("#relationshipId").value = relationship ? relationship.id : "";
    $("#relationshipType").value = relationship ? relationship.type : "parent-child";
    const firstId = relationship ? (relationship.type === "parent-child" ? relationship.parentId : relationship.person1Id) : personId;
    const secondId = relationship ? (relationship.type === "parent-child" ? relationship.childId : relationship.person2Id) : state().workspace.people.find(function (person) { return person.id !== firstId; })?.id;
    $("#relationPerson1").innerHTML = personOptions(firstId);
    $("#relationPerson2").innerHTML = personOptions(secondId);
    $("#parentLineage").innerHTML = config.parentLineages.map(function (item) { return '<option value="' + item.id + '">' + u.escapeHtml(item.label) + "</option>"; }).join("");
    $("#parentKind").innerHTML = config.parentKinds.map(function (item) { return '<option value="' + item.id + '">' + u.escapeHtml(item.label) + "</option>"; }).join("");
    $("#partnerType").innerHTML = config.partnerTypes.map(function (item) { return '<option value="' + item.id + '">' + u.escapeHtml(item.label) + "</option>"; }).join("");
    $("#partnerEndReason").innerHTML = config.partnerEndReasons.map(function (item) { return '<option value="' + u.escapeHtml(item.id) + '">' + u.escapeHtml(item.label) + "</option>"; }).join("");
    $("#parentLineage").value = relationship && relationship.lineage || "non-lineal";
    $("#parentKind").value = relationship && relationship.kind || "unknown";
    $("#partnerType").value = partnerTypeValue(relationship);
    $("#partnerEndReason").value = partnerEndReasonValue(relationship);
    $("#relationshipStartDate").value = relationshipDateValue(relationship, "start");
    $("#relationshipEndDate").value = relationshipDateValue(relationship, "end");
    $$('[data-date-input]', $("#relationshipDialog")).forEach(function (input) { input.setAttribute("aria-invalid", "false"); });
    $$('[data-date-error]', $("#relationshipDialog")).forEach(function (message) { message.hidden = true; });
    $("#relationshipNotes").value = relationship && relationship.notes || "";
    $("#relationshipFormError").hidden = true;
    updateRelationshipFormType();
    components.openDialog("#relationshipDialog", { trigger: trigger, focus: "#relationshipType" });
  }

  function saveRelationship(event) {
    event.preventDefault();
    if (!familyEditingEnabled()) return;
    const id = $("#relationshipId").value;
    const existing = id ? state().workspace.relationships.find(function (item) { return item.id === id; }) : null;
    const type = $("#relationshipType").value;
    const startValue = $("#relationshipStartDate").value.trim();
    const endValue = $("#relationshipEndDate").value.trim();
    const dateInputs = [$("#relationshipStartDate"), $("#relationshipEndDate")];
    if (!dateInputs.map(validateDateInputControl).every(Boolean)) {
      $("#relationshipFormError").textContent = "Correct every date marked in red. The examples below each date show every accepted format.";
      $("#relationshipFormError").hidden = false;
      return;
    }
    if (type === "partner" && endValue && !$("#partnerEndReason").value) {
      $("#relationshipFormError").textContent = "Choose why the partner relationship ended, or clear the end date.";
      $("#relationshipFormError").hidden = false;
      return;
    }
    const now = u.isoNow();
    const source = existing ? u.clone(existing.source) : { format: "mcrelations-v2", fields: {} };
    source.format = source.format || "mcrelations-v2";
    source.fields = Object.assign({}, u.plainObject(source.fields));
    const startDescriptor = automaticDateDescriptor(startValue, "optional", "");
    const endDescriptor = automaticDateDescriptor(endValue, "optional", "");
    source.fields["date-start-value"] = startValue;
    source.fields["date-start-descriptor"] = startDescriptor;
    source.fields["date-end-value"] = endValue;
    source.fields["date-end-descriptor"] = endDescriptor;
    const relationship = {
      id: existing ? existing.id : u.uid("relationship"), type: type,
      startDate: normalizedPersonDate(startValue, startDescriptor), endDate: normalizedPersonDate(endValue, endDescriptor), place: existing ? existing.place : "", notes: $("#relationshipNotes").value,
      source: source,
      order: existing ? existing.order : state().workspace.relationships.length + 1, createdAt: existing ? existing.createdAt : now, updatedAt: now
    };
    if (type === "parent-child") Object.assign(relationship, { parentId: $("#relationPerson1").value, childId: $("#relationPerson2").value, lineage: $("#parentLineage").value, kind: $("#parentKind").value });
    else {
      const partnerType = $("#partnerType").value;
      const endReason = $("#partnerEndReason").value;
      Object.assign(relationship, { person1Id: $("#relationPerson1").value, person2Id: $("#relationPerson2").value, status: partnerStatusFromDetails(partnerType, endReason) });
      relationship.source.fields["partner-type"] = partnerType;
      relationship.source.fields["end-reason"] = endReason;
    }
    const error = family.validateRelationshipDraft(relationship, state(), existing && existing.id);
    if (error) {
      $("#relationshipFormError").textContent = error;
      $("#relationshipFormError").hidden = false;
      return;
    }
    const validationState = u.clone(state());
    const validationIndex = validationState.workspace.relationships.findIndex(function (item) { return item.id === relationship.id; });
    if (validationIndex >= 0) validationState.workspace.relationships[validationIndex] = u.clone(relationship);
    else validationState.workspace.relationships.push(u.clone(relationship));
    let assignedLineage = "";
    try {
      assignedLineage = assignLineageForRelationship(validationState, relationship);
    } catch (lineageError) {
      $("#relationshipFormError").textContent = lineageError.message;
      $("#relationshipFormError").hidden = false;
      return;
    }
    storage.mutate(function (next) {
      if (existing) next.workspace.relationships[next.workspace.relationships.findIndex(function (item) { return item.id === existing.id; })] = relationship;
      else next.workspace.relationships.push(relationship);
      if (assignedLineage) assignLineageForRelationship(next, relationship);
    }, { reason: existing ? "edit-relationship" : "add-relationship" });
    treeNeedsFit = true;
    components.closeDialog("#relationshipDialog", "saved");
    renderAll();
    const lineageMessage = assignedLineage ? " Lineage ID " + assignedLineage + " was calculated." : "";
    components.toast((existing ? "The relationship was updated." : "The people are now connected.") + lineageMessage, { title: existing ? "Relationship updated" : "Relationship added", kind: "success" });
  }

  async function addRelative(personId, trigger) {
    if (!familyEditingEnabled()) return;
    const choice = await components.choose({
      title: "Add a new relative",
      message: "Choose how the new person is related. You can refine the relationship details afterward.",
      choices: [
        { value: "parent", label: "Add parent", description: "Create a new person as a parent of the selected person.", kind: "primary" },
        { value: "child", label: "Add child", description: "Create a new person as a child of the selected person." },
        { value: "partner", label: "Add partner", description: "Create a new person as a partner of the selected person." }
      ],
      trigger: trigger
    });
    if (choice === "cancel") return;
    pendingRelative = { sourceId: personId, role: choice };
    openPersonEditor("", trigger);
  }

  async function deleteRelationship(id, trigger) {
    if (!familyEditingEnabled()) return;
    const relationship = state().workspace.relationships.find(function (item) { return item.id === id; });
    if (!relationship) return;
    const accepted = await components.confirm({ title: "Remove this relationship?", message: "The people will remain in the list, but this link and its relationship notes will be removed from the tree and atlas.", confirmLabel: "Remove relationship", cancelLabel: "Keep relationship", danger: true, trigger: trigger });
    if (!accepted) return;
    const hosted = hostedVaultActive();
    if (!hosted) storage.saveRecovery("Before removing a relationship", state());
    storage.mutate(function (next) { next.workspace.relationships = next.workspace.relationships.filter(function (item) { return item.id !== id; }); }, { reason: "delete-relationship" });
    treeNeedsFit = true;
    renderAll();
    components.toast(hosted ? "The relationship was removed from this working copy. GitHub will stay unchanged until you choose Update." : "The relationship was removed. A recovery copy is available in Developer Mode.", { title: "Relationship removed", kind: "success" });
  }

  async function deletePerson(id, trigger) {
    if (!familyEditingEnabled()) return;
    const person = state().workspace.people.find(function (item) { return item.id === id; });
    if (!person) return;
    const linkCount = state().workspace.relationships.filter(function (relationship) { return relationship.type === "parent-child" ? relationship.parentId === id || relationship.childId === id : relationship.person1Id === id || relationship.person2Id === id; }).length;
    const hosted = hostedVaultActive();
    const accepted = await components.confirm({ title: "Delete " + model.displayName(person) + "?", message: "This removes the profile and " + linkCount + " relationship link" + (linkCount === 1 ? "" : "s") + " from this working copy. " + (hosted ? "The last published family on GitHub remains available until you choose Update." : "A local recovery copy will be saved first."), confirmLabel: "Delete person", cancelLabel: "Keep person", danger: true, trigger: trigger });
    if (!accepted) return;
    if (!hosted) storage.saveRecovery("Before deleting " + model.displayName(person), state());
    storage.mutate(function (next) {
      next.workspace.people = next.workspace.people.filter(function (item) { return item.id !== id; });
      next.workspace.relationships = next.workspace.relationships.filter(function (relationship) { return relationship.type === "parent-child" ? relationship.parentId !== id && relationship.childId !== id : relationship.person1Id !== id && relationship.person2Id !== id; });
      next.workspace.residences = next.workspace.residences.filter(function (residence) { return residence.personId !== id; });
      removeUnreferencedPlaces(next);
      next.ui.favoritePersonIds = next.ui.favoritePersonIds.filter(function (personId) { return personId !== id; });
      const fallback = next.workspace.people[0] && next.workspace.people[0].id || "";
      if (next.workspace.family.homePersonId === id) next.workspace.family.homePersonId = fallback;
      next.ui.selectedPersonId = fallback;
      next.ui.treeFocusId = fallback;
    }, { reason: "delete-person" });
    treeNeedsFit = true;
    renderAll();
    components.toast(hosted ? "The person and linked relationships were removed from this working copy. Choose Update to publish the change." : "The person and linked relationships were removed. A recovery copy is available in Developer Mode.", { title: "Person deleted", kind: "success", duration: 5000 });
  }

  function setHomePerson(id) {
    if (!familyEditingEnabled()) return;
    storage.mutate(function (next) { next.workspace.family.homePersonId = id; next.ui.treeFocusId = id; }, { reason: "set-home-person" });
    treeNeedsFit = true;
    renderAll();
    components.toast("The tree now opens around " + model.displayName(state().workspace.people.find(function (person) { return person.id === id; })) + ".", { title: "Home person updated", kind: "success" });
  }

  function printDate() {
    const today = new Date();
    return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  }

  function printRelationshipList(person, sourceState) {
    const groups = family.relationGroups(person.id, sourceState || state());
    const parents = groups.parents;
    const generation = relationshipGeneration(person);
    const siblingOrder = birthOrderMap([person].concat(groups.siblings));
    const childOrder = birthOrderMap(groups.children);
    const section = function (label, groupGeneration, entries, contextForEntry, fallbackMeta) {
      if (!entries.length) return "";
      return '<div class="print-rel-group"><dt>' + u.escapeHtml(relationshipGroupLabel(label, groupGeneration)) + "</dt><dd>" + entries.map(function (entry, index) {
        const other = entry.person || entry;
        const relationship = entry.relationship;
        const meta = relationship ? relationshipLabel(relationship, person.id, other, entry) + (relationshipMeta(relationship) ? " · " + relationshipMeta(relationship) : "") : fallbackMeta;
        const context = contextForEntry ? contextForEntry(entry, index, entries) : "";
        return u.escapeHtml(model.displayName(other) + (context ? " " + context : "") + " — " + meta);
      }).join("<br>") + "</dd></div>";
    };
    return section("Parents", Math.max(0, generation - 1), parents, function (entry) { return parentContext(person, entry); }, "Parent")
      + section("Siblings", generation, groups.siblings, function (entry) { return birthOrderContext(entry.person || entry, siblingOrder); }, "Sibling")
      + section("Partners", null, groups.partners, function (entry) { return partnerContext(entry, person); }, "Partner")
      + section("Children", generation + 1, groups.children, function (entry) { return birthOrderContext(entry.person || entry, childOrder); }, "Child");
  }

  function isGeorgeMcMillenRoot(person, generations) {
    return model.displayName(person).toLowerCase() === "george mcmillen"
      && family.eventYearLabel(person, "birth") === "1745"
      && (generations.get(person.id) || 0) === 0;
  }

  function printMapPersonClasses(person) {
    const nameLength = model.displayName(person).length;
    const sizeClass = nameLength > 64 ? " print-name-tiniest" : nameLength > 46 ? " print-name-smallest" : nameLength > 30 ? " print-name-smaller" : "";
    const linealClass = isLinealPerson(person) ? " print-lineal" : "";
    const deceasedClass = person.livingStatus === "deceased" ? " print-deceased" : "";
    const givenName = String(person.givenName || model.displayName(person) || "").trim().split(/\s+/)[0].toLowerCase();
    const isExcludedLucian = model.displayName(person).trim().toLowerCase() === "lucian lynn kretzing";
    const highlightClass = linealClass && !isExcludedLucian && ["newton", "albon", "lucian"].includes(givenName) ? " print-lineage-highlight" : "";
    return linealClass + highlightClass + deceasedClass + sizeClass;
  }

  function printComponentRoot(ids, graph, generations) {
    const people = ids.map(function (id) { return graph.peopleById.get(id); }).filter(Boolean);
    const georgeRoot = people.find(function (person) { return isGeorgeMcMillenRoot(person, generations); });
    if (georgeRoot) return georgeRoot;
    const firstGeneration = Math.min.apply(null, people.map(function (person) { return generations.get(person.id) || 0; }));
    const idSet = new Set(ids);
    return people.filter(function (person) { return (generations.get(person.id) || 0) === firstGeneration; }).sort(function (a, b) {
      const childDifference = (graph.children.get(b.id) || []).filter(function (entry) { return idSet.has(entry.person.id); }).length - (graph.children.get(a.id) || []).filter(function (entry) { return idSet.has(entry.person.id); }).length;
      return childDifference || model.sortName(a).localeCompare(model.sortName(b));
    })[0] || null;
  }

  function excludedPrintRoot(person) {
    return person && model.displayName(person).trim().toLowerCase() === "jon couts";
  }

  function printLineageProgressionHtml(person, graph) {
    const members = [];
    const used = new Set();
    let cursor = person;
    while (cursor && !used.has(cursor.id) && members.length <= config.controls.maxPeople) {
      used.add(cursor.id);
      members.push(cursor);
      const parents = graph.parents.get(cursor.id) || [];
      const linealParent = parents.find(function (entry) {
        return entry.relationship && entry.relationship.lineage === "lineal";
      });
      cursor = linealParent && linealParent.person;
    }
    members.reverse();
    const names = members.map(function (member, index) {
      return u.escapeHtml(index === members.length - 1 ? lineageName(member) : firstName(lineageName(member)));
    });
    const formattedLineage = lineageIdHtml(lineageId(person));
    if (!names.length) names.push(u.escapeHtml(lineageName(person)));
    names[names.length - 1] = '<span class="print-lineage-person">' + names[names.length - 1] + ' <span class="print-lineage-number">[' + formattedLineage + "]</span></span>";
    return names.join(' <span class="print-lineage-arrow" aria-hidden="true">-&gt;</span> ');
  }

  function printHouseholdAddress(person) {
    const addresses = person && person.addresses || [];
    return addresses.find(function (address) { return address.current; }) || addresses[0] || null;
  }

  function printDirectoryEligible(person) {
    const hasValue = function (item) { return Boolean(u.cleanLine(item && item.value, 240)); };
    return Boolean(printHouseholdAddress(person) || (person.phones || []).some(hasValue) || (person.emails || []).some(hasValue));
  }

  function printDirectoryPeople(people, printState) {
    const available = new Map(people.map(function (person) { return [person.id, person]; }));
    const included = new Set(people.filter(printDirectoryEligible).map(function (person) { return person.id; }));
    let changed = true;
    while (changed) {
      changed = false;
      Array.from(included).forEach(function (personId) {
        family.relationGroups(personId, printState).partners.filter(function (entry) { return entry.current; }).forEach(function (entry) {
          if (entry.person && available.has(entry.person.id) && !included.has(entry.person.id)) {
            included.add(entry.person.id);
            changed = true;
          }
        });
      });
    }
    return people.filter(function (person) { return included.has(person.id); });
  }

  function printHouseholdAddressKey(person, address) {
    if (!address) return "person:" + person.id;
    if (address.placeId) return "place:" + address.placeId;
    const formatted = model.formatAddress(address).toLocaleLowerCase().replace(/\s+/g, " ").trim();
    return formatted ? "address:" + formatted : "person:" + person.id;
  }

  function comparePrintHouseholdMain(a, b, graph, memberIds) {
    const aLineage = lineageSegments(a);
    const bLineage = lineageSegments(b);
    if (Boolean(aLineage.length) !== Boolean(bLineage.length)) return aLineage.length ? -1 : 1;
    if (aLineage.length !== bLineage.length) return aLineage.length - bLineage.length;
    const aPartner = (graph.partners.get(a.id) || []).some(function (entry) { return memberIds.has(entry.person.id); });
    const bPartner = (graph.partners.get(b.id) || []).some(function (entry) { return memberIds.has(entry.person.id); });
    if (aPartner !== bPartner) return aPartner ? -1 : 1;
    const aParent = (graph.children.get(a.id) || []).some(function (entry) { return memberIds.has(entry.person.id); });
    const bParent = (graph.children.get(b.id) || []).some(function (entry) { return memberIds.has(entry.person.id); });
    if (aParent !== bParent) return aParent ? -1 : 1;
    return model.sortName(a).localeCompare(model.sortName(b)) || a.id.localeCompare(b.id);
  }

  function printHouseholdPreferredAddress(members) {
    const counts = new Map();
    const candidates = members.map(function (person) {
      const address = printHouseholdAddress(person);
      const key = printHouseholdAddressKey(person, address);
      if (address) counts.set(key, (counts.get(key) || 0) + 1);
      return { person: person, address: address, key: key };
    }).filter(function (candidate) { return candidate.address; });
    return candidates.sort(function (a, b) {
      return (counts.get(b.key) || 0) - (counts.get(a.key) || 0)
        || Number(b.person.livingStatus === "living") - Number(a.person.livingStatus === "living")
        || model.sortName(a.person).localeCompare(model.sortName(b.person));
    })[0]?.address || null;
  }

  function printHouseholds(people, graph, printState) {
    const parent = new Map(people.map(function (person) { return [person.id, person.id]; }));
    const find = function (id) {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root);
      while (parent.get(id) !== id) { const next = parent.get(id); parent.set(id, root); id = next; }
      return root;
    };
    const union = function (first, second) {
      const firstRoot = find(first);
      const secondRoot = find(second);
      if (firstRoot !== secondRoot) parent.set(secondRoot, firstRoot);
    };
    const firstByAddress = new Map();
    people.forEach(function (person) {
      const address = printHouseholdAddress(person);
      if (!address) return;
      const key = printHouseholdAddressKey(person, address);
      if (firstByAddress.has(key)) union(person.id, firstByAddress.get(key));
      else firstByAddress.set(key, person.id);
    });
    const personIds = new Set(people.map(function (person) { return person.id; }));
    people.forEach(function (person) {
      family.relationGroups(person.id, printState).partners.filter(function (entry) { return entry.current; }).forEach(function (entry) {
        if (entry.person && personIds.has(entry.person.id)) union(person.id, entry.person.id);
      });
    });
    const grouped = new Map();
    people.forEach(function (person) {
      const key = find(person.id);
      if (!grouped.has(key)) grouped.set(key, { key: key, members: [] });
      grouped.get(key).members.push(person);
    });
    return Array.from(grouped.values()).map(function (household) {
      const memberIds = new Set(household.members.map(function (person) { return person.id; }));
      household.members.sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)) || a.id.localeCompare(b.id); });
      household.main = household.members.slice().sort(function (a, b) { return comparePrintHouseholdMain(a, b, graph, memberIds); })[0];
      household.address = printHouseholdPreferredAddress(household.members);
      household.partners = family.relationGroups(household.main.id, printState).partners.filter(function (entry) {
        return entry.current && entry.person && memberIds.has(entry.person.id);
      }).sort(function (a, b) {
        return Number(b.current) - Number(a.current) || model.sortName(a.person).localeCompare(model.sortName(b.person));
      }).map(function (entry) { return entry.person; }).filter(function (partner) {
        return partner && memberIds.has(partner.id);
      }).filter(function (partner, index, partners) {
        return partners.findIndex(function (candidate) { return candidate.id === partner.id; }) === index;
      });
      const partnerIds = new Set(household.partners.map(function (partner) { return partner.id; }));
      household.sameAddress = household.members.filter(function (member) { return member.id !== household.main.id && !partnerIds.has(member.id); });
      return household;
    }).sort(function (a, b) {
      return model.sortName(a.main).localeCompare(model.sortName(b.main)) || a.main.id.localeCompare(b.main.id);
    });
  }

  function printHouseholdPersonName(person) {
    let name = u.escapeHtml(model.displayName(person));
    if (isLinealPerson(person)) name = "<strong>" + name + "</strong>";
    if (person.livingStatus === "deceased") {
      const deathYear = family.eventYearLabel(person, "death");
      const knownYear = /^\d{4}$/.test(deathYear) ? deathYear : "";
      name = "<em>" + name + '</em> <span class="print-household-death">[d.' + (knownYear ? " " + knownYear : "") + "]</span>";
    }
    return name;
  }

  function mailingAddressLines(address) {
    if (!address) return [];
    const street = [address.line1, address.line2].map(function (value) { return u.cleanLine(value, 240); }).filter(Boolean).join(", ");
    const locality = [u.cleanLine(address.city, 160), u.cleanLine(address.region, 120)].filter(Boolean).join(", ");
    const cityLine = [locality, u.cleanLine(address.postalCode, 40)].filter(Boolean).join(" ");
    const country = u.cleanLine(address.country, 120);
    const internationalCountry = /^(?:u\.?s\.?a?|united states(?: of america)?)$/i.test(country) ? "" : country;
    const secondLine = [cityLine, internationalCountry].filter(Boolean).join(", ");
    return [street, secondLine];
  }

  function mailingDisplayNameParts(person) {
    return ["preferred", "current", "birth"].map(function (kind) { return model.nameParts(person, kind); }).find(function (parts) {
      return [parts.prefix, parts.first, parts.middle, parts.last, parts.suffix].some(Boolean);
    }) || model.nameParts(person, "birth");
  }

  function joinHouseholdNames(people, compactSharedLastName) {
    const names = people.map(function (person) { return model.displayName(person); }).filter(Boolean);
    if (names.length < 2) return names[0] || "Unnamed household";
    if (names.length === 2) {
      if (compactSharedLastName) {
        const parts = people.slice(0, 2).map(mailingDisplayNameParts);
        const sharedLastName = parts[0].last && parts[1].last && parts[0].last.localeCompare(parts[1].last, undefined, { sensitivity: "accent" }) === 0;
        const firstWithoutLast = [parts[0].prefix, parts[0].first, parts[0].middle, parts[0].suffix].filter(Boolean).join(" ");
        if (sharedLastName && firstWithoutLast) return firstWithoutLast + " & " + names[1];
      }
      return names.join(" & ");
    }
    return names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
  }

  function mailingHouseholdEntries() {
    const current = state();
    const people = current.workspace.people.slice().sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)); });
    const printState = { workspace: { people: people, relationships: current.workspace.relationships } };
    const graph = family.indexes(printState);
    const directoryPeople = printDirectoryPeople(people, printState);
    return printHouseholds(directoryPeople, graph, printState).filter(function (household) {
      return Boolean(household.address);
    }).map(function (household) {
      const namedPeople = [household.main].concat(household.partners);
      const lines = mailingAddressLines(household.address);
      return { names: joinHouseholdNames(namedPeople), labelNames: joinHouseholdNames(namedPeople, true), addressLines: lines, address: lines.filter(Boolean).join("\n") };
    }).filter(function (entry) { return entry.address; });
  }

  function buildMailingLabelReport(entries) {
    const pages = [];
    for (let offset = 0; offset < entries.length; offset += 30) {
      const labels = entries.slice(offset, offset + 30);
      while (labels.length < 30) labels.push(null);
      pages.push('<section class="print-label-sheet" aria-label="Avery 5260 mailing-label sheet">' + labels.map(function (entry) {
        if (!entry) return '<article class="print-mailing-label print-mailing-label-blank" aria-hidden="true"></article>';
        return '<article class="print-mailing-label"><strong>' + u.escapeHtml(entry.labelNames || entry.names) + '</strong><span>' + u.escapeHtml(entry.addressLines[0] || "") + '</span><span>' + u.escapeHtml(entry.addressLines[1] || "") + "</span></article>";
      }).join("") + "</section>");
    }
    $("#printReport").innerHTML = pages.join("");
  }

  function setPrintPageMode(mode) {
    let style = $("#dynamicPrintPageStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "dynamicPrintPageStyle";
      style.media = "print";
      document.head.appendChild(style);
    }
    style.textContent = mode === "labels"
      ? "@page { size: letter; margin: 0; }"
      : '@page { size: letter; margin: .2in .5in; @top-right { content: "' + printDate() + '"; color: #555; font: 6pt Helvetica, Arial, sans-serif; } @bottom-left { content: ""; } @bottom-right { content: counter(page) " of " counter(pages); color: #555; font: 6pt Helvetica, Arial, sans-serif; } }';
    document.body.classList.toggle("printing-labels", mode === "labels");
    document.body.classList.toggle("printing-atlas", mode === "atlas");
  }

  function useCleanPrintLocation() {
    if (activePrintLocation) return;
    activePrintLocation = location.pathname + location.search + location.hash;
    const cleanLocation = location.pathname || "/";
    if (activePrintLocation !== cleanLocation) history.replaceState(history.state, "", cleanLocation);
  }

  function clearPrintMode() {
    document.body.classList.remove("printing-atlas", "printing-labels");
    $("#dynamicPrintPageStyle")?.remove();
    $("#printReport").setAttribute("aria-hidden", "true");
    if (activePrintLocation) {
      history.replaceState(history.state, "", activePrintLocation);
      activePrintLocation = "";
    }
    if (activePrintTitle) {
      document.title = activePrintTitle;
      activePrintTitle = "";
    }
  }

  function invokeNativePrint(mode) {
    $("#printReport").setAttribute("aria-hidden", "false");
    setPrintPageMode(mode);
    useCleanPrintLocation();
    activePrintTitle = document.title;
    document.title = (mode === "labels" ? "McFamily-Mailing-Labels-" : "McFamily-Directory-") + printDate();
    requestAnimationFrame(function () {
      try {
        window.print();
      } catch (error) {
        clearPrintMode();
        throw error;
      }
    });
  }

  function mailingCsvValue(value) {
    let text = String(value == null ? "" : value);
    if (/^[\t ]*[=+\-@]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function downloadTextFile(text, fileName, type) {
    const blob = new Blob([text], { type: type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function mailingExportUnavailable() {
    if (!familyEditingEnabled()) {
      components.message("Export unavailable", "Mailing labels and CSV export are available only to Admin and Editors.");
      return true;
    }
    if (!initialized()) {
      components.message("No family to export", "Open the family before creating mailing output.");
      return true;
    }
    return false;
  }

  function printMailingLabels(eventOrTrigger) {
    if (mailingExportUnavailable()) return;
    const entries = mailingHouseholdEntries();
    if (!entries.length) {
      components.message("No mailing addresses", "Add a current household address before creating mailing labels.");
      return;
    }
    const trigger = eventOrTrigger && eventOrTrigger.currentTarget instanceof HTMLElement ? eventOrTrigger.currentTarget : eventOrTrigger instanceof HTMLElement ? eventOrTrigger : document.activeElement;
    buildMailingLabelReport(entries);
    if (developerReferencesEnabled()) {
      openPrintPreview(trigger, "Labels Preview");
      return;
    }
    invokeNativePrint("labels");
  }

  function exportMailingCsv() {
    if (mailingExportUnavailable()) return;
    const entries = mailingHouseholdEntries();
    if (!entries.length) {
      components.message("No mailing addresses", "Add a current household address before exporting a mailing CSV.");
      return;
    }
    const rows = entries.map(function (entry) { return mailingCsvValue(entry.names) + "," + mailingCsvValue(entry.address); });
    const csv = "\ufeffNames,Address\r\n" + rows.join("\r\n") + "\r\n";
    const slug = state().workspace.family.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mcfamily";
    downloadTextFile(csv, slug + "-mailing-addresses-" + new Date().toISOString().slice(0, 10) + ".csv", "text/csv;charset=utf-8");
    components.toast(entries.length + " household " + (entries.length === 1 ? "address was" : "addresses were") + " exported.", { title: "Mailing CSV saved", kind: "success" });
  }

  function printContactValues(items) {
    const values = (items || []).map(function (item) { return u.cleanLine(item && item.value, 240); }).filter(Boolean);
    return values.length ? values.map(function (value) { return "<span>" + u.escapeHtml(value) + "</span>"; }).join("") : '<span class="muted-copy">—</span>';
  }

  function printHouseholdNameDensityClass(person) {
    const length = model.displayName(person).length + (person.livingStatus === "deceased" ? 9 : 0);
    if (length > 40) return " print-household-name-tiniest";
    if (length > 32) return " print-household-name-smaller";
    if (length > 24) return " print-household-name-small";
    return "";
  }

  function printHouseholdHtml(household, graph) {
    const main = household.main;
    const householdPeople = [main].concat(household.partners);
    const residentRowCount = household.sameAddress.length ? 1 : 0;
    const addressRows = Math.max(1, householdPeople.length + residentRowCount);
    const address = household.address ? u.escapeHtml(model.formatAddress(household.address)).replace(/\n/g, "<br>") : '<span class="muted-copy">No address recorded</span>';
    const addressPhone = household.address && household.address.phone ? '<p class="print-household-address-phone">' + u.escapeHtml(household.address.phone) + "</p>" : "";
    const householdRows = householdPeople.map(function (person, index) {
      const addressCell = index === 0 ? '<td class="print-household-address" rowspan="' + addressRows + '"><div class="print-household-address-layout"><address>' + address + "</address>" + addressPhone + "</div></td>" : "";
      return '<tr class="print-household-person-row"><td><h2 class="' + printHouseholdNameDensityClass(person).trim() + '">' + printHouseholdPersonName(person) + '</h2></td><td><p>' + printContactValues(person.phones) + '</p></td><td><p>' + printContactValues(person.emails) + "</p></td>" + addressCell + "</tr>";
    }).join("");
    const sameAddress = household.sameAddress.length ? '<tr class="print-household-residents"><td colspan="3">' + household.sameAddress.map(function (person) { return u.escapeHtml(model.displayName(person)); }).join(", ") + "</td></tr>" : "";
    const sizeClass = householdPeople.length === 1 && !household.sameAddress.length ? "print-household-single" : "print-household-multiple";
    const columns = '<colgroup><col class="print-directory-household-column"><col class="print-directory-phone-column"><col class="print-directory-email-column"><col class="print-directory-address-column"></colgroup>';
    return '<tbody class="print-directory-household ' + sizeClass + '"><tr class="print-household-card-row"><td colspan="4"><table class="print-household-card">' + columns + "<tbody>" + householdRows + sameAddress + '<tr class="print-household-lineage"><td colspan="4">' + printLineageProgressionHtml(main, graph) + "</td></tr></tbody></table></td></tr></tbody>";
  }

  function printGenerationSection(generation, people) {
    return '<section class="print-generation"><h4>Generation ' + generation + '</h4><div>' + people.slice().sort(function (a, b) {
      return family.compareLineage(a, b) || model.sortName(a).localeCompare(model.sortName(b));
    }).map(function (person) {
      const classes = printMapPersonClasses(person).trim();
      const bloodlineIcon = classes.includes("print-lineage-highlight") ? '<i class="print-bloodline-icon" aria-label="Special Bloodline member">' + icons.markup("lineal") + "</i>" : "";
      return '<span class="' + classes + '"><div class="print-map-name-row"><strong>' + u.escapeHtml(model.displayName(person)) + "</strong>" + bloodlineIcon + '</div><small>' + u.escapeHtml(family.lifespan(person)) + "</small></span>";
    }).join("") + "</div></section>";
  }

  function generationThreeBranchFor(person, graph, componentIds, generations) {
    const anchors = Array.from(componentIds).map(function (id) { return graph.peopleById.get(id); }).filter(function (candidate) {
      return candidate && generations.get(candidate.id) === 3;
    });
    const prefixAnchor = function (candidate) {
      const segments = lineageSegments(candidate);
      if (!segments.length) return null;
      return anchors.filter(function (anchor) {
        const anchorSegments = lineageSegments(anchor);
        return anchorSegments.length && anchorSegments.length <= segments.length && anchorSegments.every(function (segment, index) {
          return segment === segments[index];
        });
      }).sort(function (a, b) {
        return lineageSegments(b).length - lineageSegments(a).length || family.compareLineage(a, b) || model.sortName(a).localeCompare(model.sortName(b));
      })[0] || null;
    };
    const direct = prefixAnchor(person);
    if (direct) return direct;
    const partnerBranch = (graph.partners.get(person.id) || []).map(function (entry) { return prefixAnchor(entry.person); }).find(Boolean);
    if (partnerBranch) return partnerBranch;
    const queue = (graph.parents.get(person.id) || []).map(function (entry) { return entry.person; });
    const seen = new Set();
    const candidates = [];
    while (queue.length) {
      const ancestor = queue.shift();
      if (!ancestor || seen.has(ancestor.id) || !componentIds.has(ancestor.id)) continue;
      seen.add(ancestor.id);
      const generation = generations.get(ancestor.id) || 0;
      if (generation === 3) candidates.push(ancestor);
      (graph.parents.get(ancestor.id) || []).forEach(function (entry) { queue.push(entry.person); });
    }
    return candidates.sort(function (a, b) { return family.compareLineage(a, b) || model.sortName(a).localeCompare(model.sortName(b)); })[0] || null;
  }

  function buildPrintReport() {
    const current = state();
    const excludedIds = family.unplacedLineageIds(current);
    current.workspace.people.forEach(function (person) {
      if (lineageSegments(person).includes("99")) excludedIds.add(person.id);
    });
    const people = current.workspace.people.filter(function (person) { return !excludedIds.has(person.id); }).sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)); });
    const visibleIds = new Set(people.map(function (person) { return person.id; }));
    const relationships = current.workspace.relationships.filter(function (relationship) {
      return relationship.type === "parent-child" ? visibleIds.has(relationship.parentId) && visibleIds.has(relationship.childId) : visibleIds.has(relationship.person1Id) && visibleIds.has(relationship.person2Id);
    });
    const printState = { workspace: { people: people, relationships: relationships } };
    const graph = family.indexes(printState);
    const printGenerations = family.generationMap(people, relationships);
    const georgeMcMillenRoot = people.find(function (person) { return isGeorgeMcMillenRoot(person, printGenerations); });
    const componentsList = family.connectedComponents(printState).filter(function (ids) {
      return !excludedPrintRoot(printComponentRoot(ids, graph, printGenerations));
    }).sort(function (a, b) {
      return Number(Boolean(georgeMcMillenRoot && b.includes(georgeMcMillenRoot.id))) - Number(Boolean(georgeMcMillenRoot && a.includes(georgeMcMillenRoot.id)));
    });
    const componentHtml = componentsList.map(function (ids) {
      const componentPeople = ids.map(function (id) { return graph.peopleById.get(id); }).filter(Boolean);
      const idSet = new Set(ids);
      const groups = new Map();
      componentPeople.forEach(function (person) { const level = printGenerations.get(person.id) || 0; if (!groups.has(level)) groups.set(level, []); groups.get(level).push(person); });
      const sortedLevels = Array.from(groups.keys()).sort(function (a, b) { return a - b; });
      const rootAncestor = printComponentRoot(ids, graph, printGenerations);
      const earlyGenerations = sortedLevels.filter(function (level) { return level <= 3; }).map(function (level) { return printGenerationSection(level, groups.get(level)); }).join("");
      const branches = new Map();
      sortedLevels.filter(function (level) { return level >= 4; }).forEach(function (level) {
        groups.get(level).forEach(function (person) {
          const anchor = generationThreeBranchFor(person, graph, idSet, printGenerations);
          const key = anchor ? anchor.id : "unassigned";
          if (!branches.has(key)) branches.set(key, { anchor: anchor, generations: new Map() });
          if (!branches.get(key).generations.has(level)) branches.get(key).generations.set(level, []);
          branches.get(key).generations.get(level).push(person);
        });
      });
      const branchHtml = Array.from(branches.values()).sort(function (a, b) {
        if (!a.anchor) return 1;
        if (!b.anchor) return -1;
        return family.compareLineage(a.anchor, b.anchor) || model.sortName(a.anchor).localeCompare(model.sortName(b.anchor));
      }).map(function (branch) {
        const label = branch.anchor ? "Descendants of " + model.displayName(branch.anchor) : "Other Later Generations";
        return '<section class="print-generation-branch"><header><span>Generation 3 Line</span><h4>' + u.escapeHtml(label) + '</h4></header>' + Array.from(branch.generations.keys()).sort(function (a, b) { return a - b; }).map(function (level) { return printGenerationSection(level, branch.generations.get(level)); }).join("") + "</section>";
      }).join("");
      return '<article class="print-component"><header><div><span>Root Ancestor</span><h3>' + u.escapeHtml(model.displayName(rootAncestor)) + "</h3></div></header>" + earlyGenerations + branchHtml + "</article>";
    }).join("");
    const directoryPeople = printDirectoryPeople(people, printState);
    const households = printHouseholds(directoryPeople, graph, printState);
    const directoryHtml = households.length ? '<table class="print-directory-table"><colgroup><col class="print-directory-household-column"><col class="print-directory-phone-column"><col class="print-directory-email-column"><col class="print-directory-address-column"></colgroup><thead><tr><th scope="col">Household</th><th scope="col">Phone</th><th scope="col">Email</th><th scope="col"><span class="print-directory-address-heading"><span>Address</span><span>Landline</span></span></th></tr></thead>' + households.map(function (household) { return printHouseholdHtml(household, graph); }).join("") + "</table>" : '<p class="print-directory-empty">No phone, email, or address information is recorded.</p>';
    const reportDate = printDate();
    $("#printReport").innerHTML = '<section class="print-directory"><header class="print-report-header"><h1>Directory of McMillen Clan</h1><time datetime="' + reportDate + '">' + reportDate + "</time></header>" + directoryHtml + '</section><section class="print-atlas"><h2>Family Maps</h2>' + componentHtml + "</section>";
  }

  function openPrintPreview(trigger, title) {
    $("#printPreviewTitle").textContent = title || "Directory Preview";
    const preview = $("#printPreviewContent");
    preview.innerHTML = $("#printReport").innerHTML;
    $$("[id]", preview).forEach(function (element) { element.removeAttribute("id"); });
    components.openDialog("#printPreviewDialog", { trigger: trigger, focus: "[data-close-dialog='printPreviewDialog']" });
  }

  function printAtlas(eventOrTrigger) {
    if (!familyEditingEnabled()) {
      components.message("Export unavailable", "Directory printing is not provided in read-only access.");
      return;
    }
    if (!initialized() || !state().workspace.people.length) {
      components.message("Nothing to print", "Add at least one person before building the family atlas.");
      return;
    }
    const trigger = eventOrTrigger && eventOrTrigger.currentTarget instanceof HTMLElement ? eventOrTrigger.currentTarget : eventOrTrigger instanceof HTMLElement ? eventOrTrigger : document.activeElement;
    buildPrintReport();
    if (developerReferencesEnabled()) {
      openPrintPreview(trigger, "Directory Preview");
      return;
    }
    invokeNativePrint("atlas");
  }

  function filteredRoadmap() {
    const moduleState = state().modules.roadmap;
    const query = String(moduleState.search || "").trim().toLowerCase();
    const direction = moduleState.sortDirection === "desc" ? -1 : 1;
    return config.roadmap.filter(function (item) { return (moduleState.state === "all" || item.state === moduleState.state) && (!query || (item.title + " " + item.description + " " + item.target).toLowerCase().includes(query)); }).slice().sort(function (a, b) {
      let compared = 0;
      if (moduleState.sortBy === "priority") compared = a.priority - b.priority;
      else if (moduleState.sortBy === "effort") compared = a.effort - b.effort;
      else if (moduleState.sortBy === "age") compared = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      else if (moduleState.sortBy === "target") compared = String(a.target).localeCompare(String(b.target), undefined, { numeric: true });
      else compared = a.title.localeCompare(b.title);
      return compared * direction || a.title.localeCompare(b.title);
    });
  }

  function roadmapCard(item) {
    return '<article class="roadmap-card" data-roadmap-state="' + item.state + '"><header><span class="roadmap-state">' + u.escapeHtml(item.state) + '</span><span class="priority-chip">P' + item.priority + '</span></header><h3>' + u.escapeHtml(item.title) + '</h3><p>' + u.escapeHtml(item.description) + '</p><footer><span>Target ' + u.escapeHtml(item.target) + '</span><span>Effort ' + item.effort + '/4</span><span>Added ' + u.dateLabel(item.createdAt) + "</span></footer></article>";
  }

  function emptyState(title, copy, label, action) {
    return '<div class="empty-state"><h3>' + u.escapeHtml(title) + '</h3><p>' + u.escapeHtml(copy) + "</p>" + (label ? '<button type="button" class="button" data-action="' + action + '">' + u.escapeHtml(label) + "</button>" : "") + "</div>";
  }

  function globalSearchMatches(query) {
    const needle = query.trim();
    if (!needle && !favoritesPreviewOpen) return [];
    const results = [];
    const favoriteIds = new Set(state().ui.favoritePersonIds);
    state().workspace.people.forEach(function (person) {
      const favorite = favoriteIds.has(person.id);
      if ((favoritesPreviewOpen ? favorite : model.fuzzySearchMatch(needle, model.personSearchText(person, { includeNotes: familyEditingEnabled(), includeSource: developerReferencesEnabled() })))) results.push({ type: "person", id: person.id, title: model.displayName(person), alternateNames: personAlternateNames(person), meta: developerReferencesEnabled() ? person.reference : "", favorite: favorite });
    });
    results.sort(function (a, b) { return Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title); });
    if (favoritesPreviewOpen) return results;
    config.help.forEach(function (topic) { if ((familyEditingEnabled() || !["print", "backup", "cloud"].includes(topic.id)) && model.fuzzySearchMatch(needle, topic.title + " " + topic.keywords + " " + u.stripHtml(topic.html))) results.push({ type: "help", id: topic.id, title: topic.title, meta: "Help · " + topic.section }); });
    config.roadmap.forEach(function (item) { if (model.fuzzySearchMatch(needle, item.title + " " + item.description)) results.push({ type: "roadmap", id: item.id, title: item.title, meta: "Roadmap · " + item.state }); });
    config.releases.forEach(function (release) { const text = [release.version, release.title, release.summary].concat(release.features || [], release.improvements || [], release.fixes || [], release.knownIssues || []).join(" "); if (model.fuzzySearchMatch(needle, text)) results.push({ type: "release", id: release.version, title: release.title, meta: "Release · v" + release.version }); });
    return results.slice(0, 12);
  }

  function renderGlobalSearchResults() {
    const container = $("#globalSearchResults");
    const query = state().ui.search;
    const searchActive = document.activeElement === $("#globalSearch") || container.contains(document.activeElement);
    if (!initialized() || (!query && !favoritesPreviewOpen) || !searchActive) { container.hidden = true; $("#globalSearch").setAttribute("aria-expanded", "false"); $("#favoritesButton").setAttribute("aria-expanded", "false"); return; }
    const results = globalSearchMatches(query);
    container.hidden = false;
    $("#globalSearch").setAttribute("aria-expanded", "true");
    container.innerHTML = results.length ? results.map(function (result, index) {
      const content = result.type === "person"
        ? '<span class="search-person-copy"><strong>' + u.escapeHtml(result.title) + '</strong>' + (result.alternateNames.length ? '<span class="search-person-alternates">(' + result.alternateNames.map(u.escapeHtml).join(", ") + ")</span>" : "") + (result.meta ? '<small class="search-result-meta">' + u.escapeHtml(result.meta) + "</small>" : "") + "</span>"
        : '<span><strong>' + u.escapeHtml(result.title) + '</strong><small>' + u.escapeHtml(result.meta) + "</small></span>";
      const main = '<button type="button" class="global-search-result-main" id="global-result-' + index + '" data-search-type="' + result.type + '" data-search-id="' + u.escapeHtml(result.id) + '">' + content + '<span class="search-result-arrow" aria-hidden="true">→</span></button>';
      if (result.type !== "person") return '<div class="global-search-result-row no-favorite" role="listitem">' + main + "</div>";
      const action = result.favorite ? "Remove " + result.title + " from favorites" : "Star " + result.title;
      return '<div class="global-search-result-row' + (result.favorite ? " is-favorite" : "") + '" role="listitem">' + main + '<button type="button" class="search-favorite-toggle" data-toggle-favorite="' + u.escapeHtml(result.id) + '" aria-label="' + u.escapeHtml(action) + '" title="' + u.escapeHtml(action) + '" aria-pressed="' + String(result.favorite) + '"><span data-symbol="favorite" aria-hidden="true"></span></button></div>';
    }).join("") : '<div class="search-empty">' + (favoritesPreviewOpen ? "No favorite people yet. Search for someone and select their star." : "No matches across people, contacts, Help, releases, or Roadmap.") + "</div>";
    $("#favoritesButton").setAttribute("aria-expanded", String(favoritesPreviewOpen));
    icons.mount(container);
  }

  function toggleFavoritePerson(id, trigger) {
    const person = state().workspace.people.find(function (item) { return item.id === id; });
    if (!person) return;
    const fromProfile = Boolean(trigger && trigger.closest("#profilePanel"));
    const wasFavorite = state().ui.favoritePersonIds.includes(id);
    storage.mutate(function (next) {
      const favorites = new Set(next.ui.favoritePersonIds);
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      next.ui.favoritePersonIds = Array.from(favorites);
    }, { reason: wasFavorite ? "favorite-remove" : "favorite-add" });
    renderHeader();
    renderGlobalSearchResults();
    if (state().ui.selectedPersonId === id) renderProfile();
    if (!$("#developerPanel").hidden) renderDeveloper();
    requestAnimationFrame(function () {
      const replacement = $("[data-toggle-favorite='" + CSS.escape(id) + "']", fromProfile ? $("#profilePanel") : $("#globalSearchResults"));
      (replacement || $("#globalSearch")).focus();
    });
  }

  function saveFavoritesFile() {
    const favoriteIds = new Set(state().ui.favoritePersonIds);
    const people = state().workspace.people.filter(function (person) { return favoriteIds.has(person.id); }).sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)); }).map(function (person) {
      return {
        id: person.id,
        preferredName: fullStructuredName(person, "preferred"),
        currentName: fullStructuredName(person, "current"),
        linealName: fullStructuredName(person, "birth")
      };
    });
    if (!people.length) {
      components.toast("Star at least one person before saving a Favorites file.", { title: "No favorites to save", kind: "warning" });
      return;
    }
    const envelope = {
      format: FAVORITES_BACKUP_FORMAT,
      version: FAVORITES_BACKUP_VERSION,
      exportedAt: u.isoNow(),
      familyTitle: state().workspace.family.title,
      people: people
    };
    const blob = new Blob([JSON.stringify(envelope, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug = state().workspace.family.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mcfamily";
    link.href = url;
    link.download = slug + "-favorites-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    components.toast(people.length + " favorite " + (people.length === 1 ? "person was" : "people were") + " saved outside browser storage.", { title: "Favorites file saved", kind: "success", duration: 5000 });
  }

  async function restoreFavoritesFile(file) {
    if (!file) return;
    if (!adminFavoritesRestoreEnabled()) {
      components.toast("Only Admin can restore a Favorites file.", { title: "Favorites not restored", kind: "warning", duration: 5000 });
      return;
    }
    try {
      if (file.size > 256 * 1024) throw new Error("That Favorites file is larger than the 256 KB limit.");
      const text = file.text ? await file.text() : await new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || "")); };
        reader.onerror = function () { reject(new Error("The selected Favorites file could not be read.")); };
        reader.readAsText(file);
      });
      const parsed = JSON.parse(text);
      if (!parsed || parsed.format !== FAVORITES_BACKUP_FORMAT || parsed.version !== FAVORITES_BACKUP_VERSION || !Array.isArray(parsed.people)) throw new Error("Choose a current McFamily Favorites JSON file.");
      if (parsed.people.length > config.controls.maxPeople) throw new Error("The Favorites file contains too many people.");
      const availableIds = new Set(state().workspace.people.map(function (person) { return person.id; }));
      const requestedIds = Array.from(new Set(parsed.people.map(function (person) { return u.cleanLine(person && person.id, 100); }).filter(Boolean)));
      const restoredIds = requestedIds.filter(function (id) { return availableIds.has(id); });
      const missingCount = requestedIds.length - restoredIds.length;
      storage.mutate(function (next) { next.ui.favoritePersonIds = restoredIds; }, { reason: "favorites-restore" });
      favoritesPreviewOpen = false;
      renderHeader();
      renderGlobalSearchResults();
      renderProfile();
      renderDeveloper();
      const skipped = missingCount ? " " + missingCount + " missing " + (missingCount === 1 ? "person was" : "people were") + " skipped." : "";
      components.toast(restoredIds.length + " favorite " + (restoredIds.length === 1 ? "person was" : "people were") + " restored." + skipped, { title: "Favorites restored", kind: missingCount ? "warning" : "success", duration: 6000 });
    } catch (error) {
      components.toast(error instanceof SyntaxError ? "That file is not valid JSON." : error.message, { title: "Favorites not restored", kind: "danger", duration: 6000 });
    }
  }

  function activateGlobalSearchResult(type, id) {
    const favoritesWereOpen = favoritesPreviewOpen;
    favoritesPreviewOpen = false;
    if (type === "person") selectPerson(id, { focus: true, mobileProfile: true, focusMode: true });
    else if (type === "help") { openSupport("help", $("#globalSearch")); setInputValue($("#helpSearch"), config.help.find(function (topic) { return topic.id === id; })?.title || ""); renderHelp(); }
    else if (type === "roadmap") { storage.mutate(function (next) { next.modules.roadmap.search = config.roadmap.find(function (item) { return item.id === id; })?.title || ""; }, { touch: false, reason: "roadmap-search" }); openSupport("roadmap", $("#globalSearch")); }
    else if (type === "release") { versionView = "released"; openSupport("releases", $("#globalSearch")); }
    $("#globalSearchResults").hidden = true;
    $("#globalSearch").setAttribute("aria-expanded", "false");
    $("#favoritesButton").setAttribute("aria-expanded", "false");
    if (favoritesWereOpen) renderHeader();
  }

  function openSupport(tab, trigger) {
    if (!initialized()) return;
    const requested = tab || state().ui.supportTab || "settings";
    const chosen = requested === "developer" && !developerReferencesEnabled() ? "settings" : requested;
    switchSupportTab(chosen);
    components.openDialog("#supportDialog", { trigger: trigger, focus: "[data-support-tab='" + chosen + "']" });
    renderSupport();
  }

  function switchSupportTab(tab) {
    if (tab === "developer" && !developerReferencesEnabled()) tab = "settings";
    storage.mutate(function (next) { next.ui.supportTab = tab; }, { touch: false, reason: "support-tab" });
    $$('[data-support-tab]').forEach(function (button) { const selected = button.dataset.supportTab === tab; button.setAttribute("aria-selected", String(selected)); button.tabIndex = selected ? 0 : -1; });
    $$('[data-support-panel]').forEach(function (panel) { panel.hidden = panel.dataset.supportPanel !== tab; });
    if (tab === "help") renderHelp();
    else if (tab === "releases") renderReleases();
    else if (tab === "shortcuts") renderShortcuts();
    else if (tab === "roadmap") renderSupportRoadmap();
    else if (tab === "developer") renderDeveloper();
    else renderSettings();
  }

  function renderSettings() {
    const preferences = state().preferences;
    const appearance = preferences.appearance;
    $$('[data-theme-mode]').forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.themeMode === appearance.mode)); });
    setInputValue($("#appTextScale"), Math.round(appearance.textScale * 100));
    $("#appTextScaleValue").textContent = Math.round(appearance.textScale * 100) + "%";
    $$('[data-button-style]').forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.buttonStyle === preferences.controls.buttonStyle)); });
    [
      { button: $("#settingsAppRepository"), url: config.identity.repository.url },
      { button: $("#settingsDataRepository"), url: "https://github.com/" + config.cloud.owner + "/" + config.cloud.repository }
    ].forEach(function (item) {
      const url = u.safeUrl(item.url);
      item.button.dataset.openUrl = url;
      item.button.disabled = !url;
    });
    renderLocalStatus();
  }

  function renderHelp() {
    const query = String($("#helpSearch")?.value || "").trim().toLowerCase();
    const topics = config.help.filter(function (topic) { return (familyEditingEnabled() || !["print", "backup", "cloud"].includes(topic.id)) && (!query || (topic.title + " " + topic.section + " " + topic.keywords + " " + u.stripHtml(topic.html)).toLowerCase().includes(query)); });
    $("#helpResultCount").textContent = topics.length + " topic" + (topics.length === 1 ? "" : "s");
    const groups = {};
    topics.forEach(function (topic) { (groups[topic.section] = groups[topic.section] || []).push(topic); });
    $("#helpContent").innerHTML = topics.length ? Object.keys(groups).map(function (section) { return '<section class="help-section"><h3>' + u.escapeHtml(section) + "</h3>" + groups[section].map(function (topic) { return '<article><h4>' + u.escapeHtml(topic.title) + "</h4>" + topic.html + "</article>"; }).join("") + "</section>"; }).join("") + renderSupportLinks() : emptyState("No help matches", "Try a shorter or broader search.", "Clear help search", "clear-help-search");
  }

  function renderSupportLinks() {
    const links = [config.identity.repository].concat(config.identity.support || []).filter(function (item) { return u.safeUrl(item.url); });
    return links.length ? '<section class="help-section"><h3>Support links</h3><div class="support-links">' + links.map(function (item) { return '<button type="button" class="safe-link-button" data-open-url="' + u.escapeHtml(u.safeUrl(item.url)) + '">' + u.escapeHtml(item.label) + ' <span aria-hidden="true">↗</span></button>'; }).join("") + "</div></section>" : "";
  }

  function releaseCard(release) {
    const section = function (title, values) { return values && values.length ? '<div class="release-section"><h5>' + title + "</h5><ul>" + values.map(function (value) { return "<li>" + u.escapeHtml(value) + "</li>"; }).join("") + "</ul></div>" : ""; };
    return '<article class="release-card"><header><div class="release-version-line"><span class="version-pill">v' + u.escapeHtml(release.version) + '</span><time datetime="' + u.escapeHtml(release.date) + '">' + u.dateLabel(release.date) + '</time></div><h4>' + u.escapeHtml(release.title) + '</h4></header><p>' + u.escapeHtml(release.summary) + '</p><div class="release-sections">' + section("Features", release.features) + section("Improvements", release.improvements) + section("Fixes", release.fixes) + section("Known issues", release.knownIssues) + "</div></article>";
  }

  function renderReleases() {
    $$('[data-version-view]').forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.versionView === versionView)); });
    if (versionView === "released") $("#releaseContent").innerHTML = config.releases.map(releaseCard).join("");
    else { const items = config.roadmap.filter(function (item) { return item.state === versionView; }); $("#releaseContent").innerHTML = items.length ? items.map(roadmapCard).join("") : emptyState("Nothing here", "No matching roadmap entries."); }
  }

  function renderShortcuts() {
    const groups = {};
    SHORTCUTS.filter(function (shortcut) {
      if (!["A", "N", "P", "E"].includes(shortcut.keys) || familyEditingEnabled()) return shortcut.keys !== "W" || rolePreviewAvailable();
      return false;
    }).forEach(function (shortcut) { (groups[shortcut.group] = groups[shortcut.group] || []).push(shortcut); });
    $("#shortcutContent").innerHTML = '<p class="section-intro">Listed shortcuts also work while Shift, Control, or Option is held. Command-key combinations remain available to the browser.</p>' + Object.keys(groups).map(function (group) { return '<section><h3>' + group + "</h3>" + groups[group].map(function (shortcut) { return '<div class="shortcut-row"><kbd>' + u.escapeHtml(shortcut.keys) + '</kbd><span>' + u.escapeHtml(shortcut.label) + "</span></div>"; }).join("") + "</section>"; }).join("");
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
    if (!developerReferencesEnabled()) return;
    const usage = await storage.usage();
    const device = pwa.detectDevice();
    const hosted = hostedVaultActive();
    const recovery = hosted ? null : storage.recoveryInfo();
    const diagnostics = [
      ["State model", "v" + state().schemaVersion], ["Application", "v" + config.identity.version + " · build " + config.identity.buildId],
      ["Access package", accessProfile().label],
      ["People", String(state().workspace.people.length)], ["Relationships", String(state().workspace.relationships.length)], ["Addresses", String(state().workspace.people.reduce(function (sum, person) { return sum + person.addresses.length; }, 0))],
      ["Device", device.label], ["Layout", (window.innerWidth < 700 ? "Mobile" : window.innerWidth < 960 ? "Tablet" : "Desktop") + " · " + window.innerWidth + "×" + window.innerHeight],
      ["State size", u.formatBytes(usage.stateBytes)], ["Browser storage", usage.memoryOnly ? "Preferences only · family in session memory" : (usage.quota ? u.formatBytes(usage.usage) + " of " + u.formatBytes(usage.quota) : (usage.persistentStorageAvailable ? "Available" : "Unavailable"))],
      ["Theme", document.documentElement.dataset.theme], ["Recovery", hosted ? "Hosted GitHub history" : (recovery ? u.dateLabel(recovery.createdAt) + " · " + recovery.reason : "None")]
    ];
    $("#developerDiagnostics").innerHTML = diagnostics.map(function (row) { return '<div><dt>' + u.escapeHtml(row[0]) + '</dt><dd>' + u.escapeHtml(row[1]) + "</dd></div>"; }).join("");
    $("#developerState").textContent = JSON.stringify(model.exportEnvelope(state()), null, 2);
    $("#restoreRecoveryButton").hidden = hosted;
    $("#saveRecoveryButton").hidden = hosted;
    $("#restoreRecoveryButton").disabled = !recovery;
    $("#saveFavoritesButton").disabled = !state().ui.favoritePersonIds.length;
    $("#restoreFavoritesButton").hidden = !adminFavoritesRestoreEnabled();
  }

  function renderSupport() {
    $("#developerTab").hidden = !developerReferencesEnabled();
    switchSupportTab(state().ui.supportTab);
  }

  async function resetPreferences() {
    const accepted = await components.confirm({ title: "Reset preferences?", message: "Appearance, family view settings, and filters will return to defaults. The family record will stay.", confirmLabel: "Reset preferences", danger: true });
    if (!accepted) return;
    storage.replace(model.resetPreferences(state()), { saveRecovery: false, clearRecovery: hostedVaultActive(), reason: "reset-preferences", touch: false, preserveDevicePreferences: false });
    treeNeedsFit = true;
    renderAll();
    components.toast("Preferences were reset; family data was preserved.", { title: "Preferences reset", kind: "success" });
  }

  async function restoreRecovery() {
    if (hostedVaultActive()) return;
    const info = storage.recoveryInfo();
    if (!info) return;
    const accepted = await components.confirm({ title: "Restore recovery copy?", message: "Restore the copy saved " + u.relativeTime(info.createdAt) + " (“" + info.reason + "”). Current local data will be replaced.", confirmLabel: "Restore recovery", danger: true });
    if (!accepted) return;
    storage.restoreRecovery();
    treeNeedsFit = true;
    renderAll();
    components.toast("The recovery copy was restored.", { title: "Recovery complete", kind: "success" });
  }

  function saveRecoveryCopy() {
    if (hostedVaultActive()) return;
    if (storage.saveRecovery("Manual recovery copy", state())) {
      renderDeveloper();
      components.toast("A recoverable local copy was saved.", { title: "Recovery copy saved", kind: "success" });
    }
  }

  function toggleDeveloperMode(force, options) {
    if (!config.features.developerTools || !initialized()) return;
    const willEnable = typeof force === "boolean" ? force : !state().preferences.controls.developerMode;
    if (!willEnable && App.cloud && App.cloud.setRolePreview) App.cloud.setRolePreview("owner");
    storage.mutate(function (next) { next.preferences.controls.developerMode = typeof force === "boolean" ? force : !next.preferences.controls.developerMode; }, { reason: "developer-mode" });
    $("#developerTab").hidden = !developerReferencesEnabled();
    renderHeader();
    renderMain();
    if (state().preferences.controls.developerMode) {
      components.toast("Developer Mode is available in Settings.", { title: "Developer Mode on", kind: "info" });
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
    function cancelHold() { window.clearTimeout(appIconHoldTimer); appIconHoldTimer = 0; delete button.dataset.holdActive; }
    button.addEventListener("pointerdown", function (event) { if (event.button !== 0) return; cancelHold(); appIconHoldHandled = false; startX = event.clientX; startY = event.clientY; button.dataset.holdActive = "true"; appIconHoldTimer = window.setTimeout(function () { appIconHoldTimer = 0; appIconHoldHandled = true; delete button.dataset.holdActive; toggleDeveloperMode(); window.setTimeout(function () { appIconHoldHandled = false; }, 900); }, 620); });
    button.addEventListener("pointermove", function (event) { if (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10) cancelHold(); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (name) { button.addEventListener(name, cancelHold); });
    button.addEventListener("click", function (event) { if (appIconHoldHandled) { event.preventDefault(); appIconHoldHandled = false; return; } toggleThemeFromAppIcon(); });
  }

  function updateTreeDepthControl(input, commit) {
    const key = input.id === "ancestorDepth" ? "ancestorDepth" : "descendantDepth";
    if (!String(input.value).trim()) {
      if (commit) input.value = String(state().ui[key]);
      return;
    }
    const value = Math.round(u.clamp(input.value, 0, config.controls.maxTreeDepth, state().ui[key]));
    storage.mutate(function (next) { next.ui[key] = value; next.ui.generationDepth = Math.max(next.ui.ancestorDepth, next.ui.descendantDepth); }, { touch: false, reason: "tree-depth" });
    treeNeedsFit = true;
    input.value = String(state().ui[key]);
    renderTree();
  }

  function updateTreeZoomControl(input, commit) {
    if (!String(input.value).trim()) {
      if (commit) input.value = String(Math.round(treeTransform.scale * 100));
      return;
    }
    const percent = Math.round(u.clamp(input.value, 1, 250, Math.round(treeTransform.scale * 100)));
    treeSurfaceMode = "natural";
    treeTransform.scale = percent / 100;
    input.value = String(percent);
    applyTreeTransform();
  }

  function handleMainClick(event) {
    const target = event.target;
    const openDirectoryFilter = $(".directory-filter-menu[open]");
    if (openDirectoryFilter && !target.closest(".directory-filter-menu")) openDirectoryFilter.removeAttribute("open");
    const favoriteButton = target.closest("[data-toggle-favorite]");
    if (favoriteButton) {
      toggleFavoritePerson(favoriteButton.dataset.toggleFavorite, favoriteButton);
      return;
    }
    const nonLinealToggle = target.closest("[data-toggle-non-lineal]");
    if (nonLinealToggle) {
      storage.mutate(function (next) { next.ui.showInferredParentLines = !next.ui.showInferredParentLines; }, { touch: false, reason: "tree-parent-lines" });
      nonLinealToggle.setAttribute("aria-pressed", String(state().ui.showInferredParentLines));
      renderTree();
      return;
    }
    const unplacedLineageToggle = target.closest("[data-toggle-unplaced-lineage]");
    if (unplacedLineageToggle) {
      storage.mutate(function (next) { next.ui.hideUnplacedLineage = !next.ui.hideUnplacedLineage; }, { touch: false, reason: "tree-unplaced-lineage" });
      unplacedLineageToggle.setAttribute("aria-pressed", String(!state().ui.hideUnplacedLineage));
      const showingUnplacedLineage = !state().ui.hideUnplacedLineage;
      treeNeedsFit = !showingUnplacedLineage;
      renderTree();
      if (showingUnplacedLineage) requestAnimationFrame(centerUnplacedLineage);
      return;
    }
    if (target.closest("#firstImportButton")) { $("#onboardingImportInput").click(); return; }
    if (target.closest("[data-close-profile]")) {
      const previousId = state().ui.selectedPersonId;
      storage.mutate(function (next) {
        next.ui.selectedPersonId = "";
        next.ui.profileCollapsed = true;
        if (next.ui.mobileView === "profile") next.ui.mobileView = "tree";
      }, { touch: false, reason: "deselect-person" });
      treeNeedsFit = false;
      renderWorkspace();
      requestAnimationFrame(function () { $('[data-tree-person="' + previousId + '"]')?.focus(); });
      announce("Closed the selected person.");
      return;
    }
    const letterButton = target.closest("[data-directory-letter]");
    if (letterButton) {
      const list = $("#directoryList");
      const heading = $("#directory-letter-" + letterButton.dataset.directoryLetter);
      if (list && heading) list.scrollTo({ top: Math.max(0, heading.offsetTop - 4), behavior: document.documentElement.dataset.motion === "reduce" ? "auto" : "smooth" });
      return;
    }
    const paneButton = target.closest("[data-toggle-pane]");
    if (paneButton) {
      const pane = paneButton.dataset.togglePane;
      const key = pane === "directory" ? "directoryCollapsed" : "profileCollapsed";
      const willCollapse = !state().ui[key];
      storage.mutate(function (next) {
        next.ui[key] = willCollapse;
        if (willCollapse && pane === "directory" && next.ui.mobileView === "directory") next.ui.mobileView = "tree";
        if (willCollapse && pane === "profile" && next.ui.mobileView === "profile") next.ui.mobileView = "tree";
      }, { touch: false, reason: "pane-visibility" });
      treeNeedsFit = true;
      renderHeader();
      renderWorkspace();
      requestAnimationFrame(function () {
        const focusTarget = willCollapse ? (pane === "directory" ? $("#directoryButton") : $('[data-toggle-pane="profile"]')) : (pane === "directory" ? $("#directorySearch") : $("#profilePanel .profile-header h2"));
        focusTarget?.focus();
        fitTree();
      });
      announce((willCollapse ? "Collapsed " : "Expanded ") + (pane === "directory" ? "the list." : "the selected person panel."));
      return;
    }
    const select = target.closest("[data-select-person], [data-tree-person]");
    if (select) {
      const searchedDirectoryResult = select.classList.contains("directory-person") && Boolean(state().ui.directorySearch.trim());
      selectPerson(select.dataset.selectPerson || select.dataset.treePerson, { focus: true, mobileProfile: true, focusMode: searchedDirectoryResult });
      return;
    }
    if (target.closest("[data-add-person]")) { pendingRelative = null; openPersonEditor("", target.closest("[data-add-person]")); return; }
    const editPerson = target.closest("[data-edit-person]");
    if (editPerson) { pendingRelative = null; openPersonEditor(editPerson.dataset.editPerson, editPerson); return; }
    const addRelativeButton = target.closest("[data-add-relative]");
    if (addRelativeButton) { addRelative(addRelativeButton.dataset.addRelative, addRelativeButton); return; }
    const addRelationshipButton = target.closest("[data-add-relationship]");
    if (addRelationshipButton) { openRelationshipEditor("", addRelationshipButton.dataset.addRelationship, addRelationshipButton); return; }
    const editRelationshipButton = target.closest("[data-edit-relationship]");
    if (editRelationshipButton) { openRelationshipEditor(editRelationshipButton.dataset.editRelationship, "", editRelationshipButton); return; }
    const deleteRelationshipButton = target.closest("[data-delete-relationship]");
    if (deleteRelationshipButton) { deleteRelationship(deleteRelationshipButton.dataset.deleteRelationship, deleteRelationshipButton); return; }
    const deletePersonButton = target.closest("[data-delete-person]");
    if (deletePersonButton) { deletePerson(deletePersonButton.dataset.deletePerson, deletePersonButton); return; }
    const setHomeButton = target.closest("[data-set-home]");
    if (setHomeButton) { setHomePerson(setHomeButton.dataset.setHome); return; }
    const mobileButton = target.closest("button[data-mobile-view]");
    if (mobileButton) {
      storage.mutate(function (next) {
        next.ui.mobileView = mobileButton.dataset.mobileView;
        if (next.ui.mobileView === "directory") next.ui.directoryCollapsed = false;
        if (next.ui.mobileView === "profile") next.ui.profileCollapsed = false;
      }, { touch: false, reason: "mobile-view" });
      renderHeader();
      renderWorkspace();
      return;
    }
    const modeButton = target.closest("[data-tree-mode]");
    if (modeButton) {
      storage.mutate(function (next) {
        next.ui.treeMode = modeButton.dataset.treeMode;
        if (next.ui.treeMode === "overview") {
          next.ui.selectedPersonId = "";
          next.ui.profileCollapsed = true;
          if (next.ui.mobileView === "profile") next.ui.mobileView = "tree";
        }
      }, { touch: false, reason: "tree-mode" });
      treeNeedsFit = true;
      renderHeader();
      renderWorkspace();
      if (state().ui.treeMode === "overview") announce("Showing the full tree. Selected person closed.");
      return;
    }
    const nodeViewButton = target.closest("[data-tree-node-view]");
    if (nodeViewButton) { storage.mutate(function (next) { next.ui.treeNodeView = nodeViewButton.dataset.treeNodeView; }, { touch: false, reason: "tree-node-view" }); treeNeedsFit = true; renderWorkspace(); return; }
    const nameBasisButton = target.closest("[data-tree-name-basis]");
    if (nameBasisButton) { storage.mutate(function (next) { next.ui.treeNameBasis = nameBasisButton.dataset.treeNameBasis; }, { touch: false, reason: "tree-name-basis" }); treeNeedsFit = true; renderWorkspace(); return; }
    const nameLengthButton = target.closest("[data-tree-name-length]");
    if (nameLengthButton) { storage.mutate(function (next) { next.ui.treeNameLength = nameLengthButton.dataset.treeNameLength; }, { touch: false, reason: "tree-name-length" }); treeNeedsFit = true; renderWorkspace(); return; }
    const zoomStepButton = target.closest("[data-zoom-step]");
    if (zoomStepButton) {
      const input = $("#zoomValue");
      input.value = String(Math.round(treeTransform.scale * 100) + Number(zoomStepButton.dataset.zoomStep));
      updateTreeZoomControl(input, true);
      return;
    }
    const zoomButton = target.closest("[data-zoom]");
    if (zoomButton) { treeSurfaceMode = "natural"; treeTransform.scale = u.clamp(treeTransform.scale * (zoomButton.dataset.zoom === "in" ? 1.2 : 0.833), 0.01, 2.5, treeTransform.scale); applyTreeTransform(); return; }
    if (target.closest("[data-fit-tree]")) { fitTree(); return; }
    if (target.closest("[data-clear-directory]")) { storage.mutate(function (next) { next.ui.directorySearch = ""; next.ui.directoryFilters = []; }, { touch: false, reason: "directory-filter" }); renderWorkspace(); return; }
    if (target.closest("[data-print-atlas]")) printAtlas(target.closest("[data-print-atlas]"));
  }

  function bindSupportEvents() {
    const dialog = $("#supportDialog");
    dialog.addEventListener("click", function (event) {
      const tab = event.target.closest("[data-support-tab]");
      if (tab) { switchSupportTab(tab.dataset.supportTab); return; }
      const mode = event.target.closest("[data-theme-mode]");
      if (mode) { storage.mutate(function (next) { next.preferences.appearance.mode = mode.dataset.themeMode; }, { reason: "appearance" }); applyAppearance(); renderSettings(); return; }
      const style = event.target.closest("[data-button-style]");
      if (style) { storage.mutate(function (next) { next.preferences.controls.buttonStyle = style.dataset.buttonStyle; }, { reason: "button-style" }); applyAppearance(); renderSettings(); return; }
      const versionButton = event.target.closest("[data-version-view]");
      if (versionButton) { versionView = versionButton.dataset.versionView; renderReleases(); }
    });
    dialog.addEventListener("keydown", function (event) { const tab = event.target.closest("[role='tab']"); if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const tabs = $$('[data-support-tab]:not([hidden])'); const index = tabs.indexOf(tab); const destination = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]; destination.focus(); switchSupportTab(destination.dataset.supportTab); });
    $("#appTextScale").addEventListener("input", function (event) { storage.mutate(function (next) { const scale = Number(event.target.value) / 100; next.preferences.appearance.textScale = scale; next.preferences.appearance.readingScale = scale; }, { reason: "appearance" }); applyAppearance(); $("#appTextScaleValue").textContent = event.target.value + "%"; });
    $("#exportButton").addEventListener("click", portability.exportPackage);
    $("#importButton").addEventListener("click", function () { $("#importFileInput").click(); });
    $("#resetPreferencesButton").addEventListener("click", resetPreferences);
    $("#helpSearch").addEventListener("input", renderHelp);
    $("#supportRoadmapSearch").addEventListener("input", function (event) { storage.mutate(function (next) { next.modules.roadmap.search = u.cleanLine(event.target.value, 200); }, { touch: false, reason: "roadmap-filter" }); renderSupportRoadmap(); });
    $("#supportRoadmapState").addEventListener("change", function (event) { storage.mutate(function (next) { next.modules.roadmap.state = event.target.value; }, { touch: false, reason: "roadmap-filter" }); renderSupportRoadmap(); });
    $("#supportRoadmapSort").addEventListener("change", function (event) { storage.mutate(function (next) { next.modules.roadmap.sortBy = event.target.value; }, { touch: false, reason: "roadmap-sort" }); renderSupportRoadmap(); });
    $("#restoreRecoveryButton").addEventListener("click", restoreRecovery);
    $("#saveRecoveryButton").addEventListener("click", saveRecoveryCopy);
    $("#saveFavoritesButton").addEventListener("click", saveFavoritesFile);
    $("#restoreFavoritesButton").addEventListener("click", function () { if (adminFavoritesRestoreEnabled()) $("#restoreFavoritesInput").click(); });
    $("#restoreFavoritesInput").addEventListener("change", function (event) {
      restoreFavoritesFile(event.target.files && event.target.files[0]);
      event.target.value = "";
    });
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
    const treeNode = event.target.closest && event.target.closest("[data-tree-person]");
    if (treeNode && ["Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Enter" || event.key === " ") selectPerson(treeNode.dataset.treePerson, { focus: true, mobileProfile: true });
      else { const relative = relativeForArrow(treeNode.dataset.treePerson, event.key); if (relative) selectPerson(relative.id, { focus: true, mobileProfile: true }); }
      return;
    }
    if (event.key === "Escape") {
      const directoryFilter = $(".directory-filter-menu[open]");
      if (directoryFilter) { directoryFilter.removeAttribute("open"); directoryFilter.querySelector("summary")?.focus(); return; }
      $("#globalSearchResults").hidden = true;
      return;
    }
    if (u.isEditableTarget(event.target) || event.metaKey) return;
    if (event.code === "Slash") { event.preventDefault(); if (event.shiftKey) openSupport("help", event.target); else if (initialized()) { $("#globalSearch").focus(); $("#globalSearch").select(); } return; }
    if (event.repeat || !initialized()) return;
    if (event.key === "|" && config.features.developerTools) { event.preventDefault(); toggleDeveloperMode(); }
    else if (event.code === "KeyA" && familyEditingEnabled()) { event.preventDefault(); pendingRelative = null; openPersonEditor("", event.target); }
    else if (event.code === "KeyP" && familyEditingEnabled()) { event.preventDefault(); printAtlas(); }
    else if (event.code === "KeyD") { event.preventDefault(); $("#directoryButton").click(); }
    else if (event.code === "KeyF") { event.preventDefault(); $("#favoritesButton").click(); }
    else if (event.code === "KeyK") {
      const key = $(".tree-key details");
      if (key) { event.preventDefault(); key.open = !key.open; announce(key.open ? "Opened the Family Tree key." : "Closed the Family Tree key."); }
    }
    else if (event.code === "KeyV") { event.preventDefault(); openSupport("releases", event.target); }
    else if (event.code === "KeyW" && rolePreviewAvailable()) { event.preventDefault(); openRolePreviewMenu($("#accessModePill")); }
    else if (event.code === "KeyX") {
      const toast = $("#appToast");
      const updateVisible = !toast.hidden && $("[data-toast-title]", toast).textContent === "New version available";
      if (updateVisible) { event.preventDefault(); components.hideToast(); }
    }
    else if (event.code === "KeyR") {
      const toast = $("#appToast");
      const action = $("[data-toast-action]", toast);
      if (!toast.hidden && $("[data-toast-title]", toast).textContent === "New version available" && !action.hidden) { event.preventDefault(); action.click(); }
    }
    else if (event.code === "KeyE" && App.cloud.canPublish()) { event.preventDefault(); App.cloud.open(); }
    else if (event.code === "KeyT") { event.preventDefault(); toggleThemeFromAppIcon(); }
  }

  function bindGeneralEvents() {
    bindAppIconGestures();
    $("#versionButton").addEventListener("click", function (event) { openSupport("releases", event.currentTarget); });
    $("#accessModePill").addEventListener("click", function (event) { openRolePreviewMenu(event.currentTarget); });
    $("#directoryButton").addEventListener("click", function () {
      const mobile = window.matchMedia("(max-width: 699px)").matches;
      const directoryIsOpen = !state().ui.directoryCollapsed && (!mobile || state().ui.mobileView === "directory");
      const willOpen = !directoryIsOpen;
      storage.mutate(function (next) {
        next.ui.directoryCollapsed = !willOpen;
        if (mobile) next.ui.mobileView = willOpen ? "directory" : "tree";
      }, { touch: false, reason: "directory-toggle" });
      treeNeedsFit = true;
      renderHeader();
      renderWorkspace();
      requestAnimationFrame(function () {
        (willOpen ? $("#directorySearch") : $("#familyTreeSvg"))?.focus();
        fitTree();
      });
      announce(willOpen ? "Opened the list." : "Closed the list.");
    });
    $("#favoritesButton").addEventListener("click", function () {
      favoritesPreviewOpen = !favoritesPreviewOpen;
      if (favoritesPreviewOpen) {
        $("#globalSearch").focus();
        renderGlobalSearchResults();
      } else {
        $("#globalSearchResults").hidden = true;
        $("#globalSearch").setAttribute("aria-expanded", "false");
        this.setAttribute("aria-expanded", "false");
      }
      renderHeader();
    });
    $("#restoreFavoritesHeaderButton").addEventListener("click", function () {
      if (!adminFavoritesRestoreEnabled()) return;
      favoritesPreviewOpen = false;
      renderHeader();
      $("#restoreFavoritesInput").click();
    });
    $("#supportButton").addEventListener("click", function (event) { openSupport(state().ui.supportTab, event.currentTarget); });
    $("#addPersonButton").addEventListener("click", function (event) { pendingRelative = null; openPersonEditor("", event.currentTarget); });
    $("#printButton").addEventListener("click", printAtlas);
    $("#labelsButton").addEventListener("click", printMailingLabels);
    $("#directoryCsvButton").addEventListener("click", exportMailingCsv);
    $("#printPreviewDialog").addEventListener("close", function () { $("#printPreviewContent").replaceChildren(); });
    $("#mainContent").addEventListener("click", handleMainClick);
    $("#mainContent").addEventListener("change", function (event) {
      if (event.target.id === "onboardingImportInput") { portability.previewFile(event.target.files && event.target.files[0], $("#firstImportButton")); event.target.value = ""; }
      else if (event.target.name === "directoryFilter") {
        const selectedFilters = $$("input[name='directoryFilter']:checked").map(function (input) { return input.value; });
        storage.mutate(function (next) { next.ui.directoryFilters = selectedFilters; }, { touch: false, reason: "directory-filter" });
        renderDirectoryList();
      }
      else if (event.target.id === "directorySort") { storage.mutate(function (next) { next.ui.directorySort = event.target.value; }, { touch: false, reason: "directory-sort" }); renderDirectoryList(); }
      else if (event.target.id === "ancestorDepth" || event.target.id === "descendantDepth") {
        updateTreeDepthControl(event.target, true);
      }
      else if (event.target.id === "zoomValue") {
        updateTreeZoomControl(event.target, true);
      }
    });
    $("#mainContent").addEventListener("input", function (event) {
      if (event.target.id === "directorySearch") { storage.mutate(function (next) { next.ui.directorySearch = u.cleanLine(event.target.value, 200); }, { touch: false, reason: "directory-filter" }); renderDirectoryList(); }
      else if (event.target.id === "ancestorDepth" || event.target.id === "descendantDepth") updateTreeDepthControl(event.target, false);
      else if (event.target.id === "zoomValue") updateTreeZoomControl(event.target, false);
    });
    $("#personForm").addEventListener("submit", savePerson);
    $("#relationshipForm").addEventListener("submit", saveRelationship);
    $("#relationshipType").addEventListener("change", updateRelationshipFormType);
    $("#relationshipForm").addEventListener("change", function (event) {
      if (["relationPerson1", "relationPerson2", "parentLineage", "parentKind"].includes(event.target.id)) updateRelationshipLineagePreview();
    });
    $("#relationshipForm").addEventListener("input", function (event) {
      if (event.target.matches("[data-date-input]") && validateDateInputControl(event.target)) $("#relationshipFormError").hidden = true;
    });
    $("#personDialog").addEventListener("input", function (event) {
      if (event.target.matches("[data-phone-input]")) formatPhoneInput(event.target);
      if (event.target.matches("[data-new-person-relationship-search]")) filterNewPersonRelationshipPicker(event.target);
      const birthName = /^birthName(Prefix|First|Middle|Last|Suffix)$/.exec(event.target.id);
      if (birthName) syncBirthNamePart(birthName[1]);
      const derivedName = /^(current|preferred)Name(Prefix|First|Middle|Last|Suffix)$/.exec(event.target.id);
      if (derivedName) {
        personNameOverrides.add(event.target.id);
        if (derivedName[1] === "current") syncCurrentNamePart(derivedName[2]);
      }
      if (event.target.matches("[data-date-input]")) {
        const valid = validateDateInputControl(event.target);
        if (event.target.id === "deathDate" && valid && event.target.value.trim()) $("#livingStatus").value = "deceased";
      }
      if (event.target.matches("[data-new-person-relationship]")) updateNewPersonRelationshipCounts();
      if (event.target.matches("[data-new-partner-status], [data-new-partner-start-date], [data-new-partner-end-date]")) validateNewPartnerRow(event.target.closest("[data-new-person-relationship-row]"));
      if (updatePersonFormValidity()) $("#personFormError").hidden = true;
    });
    $("#personDialog").addEventListener("click", function (event) {
      if (event.target.closest("[data-add-address]")) { syncPersonRepeatables(); personDraft.addresses.push({ id: u.uid("address"), label: "Home", current: true, startDate: { value: "", qualifier: "exact" }, endDate: { value: "", qualifier: "exact" }, order: personDraft.addresses.length }); renderPersonRepeatables(); updatePersonFormValidity(); }
      if (event.target.closest("[data-add-phone]")) { syncPersonRepeatables(); personDraft.phones.push({ id: u.uid("phone"), label: "Mobile", value: "", order: personDraft.phones.length }); renderPersonRepeatables(); updatePersonFormValidity(); }
      if (event.target.closest("[data-add-email]")) { syncPersonRepeatables(); personDraft.emails.push({ id: u.uid("email"), label: "Personal", value: "", order: personDraft.emails.length }); renderPersonRepeatables(); updatePersonFormValidity(); }
      const removeAddress = event.target.closest("[data-remove-address]");
      if (removeAddress) { syncPersonRepeatables(); personDraft.addresses.splice(Number(removeAddress.dataset.removeAddress), 1); renderPersonRepeatables(); updatePersonFormValidity(); }
      const removeContact = event.target.closest("[data-remove-contact]");
      if (removeContact) { syncPersonRepeatables(); const parts = removeContact.dataset.removeContact.split(":"); personDraft[parts[0] + "s"].splice(Number(parts[1]), 1); renderPersonRepeatables(); updatePersonFormValidity(); }
    });
    document.addEventListener("click", function (event) {
      const action = event.target.closest("[data-action]");
      if (action && action.dataset.action === "clear-help-search") { $("#helpSearch").value = ""; renderHelp(); }
      const safeLink = event.target.closest("[data-open-url]");
      if (safeLink && !u.safeExternalOpen(safeLink.dataset.openUrl)) components.toast("That external address is not allowed.", { title: "Link unavailable", kind: "warning" });
    });
    $("#globalSearch").addEventListener("input", function (event) { const favoritesWereOpen = favoritesPreviewOpen; favoritesPreviewOpen = false; storage.mutate(function (next) { next.ui.search = u.cleanLine(event.target.value, 200); }, { touch: false, reason: "global-search" }); if (favoritesWereOpen) renderHeader(); renderGlobalSearchResults(); });
    $("#globalSearch").addEventListener("focus", renderGlobalSearchResults);
    $("#globalSearch").addEventListener("keydown", function (event) { const results = $$(".global-search-result-main", $("#globalSearchResults")); if (event.key === "ArrowDown" && results.length) { event.preventDefault(); results[0].focus(); } if (event.key === "Escape") { const favoritesWereOpen = favoritesPreviewOpen; favoritesPreviewOpen = false; $("#globalSearchResults").hidden = true; event.target.setAttribute("aria-expanded", "false"); $("#favoritesButton").setAttribute("aria-expanded", "false"); if (favoritesWereOpen) renderHeader(); event.target.select(); } });
    $("#globalSearchResults").addEventListener("click", function (event) { const favorite = event.target.closest("[data-toggle-favorite]"); if (favorite) { toggleFavoritePerson(favorite.dataset.toggleFavorite, favorite); return; } const result = event.target.closest("[data-search-type]"); if (result) activateGlobalSearchResult(result.dataset.searchType, result.dataset.searchId); });
    $("#globalSearchResults").addEventListener("keydown", function (event) { const button = event.target.closest(".global-search-result-main"); const buttons = $$(".global-search-result-main", event.currentTarget); if (button && (event.key === "ArrowDown" || event.key === "ArrowUp")) { event.preventDefault(); const index = buttons.indexOf(button); buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); } else if (event.key === "Escape") { event.preventDefault(); const favoritesWereOpen = favoritesPreviewOpen; favoritesPreviewOpen = false; $("#globalSearch").focus(); $("#globalSearchResults").hidden = true; $("#globalSearch").setAttribute("aria-expanded", "false"); $("#favoritesButton").setAttribute("aria-expanded", "false"); if (favoritesWereOpen) renderHeader(); } });
    document.addEventListener("focusin", function (event) { if (!event.target.closest(".global-search-wrap") && !event.target.closest("#favoritesButton")) { const favoritesWereOpen = favoritesPreviewOpen; favoritesPreviewOpen = false; $("#globalSearchResults").hidden = true; $("#globalSearch").setAttribute("aria-expanded", "false"); $("#favoritesButton").setAttribute("aria-expanded", "false"); if (favoritesWereOpen) renderHeader(); } });
    bindSupportEvents();
    document.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("keyup", function (event) { updateShortcutHints(event, false); });
    window.addEventListener("blur", function () { updateShortcutHints({ altKey: false, shiftKey: false, ctrlKey: false }, true); });
    window.addEventListener("afterprint", clearPrintMode);
  }

  function renderAll() {
    applyAppearance();
    renderHeader();
    renderMain();
    renderGlobalSearchResults();
    if ($("#supportDialog").open && initialized()) renderSupport();
  }

  function bindRuntimeEvents() {
    window.addEventListener("app:storageerror", function (event) { components.toast(event.detail.message, { title: event.detail.title, kind: "danger", duration: 0, actionLabel: initialized() && familyEditingEnabled() ? "Recovery ZIP" : "", onAction: initialized() && familyEditingEnabled() ? portability.exportCsv : null }); renderLocalStatus(); });
    window.addEventListener("app:statesaved", renderLocalStatus);
    window.addEventListener("app:pwaerror", function (event) { components.toast(event.detail.message, { title: "Offline support unavailable", kind: "warning", duration: 5000 }); });
    window.addEventListener("app:statechange", function (event) { if (["import", "recovery", "reset-preferences"].includes(event.detail.reason)) { treeNeedsFit = true; renderAll(); } });
    window.addEventListener("resize", u.debounce(function () { if (initialized() && currentTreeLayout) { if (treeSurfaceMode === "fit") fitTree(); else sizeTreeSurface(); } if ($("#developerPanel") && !$("#developerPanel").hidden) renderDeveloper(); }, 120));
    ["(prefers-color-scheme: dark)", "(prefers-reduced-motion: reduce)"].forEach(function (query) { const media = window.matchMedia(query); if (typeof media.addEventListener === "function") media.addEventListener("change", applyAppearance); else if (typeof media.addListener === "function") media.addListener(applyAppearance); });
  }

  function showLoadReport() {
    const report = storage.getLoadReport();
    if (report.recovered) components.toast("The saved state was unusable, so the last valid recovery copy was loaded.", { title: "Recovery copy restored", kind: "warning", duration: 6000 });
    else if (report.error && report.source === "default") components.toast("Saved data could not be read. McFamily returned to the private import screen.", { title: "Import required", kind: "warning", duration: 6000 });
  }

  async function init() {
    storage.load();
    applyIdentity();
    components.init();
    portability.init();
    bindRuntimeEvents();
    pwa.init();
    await App.cloud.init();
    bindGeneralEvents();
    renderAll();
    requestAnimationFrame(function () { document.documentElement.classList.add("app-ready"); });
    showLoadReport();
  }

  App.application = { render: renderAll, openSupport: openSupport, printAtlas: printAtlas, shortcuts: SHORTCUTS };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
