# Architecture

## Runtime layers

McFamily is an ordered-script static page with no module loader or runtime packages:

1. `config.js` defines identity, version, limits, relationship vocabularies, Help, releases, and Roadmap.
2. `icons.js` provides reusable inline SVG markup.
3. `core/utils.js` provides escaping, normalization, ids, dates, and hashing.
4. `core/state.js` owns current schema defaults, sanitization, and validation.
5. `core/storage.js` loads and autosaves browser state and manages one recovery snapshot.
6. `core/components.js` implements dialogs, menus, toasts, loading UI, and focus restoration.
7. `core/family.js` derives relationship indexes, ancestors, descendants, siblings, connected components, generations, and tree layout.
8. `core/portability.js` validates, imports, and exports the complete five-file private ZIP package.
9. `core/pwa.js` manages appearance-aware install metadata, service-worker registration, and updates.
10. `app.js` renders the onboarding gate, family workspace, editors, Settings, search, SVG interaction, and print atlas.

All modules attach to `window.LocalApp`. Application runtime has no family-data network path.

## Schema v12

The durable state is normalized into this shape:

```json
{
  "schemaVersion": 12,
  "meta": {
    "appVersion": "0.0.1.57",
    "buildId": "0.0.1.57",
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp",
    "lastMutationId": "stable id",
    "tombstones": { "records": [], "documents": [], "people": [], "relationships": [], "places": [], "residences": [] },
    "package": { "format": "mcfamily-package", "version": "1", "datasetVersion": "15.0.0", "auditHistory": [] }
  },
  "workspace": {
    "family": {
      "title": "Example Family",
      "initializedAt": "ISO timestamp",
      "homePersonId": "person-id"
    },
    "people": [],
    "relationships": [],
    "places": [],
    "residences": [],
    "records": [],
    "documents": [{ "id": "app-notes", "title": "Notes", "html": "Escaped plain text" }]
  },
  "preferences": {},
  "ui": {},
  "modules": {}
}
```

Each person has a stable id, timestamps, structured name fields, status, optional gender and pronouns, birth and death events, repeated phones/emails, heritage text, general notes, and source metadata. Places are reusable physical-address records. Residences are explicit Person-to-Place records; normalization derives each person's visible addresses from those two arrays. Flexible dates use a `value` plus an exact/about/before/after qualifier.

Relationships are independent records. Parent-child records contain `parentId`, `childId`, and biological/adoptive/step/foster/guardian/unknown type. Partner records contain two person ids, status, optional start/end dates and place, and notes. Validation rejects missing people, self-links, duplicate unordered partner pairs, duplicate typed parent-child pairs, and directed parent ancestry cycles.

Derived family concepts are never copied onto people. `family.js` builds them from relationships so edits cannot leave contradictory ancestor, sibling, descendant, or family-unit arrays behind.

The dataset 15 ZIP package preserves the current state model through five exact CSV schemas. Historical application-state and transfer schemas are intentionally unsupported.

## Initialization and persistence

A fresh default has no `initializedAt` value and no people. `app.js` renders only the introduction and ZIP input in that state. `portability.js` accepts only a dataset 15 package with exactly `McPeople.csv`, `McPlaces.csv`, `McRelations.csv`, `McResidences.csv`, and `McMetadata.csv`, and requires at least one valid person before the first local state is stored.

McPeople contains one stable P-referenced row per person and no parent or partner columns. McRelations contains all authoritative Person-to-Person parent and partner links. McPlaces contains reusable physical addresses, while McResidences assigns people to places. McMetadata declares package/dataset/file-schema versions, exact record counts, family settings, and append-only audit events. Package validation completes before any current state is touched and rejects ZIP damage, wrong filenames, schema drift, count mismatches, invalid identifiers/dates, broken cross-file references, duplicate links, invalid Non-Lineal parents, Lineage inconsistencies, and ancestry cycles.

Lineal people use complete root-to-person paths that extend each direct Lineal parent's path by one two-digit segment; Non-Lineal partner-only rows intentionally leave lineage blank. A known death value marks a person deceased. Without one, `person-date-death-descriptor` is authoritative: `NONE` means living, `UNKNOWN` means explicitly deceased with no known date, and `UNKNOWN PRESUMED` means source evidence presumes death. Partial source dates remain in source details because the editable date model accepts only normalized known values.

After initialization, deleting the last person does not clear `initializedAt`; the workspace remains open and offers Add Person. Subsequent imports may contain an initialized empty family, but replacement always shows a summary, asks for confirmation, and writes the current state to recovery first.

Startup checks only `mcfamily.state.v12` and the matching `mcfamily.recovery.v4` snapshot. State v12 passes through normalization, sanitization, and validation; every other state version is rejected. McFamily removes its own older versioned state/recovery keys before loading so obsolete copies cannot consume the local-storage quota; this deployment then opens the import gate until a dataset 15 package is loaded. A corrupt current copy falls back to the current recovery snapshot or to the uninitialized gate. Ordinary mutations update metadata and are saved locally with a short debounce.

Person deletion also writes recovery before removing that person's relationship records. Recovery is a single last-known snapshot, not a history or merge log. Favorite person IDs ordinarily live in normalized UI state; Developer Mode can additionally download a small private `mcfamily-favorites` JSON envelope and restore that exact ID set without depending on browser storage.

## Tree and directory

The family workspace has three coordinated surfaces:

- Directory: header-toggled people with title-bar search and result count, first/last-name sorting, combinable checkbox filters for living status and Lineal/Non-Lineal scope, lifespan/lineage metadata, and A–Z quick jumps.
- Family Tree: a two-axis-scrollable SVG focus view with grouped numeric ancestor and descendant depths defaulting to 10, a right-aligned editable zoom and Out/In/Fit group, an optional display-only Non-Lineal Lines overlay, bold muted-red Lineal outlines with corner symbols, or an overview containing all connected components and isolated people.
- Profile: a selected person's complete information and derived relationship groups. Closing it clears selection; choosing a Family Tree node reopens it.

The SVG contains semantic relationship labels in addition to visual lines. Pan and zoom use a view transform, touch uses pointer events, Fit calculates the graph bounds, and keyboard arrows move between rendered people. Reduced-motion settings suppress nonessential transitions.

The layout is deterministic and dependency-free. Desktop opens with a thin-gutter 20/50/30 Directory/Tree/Profile balance; moving either separator persists explicit widths. Narrow cards stack each whitespace-separated name part on its own line, keep the Lineal mark beside the lifespan, and expand generation rows to the tallest card. People in the same generation are reordered around an imported Lineal person: up to two historical partners occupy the left at two-thirds scale, while at most one current or latest death-ended Non-Lineal spouse occupies the right at full size. One left partner is centered; two align to the full-size cards' top and bottom. Straight horizontal partner links remain parallel and evenly spaced. Gold distinguishes current marriages (solid), previous marriages (dashed), never-married partnerships (dotted), and unknown relationships (question marks); Lineal parent edges remain faded muted red. The optional co-parent overlay adds a lighter branch from a plausible recorded partner to the existing recorded parent-child path and never creates data. The layout favors readable generations and connected components rather than guaranteeing a traditional two-parent pedigree diagram in every pathological graph.

## Print atlas

The print action constructs hidden semantic HTML before calling `window.print()`. Print CSS suppresses application controls and exposes only the report. Developer Mode copies the same generated report into a modal preview and deliberately skips `window.print()`.

The compact cover, counts, relationship legend, and six-column Family Maps flow together without forced opening-page breaks. The George McMillen (1745) component is first and identifies him as Generation 0; every component uses its Root Ancestor label. Generation 4 and later are partitioned beneath Generation 3 descendants, including Non-Lineal partners assigned through their Lineal partner. Unresolved `99`/`??` lineage branches are excluded from the printable atlas. Lineal map cards use faded-red outlines; Newton, Albon, and Lucian have stronger orientation highlights, and adaptive map-name type is constrained to two lines. A dense Person Directory follows without internal P references, individual Notes, or Imported Source fields; Family Notes remain a separate final section. Cross-references avoid scaling one enormous SVG tree to illegible size. Page-break rules prefer intact entries and repeat important section headings where supported.

The browser owns PDF generation. McFamily does not create a binary PDF directly.

## Security and privacy boundaries

The import gate is not authentication. Browser storage, extracted package CSVs, exported ZIPs, and printed PDFs all contain sensitive plaintext. The static application has no owner/editor/viewer roles, revocation, or server-side usage audit. Those wishlist features require a future authenticated backend and are explicitly marked that way in the Roadmap.

No real family CSV, ZIP, or export belongs in the repository. Only synthetic data should be used for committed tests or documentation.

## PWA and offline strategy

`sw.js` precaches the public HTML, scripts, manifests, and install assets. Same-origin application requests use network-first revalidation and cached fallback. The service worker never reads browser family state and has no sync endpoint.

A waiting worker triggers the persistent new-version toast; its refresh action activates the new worker and reloads with a cache-busting URL.
