(function () {
  "use strict";

  const App = window.LocalApp;
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

  function relationGroups(id, state) {
    const graph = indexes(state);
    return {
      parents: graph.parents.get(id) || [],
      children: graph.children.get(id) || [],
      partners: graph.partners.get(id) || [],
      siblings: siblingsOf(id, graph)
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
    const raw = String(fields && fields.lineage_id || "").trim();
    const parts = raw ? raw.split(".").map(function (part) { return part.trim(); }).filter(Boolean) : [];
    return fields && Object.prototype.hasOwnProperty.call(fields, "lineage_parent_id") ? parts.reverse() : parts;
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
    const sourceSlot = Number(relationship && relationship.source && relationship.source.fields && relationship.source.fields.spouse_slot);
    if (Number.isFinite(sourceSlot) && sourceSlot > 0) return sourceSlot;
    const order = Number(relationship && relationship.order);
    return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
  }

  function comparePartnerHistory(a, b) {
    const aDate = String(a.relationship.startDate && a.relationship.startDate.value || a.relationship.endDate && a.relationship.endDate.value || "");
    const bDate = String(b.relationship.startDate && b.relationship.startDate.value || b.relationship.endDate && b.relationship.endDate.value || "");
    if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);
    if (aDate !== bDate) return aDate ? -1 : 1;
    return relationshipOrderValue(a.relationship) - relationshipOrderValue(b.relationship);
  }

  function arrangePartners(items, relationships) {
    const peopleById = new Map(items.map(function (person) { return [person.id, person]; }));
    const pastStatuses = new Set(["divorced", "former", "separated", "widowed"]);
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
        const aPrimary = a && a.source && a.source.format === "mclineage-cleaned" ? 1 : 0;
        const bPrimary = b && b.source && b.source.format === "mclineage-cleaned" ? 1 : 0;
        return bPrimary - aPrimary
          || Number(lineageParts(b).length > 0) - Number(lineageParts(a).length > 0)
          || (itemOrder.get(aId) || 0) - (itemOrder.get(bId) || 0);
      })[0];
      const anchor = peopleById.get(anchorId);
      const histories = (links.get(anchorId) || []).filter(function (entry) { return !used.has(entry.id); }).sort(comparePartnerHistory);
      const active = histories.filter(function (entry) { return !pastStatuses.has(entry.relationship.status); });
      const preferredActive = active.filter(function (entry) { return entry.relationship.status === "married" || entry.relationship.status === "partnered"; });
      const current = (preferredActive.length ? preferredActive : active).slice(-1)[0] || null;
      histories.filter(function (entry) { return !current || entry.id !== current.id; }).forEach(function (entry) {
        if (used.has(entry.id)) return;
        arranged.push(peopleById.get(entry.id));
        used.add(entry.id);
      });
      arranged.push(anchor);
      used.add(anchorId);
      if (current && !used.has(current.id)) { arranged.push(peopleById.get(current.id)); used.add(current.id); }
      componentIds.filter(function (id) { return !used.has(id); }).sort(function (a, b) { return itemOrder.get(a) - itemOrder.get(b); }).forEach(function (id) { arranged.push(peopleById.get(id)); used.add(id); });
    });
    return arranged;
  }

  function layout(state, options) {
    const settings = Object.assign({ mode: "focus", focusId: "", ancestorDepth: 2, descendantDepth: 2, nodeView: "condensed" }, options || {});
    if (options && options.depth != null) {
      if (options.ancestorDepth == null) settings.ancestorDepth = options.depth;
      if (options.descendantDepth == null) settings.descendantDepth = options.depth;
    }
    const visiblePeople = settings.mode === "overview" ? state.workspace.people.slice() : focusPeople(state, settings.focusId, settings.ancestorDepth, settings.descendantDepth);
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
      items = arrangePartners(items, visibleRelationships);
      groups.set(level, items);
      items.forEach(function (person, index) { positions.set(person.id, index); });
    });
    const detailed = settings.nodeView === "detailed";
    const nodeWidth = detailed ? 176 : 148;
    const nodeHeight = detailed ? 72 : 74;
    const horizontalGap = settings.mode === "overview" ? (detailed ? 34 : 26) : (detailed ? 48 : 34);
    const verticalGap = 88;
    const maxCount = Math.max.apply(null, Array.from(groups.values()).map(function (items) { return items.length; }));
    const contentWidth = Math.max(680, maxCount * (nodeWidth + horizontalGap) - horizontalGap + 80);
    const minLevel = sortedLevels[0];
    const nodes = [];
    sortedLevels.forEach(function (level) {
      const items = groups.get(level);
      const rowWidth = items.length * (nodeWidth + horizontalGap) - horizontalGap;
      const startX = (contentWidth - rowWidth) / 2;
      items.forEach(function (person, index) {
        nodes.push({
          id: person.id,
          person: person,
          x: startX + index * (nodeWidth + horizontalGap),
          y: 40 + (level - minLevel) * (nodeHeight + verticalGap),
          width: nodeWidth,
          height: nodeHeight,
          generation: level
        });
      });
    });
    const nodeById = new Map(nodes.map(function (node) { return [node.id, node]; }));
    const edges = visibleRelationships.map(function (relationship) {
      const aId = relationship.type === "parent-child" ? relationship.parentId : relationship.person1Id;
      const bId = relationship.type === "parent-child" ? relationship.childId : relationship.person2Id;
      return { relationship: relationship, from: nodeById.get(aId), to: nodeById.get(bId) };
    }).filter(function (edge) { return edge.from && edge.to; });
    const height = 80 + sortedLevels.length * nodeHeight + Math.max(0, sortedLevels.length - 1) * verticalGap;
    return { nodes: nodes, edges: edges, width: contentWidth, height: Math.max(360, height), bounds: { x: 0, y: 0, width: contentWidth, height: Math.max(360, height) }, peopleById: peopleById, nodeView: detailed ? "detailed" : "condensed" };
  }

  function validateRelationshipDraft(draft, state, ignoreId) {
    const peopleIds = new Set(state.workspace.people.map(function (person) { return person.id; }));
    const relationships = state.workspace.relationships;
    if (draft.type === "parent-child") {
      if (!peopleIds.has(draft.parentId) || !peopleIds.has(draft.childId)) return "Choose two existing people.";
      if (draft.parentId === draft.childId) return "A person cannot be their own parent.";
      const duplicate = relationships.some(function (item) { return item.id !== ignoreId && item.type === "parent-child" && item.parentId === draft.parentId && item.childId === draft.childId; });
      if (duplicate) return "That parent-child relationship already exists.";
      if (model.wouldCreateAncestryCycle(relationships, draft.parentId, draft.childId, ignoreId)) return "That link would create an ancestry cycle.";
      return "";
    }
    if (draft.type === "partner") {
      if (!peopleIds.has(draft.person1Id) || !peopleIds.has(draft.person2Id)) return "Choose two existing people.";
      if (draft.person1Id === draft.person2Id) return "A person cannot be their own partner.";
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

  function lifespan(person) {
    const birth = person.birth && person.birth.date && person.birth.date.value ? person.birth.date.value.slice(0, 4) : "";
    const death = person.death && person.death.date && person.death.date.value ? person.death.date.value.slice(0, 4) : "";
    if (birth || death) return (birth || "?") + "–" + (death || (person.livingStatus === "living" ? "present" : "?"));
    return person.livingStatus === "deceased" ? "Deceased" : person.livingStatus === "living" ? "Living" : "Dates unknown";
  }

  App.family = {
    indexes: indexes,
    relationGroups: relationGroups,
    ancestorsOf: ancestorsOf,
    descendantsOf: descendantsOf,
    familyUnits: familyUnits,
    lineageSummary: lineageSummary,
    focusPeople: focusPeople,
    connectedComponents: connectedComponents,
    generationMap: generationMap,
    layout: layout,
    validateRelationshipDraft: validateRelationshipDraft,
    lifespan: lifespan
  };
})();
