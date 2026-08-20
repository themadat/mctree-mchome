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

## Schema v8

The durable state is normalized into this shape:

```json
{
  "schemaVersion": 8,
  "meta": {
    "appVersion": "0.0.1.41",
    "buildId": "0.0.1.41",
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

Current cleaned McLineage rows represent every person and partner as a stable P-referenced row. Lineal people use complete root-to-person paths that extend each direct parent's path by one two-digit segment; Non-Lineal partner-only rows intentionally leave lineage fields blank. The originating person's `partner_relationships_json` array expands into authoritative app relationship records with stable R IDs, partner P references, relationship types, ordering, dates, and ending reasons. The technical `parent_affinal_person_id` reference must resolve through those normalized partner pairs. Known and question-mark partial source date values share the `person_*` identity/date columns. A known death value or known birth date beyond age 100 marks a person deceased or presumed deceased; an otherwise unknown-status partner of any deceased person is also presumed deceased, while a person whose birth date indicates an age of 100 or less remains living. Partial source dates remain in source details because the editable/native date model accepts only normalized known values.

After initialization, deleting the last person does not clear `initializedAt`; the workspace remains open and offers Add Person. Subsequent imports may contain an initialized empty family, but replacement always shows a summary, asks for confirmation, and writes the current state to recovery first.

Startup checks the schema-v8 storage key and known legacy keys. Candidates pass through wrapper unwrapping, sequential migration, normalization, sanitization, and validation. Normalization refreshes cleaned-source living statuses so current death descriptors, lineage generations, and age-based inference also correct existing saved imports. A corrupt current copy falls back to recovery or to the uninitialized gate. Ordinary mutations update metadata and are saved locally with a short debounce.

Person deletion also writes recovery before removing that person's relationship records. Recovery is a single last-known snapshot, not a history or merge log.

## Tree and directory

The family workspace has three coordinated surfaces:

- Directory: header-toggled people with title-bar search and result count, first/last-name sorting, combinable checkbox filters for living status and Lineal/Non-Lineal scope, lifespan/lineage metadata, and A–Z quick jumps.
- Family Tree: a two-axis-scrollable SVG focus view with grouped numeric ancestor and descendant depths defaulting to 10, a right-aligned editable zoom and Out/In/Fit group, an optional display-only Non-Lineal Lines overlay, bold muted-red Lineal outlines with corner symbols, or an overview containing all connected components and isolated people.
- Profile: a selected person's complete information and derived relationship groups. Closing it clears selection; choosing a Family Tree node reopens it.

The SVG contains semantic relationship labels in addition to visual lines. Pan and zoom use a view transform, touch uses pointer events, Fit calculates the graph bounds, and keyboard arrows move between rendered people. Reduced-motion settings suppress nonessential transitions.

The layout is deterministic and dependency-free. Desktop opens with a thin-gutter 20/50/30 Directory/Tree/Profile balance; moving either separator persists explicit widths. Narrow cards stack each whitespace-separated name part on its own line, and generation rows expand vertically to the tallest card. People in the same generation are reordered around an imported Lineal person: up to two historical partners occupy the left at 75% scale, oldest top-aligned and next bottom-aligned, while at most one current Non-Lineal spouse occupies the right at full size. A current marriage is solid, a previous marriage is dashed, a never-married partnership is dotted, and an unknown relationship is drawn with question marks. Lineal parent edges use faded muted red. The optional co-parent overlay adds a lighter branch from a plausible recorded partner to the existing recorded parent-child path and never creates data. The layout favors readable generations and connected components rather than guaranteeing a traditional two-parent pedigree diagram in every pathological graph.

## Print atlas

The print action constructs hidden semantic HTML before calling `window.print()`. Print CSS suppresses application controls and exposes only the report. Developer Mode copies the same generated report into a modal preview and deliberately skips `window.print()`.

The compact cover, counts, relationship legend, and six-column Family Maps flow together without forced opening-page breaks. The George McMillen (1745) component is first and identifies him as Generation 0; other components retain their top-sibling label. Generation 5 and later are partitioned beneath Generation 4 descendants, including Non-Lineal partners assigned through their Lineal partner. Alphabetical profiles follow without internal P references, individual Notes, or Imported Source fields; Family Notes remain a separate final section. Cross-references avoid scaling one enormous SVG tree to illegible size. Page-break rules prefer intact profiles and repeat important section headings where supported.

The browser owns PDF generation. McFamily does not create a binary PDF directly.

## Security and privacy boundaries

The import gate is not authentication. Browser storage, exported CSV, and printed PDFs all contain sensitive plaintext. The static application has no owner/editor/viewer roles, revocation, or usage audit. Those wishlist features require a future authenticated backend and are explicitly marked that way in the Roadmap.

No real family CSV or export belongs in the repository. Only synthetic data should be used for committed tests or documentation.

## PWA and offline strategy

`sw.js` precaches the public HTML, scripts, manifests, and install assets. Same-origin application requests use network-first revalidation and cached fallback. The service worker never reads browser family state and has no sync endpoint.

A waiting worker triggers the persistent new-version toast; its refresh action activates the new worker and reloads with a cache-busting URL.
