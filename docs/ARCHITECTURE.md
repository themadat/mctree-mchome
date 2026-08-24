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
9. `core/cloud.js` explicitly uploads/downloads that ZIP through a private GitHub repository, enforces audit continuity, and rejects stale writes by file SHA.
10. `core/pwa.js` manages appearance-aware install metadata, service-worker registration, and updates.
11. `app.js` renders the onboarding gate, family workspace, editors, Settings, search, SVG interaction, and print atlas.

All modules attach to `window.LocalApp`. The ordinary workspace remains local. The only family-data network path is the editor-invoked `core/cloud.js` transaction to GitHub's API; the service worker never intercepts or caches it.

## Schema v13

The durable state is normalized into this shape:

```json
{
  "schemaVersion": 13,
  "meta": {
    "appVersion": "0.0.1.60",
    "buildId": "0.0.1.60",
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp",
    "lastMutationId": "stable id",
    "tombstones": { "records": [], "documents": [], "people": [], "relationships": [], "places": [], "residences": [] },
    "package": { "format": "mcfamily-package", "version": "1", "datasetVersion": "16.0.0", "auditHistory": [] }
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

Relationships are independent records. Parent-child records contain `parentId`, `childId`, an independent Lineal/Non-Lineal `lineage` role, and a biological/adoptive/step/foster/guardian/unknown `kind`. A child may have at most one Lineal parent and multiple distinct Non-Lineal parents. Partner records contain two person ids, status, optional start/end dates and place, and notes. Validation rejects missing people, self-links, duplicate unordered partner pairs, duplicate parent-child pairs, multiple Lineal parents for one child, and directed parent ancestry cycles.

Derived family concepts are never copied onto people. `family.js` builds them from relationships so edits cannot leave contradictory ancestor, sibling, descendant, or family-unit arrays behind.

The dataset 16 ZIP package preserves the current state model through five exact CSV schemas. McRelations uses schema 2.0; the other files use schema 1.0. Historical application-state and transfer schemas are intentionally unsupported. Data-only publications advance through `16.0.x` patch versions without changing those schemas or the website build.

## Initialization and persistence

A fresh default has no `initializedAt` value and no people. `app.js` renders the introduction and ZIP input in that state while retaining the title-bar Audit action for an explicit cloud download. `portability.js` accepts only a dataset 16 package with exactly `McPeople.csv`, `McPlaces.csv`, `McRelations.csv`, `McResidences.csv`, and `McMetadata.csv`, and requires at least one valid person before the first local state is stored.

McPeople contains one stable P-referenced row per person and no parent or partner columns. McRelations contains all authoritative Person-to-Person parent and partner links, with parent lineage role separated from parent type. McPlaces contains reusable physical addresses, while McResidences assigns people to places. McMetadata declares package/dataset/file-schema versions, exact record counts, family settings, and append-only audit events. Package validation completes before any current state is touched and rejects ZIP damage, wrong filenames, schema drift, count mismatches, invalid identifiers/dates, broken cross-file references, duplicate links, multiple Lineal parents, Lineage inconsistencies, and ancestry cycles.

## Private GitHub package transport

The public Pages repository and private data repository are intentionally separate. Cloud connection settings and the optional remembered token live in dedicated browser-storage keys and are never written into normalized state, exports, recovery, PDFs, or service-worker caches. Session-only tokens use `sessionStorage`; remembered tokens use `localStorage`. Every editor should use a separate fine-grained token limited to the private data repository with Contents read/write access.

Download Latest reads the configured ZIP through GitHub's Contents/Blob APIs, applies the same strict package parser used by local import, creates local recovery when necessary, replaces the browser workspace without rewriting package metadata, and downloads the exact remote bytes.

Upload Changes validates the edited ZIP before any write. When a remote package exists, its dataset version must match the candidate and its complete audit sequence must be an unchanged prefix of the candidate audit. McFamily calculates collection-level added/changed/removed counts, requires an editor and summary, increments the `16.0.x` patch, appends one `published-cloud-package` event, re-encodes and re-validates the final ZIP, then writes it with the remote GitHub file SHA. A changed SHA or API conflict rejects the save rather than merging or overwriting. One Git commit and the McMetadata event preserve each successful publication.

This provides controlled editor handoff and revocation through GitHub collaborators, but not application roles, sign-in tracking, read/download usage history, or a tamper-proof audit. Those remain backend work.

Lineal people use complete root-to-person paths that extend each direct Lineal parent's path by one two-digit segment; Non-Lineal partner-only rows intentionally leave lineage blank. A known death value marks a person deceased. Without one, `person-date-death-descriptor` is authoritative: `NONE` means living, `UNKNOWN` means explicitly deceased with no known date, and `UNKNOWN PRESUMED` means source evidence presumes death. Partial source dates remain in source details because the editable date model accepts only normalized known values.

After initialization, deleting the last person does not clear `initializedAt`; the workspace remains open and offers Add Person. Subsequent imports may contain an initialized empty family, but replacement always shows a summary, asks for confirmation, and writes the current state to recovery first.

Startup checks only `mcfamily.state.v13` and the matching `mcfamily.recovery.v5` snapshot. State v13 passes through normalization, sanitization, and validation; every other state version is rejected. McFamily removes its own older versioned state/recovery keys before loading so obsolete copies cannot consume the local-storage quota; this deployment then opens the import gate until a dataset 16 package is loaded. A corrupt current copy falls back to the current recovery snapshot or to the uninitialized gate. Ordinary mutations update metadata and are saved locally with a short debounce.

Person deletion also writes recovery before removing that person's relationship records. Recovery is a single last-known snapshot, not a history or merge log. Favorite person IDs ordinarily live in normalized UI state; Developer Mode can additionally download a small private `mcfamily-favorites` JSON envelope and restore that exact ID set without depending on browser storage.

## Tree and directory

The family workspace has three coordinated surfaces:

- Directory: header-toggled people with title-bar search and result count, first/last-name sorting, combinable checkbox filters for living status and Lineal/Non-Lineal scope, lifespan/lineage metadata, and A–Z quick jumps.
- Family Tree: a two-axis-scrollable SVG focus view with grouped numeric ancestor and descendant depths defaulting to 10, a right-aligned editable zoom and Out/In/Fit group, an optional display-only Non-Lineal Lines overlay, bold muted-red Lineal outlines with corner symbols, or an overview containing all connected components and isolated people.
- Profile: a selected person's complete information and derived relationship groups. Closing it clears selection; choosing a Family Tree node reopens it.

The SVG contains semantic relationship labels in addition to visual lines. Pan and zoom use a view transform, touch uses pointer events, Fit calculates the graph bounds, and keyboard arrows move between rendered people. Reduced-motion settings suppress nonessential transitions.

The layout is deterministic and dependency-free. Desktop opens with a thin-gutter 20/50/30 Directory/Tree/Profile balance; moving either separator persists explicit widths. Narrow cards stack each whitespace-separated name part on its own line, keep the Lineal mark beside the lifespan, and expand generation rows to the tallest card. People in the same generation are reordered around an imported Lineal person: up to two historical partners occupy the left at two-thirds scale, while at most one current or latest death-ended Non-Lineal spouse occupies the right at full size. One left partner is centered; two align to the full-size cards' top and bottom. Straight horizontal partner links remain parallel and evenly spaced. Gold distinguishes current marriages (solid), previous marriages (dashed), never-married partnerships (dotted), and unknown relationships (question marks). Lineal parent edges are faded muted red, with Lineal adoption drawn dashed; the off-by-default Non-Lineal Lines control reveals any number of lighter dashed Non-Lineal parent branches. The optional co-parent overlay adds a lighter branch from a plausible recorded partner to the existing recorded parent-child path and never creates data. The layout favors readable generations and connected components rather than guaranteeing a traditional two-parent pedigree diagram in every pathological graph.

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
