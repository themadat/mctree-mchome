(function () {
  "use strict";

  const App = window.LocalApp;
  const config = App.config;
  const model = App.stateModel;

  function indexes(state) {
    const people = state.workspace.people;
    const relationships = state.workspace.relationships;
    const peopleById = new Map(people.map(function (person) { return [person.id, person]; }));
    const parents = new Map();
    const children = new Map();
    const partners = new Map();
    people.forEach(function (person) {
      parents.set(person.id, []);
      children.set(person.id, []);
      partners.set(person.id, []);
    });
    relationships.forEach(function (relationship) {
      if (relationship.type === "parent-child") {
        if (parents.has(relationship.childId)) parents.get(relationship.childId).push({ person: peopleById.get(relationship.parentId), relationship: relationship });
        if (children.has(relationship.parentId)) children.get(relationship.parentId).push({ person: peopleById.get(relationship.childId), relationship: relationship });
      } else if (relationship.type === "partner") {
        if (partners.has(relationship.person1Id)) partners.get(relationship.person1Id).push({ person: peopleById.get(relationship.person2Id), relationship: relationship });
        if (partners.has(relationship.person2Id)) partners.get(relationship.person2Id).push({ person: peopleById.get(relationship.person1Id), relationship: relationship });
      }
    });
    return { peopleById: peopleById, parents: parents, children: children, partners: partners };
  }

  function siblingsOf(id, graph) {
    const siblingIds = new Set();
    (graph.parents.get(id) || []).forEach(function (parentLink) {
      (graph.children.get(parentLink.person.id) || []).forEach(function (childLink) {
        if (childLink.person.id !== id) siblingIds.add(childLink.person.id);
      });
    });
    return Array.from(siblingIds).map(function (siblingId) { return graph.peopleById.get(siblingId); }).filter(Boolean);
  }

  function siblingRelationshipKind(firstId, secondId, stateOrGraph) {
    const graph = stateOrGraph && stateOrGraph.peopleById ? stateOrGraph : indexes(stateOrGraph);
    const secondParentLinks = new Map((graph.parents.get(secondId) || []).map(function (entry) { return [entry.person.id, entry]; }));
    const rankedParents = (graph.parents.get(firstId) || []).slice().sort(function (first, second) {
      const firstChildren = graph.children.get(first.person.id) || [];
      const secondChildren = graph.children.get(second.person.id) || [];
      const firstLinealChildren = firstChildren.filter(function (entry) { return isLinealRelationship(entry.relationship); }).length;
      const secondLinealChildren = secondChildren.filter(function (entry) { return isLinealRelationship(entry.relationship); }).length;
      return Number(isLinealRelationship(second.relationship)) - Number(isLinealRelationship(first.relationship))
        || secondLinealChildren - firstLinealChildren
        || secondChildren.length - firstChildren.length
        || first.person.id.localeCompare(second.person.id);
    });
    const sharedParent = rankedParents.find(function (entry) { return secondParentLinks.has(entry.person.id); });
    const secondLink = sharedParent && secondParentLinks.get(sharedParent.person.id);
    return secondLink && secondLink.relationship.kind || "";
  }

  function isLinealRelationship(relationship) {
    if (!relationship || relationship.type !== "parent-child" || relationship.lineage !== "lineal") return false;
    const kind = config.parentKinds.find(function (item) { return item.id === relationship.kind; });
    return Boolean(kind && kind.lineal);
  }

  function isLineageEligiblePerson(personId, stateOrGraph) {
    const graph = stateOrGraph && stateOrGraph.peopleById ? stateOrGraph : indexes(stateOrGraph);
    const parents = graph.parents.get(personId) || [];
    if (parents.some(function (entry) { return isLinealRelationship(entry.relationship); })) return true;
    return !parents.some(function (entry) {
      const kind = config.parentKinds.find(function (item) { return item.id === entry.relationship.kind; });
      return kind && !kind.lineal;
    });
  }

  function traverseGenerations(id, adjacency) {
    const results = [];
    const bestDepth = new Map([[id, 0]]);
    const queue = [{ id: id, depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      (adjacency.get(current.id) || []).forEach(function (entry) {
        if (!entry.person) return;
        const depth = current.depth + 1;
        if (bestDepth.has(entry.person.id) && bestDepth.get(entry.person.id) <= depth) return;
        bestDepth.set(entry.person.id, depth);
        results.push({ person: entry.person, relationship: entry.relationship, depth: depth });
        queue.push({ id: entry.person.id, depth: depth });
      });
    }
    return results.sort(function (a, b) { return a.depth - b.depth || model.sortName(a.person).localeCompare(model.sortName(b.person)); });
  }

  function ancestorsOf(id, stateOrGraph) {
    const graph = stateOrGraph && stateOrGraph.peopleById ? stateOrGraph : indexes(stateOrGraph);
    return traverseGenerations(id, graph.parents);
  }

  function descendantsOf(id, stateOrGraph) {
    const graph = stateOrGraph && stateOrGraph.peopleById ? stateOrGraph : indexes(stateOrGraph);
    return traverseGenerations(id, graph.children);
  }

  function familyUnits(state) {
    const graph = indexes(state);
    const units = [];
    const pairedChildren = new Map();
    state.workspace.relationships.filter(function (relationship) { return relationship.type === "partner"; }).forEach(function (relationship) {
      const ids = [relationship.person1Id, relationship.person2Id].sort();
      const key = ids.join("|");
      if (pairedChildren.has(key)) return;
      const firstChildren = new Set((graph.children.get(ids[0]) || []).map(function (entry) { return entry.person.id; }));
      const children = (graph.children.get(ids[1]) || []).map(function (entry) { return entry.person; }).filter(function (person) { return firstChildren.has(person.id); });
      pairedChildren.set(key, new Set(children.map(function (person) { return person.id; })));
      units.push({ partnerIds: ids, partners: ids.map(function (id) { return graph.peopleById.get(id); }).filter(Boolean), children: children });
    });
    state.workspace.people.forEach(function (person) {
      const children = (graph.children.get(person.id) || []).map(function (entry) { return entry.person; }).filter(function (child) {
        return !Array.from(pairedChildren.entries()).some(function (entry) { return entry[0].split("|").includes(person.id) && entry[1].has(child.id); });
      });
      if (children.length) units.push({ partnerIds: [person.id], partners: [person], children: children });
    });
    return units;
  }

  function lineageSummary(id, state) {
    const graph = indexes(state);
    const parents = graph.parents.get(id) || [];
    const children = graph.children.get(id) || [];
    const partners = graph.partners.get(id) || [];
    const siblings = siblingsOf(id, graph);
    const ancestors = ancestorsOf(id, graph);
    const descendants = descendantsOf(id, graph);
    return {
      parents: parents.length,
      children: children.length,
      partners: new Set(partners.map(function (entry) { return entry.person.id; })).size,
      siblings: siblings.length,
      ancestors: ancestors.length,
      descendants: descendants.length,
      label: [
        ancestors.length + " known ancestor" + (ancestors.length === 1 ? "" : "s"),
        siblings.length + " sibling" + (siblings.length === 1 ? "" : "s"),
        descendants.length + " descendant" + (descendants.length === 1 ? "" : "s")
      ].join(" · ")
    };
  }

  function relationPerson(entry) {
    return entry && entry.person || entry;
  }

  function compareBirthOrder(a, b) {
    const first = relationPerson(a);
    const second = relationPerson(b);
    const firstDate = String(first && first.birth && first.birth.date && first.birth.date.value || sourceField(first, "person-date-birth-value") || "");
    const secondDate = String(second && second.birth && second.birth.date && second.birth.date.value || sourceField(second, "person-date-birth-value") || "");
    const firstUnknown = !/\d/.test(firstDate);
    const secondUnknown = !/\d/.test(secondDate);
    if (firstUnknown !== secondUnknown) return firstUnknown ? 1 : -1;
    if (firstDate && secondDate && firstDate !== secondDate) return firstDate.localeCompare(secondDate);
    if (firstDate !== secondDate) return firstDate ? -1 : 1;
    return model.sortName(first).localeCompare(model.sortName(second)) || String(first && first.id || "").localeCompare(String(second && second.id || ""));
  }

  function sourceField(person, key) {
    return String(person && person.source && person.source.fields && person.source.fields[key] || "").trim();
  }

  function partnerSourceFields(relationship) {
    return relationship && relationship.source && relationship.source.fields || {};
  }

  function partnerSourceType(relationship) {
    const fields = partnerSourceFields(relationship);
    return String(fields["partner-type"] || fields.relationship_type || "").trim();
  }

  function partnerEndReason(relationship) {
    const fields = partnerSourceFields(relationship);
    return String(fields["end-reason"] || fields.end_reason || "").trim();
  }

  function isNeverMarriedPartnership(relationship) {
    return partnerSourceType(relationship) === "partnership" || Boolean(relationship && relationship.status === "partnered");
  }

  function isUnknownPartnerRelationship(relationship) {
    return partnerSourceType(relationship) === "UNKNOWN"
      || partnerEndReason(relationship) === "UNKNOWN"
      || Boolean(relationship && relationship.status === "unknown");
  }

  function isDeathEndedMarriage(relationship) {
    if (isNeverMarriedPartnership(relationship) || isUnknownPartnerRelationship(relationship)) return false;
    return (partnerEndReason(relationship) === "death" || Boolean(relationship && relationship.status === "widowed"))
      && (partnerSourceType(relationship) === "marriage" || Boolean(relationship && relationship.status === "widowed"));
  }

  function partnerHasRecordedEnd(relationship) {
    const fields = partnerSourceFields(relationship);
    const sourceDefinesEndReason = Object.prototype.hasOwnProperty.call(fields, "end-reason") || Object.prototype.hasOwnProperty.call(fields, "end_reason");
    const endDate = String(fields["date-end-value"] || fields.date_end_value || relationship && relationship.endDate && relationship.endDate.value || "").trim();
    if (sourceDefinesEndReason) return Boolean(partnerEndReason(relationship) || endDate);
    return Boolean(endDate || relationship && ["annulled", "divorced", "former", "separated", "widowed"].includes(relationship.status));
  }

  function isPastPartnerRelationship(relationship) {
    return partnerHasRecordedEnd(relationship);
  }

  function partnerMaritalStatusId(person, entry) {
    const relationship = entry && entry.relationship || entry;
    const other = entry && entry.person;
    const endReason = partnerEndReason(relationship);
    if (endReason === "separation") return "separated";
    if (endReason === "divorce") return "divorced";
    if (endReason === "annulment") return "annulled";
    if (endReason === "UNKNOWN") return "unknown";
    if (isNeverMarriedPartnership(relationship)) return "never-married";
    if (isUnknownPartnerRelationship(relationship)) return "unknown";
    if (isDeathEndedMarriage(relationship)) {
      if (person && person.livingStatus === "deceased") return "married";
      if (person && person.livingStatus === "living" && other && other.livingStatus === "deceased") return "widowed";
    }
    if (entry && entry.current === true && !partnerHasRecordedEnd(relationship)) {
      const personLiving = person && person.livingStatus === "living";
      const personDeceased = person && person.livingStatus === "deceased";
      const otherLiving = other && other.livingStatus === "living";
      const otherDeceased = other && other.livingStatus === "deceased";
      if (personLiving && otherDeceased) return "widowed";
      if (partnerSourceType(relationship) === "marriage" || relationship && relationship.status === "married" || (personDeceased && otherDeceased) || (personDeceased && otherLiving)) return "married";
    }
    return config.maritalStatusByPartnerStatus[relationship && relationship.status] || "unknown";
  }

  function partnerLineKind(relationship, current, first, second) {
    if (isNeverMarriedPartnership(relationship)) return "never-married";
    if (isUnknownPartnerRelationship(relationship)) return "unknown";
    const sourceType = partnerSourceType(relationship);
    const knownMarriage = sourceType === "marriage" || relationship && ["annulled", "married", "widowed", "divorced", "separated"].includes(relationship.status);
    if (knownMarriage && !partnerHasRecordedEnd(relationship)) return "married";
    if (current && (!partnerHasRecordedEnd(relationship) || isDeathEndedMarriage(relationship))) {
      const bothDeceased = first && second && first.livingStatus === "deceased" && second.livingStatus === "deceased";
      const deathSplit = first && second && ((first.livingStatus === "living" && second.livingStatus === "deceased") || (first.livingStatus === "deceased" && second.livingStatus === "living"));
      if (knownMarriage || bothDeceased || deathSplit) return "married";
    }
    return knownMarriage ? "previous-marriage" : "unknown";
  }

  function bloodlineParentRank(person, entry) {
    return isLinealRelationship(entry && entry.relationship) ? 0 : 1;
  }

  function orderPartnerHistory(entries) {
    const histories = entries.slice().sort(comparePartnerHistory);
    const active = histories.filter(function (entry) { return !isPastPartnerRelationship(entry.relationship); });
    const preferredActive = active.filter(function (entry) { return ["marriage", "partnership"].includes(partnerSourceType(entry.relationship)) || entry.relationship.status === "married" || entry.relationship.status === "partnered"; });
    const latestHistory = histories.slice(-1)[0] || null;
    const latestDeathEndedMarriage = latestHistory && isDeathEndedMarriage(latestHistory.relationship) ? latestHistory : null;
    const current = (preferredActive.length ? preferredActive : active).slice(-1)[0] || latestDeathEndedMarriage;
    return (current ? [current] : []).concat(histories.filter(function (entry) { return entry !== current; }).reverse()).map(function (entry) {
      return Object.assign({}, entry, { current: entry === current });
    });
  }

  function relationGroups(id, state) {
    const graph = indexes(state);
    const person = graph.peopleById.get(id);
    return {
      parents: (graph.parents.get(id) || []).slice().sort(function (a, b) { return bloodlineParentRank(person, a) - bloodlineParentRank(person, b) || compareBirthOrder(a, b); }),
      children: (graph.children.get(id) || []).slice().sort(compareBirthOrder),
      partners: orderPartnerHistory(graph.partners.get(id) || []),
      siblings: siblingsOf(id, graph).sort(compareBirthOrder)
    };
  }

  function generationMap(people, relationships) {
    const ids = new Set(people.map(function (person) { return person.id; }));
    const incoming = new Map();
    const children = new Map();
    people.forEach(function (person) { incoming.set(person.id, 0); children.set(person.id, []); });
    relationships.forEach(function (relationship) {
      if (relationship.type !== "parent-child" || !ids.has(relationship.parentId) || !ids.has(relationship.childId)) return;
      incoming.set(relationship.childId, (incoming.get(relationship.childId) || 0) + 1);
      children.get(relationship.parentId).push(relationship.childId);
    });
    const queue = people.filter(function (person) { return incoming.get(person.id) === 0; }).map(function (person) { return person.id; });
    const level = new Map(people.map(function (person) { return [person.id, 0]; }));
    while (queue.length) {
      const id = queue.shift();
      (children.get(id) || []).forEach(function (childId) {
        level.set(childId, Math.max(level.get(childId) || 0, (level.get(id) || 0) + 1));
        incoming.set(childId, incoming.get(childId) - 1);
        if (incoming.get(childId) === 0) queue.push(childId);
      });
    }
    const partnerLinks = relationships.filter(function (item) { return item.type === "partner" && ids.has(item.person1Id) && ids.has(item.person2Id); });
    for (let pass = 0; pass < 3; pass += 1) {
      partnerLinks.forEach(function (relationship) {
        const aligned = Math.max(level.get(relationship.person1Id) || 0, level.get(relationship.person2Id) || 0);
        level.set(relationship.person1Id, aligned);
        level.set(relationship.person2Id, aligned);
      });
      relationships.forEach(function (relationship) {
        if (relationship.type === "parent-child" && ids.has(relationship.parentId) && ids.has(relationship.childId)) {
          level.set(relationship.childId, Math.max(level.get(relationship.childId) || 0, (level.get(relationship.parentId) || 0) + 1));
        }
      });
    }
    return level;
  }

  function focusPeople(state, focusId, ancestorDepth, descendantDepth) {
    const graph = indexes(state);
    if (!graph.peopleById.has(focusId)) return [];
    const upwardDepth = Number.isFinite(Number(ancestorDepth)) ? Number(ancestorDepth) : 2;
    const downwardDepth = Number.isFinite(Number(descendantDepth)) ? Number(descendantDepth) : upwardDepth;
    const visibleIds = new Set([focusId]);
    ancestorsOf(focusId, graph).filter(function (entry) { return entry.depth <= upwardDepth; }).forEach(function (entry) { visibleIds.add(entry.person.id); });
    descendantsOf(focusId, graph).filter(function (entry) { return entry.depth <= downwardDepth; }).forEach(function (entry) { visibleIds.add(entry.person.id); });
    siblingsOf(focusId, graph).forEach(function (person) { visibleIds.add(person.id); });
    Array.from(visibleIds).forEach(function (id) {
      (graph.partners.get(id) || []).forEach(function (entry) { visibleIds.add(entry.person.id); });
    });
    return state.workspace.people.filter(function (person) { return visibleIds.has(person.id); });
  }

  function connectedComponents(state) {
    const graph = indexes(state);
    const neighbors = new Map(state.workspace.people.map(function (person) { return [person.id, new Set()]; }));
    state.workspace.relationships.forEach(function (relationship) {
      const a = relationship.type === "parent-child" ? relationship.parentId : relationship.person1Id;
      const b = relationship.type === "parent-child" ? relationship.childId : relationship.person2Id;
      if (!neighbors.has(a) || !neighbors.has(b)) return;
      neighbors.get(a).add(b);
      neighbors.get(b).add(a);
    });
    const seen = new Set();
    const components = [];
    state.workspace.people.slice().sort(function (a, b) { return model.sortName(a).localeCompare(model.sortName(b)); }).forEach(function (person) {
      if (seen.has(person.id)) return;
      const ids = [];
      const queue = [person.id];
      seen.add(person.id);
      while (queue.length) {
        const id = queue.shift();
        ids.push(id);
        (neighbors.get(id) || []).forEach(function (next) {
          if (!seen.has(next)) { seen.add(next); queue.push(next); }
        });
      }
      components.push(ids);
    });
    return components.sort(function (a, b) { return b.length - a.length; });
  }

  function lineageParts(person) {
    const fields = person && person.source && person.source.fields;
    const raw = String(fields && fields["lineage-id"] || "").trim();
    return raw ? raw.split(".").map(function (part) { return part.trim(); }).filter(Boolean) : [];
  }

  function compareLineage(a, b) {
    const aParts = lineageParts(a);
    const bParts = lineageParts(b);
    if (!aParts.length && !bParts.length) return 0;
    if (!aParts.length) return 1;
    if (!bParts.length) return -1;
    const length = Math.max(aParts.length, bParts.length);
    for (let index = 0; index < length; index += 1) {
      if (aParts[index] == null) return -1;
      if (bParts[index] == null) return 1;
      const compared = aParts[index].localeCompare(bParts[index], undefined, { numeric: true, sensitivity: "base" });
      if (compared) return compared;
    }
    return 0;
  }

  function relationshipOrderValue(relationship) {
    const fields = relationship && relationship.source && relationship.source.fields || {};
    const sourceOrder = Number(fields["relationship-order"] || fields.relationship_order);
    if (Number.isFinite(sourceOrder) && sourceOrder > 0) return sourceOrder;
    const order = Number(relationship && relationship.order);
    return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
  }

  function comparePartnerHistory(a, b) {
    const aDate = String(a.relationship.startDate && a.relationship.startDate.value || a.relationship.endDate && a.relationship.endDate.value || "");
    const bDate = String(b.relationship.startDate && b.relationship.startDate.value || b.relationship.endDate && b.relationship.endDate.value || "");
    if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);
    return relationshipOrderValue(a.relationship) - relationshipOrderValue(b.relationship);
  }

  function arrangePartners(items, relationships, placements, currentRelationshipIds) {
    const peopleById = new Map(items.map(function (person) { return [person.id, person]; }));
    const itemOrder = new Map(items.map(function (person, index) { return [person.id, index]; }));
    const links = new Map(items.map(function (person) { return [person.id, []]; }));
    relationships.filter(function (relationship) {
      return relationship.type === "partner" && peopleById.has(relationship.person1Id) && peopleById.has(relationship.person2Id);
    }).forEach(function (relationship) {
      links.get(relationship.person1Id).push({ id: relationship.person2Id, relationship: relationship });
      links.get(relationship.person2Id).push({ id: relationship.person1Id, relationship: relationship });
    });
    const used = new Set();
    const arranged = [];
    items.forEach(function (person) {
      if (used.has(person.id)) return;
      const componentIds = [];
      const queue = [person.id];
      const seen = new Set(queue);
      while (queue.length) {
        const id = queue.shift();
        componentIds.push(id);
        (links.get(id) || []).forEach(function (entry) {
          if (!seen.has(entry.id) && !used.has(entry.id)) { seen.add(entry.id); queue.push(entry.id); }
        });
      }
      const anchorId = componentIds.slice().sort(function (aId, bId) {
        const a = peopleById.get(aId);
        const b = peopleById.get(bId);
        const aPrimary = a && a.source && ["mclineage-cleaned", "mcpeople-v1"].includes(a.source.format) ? 1 : 0;
        const bPrimary = b && b.source && ["mclineage-cleaned", "mcpeople-v1"].includes(b.source.format) ? 1 : 0;
        return bPrimary - aPrimary
          || Number(lineageParts(b).length > 0) - Number(lineageParts(a).length > 0)
          || (itemOrder.get(aId) || 0) - (itemOrder.get(bId) || 0);
      })[0];
      const anchor = peopleById.get(anchorId);
      const histories = (links.get(anchorId) || []).filter(function (entry) { return !used.has(entry.id); }).sort(comparePartnerHistory);
      const active = histories.filter(function (entry) { return !isPastPartnerRelationship(entry.relationship); });
      const preferredActive = active.filter(function (entry) { return ["marriage", "partnership"].includes(partnerSourceType(entry.relationship)) || entry.relationship.status === "married" || entry.relationship.status === "partnered"; });
      const latestHistory = histories.slice(-1)[0] || null;
      const latestDeathEndedMarriage = latestHistory && isDeathEndedMarriage(latestHistory.relationship) ? latestHistory : null;
      const current = (preferredActive.length ? preferredActive : active).slice(-1)[0] || latestDeathEndedMarriage;
      const leftPartners = histories.filter(function (entry) { return !current || entry.id !== current.id; });
      leftPartners.forEach(function (entry, index) {
        if (used.has(entry.id)) return;
        placements.set(entry.id, { side: "left", anchorId: anchorId, scale: 2 / 3, align: leftPartners.length === 1 ? "center" : index === 0 ? "top" : "bottom", count: leftPartners.length });
        arranged.push(peopleById.get(entry.id));
        used.add(entry.id);
      });
      arranged.push(anchor);
      used.add(anchorId);
      if (current && !used.has(current.id)) {
        placements.set(current.id, { side: "right", anchorId: anchorId, scale: 1, align: "top" });
        currentRelationshipIds.add(current.relationship.id);
        arranged.push(peopleById.get(current.id));
        used.add(current.id);
      }
      componentIds.filter(function (id) { return !used.has(id); }).sort(function (a, b) { return itemOrder.get(a) - itemOrder.get(b); }).forEach(function (id) { arranged.push(peopleById.get(id)); used.add(id); });
    });
    return arranged;
  }

  function unplacedLineageIds(state) {
    const hidden = new Set();
    state.workspace.people.forEach(function (person) {
      if (sourceField(person, "lineage-id") === "99") hidden.add(person.id);
    });
    if (!hidden.size) return hidden;
    const total = new Map();
    const toHidden = new Map();
    state.workspace.relationships.forEach(function (relationship) {
      const pair = relationship.type === "parent-child" ? [relationship.parentId, relationship.childId] : [relationship.person1Id, relationship.person2Id];
      pair.forEach(function (id, index) {
        total.set(id, (total.get(id) || 0) + 1);
        if (hidden.has(pair[index === 0 ? 1 : 0])) toHidden.set(id, (toHidden.get(id) || 0) + 1);
      });
    });
    state.workspace.people.forEach(function (person) {
      if (hidden.has(person.id) || sourceField(person, "lineage-id")) return;
      const links = total.get(person.id) || 0;
      if (links && links === (toHidden.get(person.id) || 0)) hidden.add(person.id);
    });
    return hidden;
  }

  function treeNameLines(person, options) {
    const settings = typeof options === "boolean" ? { length: options ? "full" : "short" } : Object.assign({ basis: "lineal", length: "short" }, options || {});
    const kinds = settings.basis === "preferred" ? ["preferred", "current", "birth"] : settings.basis === "legal" ? ["current", "birth"] : ["birth", "current"];
    const nameParts = kinds.map(function (kind) { return model.nameParts(person, kind); }).find(function (parts) {
      return [parts.prefix, parts.first, parts.middle, parts.last, parts.suffix].some(Boolean);
    }) || model.nameParts(person, "birth");
    const shortLines = [nameParts.first, [nameParts.last, nameParts.suffix].filter(Boolean).join(" ")].filter(Boolean);
    if (settings.length !== "full" && shortLines.length) return shortLines;
    const fullName = model.treeName(person, settings.basis, "full");
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 3) return parts;
    let best = null;
    for (let firstBreak = 1; firstBreak < parts.length - 1; firstBreak += 1) {
      for (let secondBreak = firstBreak + 1; secondBreak < parts.length; secondBreak += 1) {
        const lines = [parts.slice(0, firstBreak).join(" "), parts.slice(firstBreak, secondBreak).join(" "), parts.slice(secondBreak).join(" ")];
        const lengths = lines.map(function (line) { return line.length; });
        const maximum = Math.max.apply(null, lengths);
        const spread = Math.max.apply(null, lengths) - Math.min.apply(null, lengths);
        const score = maximum * 100 + spread;
        if (!best || score < best.score) best = { lines: lines, score: score };
      }
    }
    return best ? best.lines : parts.slice(0, 3);
  }

  function layout(state, options) {
    const settings = Object.assign({ mode: "focus", focusId: "", ancestorDepth: 2, descendantDepth: 2, nodeView: "condensed", nameBasis: "lineal", nameLength: "short", hideUnplacedLineage: false }, options || {});
    if (options && options.depth != null) {
      if (options.ancestorDepth == null) settings.ancestorDepth = options.depth;
      if (options.descendantDepth == null) settings.descendantDepth = options.depth;
    }
    const hidden = settings.hideUnplacedLineage ? unplacedLineageIds(state) : new Set();
    hidden.delete(settings.focusId);
    const visiblePeople = (settings.mode === "overview" ? state.workspace.people.slice() : focusPeople(state, settings.focusId, settings.ancestorDepth, settings.descendantDepth)).filter(function (person) {
      return !hidden.has(person.id);
    });
    const visibleIds = new Set(visiblePeople.map(function (person) { return person.id; }));
    const visibleRelationships = state.workspace.relationships.filter(function (relationship) {
      return relationship.type === "parent-child"
        ? visibleIds.has(relationship.parentId) && visibleIds.has(relationship.childId)
        : visibleIds.has(relationship.person1Id) && visibleIds.has(relationship.person2Id);
    });
    if (!visiblePeople.length) return { nodes: [], edges: [], width: 720, height: 420, bounds: { x: 0, y: 0, width: 720, height: 420 } };
    const levels = generationMap(visiblePeople, visibleRelationships);
    if (settings.mode === "focus" && visibleIds.has(settings.focusId)) {
      const offset = levels.get(settings.focusId) || 0;
      levels.forEach(function (value, id) { levels.set(id, value - offset); });
    }
    const groups = new Map();
    visiblePeople.forEach(function (person) {
      const level = levels.get(person.id) || 0;
      if (!groups.has(level)) groups.set(level, []);
      groups.get(level).push(person);
    });
    const peopleById = new Map(visiblePeople.map(function (person) { return [person.id, person]; }));
    const parentIds = new Map();
    visiblePeople.forEach(function (person) { parentIds.set(person.id, []); });
    visibleRelationships.forEach(function (relationship) {
      if (relationship.type === "parent-child") parentIds.get(relationship.childId).push(relationship.parentId);
    });
    const sortedLevels = Array.from(groups.keys()).sort(function (a, b) { return a - b; });
    const positions = new Map();
    const partnerPlacements = new Map();
    const currentPartnerRelationshipIds = new Set();
    sortedLevels.forEach(function (level, levelIndex) {
      let items = groups.get(level).sort(function (a, b) {
        const lineageOrder = compareLineage(a, b);
        if (lineageOrder) return lineageOrder;
        const aParents = parentIds.get(a.id).map(function (id) { return positions.has(id) ? positions.get(id) : Infinity; });
        const bParents = parentIds.get(b.id).map(function (id) { return positions.has(id) ? positions.get(id) : Infinity; });
        const aAverage = aParents.length ? aParents.reduce(function (sum, value) { return sum + value; }, 0) / aParents.length : Infinity;
        const bAverage = bParents.length ? bParents.reduce(function (sum, value) { return sum + value; }, 0) / bParents.length : Infinity;
        if (Number.isFinite(aAverage) || Number.isFinite(bAverage)) return aAverage - bAverage || model.sortName(a).localeCompare(model.sortName(b));
        return model.sortName(a).localeCompare(model.sortName(b));
      });
      if (levelIndex === 0) items = items.sort(function (a, b) { return compareLineage(a, b) || model.sortName(a).localeCompare(model.sortName(b)); });
      items = arrangePartners(items, visibleRelationships, partnerPlacements, currentPartnerRelationshipIds);
      groups.set(level, items);
      items.forEach(function (person, index) { positions.set(person.id, index); });
    });
    const detailed = settings.nodeView === "detailed";
    const nodeWidth = detailed ? 116 : 100;
    const horizontalGap = settings.mode === "overview" ? 20 : 26;
    const verticalGap = 60;
    const rowHeights = new Map();
    sortedLevels.forEach(function (level) {
      const lineCount = Math.max.apply(null, groups.get(level).map(function (person) { return treeNameLines(person, { basis: settings.nameBasis, length: settings.nameLength }).length; }));
      rowHeights.set(level, (detailed ? 26 : 12) + Math.max(1, lineCount) * 14 + (detailed && settings.showDeveloperScale ? 13 : 0));
    });
    const rowTrackHeights = new Map();
    sortedLevels.forEach(function (level) { rowTrackHeights.set(level, rowHeights.get(level)); });
    const rowWidths = new Map();
    sortedLevels.forEach(function (level) {
      const items = groups.get(level);
      const width = items.reduce(function (total, person) {
        const placement = partnerPlacements.get(person.id);
        return total + nodeWidth * (placement && placement.scale || 1);
      }, 0) + Math.max(0, items.length - 1) * horizontalGap;
      rowWidths.set(level, width);
    });
    const developerScaleGutter = settings.showDeveloperScale ? 116 : 0;
    const baseContentWidth = Math.max(680, Math.max.apply(null, Array.from(rowWidths.values())) + 80);
    const contentWidth = baseContentWidth + developerScaleGutter;
    const nodes = [];
    const generationMetrics = [];
    let rowY = 40;
    sortedLevels.forEach(function (level) {
      const items = groups.get(level);
      const nodeHeight = rowHeights.get(level);
      const trackHeight = rowTrackHeights.get(level);
      const rowWidth = rowWidths.get(level);
      const startX = developerScaleGutter + (baseContentWidth - rowWidth) / 2;
      generationMetrics.push({ generation: level, y: rowY, height: trackHeight, nodeWidth: nodeWidth, nodeHeight: nodeHeight });
      let cursorX = startX;
      items.forEach(function (person) {
        const placement = partnerPlacements.get(person.id);
        const scale = placement && placement.scale || 1;
        const width = nodeWidth * scale;
        const height = nodeHeight * scale;
        nodes.push({
          id: person.id,
          person: person,
          x: cursorX,
          y: rowY + (placement && placement.align === "bottom" ? trackHeight - height : placement && placement.align === "top" ? 0 : (trackHeight - height) / 2),
          width: width,
          height: height,
          renderWidth: nodeWidth,
          renderHeight: nodeHeight,
          scale: scale,
          partnerPlacement: placement && placement.side || "",
          partnerAlign: placement && placement.align || "",
          partnerCount: placement && placement.count || 0,
          generation: level
        });
        cursorX += width + horizontalGap;
      });
      rowY += trackHeight + verticalGap;
    });
    const nodeById = new Map(nodes.map(function (node) { return [node.id, node]; }));
    const edges = visibleRelationships.map(function (relationship) {
      const aId = relationship.type === "parent-child" ? relationship.parentId : relationship.person1Id;
      const bId = relationship.type === "parent-child" ? relationship.childId : relationship.person2Id;
      return { relationship: relationship, from: nodeById.get(aId), to: nodeById.get(bId), current: relationship.type === "partner" && currentPartnerRelationshipIds.has(relationship.id) };
    }).filter(function (edge) { return edge.from && edge.to; });
    const height = rowY - verticalGap + 40;
    return { nodes: nodes, edges: edges, width: contentWidth, height: Math.max(360, height), bounds: { x: 0, y: 0, width: contentWidth, height: Math.max(360, height) }, peopleById: peopleById, nodeView: detailed ? "detailed" : "condensed", nameBasis: settings.nameBasis, nameLength: settings.nameLength, generationMetrics: generationMetrics };
  }

  function validateRelationshipDraft(draft, state, ignoreId) {
    const peopleIds = new Set(state.workspace.people.map(function (person) { return person.id; }));
    const relationships = state.workspace.relationships;
    if (draft.type === "parent-child") {
      if (!peopleIds.has(draft.parentId) || !peopleIds.has(draft.childId)) return "Choose two existing people.";
      if (draft.parentId === draft.childId) return "A person cannot be their own parent.";
      if (!config.parentLineages.some(function (item) { return item.id === draft.lineage; })) return "Choose a Lineal or Non-Lineal parent role.";
      const parentKind = config.parentKinds.find(function (item) { return item.id === draft.kind; });
      if (!parentKind) return "Choose a supported parent type.";
      if (draft.lineage === "lineal" && !parentKind.lineal) return parentKind.label + " parents must be Non-Lineal.";
      if (draft.lineage === "lineal" && relationships.some(function (item) { return item.id !== ignoreId && item.type === "parent-child" && item.childId === draft.childId && item.lineage === "lineal"; })) return "A child can have only one Lineal parent.";
      const duplicate = relationships.some(function (item) { return item.id !== ignoreId && item.type === "parent-child" && item.parentId === draft.parentId && item.childId === draft.childId; });
      if (duplicate) return "That parent-child relationship already exists.";
      if (model.wouldCreateAncestryCycle(relationships, draft.parentId, draft.childId, ignoreId)) return "That link would create an ancestry cycle.";
      return "";
    }
    if (draft.type === "partner") {
      if (!peopleIds.has(draft.person1Id) || !peopleIds.has(draft.person2Id)) return "Choose two existing people.";
      if (draft.person1Id === draft.person2Id) return "A person cannot be their own partner.";
      const fields = draft.source && draft.source.fields || {};
      const savedType = String(fields["partner-type"] || "").trim();
      const savedEndReason = String(fields["end-reason"] || "").trim();
      if (savedType && !config.partnerTypes.some(function (item) { return item.id === savedType; })) return "Choose a supported partner relationship.";
      if (savedEndReason && !config.partnerEndReasons.some(function (item) { return item.id === savedEndReason; })) return "Choose a supported partner ending.";
      if (draft.endDate && draft.endDate.value && !savedEndReason) return "Choose why the partner relationship ended.";
      const start = JSON.stringify(draft.startDate || "");
      const end = JSON.stringify(draft.endDate || "");
      const duplicate = relationships.some(function (item) {
        if (item.id === ignoreId || item.type !== "partner") return false;
        const samePair = (item.person1Id === draft.person1Id && item.person2Id === draft.person2Id) || (item.person1Id === draft.person2Id && item.person2Id === draft.person1Id);
        return samePair && JSON.stringify(item.startDate || "") === start && JSON.stringify(item.endDate || "") === end;
      });
      return duplicate ? "That partner history already exists for the same dates." : "";
    }
    return "Choose a relationship type.";
  }

  function eventYearLabel(person, kind) {
    const value = person && person[kind] && person[kind].date && person[kind].date.value;
    if (value) return String(value).slice(0, 4);
    const year = sourceField(person, "person-date-" + kind + "-value").slice(0, 4);
    return /^[\d?]{4}$/.test(year) ? year : "";
  }

  function lifespan(person) {
    const birth = eventYearLabel(person, "birth") || "????";
    if (person && person.livingStatus === "living") return birth;
    return birth + " – " + (eventYearLabel(person, "death") || "????");
  }

  App.family = {
    indexes: indexes,
    relationGroups: relationGroups,
    compareBirthOrder: compareBirthOrder,
    siblingRelationshipKind: siblingRelationshipKind,
    isLinealRelationship: isLinealRelationship,
    isLineageEligiblePerson: isLineageEligiblePerson,
    ancestorsOf: ancestorsOf,
    descendantsOf: descendantsOf,
    familyUnits: familyUnits,
    lineageSummary: lineageSummary,
    eventYearLabel: eventYearLabel,
    unplacedLineageIds: unplacedLineageIds,
    focusPeople: focusPeople,
    connectedComponents: connectedComponents,
    generationMap: generationMap,
    compareLineage: compareLineage,
    isNeverMarriedPartnership: isNeverMarriedPartnership,
    partnerHasRecordedEnd: partnerHasRecordedEnd,
    partnerMaritalStatusId: partnerMaritalStatusId,
    partnerLineKind: partnerLineKind,
    treeNameLines: treeNameLines,
    layout: layout,
    validateRelationshipDraft: validateRelationshipDraft,
    lifespan: lifespan
  };
})();
