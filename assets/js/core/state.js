(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const u = App.utils;
  const PARENT_KINDS = new Set(config.parentKinds.map(function (item) { return item.id; }));
  const PARTNER_STATUSES = new Set(config.partnerStatuses.map(function (item) { return item.id; }));
  const DATE_QUALIFIERS = new Set(["exact", "about", "before", "after"]);

  function blankDocument(now) {
    return { id: "app-notes", title: "Notes", html: "", order: 0, createdAt: now, updatedAt: now };
  }

  function defaultTheme() {
    return config.themes[0];
  }

  function createDefaultState() {
    const now = u.isoNow();
    const theme = defaultTheme();
    return {
      schemaVersion: config.schemaVersion,
      meta: {
        appVersion: config.identity.version,
        buildId: config.identity.buildId,
        createdAt: now,
        updatedAt: now,
        lastMutationId: u.uid("mutation"),
        tombstones: { records: [], documents: [], people: [], relationships: [] }
      },
      workspace: {
        family: { title: "McFamily", initializedAt: "", homePersonId: "" },
        people: [],
        relationships: [],
        records: [],
        documents: [blankDocument(now)]
      },
      preferences: {
        appearance: {
          mode: "light",
          preset: theme.id,
          accent: theme.accent,
          accent2: theme.accent2,
          success: theme.success,
          warning: theme.warning,
          danger: theme.danger,
          textScale: 1,
          readingScale: 1,
          reducedMotion: "system"
        },
        controls: {
          buttonStyle: "both",
          shortcutHints: true,
          shortcutHintModifier: config.controls.shortcutHintModifier,
          developerMode: false
        },
        hints: { enabled: config.features.hints, dismissed: [] },
        installation: { iconVariant: "auto" }
      },
      ui: {
        selectedPersonId: "",
        treeFocusId: "",
        treeMode: "focus",
        treeNodeView: "condensed",
        generationDepth: 10,
        ancestorDepth: 10,
        descendantDepth: 10,
        directoryCollapsed: true,
        profileCollapsed: false,
        showInferredParentLines: false,
        hideUnplacedLineage: true,
        panelSizingCustomized: false,
        directoryPanelWidth: 0,
        profilePanelWidth: 0,
        directorySearch: "",
        directorySort: "first",
        directoryFilters: [],
        mobileView: "tree",
        search: "",
        favoritePersonIds: [],
        favoritesOnly: false,
        seenReleaseVersion: "",
        supportTab: "settings",
        dismissedHints: []
      },
      modules: {
        family: { enabled: true },
        documents: { enabled: true },
        roadmap: { search: "", state: "all", sortBy: "priority", sortDirection: "asc" }
      }
    };
  }

  function migrate1to2(input) {
    const source = u.plainObject(input);
    const now = u.isoNow();
    const rawRecords = Array.isArray(source.items) ? source.items : (Array.isArray(source.records) ? source.records : []);
    const rawDocuments = Array.isArray(source.notes) ? source.notes : (Array.isArray(source.documents) ? source.documents : []);
    return {
      schemaVersion: 2,
      meta: { appVersion: source.appVersion || source.version || "", createdAt: source.createdAt || now, updatedAt: source.updatedAt || now },
      workspace: {
        title: source.workspaceTitle || source.title || "Legacy workspace",
        records: rawRecords,
        documents: rawDocuments.map(function (item, index) {
          if (typeof item === "string") return { id: u.uid("document"), title: "Note " + (index + 1), html: u.escapeHtml(item).replace(/\n/g, "<br>"), order: index, createdAt: now, updatedAt: now };
          return item;
        })
      },
      preferences: u.plainObject(source.preferences || source.settings),
      ui: u.plainObject(source.ui),
      modules: u.plainObject(source.modules)
    };
  }

  function migrate2to3(input) {
    const source = u.plainObject(input);
    source.schemaVersion = 3;
    source.meta = Object.assign({ tombstones: { records: [], documents: [] } }, u.plainObject(source.meta));
    return source;
  }

  function migrate3to4(input) {
    const source = u.plainObject(input);
    source.schemaVersion = 4;
    return source;
  }

  function migrate4to5(input) {
    const source = u.plainObject(input);
    const workspace = u.plainObject(source.workspace);
    source.schemaVersion = 5;
    source.workspace = Object.assign({}, workspace, {
      family: u.plainObject(workspace.family),
      people: Array.isArray(workspace.people) ? workspace.people : [],
      relationships: Array.isArray(workspace.relationships) ? workspace.relationships : []
    });
    return source;
  }

  function migrate5to6(input) {
    const source = u.plainObject(input);
    source.schemaVersion = 6;
    return source;
  }

  function migrate6to7(input) {
    const source = u.plainObject(input);
    source.schemaVersion = 7;
    source.ui = Object.assign({ treeNodeView: "condensed", directoryCollapsed: false, profileCollapsed: false }, u.plainObject(source.ui));
    return source;
  }

  function mcLineageLivingStatus(person, fallback) {
    const source = u.plainObject(person);
    const imported = u.plainObject(source.source);
    if (imported.format !== "mclineage-cleaned") return fallback;
    const fields = u.plainObject(imported.fields);
    const deathValue = u.cleanLine(fields.person_date_death_value, 40) || u.cleanLine(source.death && source.death.date && source.death.date.value, 40);
    if (deathValue) return "deceased";
    const birthValue = u.cleanLine(source.birth && source.birth.date && source.birth.date.value, 40) || u.cleanLine(fields.person_date_birth_value, 40);
    const birthMatch = birthValue.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
    if (!birthMatch) return "unknown";
    const hundredthBirthday = new Date(Number(birthMatch[1]) + 100, birthMatch[2] ? Number(birthMatch[2]) - 1 : 6, birthMatch[3] ? Number(birthMatch[3]) : 1);
    return new Date() > hundredthBirthday ? "deceased" : "living";
  }

  function presumeUnknownPartnersDeceased(people, relationships) {
    const peopleById = new Map(people.map(function (person) { return [person.id, person]; }));
    const deceasedIds = new Set(people.filter(function (person) {
      return person.livingStatus === "deceased";
    }).map(function (person) { return person.id; }));
    let changed = true;
    while (changed) {
      changed = false;
      relationships.filter(function (relationship) { return relationship.type === "partner"; }).forEach(function (relationship) {
        const first = peopleById.get(relationship.person1Id);
        const second = peopleById.get(relationship.person2Id);
        if (first && deceasedIds.has(first.id) && second && second.livingStatus === "unknown") {
          second.livingStatus = "deceased";
          deceasedIds.add(second.id);
          changed = true;
        }
        if (second && deceasedIds.has(second.id) && first && first.livingStatus === "unknown") {
          first.livingStatus = "deceased";
          deceasedIds.add(first.id);
          changed = true;
        }
      });
    }
  }

  function presumeEarlyLinealGenerationsDeceased(people) {
    people.forEach(function (person) {
      if (person.livingStatus !== "unknown") return;
      const fields = u.plainObject(person.source && person.source.fields);
      const lineage = u.cleanLine(fields.lineage_id, 400);
      if (!lineage || lineage.split(".").some(function (part) { return part === "99"; })) return;
      const generation = lineage.split(".").filter(Boolean).length - 1;
      if (generation >= 0 && generation <= 4) person.livingStatus = "deceased";
    });
  }

  function migrate7to8(input) {
    const source = u.plainObject(input);
    const workspace = u.plainObject(source.workspace);
    source.schemaVersion = 8;
    if (Array.isArray(workspace.people)) workspace.people.forEach(function (person) {
      person.livingStatus = mcLineageLivingStatus(person, person.livingStatus);
    });
    return source;
  }

  const migrations = { 1: migrate1to2, 2: migrate2to3, 3: migrate3to4, 4: migrate4to5, 5: migrate5to6, 6: migrate6to7, 7: migrate7to8 };

  function unwrapInput(input) {
    const source = u.plainObject(input);
    if (source.exportFormat && source.state && typeof source.state === "object") return source.state;
    if (source.backup && source.backup.state && typeof source.backup.state === "object") return source.backup.state;
    if (source.data && source.data.workspace && typeof source.data === "object") return source.data;
    return source;
  }

  function migrate(input) {
    let next = u.clone(unwrapInput(input));
    let version = Number(next.schemaVersion || next.stateVersion || 1);
    if (!Number.isInteger(version) || version < 1) version = 1;
    if (version > config.schemaVersion) throw new Error("This state uses a newer model (v" + version + ") than McFamily supports (v" + config.schemaVersion + ").");
    const applied = [];
    while (version < config.schemaVersion) {
      const migration = migrations[version];
      if (!migration) throw new Error("No migration is available from state model v" + version + ".");
      next = migration(next);
      applied.push(version + "→" + (version + 1));
      version += 1;
    }
    next.schemaVersion = config.schemaVersion;
    return { state: next, applied: applied };
  }

  function cleanId(value, prefix) {
    return u.cleanLine(value, 100).replace(/[^a-z0-9_-]/gi, "-") || u.uid(prefix);
  }

  function normalizeFlexibleDate(input) {
    const source = typeof input === "string" ? { value: input } : u.plainObject(input);
    let value = u.cleanLine(source.value || source.date, 10);
    if (value && !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(value)) value = "";
    return {
      value: value,
      qualifier: DATE_QUALIFIERS.has(source.qualifier) ? source.qualifier : "exact"
    };
  }

  function normalizeLifeEvent(input) {
    const source = u.plainObject(input);
    return {
      date: normalizeFlexibleDate(source.date || source.value),
      place: u.cleanLine(source.place, 240)
    };
  }

  function normalizeSource(input) {
    const source = u.plainObject(input);
    const fields = u.plainObject(source.fields);
    const normalizedFields = {};
    Object.keys(fields).slice(0, 160).forEach(function (key) {
      const cleanKey = u.cleanLine(key, 100);
      if (cleanKey) normalizedFields[cleanKey] = u.cleanText(fields[key], 4000).trim();
    });
    return {
      format: u.cleanLine(source.format, 80),
      fields: normalizedFields
    };
  }

  function normalizeAddress(input, index, usedIds) {
    const source = u.plainObject(input);
    let id = cleanId(source.id, "address");
    if (usedIds.has(id)) id = u.uid("address");
    usedIds.add(id);
    return {
      id: id,
      label: u.cleanLine(source.label || source.type || "Home", 60) || "Home",
      current: source.current !== false,
      line1: u.cleanLine(source.line1 || source.street, 200),
      line2: u.cleanLine(source.line2, 200),
      city: u.cleanLine(source.city || source.locality, 100),
      region: u.cleanLine(source.region || source.state || source.province, 100),
      postalCode: u.cleanLine(source.postalCode || source.zip, 40),
      country: u.cleanLine(source.country, 100),
      startDate: normalizeFlexibleDate(source.startDate),
      endDate: normalizeFlexibleDate(source.endDate),
      notes: u.cleanText(source.notes, 1000).trim(),
      order: Number.isFinite(Number(source.order)) ? Math.round(Number(source.order)) : index
    };
  }

  function normalizeContact(input, index, prefix) {
    const source = typeof input === "string" ? { value: input } : u.plainObject(input);
    return {
      id: cleanId(source.id, prefix),
      label: u.cleanLine(source.label || (prefix === "phone" ? "Mobile" : "Personal"), 60),
      value: u.cleanLine(source.value, 240),
      order: Number.isFinite(Number(source.order)) ? Math.round(Number(source.order)) : index
    };
  }

  function normalizePerson(input, index, usedIds, now) {
    const source = u.plainObject(input);
    const sourceNames = u.plainObject(source.names);
    let id = cleanId(source.id, "person");
    if (usedIds.has(id)) id = u.uid("person");
    usedIds.add(id);
    const createdAt = u.ensureIso(source.createdAt, now);
    const addressIds = new Set();
    return {
      id: id,
      reference: "",
      names: {
        given: u.cleanLine(sourceNames.given || source.givenName, 100),
        middle: u.cleanLine(sourceNames.middle || source.middleName, 120),
        family: u.cleanLine(sourceNames.family || source.familyName || source.surname, 120),
        birth: u.cleanLine(sourceNames.birth || source.birthSurname || source.maidenName, 120),
        preferred: u.cleanLine(sourceNames.preferred || source.preferredName, 100),
        suffix: u.cleanLine(sourceNames.suffix || source.suffix, 40),
        display: u.cleanLine(sourceNames.display || source.displayName || source.name, 200)
      },
      livingStatus: ["living", "deceased", "unknown"].includes(source.livingStatus) ? source.livingStatus : "unknown",
      gender: u.cleanLine(source.gender, 80),
      pronouns: u.cleanLine(source.pronouns, 80),
      birth: normalizeLifeEvent(source.birth),
      death: normalizeLifeEvent(source.death),
      addresses: (Array.isArray(source.addresses) ? source.addresses : []).slice(0, config.controls.maxAddressesPerPerson).map(function (address, addressIndex) { return normalizeAddress(address, addressIndex, addressIds); }),
      phones: (Array.isArray(source.phones) ? source.phones : []).slice(0, config.controls.maxContactsPerPerson).map(function (phone, phoneIndex) { return normalizeContact(phone, phoneIndex, "phone"); }).filter(function (item) { return item.value; }),
      emails: (Array.isArray(source.emails) ? source.emails : []).slice(0, config.controls.maxContactsPerPerson).map(function (email, emailIndex) { return normalizeContact(email, emailIndex, "email"); }).filter(function (item) { return item.value; }),
      heritageNote: u.cleanText(source.heritageNote || source.heritage, config.controls.maxTextLength).trim(),
      notes: u.cleanText(source.notes, config.controls.maxTextLength).trim(),
      source: normalizeSource(source.source),
      order: Number.isFinite(Number(source.order)) ? Math.round(Number(source.order)) : index,
      createdAt: createdAt,
      updatedAt: u.ensureIso(source.updatedAt, createdAt)
    };
  }

  function normalizeRelationship(input, index, usedIds, personIds, now) {
    const source = u.plainObject(input);
    let id = cleanId(source.id, "relationship");
    if (usedIds.has(id)) id = u.uid("relationship");
    usedIds.add(id);
    const createdAt = u.ensureIso(source.createdAt, now);
    if (source.type === "parent-child") {
      const parentId = cleanId(source.parentId, "missing");
      const childId = cleanId(source.childId, "missing");
      if (!personIds.has(parentId) || !personIds.has(childId) || parentId === childId) return null;
      return {
        id: id,
        type: "parent-child",
        parentId: parentId,
        childId: childId,
        kind: mcLineageParentKind(source) || (PARENT_KINDS.has(source.kind) ? source.kind : "unknown"),
        startDate: normalizeFlexibleDate(source.startDate),
        endDate: normalizeFlexibleDate(source.endDate),
        place: u.cleanLine(source.place, 240),
        notes: u.cleanText(source.notes, 4000).trim(),
        source: normalizeSource(source.source),
        order: Number.isFinite(Number(source.order)) ? Math.round(Number(source.order)) : index,
        createdAt: createdAt,
        updatedAt: u.ensureIso(source.updatedAt, createdAt)
      };
    }
    if (source.type === "partner") {
      const person1Id = cleanId(source.person1Id || (source.personIds && source.personIds[0]), "missing");
      const person2Id = cleanId(source.person2Id || (source.personIds && source.personIds[1]), "missing");
      if (!personIds.has(person1Id) || !personIds.has(person2Id) || person1Id === person2Id) return null;
      return {
        id: id,
        type: "partner",
        person1Id: person1Id,
        person2Id: person2Id,
        status: PARTNER_STATUSES.has(source.status) ? source.status : "unknown",
        startDate: normalizeFlexibleDate(source.startDate),
        endDate: normalizeFlexibleDate(source.endDate),
        place: u.cleanLine(source.place, 240),
        notes: u.cleanText(source.notes, 4000).trim(),
        source: normalizeSource(source.source),
        order: Number.isFinite(Number(source.order)) ? Math.round(Number(source.order)) : index,
        createdAt: createdAt,
        updatedAt: u.ensureIso(source.updatedAt, createdAt)
      };
    }
    return null;
  }

  function normalizeDocument(input, index, usedIds, now) {
    const source = u.plainObject(input);
    let id = cleanId(source.id, "document");
    if (usedIds.has(id)) id = u.uid("document");
    usedIds.add(id);
    const createdAt = u.ensureIso(source.createdAt, now);
    return {
      id: id,
      title: u.cleanLine(source.title || "Notes", 140) || "Notes",
      html: u.sanitizeRichHtml(source.html || source.content || source.text || ""),
      order: Number.isFinite(Number(source.order)) ? Math.round(Number(source.order)) : index,
      createdAt: createdAt,
      updatedAt: u.ensureIso(source.updatedAt, createdAt)
    };
  }

  function consolidateDocuments(documents, now) {
    const ordered = documents.slice().sort(function (a, b) { return a.order - b.order; });
    if (!ordered.length) return [blankDocument(now)];
    if (ordered.length === 1) return [Object.assign({}, ordered[0], { id: "app-notes", title: "Notes", order: 0 })];
    const text = ordered.map(function (item) {
      const body = u.richTextToPlainText(item.html, config.controls.maxDocumentHtmlLength);
      return [item.title, body].filter(Boolean).join("\n\n");
    }).filter(Boolean).join("\n\n—\n\n");
    return [{
      id: "app-notes",
      title: "Notes",
      html: u.escapeHtml(u.cleanText(text, config.controls.maxDocumentHtmlLength)).replace(/\n/g, "<br>"),
      order: 0,
      createdAt: ordered[0].createdAt,
      updatedAt: ordered.reduce(function (latest, item) { return Date.parse(item.updatedAt) > Date.parse(latest) ? item.updatedAt : latest; }, ordered[0].updatedAt)
    }];
  }

  function normalizeTombstones(value) {
    const used = new Set();
    return (Array.isArray(value) ? value : []).map(function (entry) {
      const source = u.plainObject(entry);
      const id = cleanId(source.id, "");
      if (!id || used.has(id)) return null;
      used.add(id);
      return { id: id, deletedAt: u.ensureIso(source.deletedAt) };
    }).filter(Boolean).slice(0, 10000);
  }

  function normalizeRecord(input, index, usedIds, now) {
    const source = u.plainObject(input);
    let id = cleanId(source.id, "record");
    if (usedIds.has(id)) id = u.uid("record");
    usedIds.add(id);
    return {
      id: id,
      title: u.cleanLine(source.title || source.name || "Legacy record", 140),
      summary: u.cleanText(source.summary || source.description, 4000).trim(),
      createdAt: u.ensureIso(source.createdAt, now),
      updatedAt: u.ensureIso(source.updatedAt, now),
      order: Number.isFinite(Number(source.order)) ? Math.round(Number(source.order)) : index
    };
  }

  function mcLineageParentKind(relationship) {
    const imported = u.plainObject(u.plainObject(relationship).source);
    if (imported.format !== "mclineage-cleaned") return "";
    const fields = u.plainObject(imported.fields);
    if (u.cleanLine(fields.parent_affinal_person_id, 100)) return "affinal";
    return u.cleanLine(fields.parent_consanguinity_person_id, 100) ? "biological" : "";
  }

  function normalize(input) {
    const source = u.plainObject(input);
    const base = createDefaultState();
    const now = u.isoNow();
    const sourceMeta = u.plainObject(source.meta);
    const sourceWorkspace = u.plainObject(source.workspace);
    const sourceFamily = u.plainObject(sourceWorkspace.family);
    const sourcePreferences = u.plainObject(source.preferences);
    const sourceAppearance = u.plainObject(sourcePreferences.appearance);
    const sourceControls = u.plainObject(sourcePreferences.controls);
    const sourceHints = u.plainObject(sourcePreferences.hints);
    const sourceInstallation = u.plainObject(sourcePreferences.installation);
    const sourceUi = u.plainObject(source.ui);
    const sourceModules = u.plainObject(source.modules);
    const sourceRoadmap = u.plainObject(sourceModules.roadmap);
    const personIds = new Set();
    const people = (Array.isArray(sourceWorkspace.people) ? sourceWorkspace.people : []).slice(0, config.controls.maxPeople).map(function (person, index) { return normalizePerson(person, index, personIds, now); });
    people.forEach(function (person) { person.livingStatus = mcLineageLivingStatus(person, person.livingStatus); });
    const relationshipIds = new Set();
    const relationships = (Array.isArray(sourceWorkspace.relationships) ? sourceWorkspace.relationships : []).slice(0, config.controls.maxRelationships).map(function (relationship, index) { return normalizeRelationship(relationship, index, relationshipIds, personIds, now); }).filter(Boolean);
    presumeEarlyLinealGenerationsDeceased(people);
    presumeUnknownPartnersDeceased(people, relationships);
    const documentIds = new Set();
    const documents = consolidateDocuments((Array.isArray(sourceWorkspace.documents) ? sourceWorkspace.documents : []).map(function (document, index) { return normalizeDocument(document, index, documentIds, now); }), now);
    const recordIds = new Set();
    const records = (Array.isArray(sourceWorkspace.records) ? sourceWorkspace.records : []).map(function (record, index) { return normalizeRecord(record, index, recordIds, now); });
    const theme = config.themes.find(function (item) { return item.id === sourceAppearance.preset; }) || defaultTheme();
    const homePersonId = personIds.has(sourceFamily.homePersonId) ? sourceFamily.homePersonId : (people[0] ? people[0].id : "");
    const selectedPersonId = sourceUi.selectedPersonId === "" ? "" : (personIds.has(sourceUi.selectedPersonId) ? sourceUi.selectedPersonId : homePersonId);
    const validDirectoryFilters = new Set(config.directoryFilters.map(function (filter) { return filter.id; }));
    const legacyDirectoryFilter = ["living", "deceased", "unknown"].includes(sourceUi.livingFilter) ? [sourceUi.livingFilter] : [];
    const directoryFilters = Array.from(new Set((Array.isArray(sourceUi.directoryFilters) ? sourceUi.directoryFilters : legacyDirectoryFilter).map(function (filter) { return u.cleanLine(filter, 40); }).filter(function (filter) { return validDirectoryFilters.has(filter); })));
    const sourceTombstones = u.plainObject(sourceMeta.tombstones);
    const state = {
      schemaVersion: config.schemaVersion,
      meta: {
        appVersion: config.identity.version,
        buildId: config.identity.buildId,
        createdAt: u.ensureIso(sourceMeta.createdAt, now),
        updatedAt: u.ensureIso(sourceMeta.updatedAt, now),
        lastMutationId: u.cleanLine(sourceMeta.lastMutationId, 100) || u.uid("mutation"),
        tombstones: {
          records: normalizeTombstones(sourceTombstones.records),
          documents: normalizeTombstones(sourceTombstones.documents),
          people: normalizeTombstones(sourceTombstones.people),
          relationships: normalizeTombstones(sourceTombstones.relationships)
        }
      },
      workspace: {
        family: {
          title: u.cleanLine(sourceFamily.title || sourceWorkspace.title || "McFamily", 120) || "McFamily",
          initializedAt: sourceFamily.initializedAt ? u.ensureIso(sourceFamily.initializedAt, now) : "",
          homePersonId: homePersonId
        },
        people: people,
        relationships: relationships,
        records: records,
        documents: documents
      },
      preferences: {
        appearance: {
          mode: ["system", "light", "dark"].includes(sourceAppearance.mode) ? sourceAppearance.mode : "light",
          preset: theme.id,
          accent: u.normalizeColor(sourceAppearance.accent, theme.accent),
          accent2: u.normalizeColor(sourceAppearance.accent2, theme.accent2),
          success: u.normalizeColor(sourceAppearance.success, theme.success),
          warning: u.normalizeColor(sourceAppearance.warning, theme.warning),
          danger: u.normalizeColor(sourceAppearance.danger, theme.danger),
          textScale: u.clamp(sourceAppearance.textScale, 0.85, 1.3, 1),
          readingScale: u.clamp(sourceAppearance.readingScale, 0.85, 1.6, 1),
          reducedMotion: ["system", "reduce", "full"].includes(sourceAppearance.reducedMotion) ? sourceAppearance.reducedMotion : "system"
        },
        controls: {
          buttonStyle: ["icons", "text", "both"].includes(sourceControls.buttonStyle) ? sourceControls.buttonStyle : "both",
          shortcutHints: sourceControls.shortcutHints !== false,
          shortcutHintModifier: ["Alt", "Shift", "Control"].includes(sourceControls.shortcutHintModifier) ? sourceControls.shortcutHintModifier : config.controls.shortcutHintModifier,
          developerMode: sourceControls.developerMode === true
        },
        hints: {
          enabled: config.features.hints && sourceHints.enabled !== false,
          dismissed: Array.from(new Set((Array.isArray(sourceHints.dismissed) ? sourceHints.dismissed : []).map(function (id) { return u.cleanLine(id, 80); }).filter(Boolean))).slice(0, 200)
        },
        installation: { iconVariant: ["auto", "light", "dark"].includes(sourceInstallation.iconVariant) ? sourceInstallation.iconVariant : "auto" }
      },
      ui: {
        selectedPersonId: selectedPersonId,
        treeFocusId: personIds.has(sourceUi.treeFocusId) ? sourceUi.treeFocusId : selectedPersonId,
        treeMode: sourceUi.treeMode === "overview" ? "overview" : "focus",
        treeNodeView: sourceUi.treeNodeView === "detailed" ? "detailed" : "condensed",
        generationDepth: Math.round(u.clamp(sourceUi.generationDepth, 1, config.controls.maxTreeDepth, 10)),
        ancestorDepth: Math.round(u.clamp(sourceUi.ancestorDepth, 0, config.controls.maxTreeDepth, sourceUi.generationDepth == null ? 10 : sourceUi.generationDepth)),
        descendantDepth: Math.round(u.clamp(sourceUi.descendantDepth, 0, config.controls.maxTreeDepth, sourceUi.generationDepth == null ? 10 : sourceUi.generationDepth)),
        directoryCollapsed: sourceUi.directoryCollapsed === true,
        profileCollapsed: sourceUi.profileCollapsed === true,
        showInferredParentLines: sourceUi.showInferredParentLines === true,
        hideUnplacedLineage: sourceUi.hideUnplacedLineage !== false,
        panelSizingCustomized: sourceUi.panelSizingCustomized === true,
        directoryPanelWidth: sourceUi.panelSizingCustomized === true ? Math.round(u.clamp(sourceUi.directoryPanelWidth, 220, 480, 280)) : 0,
        profilePanelWidth: sourceUi.panelSizingCustomized === true ? Math.round(u.clamp(sourceUi.profilePanelWidth, 240, 600, 300)) : 0,
        directorySearch: u.cleanLine(sourceUi.directorySearch, 200),
        directorySort: sourceUi.directorySort === "last" ? "last" : "first",
        directoryFilters: directoryFilters,
        mobileView: ["tree", "directory", "profile"].includes(sourceUi.mobileView) ? sourceUi.mobileView : "tree",
        search: u.cleanLine(sourceUi.search, 200),
        favoritePersonIds: Array.from(new Set((Array.isArray(sourceUi.favoritePersonIds) ? sourceUi.favoritePersonIds : []).map(function (id) { return u.cleanLine(id, 100); }).filter(function (id) { return personIds.has(id); }))).slice(0, config.controls.maxPeople),
        favoritesOnly: sourceUi.favoritesOnly === true,
        seenReleaseVersion: u.cleanLine(sourceUi.seenReleaseVersion, 32),
        supportTab: ["settings", "help", "releases", "shortcuts", "roadmap", "developer"].includes(sourceUi.supportTab) ? sourceUi.supportTab : "settings",
        dismissedHints: Array.from(new Set((Array.isArray(sourceUi.dismissedHints) ? sourceUi.dismissedHints : []).map(function (id) { return u.cleanLine(id, 80); }).filter(Boolean))).slice(0, 200)
      },
      modules: {
        family: { enabled: true },
        documents: { enabled: u.plainObject(sourceModules.documents).enabled !== false },
        roadmap: {
          search: u.cleanLine(sourceRoadmap.search, 200),
          state: ["all", "released", "planned", "wishlist"].includes(sourceRoadmap.state) ? sourceRoadmap.state : "all",
          sortBy: ["priority", "target", "effort", "age", "title"].includes(sourceRoadmap.sortBy) ? sourceRoadmap.sortBy : "priority",
          sortDirection: sourceRoadmap.sortDirection === "desc" ? "desc" : "asc"
        }
      }
    };
    assignReferences(state.workspace.people);
    return state;
  }

  function rawRelationshipErrors(input) {
    const source = u.plainObject(input);
    const workspace = u.plainObject(source.workspace);
    const people = Array.isArray(workspace.people) ? workspace.people : [];
    const relationships = Array.isArray(workspace.relationships) ? workspace.relationships : [];
    const ids = new Set();
    const relationshipIds = new Set();
    const errors = [];
    if (people.length > config.controls.maxPeople) errors.push("The import contains more than " + config.controls.maxPeople + " people.");
    if (relationships.length > config.controls.maxRelationships) errors.push("The import contains more than " + config.controls.maxRelationships + " relationships.");
    people.forEach(function (person) {
      const id = u.cleanLine(u.plainObject(person).id, 100).replace(/[^a-z0-9_-]/gi, "-");
      if (!id) errors.push("Every imported person must have a stable id.");
      else if (ids.has(id)) errors.push("The import contains duplicate person ids.");
      else ids.add(id);
    });
    const seen = new Set();
    relationships.forEach(function (item) {
      const relationship = u.plainObject(item);
      const relationshipId = u.cleanLine(relationship.id, 100).replace(/[^a-z0-9_-]/gi, "-");
      if (!relationshipId) errors.push("Every imported relationship must have a stable id.");
      else if (relationshipIds.has(relationshipId)) errors.push("The import contains duplicate relationship ids.");
      else relationshipIds.add(relationshipId);
      let a = "";
      let b = "";
      let key = "";
      if (relationship.type === "parent-child") {
        a = u.cleanLine(relationship.parentId, 100);
        b = u.cleanLine(relationship.childId, 100);
        key = "parent|" + a + "|" + b;
      } else if (relationship.type === "partner") {
        a = u.cleanLine(relationship.person1Id || (relationship.personIds && relationship.personIds[0]), 100);
        b = u.cleanLine(relationship.person2Id || (relationship.personIds && relationship.personIds[1]), 100);
        const pair = [a, b].sort();
        key = "partner|" + pair.join("|") + "|" + JSON.stringify(relationship.startDate || "") + "|" + JSON.stringify(relationship.endDate || "");
      } else {
        errors.push("Every relationship must be parent-child or partner.");
        return;
      }
      if (!ids.has(a) || !ids.has(b)) errors.push("A relationship references a person that is not in the import.");
      if (a && a === b) errors.push("A person cannot have a relationship with themselves.");
      if (seen.has(key)) errors.push("The import contains a duplicate relationship.");
      seen.add(key);
    });
    return Array.from(new Set(errors));
  }

  function parentAdjacency(relationships) {
    const children = new Map();
    relationships.filter(function (item) { return item.type === "parent-child"; }).forEach(function (item) {
      if (!children.has(item.parentId)) children.set(item.parentId, []);
      children.get(item.parentId).push(item.childId);
    });
    return children;
  }

  function hasAncestryCycle(relationships) {
    const children = parentAdjacency(relationships);
    const visiting = new Set();
    const visited = new Set();
    function walk(id) {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      const next = children.get(id) || [];
      for (let index = 0; index < next.length; index += 1) if (walk(next[index])) return true;
      visiting.delete(id);
      visited.add(id);
      return false;
    }
    const ids = new Set();
    relationships.forEach(function (item) {
      if (item.type === "parent-child") { ids.add(item.parentId); ids.add(item.childId); }
    });
    return Array.from(ids).some(walk);
  }

  function validate(state) {
    const errors = [];
    const warnings = [];
    if (!state || typeof state !== "object") errors.push("The root value must be an object.");
    if (state.schemaVersion !== config.schemaVersion) errors.push("The state-model version is not supported.");
    if (!state.workspace || !Array.isArray(state.workspace.people) || !Array.isArray(state.workspace.relationships)) errors.push("Family people or relationships are missing.");
    if (state.workspace && hasAncestryCycle(state.workspace.relationships)) errors.push("Parent-child relationships contain an ancestry cycle.");
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function prepare(input) {
    const migration = migrate(input);
    const rawErrors = rawRelationshipErrors(migration.state);
    if (rawErrors.length) throw new Error(rawErrors.join(" "));
    const state = normalize(migration.state);
    const validation = validate(state);
    if (!validation.ok) throw new Error(validation.errors.join(" "));
    return { state: state, migrations: migration.applied, validation: validation };
  }

  function touch(state) {
    state.meta.appVersion = config.identity.version;
    state.meta.buildId = config.identity.buildId;
    state.meta.updatedAt = u.isoNow();
    state.meta.lastMutationId = u.uid("mutation");
    return state;
  }

  function resetPreferences(state) {
    const defaults = createDefaultState();
    const next = u.clone(state);
    next.preferences = defaults.preferences;
    next.ui.treeMode = defaults.ui.treeMode;
    next.ui.treeNodeView = defaults.ui.treeNodeView;
    next.ui.generationDepth = defaults.ui.generationDepth;
    next.ui.ancestorDepth = defaults.ui.ancestorDepth;
    next.ui.descendantDepth = defaults.ui.descendantDepth;
    next.ui.directoryCollapsed = defaults.ui.directoryCollapsed;
    next.ui.profileCollapsed = defaults.ui.profileCollapsed;
    next.ui.showInferredParentLines = defaults.ui.showInferredParentLines;
    next.ui.hideUnplacedLineage = defaults.ui.hideUnplacedLineage;
    next.ui.panelSizingCustomized = defaults.ui.panelSizingCustomized;
    next.ui.directoryPanelWidth = defaults.ui.directoryPanelWidth;
    next.ui.profilePanelWidth = defaults.ui.profilePanelWidth;
    next.ui.directorySearch = "";
    next.ui.directorySort = defaults.ui.directorySort;
    next.ui.directoryFilters = [];
    next.ui.mobileView = "tree";
    next.ui.search = "";
    next.ui.dismissedHints = [];
    next.ui.supportTab = "settings";
    next.modules.roadmap = defaults.modules.roadmap;
    return normalize(touch(next));
  }

  function exportEnvelope(state) {
    return {
      exportFormat: "mcfamily-diagnostic-state",
      exportVersion: 1,
      exportedAt: u.isoNow(),
      application: { name: config.identity.name, version: config.identity.version, buildId: config.identity.buildId },
      schemaVersion: config.schemaVersion,
      state: normalize(u.clone(state))
    };
  }

  function displayName(person) {
    if (!person) return "Unknown person";
    const names = u.plainObject(person.names);
    if (names.display) return names.display;
    const given = names.preferred || names.given;
    const values = [given, names.middle, names.family, names.suffix].filter(Boolean);
    return values.join(" ") || names.birth || "Unnamed person";
  }

  function sortName(person) {
    if (!person) return "";
    const names = u.plainObject(person.names);
    return [names.family || names.birth, names.preferred || names.given, names.middle, names.suffix].filter(Boolean).join(", ").toLowerCase();
  }

  function assignReferences(people) {
    const used = new Set();
    people.forEach(function (person) {
      const sourceReference = /^P\d{3,}$/i.test(person.id) ? person.id.toUpperCase() : "";
      if (!sourceReference || used.has(sourceReference)) return;
      person.reference = sourceReference;
      used.add(sourceReference);
    });
    let nextReference = 1;
    people.filter(function (person) { return !person.reference; }).sort(function (a, b) { return sortName(a).localeCompare(sortName(b)) || a.id.localeCompare(b.id); }).forEach(function (person) {
      let reference = "";
      do {
        reference = "P" + String(nextReference).padStart(3, "0");
        nextReference += 1;
      } while (used.has(reference));
      person.reference = reference;
      used.add(reference);
    });
  }

  function formatFlexibleDate(input) {
    const date = normalizeFlexibleDate(input);
    if (!date.value) return "";
    const prefix = { about: "About ", before: "Before ", after: "After ", exact: "" }[date.qualifier] || "";
    if (/^\d{4}$/.test(date.value)) return prefix + date.value;
    const parts = date.value.split("-").map(Number);
    const options = parts.length === 2 ? { year: "numeric", month: "long", timeZone: "UTC" } : { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" };
    const stamp = Date.UTC(parts[0], parts[1] - 1, parts[2] || 1);
    return prefix + new Intl.DateTimeFormat(undefined, options).format(new Date(stamp));
  }

  function formatAddress(address) {
    if (!address) return "";
    const locality = [address.city, address.region, address.postalCode].filter(Boolean).join(", ").replace(/, ([^,]+)$/, " $1");
    return [address.line1, address.line2, locality, address.country].filter(Boolean).join("\n");
  }

  function personSearchText(person) {
    const sourceText = Object.entries(u.plainObject(person.source && person.source.fields)).filter(function (entry) {
      const key = String(entry[0] || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      return key !== "source_last_modified_by";
    }).map(function (entry) { return entry[1]; }).join(" ");
    return [
      displayName(person), sortName(person), person.names && person.names.birth, person.gender, person.pronouns,
      person.birth && person.birth.place, person.death && person.death.place,
      person.heritageNote, person.notes,
      sourceText,
      (person.addresses || []).map(function (item) { return item.label + " " + formatAddress(item) + " " + item.notes; }).join(" "),
      (person.phones || []).map(function (item) { return item.label + " " + item.value; }).join(" "),
      (person.emails || []).map(function (item) { return item.label + " " + item.value; }).join(" ")
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function normalizeSearchText(value) {
    let text = String(value == null ? "" : value).toLowerCase();
    if (typeof text.normalize === "function") text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return text.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }

  function isSubsequence(needle, value) {
    let index = 0;
    for (let position = 0; position < value.length && index < needle.length; position += 1) {
      if (value[position] === needle[index]) index += 1;
    }
    return index === needle.length;
  }

  function fuzzySearchMatch(query, value) {
    const needle = normalizeSearchText(query);
    const haystack = normalizeSearchText(value);
    if (!needle) return true;
    if (!haystack) return false;
    if (haystack.includes(needle)) return true;
    const words = haystack.split(" ");
    return needle.split(" ").every(function (token) {
      if (haystack.includes(token)) return true;
      return token.length > 1 && words.some(function (word) { return isSubsequence(token, word); });
    });
  }

  function wouldCreateAncestryCycle(relationships, parentId, childId, ignoreId) {
    const candidate = relationships.filter(function (item) { return item.type === "parent-child" && item.id !== ignoreId; }).concat({ id: "candidate", type: "parent-child", parentId: parentId, childId: childId });
    return hasAncestryCycle(candidate);
  }

  App.stateModel = {
    migrations: migrations,
    createDefaultState: createDefaultState,
    normalize: normalize,
    validate: validate,
    prepare: prepare,
    touch: touch,
    resetPreferences: resetPreferences,
    exportEnvelope: exportEnvelope,
    displayName: displayName,
    sortName: sortName,
    formatFlexibleDate: formatFlexibleDate,
    formatAddress: formatAddress,
    mcLineageLivingStatus: mcLineageLivingStatus,
    personSearchText: personSearchText,
    normalizeSearchText: normalizeSearchText,
    fuzzySearchMatch: fuzzySearchMatch,
    hasAncestryCycle: hasAncestryCycle,
    wouldCreateAncestryCycle: wouldCreateAncestryCycle
  };
})();
