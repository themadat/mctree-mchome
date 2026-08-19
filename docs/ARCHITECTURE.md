# Architecture

## Runtime layers

McFamily is an ordered-script static page with no module loader or runtime packages:

1. `config.js` defines identity, version, limits, relationship vocabularies, Help, releases, and Roadmap.
2. `icons.js` provides reusable inline SVG markup.
3. `core/utils.js` provides escaping, normalization, ids, dates, and hashing.
4. `core/state.js` owns schema defaults, migration, sanitization, and validation.
5. `core/storage.js` loads and autosaves browser state and manages one recovery snapshot.
6. `core/components.js` implements dialogs, menus, toasts, loading UI, and focus restoration.
7. `core/family.js` derives relationship indexes, ancestors, descendants, siblings, connected components, generations, and tree layout.
8. `core/portability.js` handles cleaned-source mapping plus complete private CSV export and replacement import.
9. `core/pwa.js` manages appearance-aware install metadata, service-worker registration, and updates.
10. `app.js` renders the onboarding gate, family workspace, editors, Settings, search, SVG interaction, and print atlas.

All modules attach to `window.LocalApp`. Application runtime has no family-data network path.

## Schema v7

The durable state is normalized into this shape:

```json
{
  "schemaVersion": 7,
  "meta": {
    "appVersion": "0.0.1.7",
    "buildId": "0.0.1.7",
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp",
    "lastMutationId": "stable id",
    "tombstones": { "records": [], "documents": [] }
  },
  "workspace": {
    "family": {
      "title": "Example Family",
      "initializedAt": "ISO timestamp",
      "homePersonId": "person-id"
    },
    "people": [],
    "relationships": [],
    "records": [],
    "documents": [{ "id": "app-notes", "title": "Notes", "html": "Escaped plain text" }]
  },
  "preferences": {},
  "ui": {},
  "modules": {}
}
```

Each person has a stable id, a stable display reference, timestamps, structured name fields, status, optional gender and pronouns, birth and death events, repeated addresses/phones/emails, heritage text, general notes, and optional cleaned-source metadata. Flexible dates use a `value` plus an exact/about/before/after qualifier.

Relationships are independent records. Parent-child records contain `parentId`, `childId`, and biological/adoptive/step/foster/guardian/unknown type. Partner records contain two person ids, status, optional start/end dates and place, and notes. Validation rejects missing people, self-links, duplicate unordered partner pairs, duplicate typed parent-child pairs, and directed parent ancestry cycles.

Derived family concepts are never copied onto people. `family.js` builds them from relationships so edits cannot leave contradictory ancestor, sibling, descendant, or family-unit arrays behind.

The compatibility `records`, `documents`, tombstone, UI, and module fields remain readable for older backups. Notes migration consolidates older documents into the stable `app-notes` document without exposing a former multi-note interface.

## Initialization and persistence

A fresh default has no `initializedAt` value and no people. `app.js` renders only the introduction and file input in that state. `portability.js` accepts the documented cleaned McLineage columns or native `mcfamily-csv-v1` rows and requires at least one valid person before the first local state is stored.

After initialization, deleting the last person does not clear `initializedAt`; the workspace remains open and offers Add Person. Subsequent imports may contain an initialized empty family, but replacement always shows a summary, asks for confirmation, and writes the current state to recovery first.

Startup checks the schema-v7 storage key and known legacy keys. Candidates pass through wrapper unwrapping, sequential migration, normalization, sanitization, and validation. A corrupt current copy falls back to recovery or to the uninitialized gate. Ordinary mutations update metadata and are saved locally with a short debounce.

Person deletion also writes recovery before removing that person's relationship records. Recovery is a single last-known snapshot, not a history or merge log.

## Tree and directory

The family workspace has three coordinated surfaces:

- Directory: alphabetical people with living-status filtering and broad local search.
- Tree: an SVG focus view around the home or selected person, or an overview containing all connected components and isolated people.
- Profile: a selected person's complete information and derived relationship groups, with edit/connect actions.

The SVG contains semantic relationship labels in addition to visual lines. Pan and zoom use a view transform, touch uses pointer events, Fit calculates the graph bounds, and keyboard arrows move between rendered people. Reduced-motion settings suppress nonessential transitions.

The layout is deterministic and dependency-free. People in the same generation are reordered to keep recorded partners adjacent when possible; the partner status controls married, divorced, and other line treatments. It favors readable generations and connected components rather than guaranteeing a traditional two-parent pedigree diagram in every pathological graph.

## Print atlas

The print action constructs hidden semantic HTML before calling `window.print()`. Print CSS suppresses application controls and exposes only the report. Stable `P` references identify people in detailed profiles and relationship cross-references.

The report contains a cover and counts, relationship legend, compact generation-grouped maps for every component, alphabetical profiles with all stored person fields, and Family Notes. Each map is named for the top-generation person with the most direct children, falling back to name order; cards show names and years without identifiers. Cross-references avoid scaling one enormous SVG tree to illegible size. Page-break rules prefer intact profiles and repeat important section headings where supported.

The browser owns PDF generation. McFamily does not create a binary PDF directly.

## Security and privacy boundaries

The import gate is not authentication. Browser storage, exported CSV, and printed PDFs all contain sensitive plaintext. The static application has no owner/editor/viewer roles, revocation, or usage audit. Those wishlist features require a future authenticated backend and are explicitly marked that way in the Roadmap.

No real family CSV or export belongs in the repository. Only synthetic data should be used for committed tests or documentation.

## PWA and offline strategy

`sw.js` precaches the public HTML, scripts, manifests, and install assets. Same-origin application requests use network-first revalidation and cached fallback. The service worker never reads browser family state and has no sync endpoint.

A waiting worker triggers the persistent new-version toast; its refresh action activates the new worker and reloads with a cache-busting URL.
