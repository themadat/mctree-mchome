(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const u = App.utils;
  const PARENT_KINDS = new Set(config.parentKinds.map(function (item) { return item.id; }));
  const PARENT_LINEAGES = new Set(config.parentLineages.map(function (item) { return item.id; }));
  const PARTNER_STATUSES = new Set(config.partnerStatuses.map(function (item) { return item.id; }));
  const DATE_QUALIFIERS = new Set(["exact", "about", "before", "after"]);
  const NAME_PART_KEYS = ["prefix", "first", "middle", "last", "suffix"];
  function blankNameParts() {
    return { prefix: "", first: "", middle: "", last: "", suffix: "" };
  }

  function normalizeNameParts(input) {
    const source = u.plainObject(input);
    const result = blankNameParts();
    NAME_PART_KEYS.forEach(function (key) { result[key] = u.cleanLine(source[key], key === "suffix" ? 40 : 120); });
    return result;
  }

  function normalizePersonNames(person) {
    const source = u.plainObject(person);
    const names = u.plainObject(source.names);
    const birth = normalizeNameParts(names.birth);
    const current = normalizeNameParts(names.current);
    birth.first = birth.first || "UNKNOWN";
    birth.last = birth.last || "UNKNOWN";
    current.first = current.first || birth.first;
    current.last = current.last || birth.last;
    return {
      birth: birth,
      current: current,
      preferred: normalizeNameParts(names.preferred),
      maidenLast: u.cleanLine(names.maidenLast, 120)
    };
  }

  function hasNameParts(parts) {
    const name = normalizeNameParts(parts);
    return NAME_PART_KEYS.some(function (key) { return Boolean(name[key]); });
  }

  function formatNameParts(parts, length) {
    const name = normalizeNameParts(parts);
    const keys = length === "short" ? ["first", "last", "suffix"] : NAME_PART_KEYS;
    return keys.map(function (key) { return name[key]; }).filter(Boolean).join(" ");
  }

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
        package: { format: "", version: "", datasetVersion: "", accessMode: "editor", auditHistory: [] }
      },
      workspace: {
        family: { title: "McFamily", initializedAt: "", homePersonId: "" },
        people: [],
        relationships: [],
        places: [],
        residences: [],
        documents: [blankDocument(now)]
      },
      preferences: {
        appearance: {
          mode: "system",
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
        installation: { iconVariant: "auto" }
      },
      ui: {
        selectedPersonId: "",
        treeFocusId: "",
        treeMode: "focus",
        treeNodeView: "condensed",
        treeNameBasis: "lineal",
        treeNameLength: "short",
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
        supportTab: "settings"
      },
      modules: {
        family: { enabled: true },
        documents: { enabled: true },
        roadmap: { search: "", state: "all", sortBy: "priority", sortDirection: "asc" }
      }
    };
  }

  function mcLineageLivingStatus(person, fallback) {
    const source = u.plainObject(person);
    const imported = u.plainObject(source.source);
    if (!["mclineage-cleaned", "mcpeople-v1"].includes(imported.format)) return fallback;
    const fields = u.plainObject(imported.fields);
    const deathValue = u.cleanLine(fields["person-date-death-value"], 40) || u.cleanLine(source.death && source.death.date && source.death.date.value, 40);
    if (deathValue) return "deceased";
    const deathDescriptor = u.cleanLine(fields["person-date-death-descriptor"], 40);
    if (["UNKNOWN", "UNKNOWN PRESUMED"].includes(deathDescriptor)) return "deceased";
    if (deathDescriptor === "NONE") return "living";
    return fallback;
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
      const lineage = u.cleanLine(fields["lineage-id"], 400);
      if (!lineage || lineage.split(".").some(function (part) { return part === "99"; })) return;
      const generation = lineage.split(".").filter(Boolean).length - 1;
      if (generation >= 0 && generation <= 4) person.livingStatus = "deceased";
    });
  }

  function requireCurrentState(input) {
    const next = u.clone(u.plainObject(input));
    const version = Number(next.schemaVersion);
    if (version !== config.schemaVersion) {
      throw new Error("This state model is no longer supported. Import the current McFamily data package.");
    }
    return next;
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
      phone: u.formatPhoneNumber(source.phone),
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
      value: prefix === "phone" ? u.formatPhoneNumber(source.value) : u.cleanLine(source.value, 240),
      order: Number.isFinite(Number(source.order)) ? Math.round(Number(source.order)) : index
    };
  }

  function normalizePlace(input, index, usedIds) {
    const source = u.plainObject(input);
    let id = cleanId(source.id, "place");
    if (usedIds.has(id)) id = u.uid("place");
    usedIds.add(id);
    return {
      id: id,
      label: u.cleanLine(source.label || "Home", 60) || "Home",
      line1: u.cleanLine(source.line1, 200),
      line2: u.cleanLine(source.line2, 200),
      city: u.cleanLine(source.city, 100),
      region: u.cleanLine(source.region, 100),
      postalCode: u.cleanLine(source.postalCode, 40),
      country: u.cleanLine(source.country, 100),
      phone: u.formatPhoneNumber(source.phone),
      notes: u.cleanText(source.notes, 1000).trim(),
      source: normalizeSource(source.source),
      order: Number.isFinite(Number(source.order)) ? Math.round(Number(source.order)) : index
    };
  }

  function normalizeResidence(input, index, usedIds, personIds, placeIds) {
    const source = u.plainObject(input);
    let id = cleanId(source.id, "residence");
    if (usedIds.has(id)) id = u.uid("residence");
    usedIds.add(id);
    const personId = cleanId(source.personId, "missing");
    const placeId = cleanId(source.placeId, "missing");
    if (!personIds.has(personId) || !placeIds.has(placeId)) return null;
    return {
      id: id,
      personId: personId,
      placeId: placeId,
      label: u.cleanLine(source.label || "Home", 60) || "Home",
      current: source.current !== false,
      startDate: normalizeFlexibleDate(source.startDate),
      endDate: normalizeFlexibleDate(source.endDate),
      notes: u.cleanText(source.notes, 1000).trim(),
      source: normalizeSource(source.source),
      order: Number.isFinite(Number(source.order)) ? Math.round(Number(source.order)) : index
    };
  }

  function normalizeAuditHistory(input) {
    const usedIds = new Set();
    return (Array.isArray(input) ? input : []).map(function (item, index) {
      const source = u.plainObject(item);
      let id = cleanId(source.id, "audit");
      if (usedIds.has(id)) id = "audit-" + String(index + 1);
      usedIds.add(id);
      return {
        id: id,
        subject: u.cleanLine(source.subject, 160),
        action: u.cleanLine(source.action, 120),
        recordedAt: u.ensureIso(source.recordedAt),
        recordedBy: u.cleanLine(source.recordedBy, 160),
        details: u.cleanText(source.details, 4000).trim()
      };
    }).filter(function (item) { return item.action; }).slice(0, 5000);
  }

  function normalizePerson(input, index, usedIds, now) {
    const source = u.plainObject(input);
    let id = cleanId(source.id, "person");
    if (usedIds.has(id)) id = u.uid("person");
    usedIds.add(id);
    const createdAt = u.ensureIso(source.createdAt, now);
    const addressIds = new Set();
    return {
      id: id,
      reference: "",
      names: normalizePersonNames(source),
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
        lineage: PARENT_LINEAGES.has(source.lineage) ? source.lineage : "non-lineal",
        kind: PARENT_KINDS.has(source.kind) ? source.kind : "biological",
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
    const sourceInstallation = u.plainObject(sourcePreferences.installation);
    const sourceUi = u.plainObject(source.ui);
    const savedGenerationDepth = Math.round(u.clamp(sourceUi.generationDepth, 1, config.controls.maxTreeDepth, 10));
    const savedDescendantDepth = Math.round(u.clamp(sourceUi.descendantDepth, 0, config.controls.maxTreeDepth, sourceUi.generationDepth == null ? 10 : sourceUi.generationDepth));
    const replaceLegacyThreeDepth = sourceMeta.buildId !== config.identity.buildId && savedDescendantDepth === 3;
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
    const theme = defaultTheme();
    const textScale = u.clamp(sourceAppearance.textScale, 0.85, 1.6, 1);
    const homePersonId = personIds.has(sourceFamily.homePersonId) ? sourceFamily.homePersonId : (people[0] ? people[0].id : "");
    const selectedPersonId = sourceUi.selectedPersonId === "" ? "" : (personIds.has(sourceUi.selectedPersonId) ? sourceUi.selectedPersonId : homePersonId);
    const validDirectoryFilters = new Set(config.directoryFilters.map(function (filter) { return filter.id; }));
    const directoryFilters = Array.from(new Set((Array.isArray(sourceUi.directoryFilters) ? sourceUi.directoryFilters : []).map(function (filter) { return u.cleanLine(filter, 40); }).filter(function (filter) { return validDirectoryFilters.has(filter); })));
    const sourcePackage = u.plainObject(sourceMeta.package);
    const placeIds = new Set();
    const places = (Array.isArray(sourceWorkspace.places) ? sourceWorkspace.places : []).slice(0, config.controls.maxPlaces).map(function (place, index) { return normalizePlace(place, index, placeIds); });
    const residenceIds = new Set();
    const residences = (Array.isArray(sourceWorkspace.residences) ? sourceWorkspace.residences : []).slice(0, config.controls.maxResidences).map(function (residence, index) { return normalizeResidence(residence, index, residenceIds, personIds, placeIds); }).filter(Boolean);
    if (places.length || residences.length) {
      const peopleById = new Map(people.map(function (person) { return [person.id, person]; }));
      const placesById = new Map(places.map(function (place) { return [place.id, place]; }));
      people.forEach(function (person) { person.addresses = []; });
      residences.forEach(function (residence) {
        const person = peopleById.get(residence.personId);
        const place = placesById.get(residence.placeId);
        if (!person || !place) return;
        person.addresses.push({
          id: residence.id, placeId: place.id, residenceId: residence.id, label: residence.label || place.label,
          current: residence.current, line1: place.line1, line2: place.line2, city: place.city, region: place.region,
          postalCode: place.postalCode, country: place.country, phone: place.phone, startDate: residence.startDate, endDate: residence.endDate,
          notes: [place.notes, residence.notes].filter(Boolean).join(" · "), source: residence.source, placeSource: place.source, order: residence.order
        });
      });
    }
    const state = {
      schemaVersion: config.schemaVersion,
      meta: {
        appVersion: config.identity.version,
        buildId: config.identity.buildId,
        createdAt: u.ensureIso(sourceMeta.createdAt, now),
        updatedAt: u.ensureIso(sourceMeta.updatedAt, now),
        lastMutationId: u.cleanLine(sourceMeta.lastMutationId, 100) || u.uid("mutation"),
        package: {
          format: u.cleanLine(sourcePackage.format, 80),
          version: u.cleanLine(sourcePackage.version, 40),
          datasetVersion: u.cleanLine(sourcePackage.datasetVersion, 40),
          accessMode: Object.prototype.hasOwnProperty.call(config.accessModes, sourcePackage.accessMode) ? sourcePackage.accessMode : "editor",
          auditHistory: normalizeAuditHistory(sourcePackage.auditHistory)
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
        places: places,
        residences: residences,
        documents: documents
      },
      preferences: {
        appearance: {
          mode: ["system", "light", "dark"].includes(sourceAppearance.mode) ? sourceAppearance.mode : "system",
          preset: theme.id,
          accent: theme.accent,
          accent2: theme.accent2,
          success: theme.success,
          warning: theme.warning,
          danger: theme.danger,
          textScale: textScale,
          readingScale: textScale,
          reducedMotion: ["system", "reduce", "full"].includes(sourceAppearance.reducedMotion) ? sourceAppearance.reducedMotion : "system"
        },
        controls: {
          buttonStyle: ["icons", "text", "both"].includes(sourceControls.buttonStyle) ? sourceControls.buttonStyle : "both",
          shortcutHints: sourceControls.shortcutHints !== false,
          shortcutHintModifier: ["Alt", "Shift", "Control"].includes(sourceControls.shortcutHintModifier) ? sourceControls.shortcutHintModifier : config.controls.shortcutHintModifier,
          developerMode: sourceControls.developerMode === true
        },
        installation: { iconVariant: ["auto", "light", "dark"].includes(sourceInstallation.iconVariant) ? sourceInstallation.iconVariant : "auto" }
      },
      ui: {
        selectedPersonId: selectedPersonId,
        treeFocusId: personIds.has(sourceUi.treeFocusId) ? sourceUi.treeFocusId : selectedPersonId,
        treeMode: sourceUi.treeMode === "overview" ? "overview" : "focus",
        treeNodeView: sourceUi.treeNodeView === "detailed" ? "detailed" : "condensed",
        treeNameBasis: ["preferred", "legal", "lineal"].includes(sourceUi.treeNameBasis) ? sourceUi.treeNameBasis : "lineal",
        treeNameLength: sourceUi.treeNameLength === "full" ? "full" : "short",
        generationDepth: replaceLegacyThreeDepth ? 10 : savedGenerationDepth,
        ancestorDepth: Math.round(u.clamp(sourceUi.ancestorDepth, 0, config.controls.maxTreeDepth, sourceUi.generationDepth == null ? 10 : sourceUi.generationDepth)),
        descendantDepth: replaceLegacyThreeDepth ? 10 : savedDescendantDepth,
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
        supportTab: ["settings", "help", "releases", "shortcuts", "roadmap", "developer"].includes(sourceUi.supportTab) ? sourceUi.supportTab : "settings"
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
    const linealParents = new Map();
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
        if (!PARENT_LINEAGES.has(relationship.lineage)) errors.push("Every parent-child relationship must identify a Lineal or Non-Lineal role.");
        if (!PARENT_KINDS.has(relationship.kind)) errors.push("Every parent-child relationship must identify a supported parent type.");
        if (relationship.kind === "step" && relationship.lineage === "lineal") errors.push("A Step parent must be Non-Lineal.");
        if (relationship.lineage === "lineal") {
          if (linealParents.has(b)) errors.push("A child cannot have more than one Lineal parent.");
          else linealParents.set(b, a);
        }
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

  function rawPlaceErrors(input) {
    const source = u.plainObject(input);
    const workspace = u.plainObject(source.workspace);
    const people = Array.isArray(workspace.people) ? workspace.people : [];
    const places = Array.isArray(workspace.places) ? workspace.places : [];
    const residences = Array.isArray(workspace.residences) ? workspace.residences : [];
    const personIds = new Set(people.map(function (person) { return u.cleanLine(u.plainObject(person).id, 100); }));
    const placeIds = new Set();
    const residenceIds = new Set();
    const links = new Set();
    const errors = [];
    if (places.length > config.controls.maxPlaces) errors.push("The import contains more than " + config.controls.maxPlaces + " places.");
    if (residences.length > config.controls.maxResidences) errors.push("The import contains more than " + config.controls.maxResidences + " residences.");
    places.forEach(function (item) {
      const id = u.cleanLine(u.plainObject(item).id, 100);
      if (!id) errors.push("Every imported place must have a stable id.");
      else if (placeIds.has(id)) errors.push("The import contains duplicate place ids.");
      else placeIds.add(id);
    });
    residences.forEach(function (item) {
      const residence = u.plainObject(item);
      const id = u.cleanLine(residence.id, 100);
      const personId = u.cleanLine(residence.personId, 100);
      const placeId = u.cleanLine(residence.placeId, 100);
      const link = personId + "|" + placeId + "|" + String(residence.startDate && residence.startDate.value || "");
      if (!id) errors.push("Every imported residence must have a stable id.");
      else if (residenceIds.has(id)) errors.push("The import contains duplicate residence ids.");
      else residenceIds.add(id);
      if (!personIds.has(personId)) errors.push("A residence references a person that is not in the import.");
      if (!placeIds.has(placeId)) errors.push("A residence references a place that is not in the import.");
      if (links.has(link)) errors.push("The import contains a duplicate residence link.");
      links.add(link);
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
    if (!state.workspace || !Array.isArray(state.workspace.people) || !Array.isArray(state.workspace.relationships) || !Array.isArray(state.workspace.places) || !Array.isArray(state.workspace.residences)) errors.push("Family people, places, residences, or relationships are missing.");
    if (state.workspace && hasAncestryCycle(state.workspace.relationships)) errors.push("Parent-child relationships contain an ancestry cycle.");
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function prepare(input) {
    const currentInput = requireCurrentState(input);
    const rawErrors = rawRelationshipErrors(currentInput).concat(rawPlaceErrors(currentInput));
    if (rawErrors.length) throw new Error(rawErrors.join(" "));
    const state = normalize(currentInput);
    const validation = validate(state);
    if (!validation.ok) throw new Error(validation.errors.join(" "));
    return { state: state, validation: validation };
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
    next.ui.treeNameBasis = defaults.ui.treeNameBasis;
    next.ui.treeNameLength = defaults.ui.treeNameLength;
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
    const preferred = normalizeNameParts(names.preferred);
    const current = normalizeNameParts(names.current);
    const birth = normalizeNameParts(names.birth);
    if (hasNameParts(preferred)) return formatNameParts(preferred, "full");
    if (hasNameParts(current)) return formatNameParts(current, "full");
    return formatNameParts(birth, "full") || "Unnamed person";
  }

  function treeName(person, basis, length) {
    if (!person) return "Unknown person";
    const names = u.plainObject(person.names);
    const candidates = basis === "preferred" ? [names.preferred, names.current, names.birth] : basis === "legal" ? [names.current, names.birth] : [names.birth, names.current];
    const selected = candidates.find(hasNameParts);
    return formatNameParts(selected, length === "full" ? "full" : "short") || displayName(person);
  }

  function nameParts(person, kind) {
    const names = u.plainObject(person && person.names);
    return normalizeNameParts(names[kind]);
  }

  function sortName(person) {
    if (!person) return "";
    const names = u.plainObject(person.names);
    const preferred = hasNameParts(names.preferred) ? normalizeNameParts(names.preferred) : null;
    const current = hasNameParts(names.current) ? normalizeNameParts(names.current) : normalizeNameParts(names.birth);
    const first = preferred && preferred.first || current.first;
    const last = preferred && preferred.last || current.last;
    const middle = preferred && preferred.middle || current.middle;
    const suffix = preferred && preferred.suffix || current.suffix;
    return [last, first, middle, suffix].filter(Boolean).join(", ").toLowerCase();
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

  function personSearchText(person, options) {
    const settings = Object.assign({ includeNotes: true, includeSource: true }, u.plainObject(options));
    const sourceText = settings.includeSource ? Object.entries(u.plainObject(person.source && person.source.fields)).filter(function (entry) {
      const key = String(entry[0] || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      return key !== "source_last_modified_by";
    }).map(function (entry) { return entry[1]; }).join(" ") : "";
    return [
      displayName(person), sortName(person), formatNameParts(person.names && person.names.birth, "full"), formatNameParts(person.names && person.names.current, "full"), formatNameParts(person.names && person.names.preferred, "full"), person.names && person.names.maidenLast, person.gender, person.pronouns,
      person.birth && person.birth.place, person.death && person.death.place,
      person.heritageNote, settings.includeNotes ? person.notes : "",
      sourceText,
      (person.addresses || []).map(function (item) { return item.label + " " + formatAddress(item) + " " + item.phone + " " + item.notes; }).join(" "),
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
    createDefaultState: createDefaultState,
    normalize: normalize,
    validate: validate,
    prepare: prepare,
    touch: touch,
    resetPreferences: resetPreferences,
    exportEnvelope: exportEnvelope,
    displayName: displayName,
    treeName: treeName,
    nameParts: nameParts,
    formatNameParts: formatNameParts,
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
