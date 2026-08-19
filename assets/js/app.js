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

  const SHORTCUTS = [
    { keys: "/", label: "Focus global search", group: "Global" },
    { keys: "Esc", label: "Close a dialog or menu", group: "Global" },
    { keys: "?", label: "Open Help Center", group: "Global" },
    { keys: "P", label: "Print or save the family atlas as PDF", group: "Family" },
    { keys: "N", label: "Open Notes", group: "Actions" },
    { keys: "V", label: "Open What’s New", group: "Actions" },
    { keys: "E", label: "Export a private CSV backup", group: "Actions" },
    { keys: "T", label: "Switch color theme", group: "Actions" },
    { keys: "D", label: "Toggle hidden Developer Mode", group: "Developer" },
    { keys: "Arrow keys", label: "Move through tree relatives, tabs, menus, and choices", group: "Navigation" }
  ];

  function state() {
    return storage.getState();
  }

  function initialized() {
    return Boolean(state().workspace.family.initializedAt);
  }

  function familyEditingEnabled() {
    return config.features.familyEditing !== false;
  }

  function developerReferencesEnabled() {
    return Boolean(config.features.developerTools && state().preferences.controls.developerMode);
  }

  function mutationDisabledAttributes() {
    return familyEditingEnabled() ? "" : ' disabled aria-disabled="true" title="Family editing is paused while McFamily is being built"';
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
    root.style.setProperty("--reading-scale", String(appearance.readingScale));
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
    $("#appIconButton").setAttribute("aria-label", "Switch to " + nextTheme + " theme. Press and hold to toggle Developer Mode");
    $("#appIconButton").title = "Switch to " + nextTheme + " theme · Press and hold for Developer Mode";
    pwa.applyAppearanceAssets?.();
  }

  function isBetaDeploy() {
    const path = (location.pathname || "").toLowerCase();
    if (/\/beta(\/|$)/.test(path)) return true;
    const beta = new URLSearchParams(location.search || "").get("beta");
    return beta === "1" || beta === "true";
  }

  function renderHeader() {
    const isInitialized = initialized();
    document.body.dataset.onboarding = isInitialized ? "false" : "true";
    const developerMode = developerReferencesEnabled();
    const versionButton = $("#versionButton");
    versionButton.textContent = "v" + config.identity.version + (developerMode ? " DEV" : "");
    versionButton.dataset.developer = developerMode ? "true" : "false";
    versionButton.setAttribute("aria-label", "Open release notes for version " + config.identity.version + (developerMode ? ". Developer Mode is enabled" : ""));
    $("#betaPill").hidden = !isBetaDeploy();
    document.documentElement.dataset.developer = developerMode ? "on" : "off";
    setInputValue($("#globalSearch"), state().ui.search);
    ["#printButton", "#notesButton", "#supportButton"].forEach(function (selector) { $(selector).disabled = !isInitialized; });
    $("#addPersonButton").disabled = !isInitialized || !familyEditingEnabled();
    $("#directoryButton").disabled = !isInitialized;
    $("#directoryButton").setAttribute("aria-pressed", String(isInitialized && !state().ui.directoryCollapsed));
    $("#globalSearch").disabled = !isInitialized;
    renderLocalStatus();
    const latest = config.releases[0];
    const unread = isInitialized && latest && state().ui.seenReleaseVersion !== latest.version;
    $("#releaseUnreadDot").hidden = !unread;
    const banner = $("#whatsNewBanner");
    banner.hidden = !unread;
    if (unread) {
      $("[data-whats-new-version]").textContent = "v" + latest.version;
      $("[data-whats-new-title]").textContent = latest.title;
      $("[data-whats-new-summary]").textContent = latest.summary;
    }
    const hint = $("#contextHint");
    hint.hidden = !isInitialized || !config.features.hints || !state().preferences.hints.enabled || state().preferences.hints.dismissed.includes("workspace-basics");
  }

  function renderLocalStatus() {
    const button = $("#floatingStatusButton");
    const available = storage.isPersistent();
    button.dataset.storageState = available ? "saved" : "error";
    button.disabled = !initialized();
    $("[data-floating-local-label]").textContent = available ? "Saved locally" : "Storage unavailable";
    $("[data-floating-backup-label]").textContent = initialized() ? state().workspace.people.length + " people · export backup" : "Import required";
    $("[data-floating-status-icon]").innerHTML = icons.markup(available ? "check" : "close");
    button.title = available ? "Saved only in this browser. Open private CSV settings." : "Browser storage is unavailable. Export a private CSV.";
    button.setAttribute("aria-label", button.title);
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
      documentItem.html = documentHtml(normalized);
      documentItem.updatedAt = u.isoNow();
    }, { reason: "edit-document" });
    $("[data-floating-local-label]").textContent = "Saving locally…";
    renderGlobalSearchResults();
  }

  function openNotes(trigger) {
    if (!initialized()) return;
    renderNotesEditor();
    components.openDialog("#notesDialog", { trigger: trigger, focus: "#notesTextarea" });
  }

  function renderOnboarding() {
    const icon = document.documentElement.dataset.theme === "dark" ? config.identity.assets.appIconDark : config.identity.assets.appIconLight;
    $("#mainContent").innerHTML = '<section class="onboarding-screen" aria-labelledby="onboardingTitle"><div class="onboarding-card"><img src="' + u.escapeHtml(versionedAsset(icon)) + '" alt="" class="onboarding-icon"><span class="eyebrow">Private local family atlas</span><h1 id="onboardingTitle">Open McFamily</h1><p>Choose the cleaned McLineage CSV for the initial load, or a native McFamily CSV exported by this app. McFamily maps and validates people, relationships, source fields, and ancestry before storing a private copy in this browser.</p><div class="privacy-callout"><strong>This is not a login.</strong><span>The import gate controls first-run setup only. The static GitHub Pages app cannot authenticate users or revoke access.</span></div><button id="firstImportButton" type="button" class="button primary large-button">Choose family CSV</button><input id="onboardingImportInput" type="file" accept="text/csv,.csv" data-import-file-input hidden><small>No demo family, blank-family option, JSON/GEDCOM import, cloud sync, or bypass is available.</small></div></section>';
    icons.mount($("#mainContent"));
  }

  function directoryPeople() {
    const query = state().ui.directorySearch.trim();
    const filter = state().ui.livingFilter;
    const sortMode = state().ui.directorySort;
    return state().workspace.people.filter(function (person) {
      return (filter === "all" || person.livingStatus === filter) && model.fuzzySearchMatch(query, model.personSearchText(person));
    }).sort(function (a, b) { return directorySortName(a, sortMode).localeCompare(directorySortName(b, sortMode)) || a.id.localeCompare(b.id); });
  }

  function directorySortName(person, mode) {
    const names = person.names || {};
    const first = names.preferred || names.given || names.display || "";
    const last = names.family || names.birth || "";
    return (mode === "last" ? [last, first, names.middle] : [first, names.middle, last]).filter(Boolean).join(", ").toLowerCase();
  }

  function directoryLetter(person) {
    const names = person.names || {};
    const value = state().ui.directorySort === "last" ? (names.family || names.birth || names.preferred || names.given) : (names.preferred || names.given || names.display || names.family);
    const letter = String(value || "#").slice(0, 1).toUpperCase();
    return /^[A-Z]$/.test(letter) ? letter : "#";
  }

  function eventYear(event) {
    const match = String(event && event.date && event.date.value || "").match(/^\d{4}/);
    return match ? match[0] : "????";
  }

  function directoryPersonMeta(person) {
    const years = "[" + eventYear(person.birth) + "-" + eventYear(person.death) + "]";
    const sourceId = lineageId(person).join(".") || "No lineage ID";
    return [years, sourceId].concat(developerReferencesEnabled() ? [person.reference] : []).join(" · ");
  }

  function renderDirectoryList() {
    const container = $("#directoryList");
    if (!container) return;
    const people = directoryPeople();
    $("#directoryCount").textContent = people.length + " of " + state().workspace.people.length;
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
    }).join("") : '<div class="empty-state compact-empty"><h3>No people match</h3><p>Try another name, contact detail, or living-status filter.</p><button type="button" class="button" data-clear-directory>Clear directory filters</button></div>';
  }

  function formatEvent(label, event) {
    if (!event) return "";
    const date = model.formatFlexibleDate(event.date);
    if (!date && !event.place) return "";
    return '<div><dt>' + label + '</dt><dd>' + u.escapeHtml([date, event.place].filter(Boolean).join(" · ")) + "</dd></div>";
  }

  function relationshipLabel(relationship, personId, other) {
    if (relationship.type === "parent-child") {
      const type = config.parentKinds.find(function (item) { return item.id === relationship.kind; });
      return personId === relationship.parentId ? "Child" : (type ? type.label : "Parent");
    }
    const status = config.partnerStatuses.find(function (item) { return item.id === relationship.status; });
    return status ? status.label : "Partners";
  }

  function relationshipMeta(relationship) {
    const dates = [model.formatFlexibleDate(relationship.startDate), model.formatFlexibleDate(relationship.endDate)].filter(Boolean).join(" – ");
    return [dates, relationship.place, relationship.notes].filter(Boolean).join(" · ");
  }

  function relationshipDescription(edge) {
    const first = model.displayName(edge.from.person);
    const second = model.displayName(edge.to.person);
    if (edge.relationship.type === "parent-child") {
      const kind = config.parentKinds.find(function (item) { return item.id === edge.relationship.kind; });
      return first + " is " + (kind ? kind.label.toLowerCase() : "a parent") + " of " + second + (relationshipMeta(edge.relationship) ? ". " + relationshipMeta(edge.relationship) : "");
    }
    const status = config.partnerStatuses.find(function (item) { return item.id === edge.relationship.status; });
    return first + " and " + second + ": " + (status ? status.label : "Partners") + (relationshipMeta(edge.relationship) ? ". " + relationshipMeta(edge.relationship) : "");
  }

  function relationshipYear(date) {
    const match = String(date && date.value || "").match(/^\d{4}/);
    return match ? Number(match[0]) : 0;
  }

  function partnerCouldBeParent(relationship, child) {
    const birthYear = relationshipYear(child.birth && child.birth.date);
    if (!birthYear) return true;
    const startYear = relationshipYear(relationship.startDate);
    const endYear = relationshipYear(relationship.endDate);
    return (!startYear || startYear <= birthYear) && (!endYear || endYear >= birthYear);
  }

  function relationshipNameList(people, emptyText) {
    const unique = Array.from(new Map(people.filter(Boolean).map(function (person) { return [person.id, person]; })).values()).sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)); });
    return unique.length ? unique.map(function (other) {
      return '<button type="button" class="relationship-name" data-select-person="' + u.escapeHtml(other.id) + '">' + u.escapeHtml(model.displayName(other)) + "</button>";
    }).join("") : '<span class="relationship-empty">' + u.escapeHtml(emptyText) + "</span>";
  }

  function relationshipGroup(label, people, emptyText) {
    const count = new Set(people.filter(Boolean).map(function (person) { return person.id; })).size;
    return '<details class="relationship-group" open><summary><span>' + u.escapeHtml(label) + '</span><span class="count-pill">' + count + '</span></summary><div class="relationship-names">' + relationshipNameList(people, emptyText) + "</div></details>";
  }

  function expandedParentEntries(person, groups, graph) {
    const parents = groups.parents.slice();
    const parentIds = new Set(parents.map(function (entry) { return entry.person.id; }));
    groups.parents.forEach(function (entry) {
      (graph.partners.get(entry.person.id) || []).forEach(function (partnerEntry) {
        if (!partnerEntry.person || partnerEntry.person.id === person.id || parentIds.has(partnerEntry.person.id) || !partnerCouldBeParent(partnerEntry.relationship, person)) return;
        parentIds.add(partnerEntry.person.id);
        parents.push({ person: partnerEntry.person, relationship: null });
      });
    });
    return parents;
  }

  function relationshipRows(person) {
    const graph = family.indexes(state());
    const groups = family.relationGroups(person.id, state());
    const parents = expandedParentEntries(person, groups, graph).map(function (entry) { return entry.person; });
    return relationshipGroup("Parents", parents, "No parents recorded")
      + relationshipGroup("Partners", groups.partners.map(function (entry) { return entry.person; }), "No partners recorded")
      + relationshipGroup("Siblings", groups.siblings, "No siblings recorded")
      + relationshipGroup("Children", groups.children.map(function (entry) { return entry.person; }), "No children recorded");
  }

  function sourceEntries(source) {
    return Object.entries(u.plainObject(source && source.fields)).filter(function (entry) { return String(entry[1] || "").trim(); });
  }

  function sourceLabel(key) {
    return String(key || "").replace(/_/g, " ").replace(/\b\w/g, function (character) { return character.toUpperCase(); });
  }

  function sourceField(person, key) {
    return u.cleanLine(person && person.source && person.source.fields && person.source.fields[key], 4000);
  }

  function lineageId(person) {
    const raw = sourceField(person, "lineage_id");
    if (!raw) return [];
    return raw.split(".").map(function (part) { return u.cleanLine(part, 20); }).filter(Boolean).map(function (part) {
      return /^\d+$/.test(part) ? String(Number(part)).padStart(2, "0") : part.padStart(2, "0");
    });
  }

  function sourceBirthYear(person) {
    const match = String(person && person.birth && person.birth.date && person.birth.date.value || "").match(/^\d{4}/);
    return match ? Number(match[0]) : -1;
  }

  function sourceNameMatches(person, name) {
    const expected = model.normalizeSearchText(name);
    const given = model.normalizeSearchText(sourceField(person, "descendant_first_names") || person.names.given);
    const display = model.normalizeSearchText(model.displayName(person));
    return Boolean(expected && (given === expected || display === expected || given.startsWith(expected + " ") || display.startsWith(expected + " ")));
  }

  function ordinalLineageNumber(value) {
    if (!/^\d+$/.test(String(value || "")) || Number(value) < 1) return "";
    const number = Number(value);
    const lastTwo = number % 100;
    const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th");
    return number + suffix;
  }

  function lineageChain(person) {
    const current = state();
    const rawId = sourceField(person, "lineage_id");
    const rawSegments = rawId ? rawId.split(".").map(function (part) { return u.cleanLine(part, 20); }).filter(Boolean) : [];
    const numbers = lineageId(person);
    const chainNumbers = numbers.slice().reverse();
    const people = current.workspace.people;
    const used = new Set([person.id]);
    const members = [{ name: model.displayName(person), person: person, number: chainNumbers[0] || "" }];
    const levelNames = [1, 2, 3, 4, 5, 6].map(function (level) { return sourceField(person, "lineage_level_" + String(level).padStart(2, "0") + "_name"); }).filter(Boolean).reverse();

    levelNames.forEach(function (name, index) {
      const prefix = rawSegments.slice(0, Math.max(0, rawSegments.length - index - 1)).join(".");
      const candidates = people.filter(function (candidate) { return candidate.id !== person.id && sourceField(candidate, "lineage_id") === prefix; });
      const target = candidates.length === 1 ? candidates[0] : candidates.find(function (candidate) { return sourceNameMatches(candidate, name); });
      if (target) used.add(target.id);
      members.push({ name: name, person: target || null, number: chainNumbers[index + 1] || "" });
    });

    const rootNames = [1, 2, 3].map(function (level) { return sourceField(person, "root_ancestor_" + String(level).padStart(2, "0") + "_name"); }).filter(Boolean);
    const remainingRootNames = rootNames.slice();
    const personBirthYear = sourceBirthYear(person);
    const rootCandidates = people.filter(function (candidate) {
      if (used.has(candidate.id) || sourceField(candidate, "lineage_id") !== "0") return false;
      const candidateBirthYear = sourceBirthYear(candidate);
      if (personBirthYear > 0 && candidateBirthYear > 0 && candidateBirthYear >= personBirthYear) return false;
      return remainingRootNames.some(function (name) { return sourceNameMatches(candidate, name); });
    }).sort(function (a, b) { return sourceBirthYear(b) - sourceBirthYear(a) || model.sortName(a).localeCompare(model.sortName(b)); });
    rootCandidates.forEach(function (target) {
      const nameIndex = remainingRootNames.findIndex(function (name) { return sourceNameMatches(target, name); });
      if (nameIndex < 0) return;
      const name = remainingRootNames.splice(nameIndex, 1)[0];
      used.add(target.id);
      members.push({ name: name, person: target, number: "" });
    });
    remainingRootNames.reverse().forEach(function (name) { members.push({ name: name, person: null, number: "" }); });
    const selectedGeneration = rawId === "0" ? rootNames.length : Math.max(0, rootNames.length - 1 + rawSegments.length);
    members.forEach(function (member, index) { member.generation = Math.max(0, selectedGeneration - index); });
    return { numbers: numbers, members: members };
  }

  function lineagePersonLink(member, includeNumber) {
    const label = u.escapeHtml(member.name) + (includeNumber ? ' <span class="lineage-bracket">[' + u.escapeHtml(member.number || "Nth") + "]</span>" : "");
    return member.person ? '<button type="button" class="lineage-person-link" data-select-person="' + u.escapeHtml(member.person.id) + '">' + label + "</button>" : '<span class="lineage-unlinked-name">' + label + "</span>";
  }

  function lineageIdHtml(numbers) {
    if (!numbers.length) return '<span class="muted-copy">Not recorded</span>';
    return '<code class="lineage-id">' + numbers.map(function (number, index) {
      const value = u.escapeHtml(number);
      return (index ? "." : "") + (index === numbers.length - 1 ? "<strong>" + value + "</strong>" : value);
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
    if (!parent && !hasRecordedLineage) return '<span class="muted-copy">No parent lineage recorded.</span>';
    if (!parent) return '<span class="lineage-generation">Gen ' + member.generation + ' ·</span><span>' + lineagePersonLink(member, false) + "</span>";
    const ordinalLabel = ordinalLineageNumber(member.number);
    const ordinal = ordinalLabel ? "<strong>" + u.escapeHtml(ordinalLabel) + "</strong> " : "";
    return '<span class="lineage-generation">Gen ' + member.generation + ' ·</span><span>' + ordinal + "Child of " + lineagePersonLink(parent, false) + "</span>";
  }

  function profileLineage(person) {
    const chain = lineageChain(person);
    const background = person.heritageNote && !sourceField(person, "lineage_id") ? '<div class="lineage-background"><h4>Background</h4><p class="preserve-lines">' + u.escapeHtml(person.heritageNote) + "</p></div>" : "";
    const hasRecordedLineage = chain.members.length > 1 || chain.numbers.length > 0;
    return '<section class="profile-section lineage-section"><h3>Lineage</h3><div class="lineage-id-row"><span>ID</span>' + lineageIdHtml(chain.numbers) + '</div><div class="lineage-columns"><h4>Names</h4><ol class="lineage-paired-list">' + chain.members.map(function (member, index) {
      return '<li><div class="lineage-name-cell">' + lineagePersonLink(member, true) + '</div><div class="lineage-reading-cell">' + lineageReadingCell(member, chain.members[index + 1], hasRecordedLineage) + "</div></li>";
    }).join("") + '</ol><p class="lineage-summary">' + u.escapeHtml(lineageSummaryText(person)) + "</p></div>" + background + "</section>";
  }

  function profileSource(person) {
    const entries = sourceEntries(person.source);
    if (!entries.length) return "";
    return '<section class="profile-section source-section"><details><summary>Imported source · ' + entries.length + ' populated fields</summary><p class="source-format">' + u.escapeHtml(person.source.format || "Imported CSV") + '</p><dl class="profile-list source-list">' + entries.map(function (entry) { return '<div><dt>' + u.escapeHtml(sourceLabel(entry[0])) + '</dt><dd>' + u.escapeHtml(entry[1]) + "</dd></div>"; }).join("") + "</dl></details></section>";
  }

  function printSource(person) {
    const entries = sourceEntries(person.source);
    if (!entries.length) return "";
    return '<section class="print-wide print-source"><h3>Imported source fields</h3><p>' + u.escapeHtml(person.source.format || "Imported CSV") + '</p><dl>' + entries.map(function (entry) { return '<div><dt>' + u.escapeHtml(sourceLabel(entry[0])) + '</dt><dd>' + u.escapeHtml(entry[1]) + "</dd></div>"; }).join("") + "</dl></section>";
  }

  function printLineage(person) {
    const chain = lineageChain(person);
    const nameList = chain.members.map(function (member) { return u.escapeHtml(member.name) + " [" + u.escapeHtml(member.number || "Nth") + "]"; }).join(" → ");
    const reading = chain.members.map(function (member, index) {
      const parent = chain.members[index + 1];
      if (!parent) return "Gen " + member.generation + " · " + u.escapeHtml(member.name);
      const ordinalLabel = ordinalLineageNumber(member.number);
      const ordinal = ordinalLabel ? u.escapeHtml(ordinalLabel) + " " : "";
      return "Gen " + member.generation + " · " + ordinal + "Child of " + u.escapeHtml(parent.name);
    }).join("<br>");
    const background = person.heritageNote && !sourceField(person, "lineage_id") ? '<div><dt>Background</dt><dd>' + u.escapeHtml(person.heritageNote).replace(/\n/g, "<br>") + "</dd></div>" : "";
    return '<section class="print-wide"><h3>Lineage</h3><dl><div><dt>ID</dt><dd>' + lineageIdHtml(chain.numbers) + '</dd></div><div><dt>Names</dt><dd>' + nameList + '</dd></div><div><dt>Reading</dt><dd>' + reading + '</dd></div><div><dt>Family</dt><dd>' + u.escapeHtml(lineageSummaryText(person)) + "</dd></div>" + background + "</dl></section>";
  }

  function renderProfile() {
    const container = $("#profilePanelContent");
    if (!container) return;
    const person = state().workspace.people.find(function (item) { return item.id === state().ui.selectedPersonId; });
    if (!person) {
      container.innerHTML = '<div class="empty-state"><h2>No person selected</h2><p>Select someone in the directory or tree.</p><button type="button" class="button primary" data-add-person' + mutationDisabledAttributes() + '>Add person</button></div>';
      return;
    }
    const isHome = state().workspace.family.homePersonId === person.id;
    const profileLabels = (developerReferencesEnabled() ? [person.reference] : []).concat(isHome ? ["Home person"] : []);
    const profileEyebrow = profileLabels.length ? '<span class="eyebrow">' + u.escapeHtml(profileLabels.join(" · ")) + "</span>" : "";
    const contactBlocks = [];
    if (person.addresses.length) contactBlocks.push('<section class="profile-section"><h3>Addresses</h3>' + person.addresses.slice().sort(function (a, b) { return a.order - b.order; }).map(function (address) { return '<article class="contact-card"><header><strong>' + u.escapeHtml(address.label) + '</strong><span class="status-pill" data-kind="' + (address.current ? "success" : "neutral") + '">' + (address.current ? "Current" : "Former") + '</span></header><address>' + u.escapeHtml(model.formatAddress(address)).replace(/\n/g, "<br>") + '</address>' + ((model.formatFlexibleDate(address.startDate) || model.formatFlexibleDate(address.endDate)) ? '<small>' + u.escapeHtml([model.formatFlexibleDate(address.startDate), model.formatFlexibleDate(address.endDate)].filter(Boolean).join(" – ")) + "</small>" : "") + (address.notes ? "<p>" + u.escapeHtml(address.notes) + "</p>" : "") + "</article>"; }).join("") + "</section>");
    if (person.phones.length || person.emails.length) contactBlocks.push('<section class="profile-section"><h3>Contact</h3><dl class="profile-list">' + person.phones.map(function (item) { return '<div><dt>' + u.escapeHtml(item.label) + '</dt><dd>' + u.escapeHtml(item.value) + "</dd></div>"; }).join("") + person.emails.map(function (item) { return '<div><dt>' + u.escapeHtml(item.label) + '</dt><dd>' + u.escapeHtml(item.value) + "</dd></div>"; }).join("") + "</dl></section>");
    container.innerHTML = '<article class="person-profile"><header class="profile-header"><div class="profile-title">' + profileEyebrow + '<h2>' + u.escapeHtml(model.displayName(person)) + '</h2><p>' + u.escapeHtml(family.lifespan(person)) + '</p></div><button type="button" class="icon-button" data-close-profile aria-controls="profilePanel" aria-label="Close and deselect person" title="Close and deselect person"><span data-symbol="close" aria-hidden="true"></span></button></header><div class="profile-action-bar"><button type="button" class="button primary" data-edit-person="' + u.escapeHtml(person.id) + '"' + mutationDisabledAttributes() + '>Edit person</button><button type="button" class="button" data-add-relative="' + u.escapeHtml(person.id) + '"' + mutationDisabledAttributes() + '>Add relative</button><button type="button" class="button" data-add-relationship="' + u.escapeHtml(person.id) + '"' + mutationDisabledAttributes() + '>Connect existing</button></div><dl class="profile-list identity-list">' + formatEvent("Born", person.birth) + formatEvent("Died", person.death) + (person.gender ? '<div><dt>Gender</dt><dd>' + u.escapeHtml(person.gender) + "</dd></div>" : "") + (person.pronouns ? '<div><dt>Pronouns</dt><dd>' + u.escapeHtml(person.pronouns) + "</dd></div>" : "") + '<div><dt>Status</dt><dd>' + u.escapeHtml(person.livingStatus) + "</dd></div></dl>" + contactBlocks.join("") + profileLineage(person) + profileSource(person) + '<section class="profile-section"><div class="form-section-heading"><h3>Relationships</h3><button type="button" class="button small" data-add-relationship="' + u.escapeHtml(person.id) + '"' + mutationDisabledAttributes() + '>Add</button></div><div class="relationship-list">' + relationshipRows(person) + "</div></section>" + (person.notes ? '<section class="profile-section"><h3>Notes</h3><p class="preserve-lines">' + u.escapeHtml(person.notes) + "</p></section>" : "") + '<footer class="profile-footer">' + (isHome ? '<span class="status-pill" data-kind="success">Home person</span>' : '<button type="button" class="button" data-set-home="' + u.escapeHtml(person.id) + '"' + mutationDisabledAttributes() + '>Set as home person</button>') + '<button type="button" class="button danger-text" data-delete-person="' + u.escapeHtml(person.id) + '"' + mutationDisabledAttributes() + '>Delete person</button></footer></article>';
    icons.mount(container);
  }

  function edgePath(edge) {
    if (edge.relationship.type === "partner") {
      const x1 = edge.from.x + edge.from.width / 2;
      const y1 = edge.from.y + edge.from.height / 2;
      const x2 = edge.to.x + edge.to.width / 2;
      const y2 = edge.to.y + edge.to.height / 2;
      return "M" + x1 + " " + y1 + " L" + x2 + " " + y2;
    }
    const x1 = edge.from.x + edge.from.width / 2;
    const y1 = edge.from.y + edge.from.height;
    const x2 = edge.to.x + edge.to.width / 2;
    const y2 = edge.to.y;
    const middle = (y1 + y2) / 2;
    return "M" + x1 + " " + y1 + " C" + x1 + " " + middle + " " + x2 + " " + middle + " " + x2 + " " + y2;
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
    const label = $("#zoomValue");
    if (label) label.textContent = Math.round(treeTransform.scale * 100) + "%";
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

  function condensedTreeNames(person) {
    const names = person.names || {};
    const displayParts = model.displayName(person).trim().split(/\s+/);
    const shorten = function (value) { const text = String(value || ""); return text.length > 19 ? text.slice(0, 18) + "…" : text; };
    return {
      given: shorten(names.preferred || names.given || displayParts[0] || "Unnamed"),
      family: shorten(names.family || names.birth || (displayParts.length > 1 ? displayParts[displayParts.length - 1] : ""))
    };
  }

  function renderTree() {
    const svg = $("#familyTreeSvg");
    if (!svg) return;
    const focusId = state().ui.treeFocusId || state().workspace.family.homePersonId || (state().workspace.people[0] && state().workspace.people[0].id);
    currentTreeLayout = family.layout(state(), { mode: state().ui.treeMode, focusId: focusId, ancestorDepth: state().ui.ancestorDepth, descendantDepth: state().ui.descendantDepth, nodeView: state().ui.treeNodeView });
    if (!currentTreeLayout.nodes.length) {
      svg.innerHTML = '<text class="tree-empty-text" x="50%" y="46%" text-anchor="middle">No people yet</text><text class="tree-empty-subtext" x="50%" y="54%" text-anchor="middle">Family editing is paused while McFamily is being built.</text>';
      return;
    }
    const edges = currentTreeLayout.edges.map(function (edge) {
      const relationship = edge.relationship;
      const kind = relationship.type === "parent-child" ? relationship.kind : relationship.status;
      const description = relationshipDescription(edge);
      return '<path class="tree-edge ' + u.escapeHtml(relationship.type) + '" role="img" aria-label="' + u.escapeHtml(description) + '" data-kind="' + u.escapeHtml(kind) + '" d="' + edgePath(edge) + '"><title>' + u.escapeHtml(description) + "</title></path>";
    }).join("");
    const nodes = currentTreeLayout.nodes.map(function (node) {
      const person = node.person;
      const selected = state().ui.selectedPersonId === person.id;
      const home = state().workspace.family.homePersonId === person.id;
      const name = model.displayName(person);
      const shortName = name.length > 25 ? name.slice(0, 24) + "…" : name;
      const shell = '<g class="tree-node' + (selected ? " selected" : "") + (home ? " home" : "") + '" data-view="' + u.escapeHtml(currentTreeLayout.nodeView) + '" tabindex="0" role="button" aria-label="' + u.escapeHtml(name + ", " + family.lifespan(person) + ". Select to focus.") + '" data-tree-person="' + u.escapeHtml(person.id) + '" transform="translate(' + node.x + " " + node.y + ')"><rect width="' + node.width + '" height="' + node.height + '" rx="12"></rect>';
      if (currentTreeLayout.nodeView === "condensed") {
        const compact = condensedTreeNames(person);
        return shell + '<text class="tree-given" x="' + (node.width / 2) + '" y="23" text-anchor="middle">' + u.escapeHtml(compact.given) + '</text><text class="tree-family" x="' + (node.width / 2) + '" y="43" text-anchor="middle">' + u.escapeHtml(compact.family) + '</text><text class="tree-life" x="' + (node.width / 2) + '" y="62" text-anchor="middle">' + u.escapeHtml(family.lifespan(person)) + "</text></g>";
      }
      const reference = developerReferencesEnabled() ? '<text class="tree-reference" x="12" y="62">' + u.escapeHtml(person.reference) + "</text>" : "";
      return shell + '<text class="tree-name" x="12" y="23">' + u.escapeHtml(shortName) + '</text><text class="tree-life" x="12" y="46">' + u.escapeHtml(family.lifespan(person) + (home ? " · home" : "")) + "</text>" + reference + "</g>";
    }).join("");
    svg.innerHTML = '<g id="treeViewport"><g class="tree-edges">' + edges + '</g><g class="tree-nodes">' + nodes + "</g></g>";
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

  function renderWorkspace() {
    const directoryCollapsed = state().ui.directoryCollapsed;
    const profileCollapsed = state().ui.profileCollapsed;
    const overviewDisabled = state().ui.treeMode === "overview" ? "disabled" : "";
    const personTabDisabled = state().ui.selectedPersonId ? "" : " disabled";
    $("#mainContent").innerHTML = '<section class="family-workspace" aria-label="Family workspace"><nav class="mobile-workspace-tabs segmented" aria-label="Workspace views"><button type="button" data-mobile-view="directory" aria-pressed="' + String(state().ui.mobileView === "directory") + '">Directory</button><button type="button" data-mobile-view="tree" aria-pressed="' + String(state().ui.mobileView === "tree") + '">Family Tree</button><button type="button" data-mobile-view="profile" aria-pressed="' + String(state().ui.mobileView === "profile") + '"' + personTabDisabled + '>Person</button></nav><div class="family-workspace-grid" data-mobile-view="' + u.escapeHtml(state().ui.mobileView) + '" data-directory-collapsed="' + String(directoryCollapsed) + '" data-profile-collapsed="' + String(profileCollapsed) + '"><aside id="directoryPanel" class="directory-panel workspace-card' + (directoryCollapsed ? " is-collapsed" : "") + '" aria-label="Family directory"><header class="directory-module-bar"><span id="directoryCount" class="count-pill"></span><button type="button" class="icon-button" data-toggle-pane="directory" aria-controls="directoryPanel" aria-expanded="true" aria-label="Close directory" title="Close directory"><span data-symbol="close" aria-hidden="true"></span></button></header><div class="directory-controls"><label class="field full"><span class="visually-hidden">Search family directory</span><input id="directorySearch" type="search" placeholder="Name, address, phone, email…" value="' + u.escapeHtml(state().ui.directorySearch) + '"></label><div class="directory-filter-row"><label class="field"><span class="visually-hidden">Filter living status</span><select id="livingFilter"><option value="all">All people</option><option value="living">Living</option><option value="deceased">Deceased</option><option value="unknown">Unknown status</option></select></label><label class="field"><span class="visually-hidden">Sort directory</span><select id="directorySort"><option value="first">First name</option><option value="last">Last name</option></select></label></div></div><div class="directory-body"><div id="directoryList" class="directory-list"></div><nav id="directoryAlphaRail" class="directory-alpha-rail" aria-label="Jump to directory letter"></nav></div></aside><section class="tree-panel workspace-card" aria-label="Family Tree"><header class="tree-toolbar"><div class="tree-view-controls"><div class="segmented" aria-label="Tree mode"><button type="button" data-tree-mode="focus" aria-pressed="' + String(state().ui.treeMode === "focus") + '">Focus</button><button type="button" data-tree-mode="overview" aria-pressed="' + String(state().ui.treeMode === "overview") + '">Overview</button></div><div class="segmented" aria-label="Person card detail"><button type="button" data-tree-node-view="condensed" aria-pressed="' + String(state().ui.treeNodeView === "condensed") + '">Condensed</button><button type="button" data-tree-node-view="detailed" aria-pressed="' + String(state().ui.treeNodeView === "detailed") + '">Detailed</button></div><label class="depth-control"><span>Ancestors <strong id="ancestorDepthValue">' + state().ui.ancestorDepth + '</strong></span><input id="ancestorDepth" type="range" min="0" max="4" step="1" value="' + state().ui.ancestorDepth + '" ' + overviewDisabled + '></label><label class="depth-control"><span>Descendants <strong id="descendantDepthValue">' + state().ui.descendantDepth + '</strong></span><input id="descendantDepth" type="range" min="0" max="4" step="1" value="' + state().ui.descendantDepth + '" ' + overviewDisabled + '></label><div class="zoom-controls" aria-label="Tree zoom"><button type="button" class="button small" data-zoom="out">Zoom out</button><span id="zoomValue" aria-live="polite">100%</span><button type="button" class="button small" data-zoom="in">Zoom in</button><button type="button" class="button small" data-fit-tree>Fit</button></div></div></header><div class="tree-canvas"><svg id="familyTreeSvg" role="group" aria-label="Interactive Family Tree. Scroll horizontally or vertically, drag to pan, use the zoom controls, and select a person to focus." tabindex="0"></svg></div></section><aside id="profilePanel" class="profile-panel workspace-card' + (profileCollapsed ? " is-collapsed" : "") + '" aria-label="Selected person profile"><div id="profilePanelContent" class="profile-panel-content"></div></aside></div></section>';
    $("#livingFilter").value = state().ui.livingFilter;
    $("#directorySort").value = state().ui.directorySort;
    renderDirectoryList();
    renderProfile();
    renderTree();
    icons.mount($("#mainContent"));
  }

  function renderMain() {
    if (initialized()) renderWorkspace();
    else renderOnboarding();
  }

  function selectPerson(id, options) {
    if (!state().workspace.people.some(function (person) { return person.id === id; })) return;
    const settings = Object.assign({ focus: true, mobileProfile: false }, options || {});
    storage.mutate(function (next) {
      next.ui.selectedPersonId = id;
      next.ui.profileCollapsed = false;
      if (settings.focus) next.ui.treeFocusId = id;
      if (settings.mobileProfile) next.ui.mobileView = "profile";
    }, { touch: false, reason: "select-person" });
    treeNeedsFit = settings.focus;
    renderWorkspace();
    announce("Selected " + model.displayName(state().workspace.people.find(function (person) { return person.id === id; })) + ".");
  }

  function addressRow(address, index) {
    return '<fieldset class="repeatable-card" data-address-index="' + index + '"><legend>Address ' + (index + 1) + '</legend><div class="repeatable-card-actions"><button type="button" class="button small danger-text" data-remove-address="' + index + '">Remove</button></div><div class="form-grid"><label class="field"><span>Label</span><input data-address-field="label" value="' + u.escapeHtml(address.label || "Home") + '"></label><label class="check-field"><input type="checkbox" data-address-field="current" ' + (address.current !== false ? "checked" : "") + '><span>Current address</span></label><label class="field full"><span>Address line 1</span><input data-address-field="line1" value="' + u.escapeHtml(address.line1 || "") + '"></label><label class="field full"><span>Address line 2</span><input data-address-field="line2" value="' + u.escapeHtml(address.line2 || "") + '"></label><label class="field"><span>City / locality</span><input data-address-field="city" value="' + u.escapeHtml(address.city || "") + '"></label><label class="field"><span>State / region</span><input data-address-field="region" value="' + u.escapeHtml(address.region || "") + '"></label><label class="field"><span>Postal code</span><input data-address-field="postalCode" value="' + u.escapeHtml(address.postalCode || "") + '"></label><label class="field"><span>Country</span><input data-address-field="country" value="' + u.escapeHtml(address.country || "") + '"></label><label class="field"><span>Start date</span><input data-address-field="startDate" placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" value="' + u.escapeHtml(address.startDate && address.startDate.value || "") + '"></label><label class="field"><span>End date</span><input data-address-field="endDate" placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" value="' + u.escapeHtml(address.endDate && address.endDate.value || "") + '"></label><label class="field full"><span>Address notes</span><textarea data-address-field="notes" rows="2">' + u.escapeHtml(address.notes || "") + "</textarea></label></div></fieldset>";
  }

  function contactRow(item, index, type) {
    const inputType = type === "email" ? "email" : "tel";
    return '<div class="repeatable-contact" data-contact-index="' + index + '" data-contact-type="' + type + '"><label class="field"><span>Label</span><input data-contact-field="label" value="' + u.escapeHtml(item.label || (type === "phone" ? "Mobile" : "Personal")) + '"></label><label class="field grow-control"><span>' + (type === "phone" ? "Number" : "Address") + '</span><input type="' + inputType + '" data-contact-field="value" value="' + u.escapeHtml(item.value || "") + '"></label><button type="button" class="button small danger-text" data-remove-contact="' + type + ':' + index + '">Remove</button></div>';
  }

  function renderPersonRepeatables() {
    $("#addressEditor").innerHTML = personDraft.addresses.length ? personDraft.addresses.map(addressRow).join("") : '<p class="muted-copy">No addresses recorded.</p>';
    $("#phoneEditor").innerHTML = personDraft.phones.length ? personDraft.phones.map(function (item, index) { return contactRow(item, index, "phone"); }).join("") : '<p class="muted-copy">No phone numbers recorded.</p>';
    $("#emailEditor").innerHTML = personDraft.emails.length ? personDraft.emails.map(function (item, index) { return contactRow(item, index, "email"); }).join("") : '<p class="muted-copy">No email addresses recorded.</p>';
  }

  function syncPersonRepeatables() {
    personDraft.addresses = $$("[data-address-index]", $("#addressEditor")).map(function (row, index) {
      const value = function (name) { return row.querySelector('[data-address-field="' + name + '"]')?.value || ""; };
      return {
        id: personDraft.addresses[index] && personDraft.addresses[index].id || u.uid("address"),
        label: value("label"), current: row.querySelector('[data-address-field="current"]')?.checked !== false,
        line1: value("line1"), line2: value("line2"), city: value("city"), region: value("region"), postalCode: value("postalCode"), country: value("country"),
        startDate: { value: value("startDate"), qualifier: "exact" }, endDate: { value: value("endDate"), qualifier: "exact" }, notes: value("notes"), order: index
      };
    });
    ["phone", "email"].forEach(function (type) {
      personDraft[type + "s"] = $$('.repeatable-contact[data-contact-type="' + type + '"]', $("#" + type + "Editor")).map(function (row, index) {
        return { id: personDraft[type + "s"][index] && personDraft[type + "s"][index].id || u.uid(type), label: row.querySelector('[data-contact-field="label"]').value, value: row.querySelector('[data-contact-field="value"]').value, order: index };
      });
    });
  }

  function fillPersonForm(person) {
    const values = {
      personId: person && person.id,
      givenName: person && person.names.given,
      middleName: person && person.names.middle,
      familyName: person && person.names.family,
      birthSurname: person && person.names.birth,
      preferredName: person && person.names.preferred,
      nameSuffix: person && person.names.suffix,
      displayName: person && person.names.display,
      livingStatus: person && person.livingStatus || "living",
      gender: person && person.gender,
      pronouns: person && person.pronouns,
      birthDate: person && person.birth.date.value,
      birthQualifier: person && person.birth.date.qualifier || "exact",
      birthPlace: person && person.birth.place,
      deathDate: person && person.death.date.value,
      deathQualifier: person && person.death.date.qualifier || "exact",
      deathPlace: person && person.death.place,
      heritageNote: person && person.heritageNote,
      personNotes: person && person.notes
    };
    Object.keys(values).forEach(function (id) { const input = $("#" + id); if (input) input.value = values[id] || ""; });
    personDraft = {
      addresses: u.clone(person && person.addresses || []),
      phones: u.clone(person && person.phones || []),
      emails: u.clone(person && person.emails || [])
    };
    renderPersonRepeatables();
    $("#personFormError").hidden = true;
  }

  function openPersonEditor(id, trigger) {
    const person = id ? state().workspace.people.find(function (item) { return item.id === id; }) : null;
    $("#personDialogTitle").textContent = person ? "Edit " + model.displayName(person) : pendingRelative ? "Add " + pendingRelative.role : "Add person";
    fillPersonForm(person);
    components.openDialog("#personDialog", { trigger: trigger, focus: "#givenName" });
  }

  function validDateInput(value) {
    return !value || /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(value);
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
    return {
      id: existing ? existing.id : u.uid("person"),
      names: { given: $("#givenName").value, middle: $("#middleName").value, family: $("#familyName").value, birth: $("#birthSurname").value, preferred: $("#preferredName").value, suffix: $("#nameSuffix").value, display: $("#displayName").value },
      livingStatus: $("#livingStatus").value,
      gender: $("#gender").value,
      pronouns: $("#pronouns").value,
      birth: { date: { value: $("#birthDate").value.trim(), qualifier: $("#birthQualifier").value }, place: $("#birthPlace").value },
      death: { date: { value: $("#deathDate").value.trim(), qualifier: $("#deathQualifier").value }, place: $("#deathPlace").value },
      addresses: personDraft.addresses,
      phones: personDraft.phones,
      emails: personDraft.emails,
      heritageNote: $("#heritageNote").value,
      notes: $("#personNotes").value,
      order: existing ? existing.order : state().workspace.people.length,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
  }

  function savePerson(event) {
    event.preventDefault();
    const id = $("#personId").value;
    const existing = id ? state().workspace.people.find(function (person) { return person.id === id; }) : null;
    if (!$("#displayName").value.trim() && !$("#givenName").value.trim() && !$("#familyName").value.trim()) return showPersonError("Enter a display name, given name, or family name.");
    const dateValues = [$("#birthDate").value.trim(), $("#deathDate").value.trim()];
    syncPersonRepeatables();
    personDraft.addresses.forEach(function (address) { dateValues.push(address.startDate.value, address.endDate.value); });
    if (dateValues.some(function (value) { return !validDateInput(value); })) return showPersonError("Use YYYY, YYYY-MM, or YYYY-MM-DD for every date.");
    const person = collectPersonForm(existing);
    let relationshipError = "";
    storage.mutate(function (next) {
      if (existing) next.workspace.people[next.workspace.people.findIndex(function (item) { return item.id === existing.id; })] = person;
      else next.workspace.people.push(person);
      if (!next.workspace.family.homePersonId) next.workspace.family.homePersonId = person.id;
      next.ui.selectedPersonId = person.id;
      next.ui.treeFocusId = person.id;
      if (pendingRelative) {
        const sourceId = pendingRelative.sourceId;
        let relationship;
        if (pendingRelative.role === "parent") relationship = { id: u.uid("relationship"), type: "parent-child", parentId: person.id, childId: sourceId, kind: "unknown", startDate: { value: "", qualifier: "exact" }, endDate: { value: "", qualifier: "exact" }, place: "", notes: "", createdAt: u.isoNow(), updatedAt: u.isoNow() };
        else if (pendingRelative.role === "child") relationship = { id: u.uid("relationship"), type: "parent-child", parentId: sourceId, childId: person.id, kind: "unknown", startDate: { value: "", qualifier: "exact" }, endDate: { value: "", qualifier: "exact" }, place: "", notes: "", createdAt: u.isoNow(), updatedAt: u.isoNow() };
        else relationship = { id: u.uid("relationship"), type: "partner", person1Id: sourceId, person2Id: person.id, status: "unknown", startDate: { value: "", qualifier: "exact" }, endDate: { value: "", qualifier: "exact" }, place: "", notes: "", createdAt: u.isoNow(), updatedAt: u.isoNow() };
        relationshipError = family.validateRelationshipDraft(relationship, next);
        if (!relationshipError) next.workspace.relationships.push(relationship);
      }
    }, { reason: existing ? "edit-person" : "add-person" });
    const message = existing ? "Updated " + model.displayName(person) + "." : "Added " + model.displayName(person) + ".";
    pendingRelative = null;
    treeNeedsFit = true;
    components.closeDialog("#personDialog", "saved");
    renderAll();
    components.toast(relationshipError ? message + " The relative link was not added: " + relationshipError : message, { title: existing ? "Person updated" : "Person added", kind: relationshipError ? "warning" : "success" });
  }

  function personOptions(selectedId) {
    return state().workspace.people.slice().sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)); }).map(function (person) { return '<option value="' + u.escapeHtml(person.id) + '" ' + (person.id === selectedId ? "selected" : "") + '>' + u.escapeHtml(model.displayName(person) + (developerReferencesEnabled() ? " · " + person.reference : "")) + "</option>"; }).join("");
  }

  function updateRelationshipFormType() {
    const partner = $("#relationshipType").value === "partner";
    $("#relationPerson1Label").textContent = partner ? "First partner" : "Parent";
    $("#relationPerson2Label").textContent = partner ? "Second partner" : "Child";
    $("#parentKindField").hidden = partner;
    $("#partnerStatusField").hidden = !partner;
  }

  function openRelationshipEditor(id, personId, trigger) {
    const relationship = id ? state().workspace.relationships.find(function (item) { return item.id === id; }) : null;
    $("#relationshipDialogTitle").textContent = relationship ? "Edit relationship" : "Connect existing people";
    $("#relationshipId").value = relationship ? relationship.id : "";
    $("#relationshipType").value = relationship ? relationship.type : "parent-child";
    const firstId = relationship ? (relationship.type === "parent-child" ? relationship.parentId : relationship.person1Id) : personId;
    const secondId = relationship ? (relationship.type === "parent-child" ? relationship.childId : relationship.person2Id) : state().workspace.people.find(function (person) { return person.id !== firstId; })?.id;
    $("#relationPerson1").innerHTML = personOptions(firstId);
    $("#relationPerson2").innerHTML = personOptions(secondId);
    $("#parentKind").innerHTML = config.parentKinds.map(function (item) { return '<option value="' + item.id + '">' + u.escapeHtml(item.label) + "</option>"; }).join("");
    $("#partnerStatus").innerHTML = config.partnerStatuses.map(function (item) { return '<option value="' + item.id + '">' + u.escapeHtml(item.label) + "</option>"; }).join("");
    $("#parentKind").value = relationship && relationship.kind || "unknown";
    $("#partnerStatus").value = relationship && relationship.status || "unknown";
    $("#relationshipStartDate").value = relationship && relationship.startDate.value || "";
    $("#relationshipStartQualifier").value = relationship && relationship.startDate.qualifier || "exact";
    $("#relationshipEndDate").value = relationship && relationship.endDate.value || "";
    $("#relationshipEndQualifier").value = relationship && relationship.endDate.qualifier || "exact";
    $("#relationshipPlace").value = relationship && relationship.place || "";
    $("#relationshipNotes").value = relationship && relationship.notes || "";
    $("#relationshipFormError").hidden = true;
    updateRelationshipFormType();
    components.openDialog("#relationshipDialog", { trigger: trigger, focus: "#relationshipType" });
  }

  function saveRelationship(event) {
    event.preventDefault();
    const id = $("#relationshipId").value;
    const existing = id ? state().workspace.relationships.find(function (item) { return item.id === id; }) : null;
    const type = $("#relationshipType").value;
    const startDate = { value: $("#relationshipStartDate").value.trim(), qualifier: $("#relationshipStartQualifier").value };
    const endDate = { value: $("#relationshipEndDate").value.trim(), qualifier: $("#relationshipEndQualifier").value };
    if (!validDateInput(startDate.value) || !validDateInput(endDate.value)) {
      $("#relationshipFormError").textContent = "Use YYYY, YYYY-MM, or YYYY-MM-DD for relationship dates.";
      $("#relationshipFormError").hidden = false;
      return;
    }
    const now = u.isoNow();
    const relationship = {
      id: existing ? existing.id : u.uid("relationship"), type: type,
      startDate: startDate, endDate: endDate, place: $("#relationshipPlace").value, notes: $("#relationshipNotes").value,
      order: existing ? existing.order : state().workspace.relationships.length, createdAt: existing ? existing.createdAt : now, updatedAt: now
    };
    if (type === "parent-child") Object.assign(relationship, { parentId: $("#relationPerson1").value, childId: $("#relationPerson2").value, kind: $("#parentKind").value });
    else Object.assign(relationship, { person1Id: $("#relationPerson1").value, person2Id: $("#relationPerson2").value, status: $("#partnerStatus").value });
    const error = family.validateRelationshipDraft(relationship, state(), existing && existing.id);
    if (error) {
      $("#relationshipFormError").textContent = error;
      $("#relationshipFormError").hidden = false;
      return;
    }
    storage.mutate(function (next) {
      if (existing) next.workspace.relationships[next.workspace.relationships.findIndex(function (item) { return item.id === existing.id; })] = relationship;
      else next.workspace.relationships.push(relationship);
    }, { reason: existing ? "edit-relationship" : "add-relationship" });
    treeNeedsFit = true;
    components.closeDialog("#relationshipDialog", "saved");
    renderAll();
    components.toast(existing ? "The relationship was updated." : "The people are now connected.", { title: existing ? "Relationship updated" : "Relationship added", kind: "success" });
  }

  async function addRelative(personId, trigger) {
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
    const relationship = state().workspace.relationships.find(function (item) { return item.id === id; });
    if (!relationship) return;
    const accepted = await components.confirm({ title: "Remove this relationship?", message: "The people will remain in the directory, but this link and its relationship notes will be removed from the tree and atlas.", confirmLabel: "Remove relationship", cancelLabel: "Keep relationship", danger: true, trigger: trigger });
    if (!accepted) return;
    storage.saveRecovery("Before removing a relationship", state());
    storage.mutate(function (next) { next.workspace.relationships = next.workspace.relationships.filter(function (item) { return item.id !== id; }); }, { reason: "delete-relationship" });
    treeNeedsFit = true;
    renderAll();
    components.toast("The relationship was removed. A recovery copy is available in Developer Mode.", { title: "Relationship removed", kind: "success" });
  }

  async function deletePerson(id, trigger) {
    const person = state().workspace.people.find(function (item) { return item.id === id; });
    if (!person) return;
    const linkCount = state().workspace.relationships.filter(function (relationship) { return relationship.type === "parent-child" ? relationship.parentId === id || relationship.childId === id : relationship.person1Id === id || relationship.person2Id === id; }).length;
    const accepted = await components.confirm({ title: "Delete " + model.displayName(person) + "?", message: "This permanently removes the profile and " + linkCount + " relationship link" + (linkCount === 1 ? "" : "s") + " from the local family. A recovery copy will be saved first.", confirmLabel: "Delete person", cancelLabel: "Keep person", danger: true, trigger: trigger });
    if (!accepted) return;
    storage.saveRecovery("Before deleting " + model.displayName(person), state());
    storage.mutate(function (next) {
      next.workspace.people = next.workspace.people.filter(function (item) { return item.id !== id; });
      next.workspace.relationships = next.workspace.relationships.filter(function (relationship) { return relationship.type === "parent-child" ? relationship.parentId !== id && relationship.childId !== id : relationship.person1Id !== id && relationship.person2Id !== id; });
      const fallback = next.workspace.people[0] && next.workspace.people[0].id || "";
      if (next.workspace.family.homePersonId === id) next.workspace.family.homePersonId = fallback;
      next.ui.selectedPersonId = fallback;
      next.ui.treeFocusId = fallback;
    }, { reason: "delete-person" });
    treeNeedsFit = true;
    renderAll();
    components.toast("The person and linked relationships were removed. A recovery copy is available in Developer Mode.", { title: "Person deleted", kind: "success", duration: 5000 });
  }

  function setHomePerson(id) {
    storage.mutate(function (next) { next.workspace.family.homePersonId = id; next.ui.treeFocusId = id; }, { reason: "set-home-person" });
    treeNeedsFit = true;
    renderAll();
    components.toast("The tree now opens around " + model.displayName(state().workspace.people.find(function (person) { return person.id === id; })) + ".", { title: "Home person updated", kind: "success" });
  }

  function printDate() {
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(new Date());
  }

  function printRelationshipList(person, graph) {
    const groups = family.relationGroups(person.id, state());
    const section = function (label, entries, fallbackMeta) {
      if (!entries.length) return "";
      return '<div class="print-rel-group"><dt>' + label + "</dt><dd>" + entries.map(function (entry) {
        const other = entry.person || entry;
        const relationship = entry.relationship;
        const meta = relationship ? relationshipLabel(relationship, person.id, other) + (relationshipMeta(relationship) ? " · " + relationshipMeta(relationship) : "") : fallbackMeta;
        return u.escapeHtml((developerReferencesEnabled() ? other.reference + " " : "") + model.displayName(other) + " — " + meta);
      }).join("<br>") + "</dd></div>";
    };
    return section("Parents", expandedParentEntries(person, groups, graph), "Parent") + section("Partners", groups.partners, "Partner") + section("Children", groups.children, "Child") + section("Siblings", groups.siblings, "Sibling");
  }

  function buildPrintReport() {
    const current = state();
    const people = current.workspace.people.slice().sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)); });
    const graph = family.indexes(current);
    const componentsList = family.connectedComponents(current);
    const familyUnits = family.familyUnits(current);
    const addressCount = people.reduce(function (total, person) { return total + person.addresses.length; }, 0);
    const notes = documentText(current.workspace.documents[0]);
    const componentHtml = componentsList.map(function (ids) {
      const componentPeople = ids.map(function (id) { return graph.peopleById.get(id); }).filter(Boolean);
      const idSet = new Set(ids);
      const componentRelationships = current.workspace.relationships.filter(function (relationship) { return relationship.type === "parent-child" ? idSet.has(relationship.parentId) && idSet.has(relationship.childId) : idSet.has(relationship.person1Id) && idSet.has(relationship.person2Id); });
      const levels = family.generationMap(componentPeople, componentRelationships);
      const groups = new Map();
      componentPeople.forEach(function (person) { const level = levels.get(person.id) || 0; if (!groups.has(level)) groups.set(level, []); groups.get(level).push(person); });
      const sortedLevels = Array.from(groups.keys()).sort(function (a, b) { return a - b; });
      const topSibling = groups.get(sortedLevels[0]).slice().sort(function (a, b) {
        const childDifference = (graph.children.get(b.id) || []).filter(function (entry) { return idSet.has(entry.person.id); }).length - (graph.children.get(a.id) || []).filter(function (entry) { return idSet.has(entry.person.id); }).length;
        return childDifference || model.sortName(a).localeCompare(model.sortName(b));
      })[0];
      return '<article class="print-component"><header><div><span>Top sibling</span><h3>' + u.escapeHtml(model.displayName(topSibling)) + '</h3></div><p>' + componentPeople.length + " people</p></header>" + sortedLevels.map(function (level, index) { return '<section class="print-generation"><h4>Generation ' + (index + 1) + '</h4><div>' + groups.get(level).sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)); }).map(function (person) { return '<span><strong>' + u.escapeHtml(model.displayName(person)) + '</strong><small>' + u.escapeHtml(family.lifespan(person)) + "</small></span>"; }).join("") + "</div></section>"; }).join("") + "</article>";
    }).join("");
    const profiles = people.map(function (person) {
      const addressHtml = person.addresses.length ? '<section><h3>Addresses</h3>' + person.addresses.map(function (address) { return '<div class="print-address"><strong>' + u.escapeHtml(address.label + (address.current ? " · current" : " · former")) + '</strong><address>' + u.escapeHtml(model.formatAddress(address)).replace(/\n/g, "<br>") + '</address>' + ((model.formatFlexibleDate(address.startDate) || model.formatFlexibleDate(address.endDate)) ? '<small>' + u.escapeHtml([model.formatFlexibleDate(address.startDate), model.formatFlexibleDate(address.endDate)].filter(Boolean).join(" – ")) + "</small>" : "") + (address.notes ? "<p>" + u.escapeHtml(address.notes) + "</p>" : "") + "</div>"; }).join("") + "</section>" : "";
      const contactHtml = person.phones.length || person.emails.length ? '<section><h3>Contact</h3><dl>' + person.phones.map(function (item) { return '<div><dt>' + u.escapeHtml(item.label) + '</dt><dd>' + u.escapeHtml(item.value) + "</dd></div>"; }).join("") + person.emails.map(function (item) { return '<div><dt>' + u.escapeHtml(item.label) + '</dt><dd>' + u.escapeHtml(item.value) + "</dd></div>"; }).join("") + "</dl></section>" : "";
      const printReference = developerReferencesEnabled() ? '<span class="print-reference">' + u.escapeHtml(person.reference) + "</span>" : "";
      return '<article id="print-' + u.escapeHtml(person.id) + '" class="print-person"><header>' + printReference + '<div><h2>' + u.escapeHtml(model.displayName(person)) + '</h2><p>' + u.escapeHtml(family.lifespan(person) + (current.workspace.family.homePersonId === person.id ? " · home person" : "")) + '</p></div></header><div class="print-profile-grid"><section><h3>Life details</h3><dl>' + formatEvent("Born", person.birth) + formatEvent("Died", person.death) + '<div><dt>Status</dt><dd>' + u.escapeHtml(person.livingStatus) + "</dd></div>" + (person.gender ? '<div><dt>Gender</dt><dd>' + u.escapeHtml(person.gender) + "</dd></div>" : "") + (person.pronouns ? '<div><dt>Pronouns</dt><dd>' + u.escapeHtml(person.pronouns) + "</dd></div>" : "") + '</dl></section><section><h3>Lineage references</h3><dl>' + printRelationshipList(person, graph) + "</dl></section>" + contactHtml + addressHtml + printLineage(person) + printSource(person) + (person.notes ? '<section class="print-wide"><h3>Notes</h3><p>' + u.escapeHtml(person.notes).replace(/\n/g, "<br>") + "</p></section>" : "") + "</div></article>";
    }).join("");
    const referenceGuide = developerReferencesEnabled() ? " Developer Mode adds stable P-numbers for cross-reference." : "";
    $("#printReport").innerHTML = '<article class="print-cover"><span class="eyebrow">Private family atlas</span><h1>' + u.escapeHtml(current.workspace.family.title) + '</h1><p>Prepared by McFamily on ' + u.escapeHtml(printDate()) + '</p><dl><div><dt>People</dt><dd>' + people.length + '</dd></div><div><dt>Relationships</dt><dd>' + current.workspace.relationships.length + '</dd></div><div><dt>Family units</dt><dd>' + familyUnits.length + '</dd></div><div><dt>Addresses</dt><dd>' + addressCount + '</dd></div><div><dt>Family maps</dt><dd>' + componentsList.length + '</dd></div></dl><aside><strong>Private document</strong><span>This atlas may contain home addresses, contact details, and family notes. Store and share it carefully.</span></aside></article><article class="print-legend"><h2>How to use this atlas</h2><p>Family maps are named for their top sibling and group people by generation using names and years.' + referenceGuide + '</p><div><span><strong>Parent links</strong> Biological, adoptive, step, foster, guardian, or unspecified</span><span><strong>Partner links</strong> Married, partnered, separated, divorced, widowed, former, or unspecified</span></div></article><section class="print-atlas"><h2>Family maps</h2>' + componentHtml + '</section><section class="print-directory"><h1>Person directory</h1>' + profiles + "</section>" + (notes ? '<article class="print-family-notes"><h1>Family Notes</h1><p>' + u.escapeHtml(notes).replace(/\n/g, "<br>") + "</p></article>" : "");
  }

  function printAtlas() {
    if (!initialized() || !state().workspace.people.length) {
      components.message("Nothing to print", "Add at least one person before building the family atlas.");
      return;
    }
    buildPrintReport();
    $("#printReport").setAttribute("aria-hidden", "false");
    document.body.classList.add("printing-atlas");
    requestAnimationFrame(function () {
      window.print();
      document.body.classList.remove("printing-atlas");
      $("#printReport").setAttribute("aria-hidden", "true");
    });
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
    if (!needle) return [];
    const results = [];
    state().workspace.people.forEach(function (person) {
      if (model.fuzzySearchMatch(needle, model.personSearchText(person))) results.push({ type: "person", id: person.id, title: model.displayName(person), meta: "Person" + (developerReferencesEnabled() ? " · " + person.reference : "") });
    });
    const notes = state().workspace.documents[0];
    if (notes && model.fuzzySearchMatch(needle, "notes " + documentText(notes))) results.push({ type: "notes", id: notes.id, title: "Notes", meta: "Private family notes" });
    config.help.forEach(function (topic) { if (model.fuzzySearchMatch(needle, topic.title + " " + topic.keywords + " " + u.stripHtml(topic.html))) results.push({ type: "help", id: topic.id, title: topic.title, meta: "Help · " + topic.section }); });
    config.roadmap.forEach(function (item) { if (model.fuzzySearchMatch(needle, item.title + " " + item.description)) results.push({ type: "roadmap", id: item.id, title: item.title, meta: "Roadmap · " + item.state }); });
    config.releases.forEach(function (release) { const text = [release.version, release.title, release.summary].concat(release.features || [], release.improvements || [], release.fixes || [], release.knownIssues || []).join(" "); if (model.fuzzySearchMatch(needle, text)) results.push({ type: "release", id: release.version, title: release.title, meta: "Release · v" + release.version }); });
    return results.slice(0, 12);
  }

  function renderGlobalSearchResults() {
    const container = $("#globalSearchResults");
    const query = state().ui.search;
    if (!initialized() || !query || document.activeElement !== $("#globalSearch")) { container.hidden = true; return; }
    const results = globalSearchMatches(query);
    container.hidden = false;
    container.innerHTML = results.length ? results.map(function (result, index) { return '<button type="button" role="option" id="global-result-' + index + '" data-search-type="' + result.type + '" data-search-id="' + u.escapeHtml(result.id) + '"><span><strong>' + u.escapeHtml(result.title) + '</strong><small>' + u.escapeHtml(result.meta) + "</small></span><span aria-hidden=\"true\">→</span></button>"; }).join("") : '<div class="search-empty">No matches across people, contacts, Notes, Help, releases, or Roadmap.</div>';
  }

  function activateGlobalSearchResult(type, id) {
    if (type === "person") selectPerson(id, { focus: true, mobileProfile: true });
    else if (type === "notes") openNotes($("#globalSearch"));
    else if (type === "help") { openSupport("help", $("#globalSearch")); setInputValue($("#helpSearch"), config.help.find(function (topic) { return topic.id === id; })?.title || ""); renderHelp(); }
    else if (type === "roadmap") { storage.mutate(function (next) { next.modules.roadmap.search = config.roadmap.find(function (item) { return item.id === id; })?.title || ""; }, { touch: false, reason: "roadmap-search" }); openSupport("roadmap", $("#globalSearch")); }
    else if (type === "release") { versionView = "released"; openSupport("releases", $("#globalSearch")); }
    $("#globalSearchResults").hidden = true;
  }

  function openSupport(tab, trigger) {
    if (!initialized()) return;
    const chosen = tab || state().ui.supportTab || "settings";
    switchSupportTab(chosen);
    components.openDialog("#supportDialog", { trigger: trigger, focus: "[data-support-tab='" + chosen + "']" });
    renderSupport();
  }

  function switchSupportTab(tab) {
    if (tab === "developer" && !state().preferences.controls.developerMode) tab = "settings";
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
    $("#themePresets").innerHTML = config.themes.map(function (theme) { const selected = appearance.preset === theme.id; return '<button type="button" class="theme-preset" data-theme-preset="' + theme.id + '" aria-pressed="' + selected + '"><span class="theme-swatches" aria-hidden="true"><i style="--swatch:' + theme.accent + '"></i><i style="--swatch:' + theme.accent2 + '"></i><i style="--swatch:' + theme.success + '"></i><i style="--swatch:' + theme.warning + '"></i></span><strong>' + u.escapeHtml(theme.label) + "</strong></button>"; }).join("");
    ["accent", "accent2", "success", "warning", "danger"].forEach(function (key) { setInputValue($("[data-color-setting='" + key + "']"), appearance[key]); setInputValue($("[data-color-text='" + key + "']"), appearance[key]); });
    setInputValue($("#appTextScale"), Math.round(appearance.textScale * 100));
    $("#appTextScaleValue").textContent = Math.round(appearance.textScale * 100) + "%";
    setInputValue($("#readingTextScale"), Math.round(appearance.readingScale * 100));
    $("#readingTextScaleValue").textContent = Math.round(appearance.readingScale * 100) + "%";
    $$('[data-button-style]').forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.buttonStyle === preferences.controls.buttonStyle)); });
    $("#motionPreference").value = appearance.reducedMotion;
    $("#hintsToggle").setAttribute("aria-pressed", String(preferences.hints.enabled));
    $("#hintsToggle").textContent = preferences.hints.enabled ? "On" : "Off";
    setInputValue($("#familyTitle"), state().workspace.family.title);
    const localAvailable = storage.isPersistent();
    $("#localStorageSettingsState").textContent = localAvailable ? "Saved locally" : "Unavailable";
    $("#localStorageSettingsState").dataset.kind = localAvailable ? "success" : "danger";
    $("#localStorageSettingsSummary").innerHTML = '<span aria-hidden="true">' + icons.markup(localAvailable ? "check" : "close") + '</span><span><strong>' + (localAvailable ? "Browser storage is working" : "Browser storage is unavailable") + '</strong><small>' + (localAvailable ? state().workspace.people.length + " people and " + state().workspace.relationships.length + " relationships save automatically on this browser." : "Changes may not survive a reload. Export a private CSV before continuing.") + "</small></span>";
  }

  function renderHelp() {
    const query = String($("#helpSearch")?.value || "").trim().toLowerCase();
    const topics = config.help.filter(function (topic) { return !query || (topic.title + " " + topic.section + " " + topic.keywords + " " + u.stripHtml(topic.html)).toLowerCase().includes(query); });
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
    SHORTCUTS.forEach(function (shortcut) { (groups[shortcut.group] = groups[shortcut.group] || []).push(shortcut); });
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
    if (!state().preferences.controls.developerMode) return;
    const usage = await storage.usage();
    const device = pwa.detectDevice();
    const recovery = storage.recoveryInfo();
    const diagnostics = [
      ["State model", "v" + state().schemaVersion], ["Application", "v" + config.identity.version + " · build " + config.identity.buildId],
      ["People", String(state().workspace.people.length)], ["Relationships", String(state().workspace.relationships.length)], ["Addresses", String(state().workspace.people.reduce(function (sum, person) { return sum + person.addresses.length; }, 0))],
      ["Device", device.label], ["Layout", (window.innerWidth < 700 ? "Mobile" : window.innerWidth < 960 ? "Tablet" : "Desktop") + " · " + window.innerWidth + "×" + window.innerHeight],
      ["State size", u.formatBytes(usage.stateBytes)], ["Browser storage", usage.quota ? u.formatBytes(usage.usage) + " of " + u.formatBytes(usage.quota) : (usage.persistentStorageAvailable ? "Available" : "Unavailable")],
      ["Theme", document.documentElement.dataset.theme + " · " + state().preferences.appearance.preset], ["Recovery", recovery ? u.dateLabel(recovery.createdAt) + " · " + recovery.reason : "None"]
    ];
    $("#developerDiagnostics").innerHTML = diagnostics.map(function (row) { return '<div><dt>' + u.escapeHtml(row[0]) + '</dt><dd>' + u.escapeHtml(row[1]) + "</dd></div>"; }).join("");
    $("#developerState").textContent = JSON.stringify(model.exportEnvelope(state()), null, 2);
    $("#restoreRecoveryButton").disabled = !recovery;
  }

  function renderSupport() {
    $("#developerTab").hidden = !state().preferences.controls.developerMode || !config.features.developerTools;
    switchSupportTab(state().ui.supportTab);
  }

  async function resetPreferences() {
    const accepted = await components.confirm({ title: "Reset preferences?", message: "Appearance, family view settings, filters, and dismissed hints will return to defaults. People, relationships, contacts, and Notes will stay.", confirmLabel: "Reset preferences", danger: true });
    if (!accepted) return;
    storage.replace(model.resetPreferences(state()), { recoveryReason: "Before resetting preferences", reason: "reset-preferences", touch: false });
    treeNeedsFit = true;
    renderAll();
    components.toast("Preferences were reset; family data was preserved.", { title: "Preferences reset", kind: "success" });
  }

  async function eraseAllData() {
    const accepted = await components.confirm({ title: "Erase all local McFamily data?", message: "This permanently removes every person, address, relationship, Note, preference, and recovery copy from this browser and returns to the strict import screen. Export a private CSV first.", confirmLabel: "Erase everything", cancelLabel: "Keep my family", danger: true });
    if (!accepted) return;
    storage.clearAll();
    components.closeDialog("#supportDialog", "erased");
    treeNeedsFit = true;
    renderAll();
    announce("All local McFamily data was erased.", true);
    components.toast("All McFamily data was erased from this browser.", { title: "Local data erased", kind: "info", duration: 5000 });
  }

  async function restoreRecovery() {
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
    if (storage.saveRecovery("Manual recovery copy", state())) {
      renderDeveloper();
      components.toast("A recoverable local copy was saved.", { title: "Recovery copy saved", kind: "success" });
    }
  }

  function toggleDeveloperMode(force, options) {
    if (!config.features.developerTools || !initialized()) return;
    storage.mutate(function (next) { next.preferences.controls.developerMode = typeof force === "boolean" ? force : !next.preferences.controls.developerMode; }, { reason: "developer-mode" });
    $("#developerTab").hidden = !state().preferences.controls.developerMode;
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

  function handleMainClick(event) {
    const target = event.target;
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
      announce((willCollapse ? "Collapsed " : "Expanded ") + (pane === "directory" ? "the directory." : "the selected person panel."));
      return;
    }
    const select = target.closest("[data-select-person], [data-tree-person]");
    if (select) { selectPerson(select.dataset.selectPerson || select.dataset.treePerson, { focus: true, mobileProfile: true }); return; }
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
    if (modeButton) { storage.mutate(function (next) { next.ui.treeMode = modeButton.dataset.treeMode; }, { touch: false, reason: "tree-mode" }); treeNeedsFit = true; renderWorkspace(); return; }
    const nodeViewButton = target.closest("[data-tree-node-view]");
    if (nodeViewButton) { storage.mutate(function (next) { next.ui.treeNodeView = nodeViewButton.dataset.treeNodeView; }, { touch: false, reason: "tree-node-view" }); treeNeedsFit = true; renderWorkspace(); return; }
    const zoomButton = target.closest("[data-zoom]");
    if (zoomButton) { treeSurfaceMode = "natural"; treeTransform.scale = u.clamp(treeTransform.scale * (zoomButton.dataset.zoom === "in" ? 1.2 : 0.833), 0.01, 2.5, treeTransform.scale); applyTreeTransform(); return; }
    if (target.closest("[data-fit-tree]")) { fitTree(); return; }
    if (target.closest("[data-clear-directory]")) { storage.mutate(function (next) { next.ui.directorySearch = ""; next.ui.livingFilter = "all"; }, { touch: false, reason: "directory-filter" }); renderWorkspace(); return; }
    if (target.closest("[data-print-atlas]")) printAtlas();
  }

  function bindSupportEvents() {
    const dialog = $("#supportDialog");
    dialog.addEventListener("click", function (event) {
      const tab = event.target.closest("[data-support-tab]");
      if (tab) { switchSupportTab(tab.dataset.supportTab); return; }
      const mode = event.target.closest("[data-theme-mode]");
      if (mode) { storage.mutate(function (next) { next.preferences.appearance.mode = mode.dataset.themeMode; }, { reason: "appearance" }); applyAppearance(); renderSettings(); return; }
      const presetButton = event.target.closest("[data-theme-preset]");
      if (presetButton) { const theme = config.themes.find(function (item) { return item.id === presetButton.dataset.themePreset; }); if (theme) storage.mutate(function (next) { Object.assign(next.preferences.appearance, { preset: theme.id, accent: theme.accent, accent2: theme.accent2, success: theme.success, warning: theme.warning, danger: theme.danger }); }, { reason: "appearance" }); applyAppearance(); renderSettings(); return; }
      const style = event.target.closest("[data-button-style]");
      if (style) { storage.mutate(function (next) { next.preferences.controls.buttonStyle = style.dataset.buttonStyle; }, { reason: "button-style" }); applyAppearance(); renderSettings(); return; }
      const versionButton = event.target.closest("[data-version-view]");
      if (versionButton) { versionView = versionButton.dataset.versionView; renderReleases(); }
    });
    dialog.addEventListener("keydown", function (event) { const tab = event.target.closest("[role='tab']"); if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const tabs = $$('[data-support-tab]:not([hidden])'); const index = tabs.indexOf(tab); const destination = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]; destination.focus(); switchSupportTab(destination.dataset.supportTab); });
    dialog.addEventListener("change", function (event) {
      if (event.target.matches("[data-color-setting]")) { const key = event.target.dataset.colorSetting; storage.mutate(function (next) { next.preferences.appearance[key] = u.normalizeColor(event.target.value, next.preferences.appearance[key]); }, { reason: "appearance" }); applyAppearance(); renderSettings(); }
      if (event.target.id === "familyTitle") { storage.mutate(function (next) { next.workspace.family.title = u.cleanLine(event.target.value, 120) || "McFamily"; }, { reason: "family-title" }); renderMain(); }
    });
    dialog.addEventListener("blur", function (event) { if (!event.target.matches("[data-color-text]")) return; const key = event.target.dataset.colorText; const previous = state().preferences.appearance[key]; const normalized = u.normalizeColor(event.target.value, ""); if (!normalized) { event.target.value = previous; components.toast("Use a six-digit hex value such as #315f73.", { title: "Color not changed", kind: "warning" }); return; } storage.mutate(function (next) { next.preferences.appearance[key] = normalized; }, { reason: "appearance" }); applyAppearance(); renderSettings(); }, true);
    $("#appTextScale").addEventListener("input", function (event) { storage.mutate(function (next) { next.preferences.appearance.textScale = Number(event.target.value) / 100; }, { reason: "appearance" }); applyAppearance(); $("#appTextScaleValue").textContent = event.target.value + "%"; });
    $("#readingTextScale").addEventListener("input", function (event) { storage.mutate(function (next) { next.preferences.appearance.readingScale = Number(event.target.value) / 100; }, { reason: "appearance" }); applyAppearance(); $("#readingTextScaleValue").textContent = event.target.value + "%"; });
    $("#motionPreference").addEventListener("change", function (event) { storage.mutate(function (next) { next.preferences.appearance.reducedMotion = event.target.value; }, { reason: "appearance" }); applyAppearance(); });
    $("#hintsToggle").addEventListener("click", function () { storage.mutate(function (next) { next.preferences.hints.enabled = !next.preferences.hints.enabled; }, { reason: "hints" }); renderHeader(); renderSettings(); });
    $("#restoreHintsButton").addEventListener("click", function () { storage.mutate(function (next) { next.preferences.hints.dismissed = []; next.ui.dismissedHints = []; }, { reason: "hints" }); renderHeader(); renderSettings(); components.toast("All contextual hints are available again.", { title: "Hints restored", kind: "success" }); });
    $("#exportButton").addEventListener("click", portability.exportCsv);
    $("#importButton").addEventListener("click", function () { $("#importFileInput").click(); });
    $("#resetPreferencesButton").addEventListener("click", resetPreferences);
    $("#eraseAllButton").addEventListener("click", eraseAllData);
    $("#helpSearch").addEventListener("input", renderHelp);
    $("#supportRoadmapSearch").addEventListener("input", function (event) { storage.mutate(function (next) { next.modules.roadmap.search = u.cleanLine(event.target.value, 200); }, { touch: false, reason: "roadmap-filter" }); renderSupportRoadmap(); });
    $("#supportRoadmapState").addEventListener("change", function (event) { storage.mutate(function (next) { next.modules.roadmap.state = event.target.value; }, { touch: false, reason: "roadmap-filter" }); renderSupportRoadmap(); });
    $("#supportRoadmapSort").addEventListener("change", function (event) { storage.mutate(function (next) { next.modules.roadmap.sortBy = event.target.value; }, { touch: false, reason: "roadmap-sort" }); renderSupportRoadmap(); });
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
    const treeNode = event.target.closest && event.target.closest("[data-tree-person]");
    if (treeNode && ["Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Enter" || event.key === " ") selectPerson(treeNode.dataset.treePerson, { focus: true, mobileProfile: true });
      else { const relative = relativeForArrow(treeNode.dataset.treePerson, event.key); if (relative) selectPerson(relative.id, { focus: true, mobileProfile: true }); }
      return;
    }
    if (event.key === "Escape") { $("#globalSearchResults").hidden = true; return; }
    if (u.isEditableTarget(event.target) || event.metaKey) return;
    if (event.code === "Slash") { event.preventDefault(); if (event.shiftKey) openSupport("help", event.target); else if (initialized()) { $("#globalSearch").focus(); $("#globalSearch").select(); } return; }
    if (event.repeat || !initialized()) return;
    if (event.code === "KeyP") { event.preventDefault(); printAtlas(); }
    else if (event.code === "KeyN") { event.preventDefault(); openNotes(event.target); }
    else if (event.code === "KeyV") { event.preventDefault(); openSupport("releases", event.target); }
    else if (event.code === "KeyE") { event.preventDefault(); portability.exportCsv(); }
    else if (event.code === "KeyT") { event.preventDefault(); toggleThemeFromAppIcon(); }
    else if (event.code === "KeyD") { event.preventDefault(); toggleDeveloperMode(undefined, { openPanel: true }); }
  }

  function bindGeneralEvents() {
    bindAppIconGestures();
    $("#versionButton").addEventListener("click", function (event) { openSupport("releases", event.currentTarget); });
    $("#directoryButton").addEventListener("click", function () {
      storage.mutate(function (next) { next.ui.directoryCollapsed = false; next.ui.mobileView = "directory"; }, { touch: false, reason: "directory-open" });
      treeNeedsFit = true;
      renderHeader();
      renderWorkspace();
      requestAnimationFrame(function () { $("#directorySearch")?.focus(); });
    });
    $("#supportButton").addEventListener("click", function (event) { openSupport(state().ui.supportTab, event.currentTarget); });
    $("#notesButton").addEventListener("click", function (event) { openNotes(event.currentTarget); });
    $("#addPersonButton").addEventListener("click", function (event) { pendingRelative = null; openPersonEditor("", event.currentTarget); });
    $("#printButton").addEventListener("click", printAtlas);
    $("#notesTextarea").addEventListener("input", function (event) { saveNotes(event.target.value); });
    $("#floatingStatusButton").addEventListener("click", function (event) { openSupport("settings", event.currentTarget); requestAnimationFrame(function () { $("#storageSettings").scrollIntoView({ block: "start" }); }); });
    $("#mainContent").addEventListener("click", handleMainClick);
    $("#mainContent").addEventListener("change", function (event) {
      if (event.target.id === "onboardingImportInput") { portability.previewFile(event.target.files && event.target.files[0], $("#firstImportButton")); event.target.value = ""; }
      else if (event.target.id === "livingFilter") { storage.mutate(function (next) { next.ui.livingFilter = event.target.value; }, { touch: false, reason: "directory-filter" }); renderDirectoryList(); }
      else if (event.target.id === "directorySort") { storage.mutate(function (next) { next.ui.directorySort = event.target.value; }, { touch: false, reason: "directory-sort" }); renderDirectoryList(); }
      else if (event.target.id === "ancestorDepth" || event.target.id === "descendantDepth") {
        const key = event.target.id === "ancestorDepth" ? "ancestorDepth" : "descendantDepth";
        storage.mutate(function (next) { next.ui[key] = Number(event.target.value); next.ui.generationDepth = Math.max(next.ui.ancestorDepth, next.ui.descendantDepth); }, { touch: false, reason: "tree-depth" });
        treeNeedsFit = true;
        $("#" + key + "Value").textContent = event.target.value;
        renderTree();
      }
    });
    $("#mainContent").addEventListener("input", function (event) { if (event.target.id === "directorySearch") { storage.mutate(function (next) { next.ui.directorySearch = u.cleanLine(event.target.value, 200); }, { touch: false, reason: "directory-filter" }); renderDirectoryList(); } });
    $("#personForm").addEventListener("submit", savePerson);
    $("#relationshipForm").addEventListener("submit", saveRelationship);
    $("#relationshipType").addEventListener("change", updateRelationshipFormType);
    $("#personDialog").addEventListener("click", function (event) {
      if (event.target.closest("[data-add-address]")) { syncPersonRepeatables(); personDraft.addresses.push({ id: u.uid("address"), label: "Home", current: true, startDate: { value: "", qualifier: "exact" }, endDate: { value: "", qualifier: "exact" }, order: personDraft.addresses.length }); renderPersonRepeatables(); }
      if (event.target.closest("[data-add-phone]")) { syncPersonRepeatables(); personDraft.phones.push({ id: u.uid("phone"), label: "Mobile", value: "", order: personDraft.phones.length }); renderPersonRepeatables(); }
      if (event.target.closest("[data-add-email]")) { syncPersonRepeatables(); personDraft.emails.push({ id: u.uid("email"), label: "Personal", value: "", order: personDraft.emails.length }); renderPersonRepeatables(); }
      const removeAddress = event.target.closest("[data-remove-address]");
      if (removeAddress) { syncPersonRepeatables(); personDraft.addresses.splice(Number(removeAddress.dataset.removeAddress), 1); renderPersonRepeatables(); }
      const removeContact = event.target.closest("[data-remove-contact]");
      if (removeContact) { syncPersonRepeatables(); const parts = removeContact.dataset.removeContact.split(":"); personDraft[parts[0] + "s"].splice(Number(parts[1]), 1); renderPersonRepeatables(); }
    });
    document.addEventListener("click", function (event) {
      const action = event.target.closest("[data-action]");
      if (action && action.dataset.action === "clear-help-search") { $("#helpSearch").value = ""; renderHelp(); }
      const dismissHint = event.target.closest("[data-dismiss-hint]");
      if (dismissHint) { storage.mutate(function (next) { next.preferences.hints.dismissed = Array.from(new Set(next.preferences.hints.dismissed.concat(dismissHint.dataset.dismissHint))); }, { reason: "dismiss-hint" }); renderHeader(); }
      if (event.target.closest("[data-dismiss-release]")) { storage.mutate(function (next) { next.ui.seenReleaseVersion = config.releases[0].version; }, { reason: "release-seen" }); renderHeader(); }
      if (event.target.closest("[data-open-releases]")) openSupport("releases", event.target.closest("[data-open-releases]"));
      const safeLink = event.target.closest("[data-open-url]");
      if (safeLink && !u.safeExternalOpen(safeLink.dataset.openUrl)) components.toast("That external address is not allowed.", { title: "Link unavailable", kind: "warning" });
    });
    $("#globalSearch").addEventListener("input", function (event) { storage.mutate(function (next) { next.ui.search = u.cleanLine(event.target.value, 200); }, { touch: false, reason: "global-search" }); renderGlobalSearchResults(); });
    $("#globalSearch").addEventListener("focus", renderGlobalSearchResults);
    $("#globalSearch").addEventListener("keydown", function (event) { const results = $$("button[role='option']", $("#globalSearchResults")); if (event.key === "ArrowDown" && results.length) { event.preventDefault(); results[0].focus(); } if (event.key === "Escape") { $("#globalSearchResults").hidden = true; event.target.select(); } });
    $("#globalSearchResults").addEventListener("click", function (event) { const result = event.target.closest("[data-search-type]"); if (result) activateGlobalSearchResult(result.dataset.searchType, result.dataset.searchId); });
    $("#globalSearchResults").addEventListener("keydown", function (event) { const button = event.target.closest("[data-search-type]"); if (!button) return; const buttons = $$("[data-search-type]", event.currentTarget); const index = buttons.indexOf(button); if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); } else if (event.key === "Escape") { event.preventDefault(); $("#globalSearch").focus(); $("#globalSearchResults").hidden = true; } });
    document.addEventListener("focusin", function (event) { if (!event.target.closest(".global-search-wrap")) $("#globalSearchResults").hidden = true; });
    bindSupportEvents();
    document.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("keyup", function (event) { updateShortcutHints(event, false); });
    window.addEventListener("blur", function () { updateShortcutHints({ altKey: false, shiftKey: false, ctrlKey: false }, true); });
    window.addEventListener("afterprint", function () { document.body.classList.remove("printing-atlas"); $("#printReport").setAttribute("aria-hidden", "true"); });
  }

  function renderAll() {
    applyAppearance();
    renderHeader();
    renderNotesEditor();
    renderMain();
    renderGlobalSearchResults();
    if ($("#supportDialog").open && initialized()) renderSupport();
  }

  function bindRuntimeEvents() {
    window.addEventListener("app:storageerror", function (event) { components.toast(event.detail.message, { title: event.detail.title, kind: "danger", duration: 0, actionLabel: initialized() ? "Export" : "", onAction: initialized() ? portability.exportCsv : null }); renderLocalStatus(); });
    window.addEventListener("app:statesaved", renderLocalStatus);
    window.addEventListener("app:pwaerror", function (event) { components.toast(event.detail.message, { title: "Offline support unavailable", kind: "warning", duration: 5000 }); });
    window.addEventListener("app:statechange", function (event) { if (["import", "recovery", "erase-all", "reset-preferences"].includes(event.detail.reason)) { treeNeedsFit = true; renderAll(); } });
    window.addEventListener("resize", u.debounce(function () { if (initialized() && currentTreeLayout) { if (treeSurfaceMode === "fit") fitTree(); else sizeTreeSurface(); } if ($("#developerPanel") && !$("#developerPanel").hidden) renderDeveloper(); }, 120));
    ["(prefers-color-scheme: dark)", "(prefers-reduced-motion: reduce)"].forEach(function (query) { const media = window.matchMedia(query); if (typeof media.addEventListener === "function") media.addEventListener("change", applyAppearance); else if (typeof media.addListener === "function") media.addListener(applyAppearance); });
  }

  function showLoadReport() {
    const report = storage.getLoadReport();
    if (report.recovered) components.toast("The saved state was unusable, so the last valid recovery copy was loaded.", { title: "Recovery copy restored", kind: "warning", duration: 6000 });
    else if (report.error && report.source === "default") components.toast("Saved data could not be read. McFamily returned to the private import screen.", { title: "Import required", kind: "warning", duration: 6000 });
    else if (report.migrations.length) components.toast("Saved data was upgraded through " + report.migrations.join(", ") + ".", { title: "State upgraded", kind: "success" });
  }

  function init() {
    storage.load();
    applyIdentity();
    components.init();
    portability.init();
    bindGeneralEvents();
    bindRuntimeEvents();
    pwa.init();
    renderAll();
    requestAnimationFrame(function () { document.documentElement.classList.add("app-ready"); });
    showLoadReport();
  }

  App.application = { render: renderAll, openSupport: openSupport, openNotes: openNotes, printAtlas: printAtlas, shortcuts: SHORTCUTS };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
