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
8. `core/portability.js` validates the five-file package used inside encrypted records and provides Owner/Editor recovery ZIP import/export.
9. `core/cloud.js` fetches the public ciphertext vault, derives passphrase keys, decrypts the authorized package, applies access gates, publishes encrypted updates, manages grants, and rejects stale writes by vault revision and file SHA.
10. `core/pwa.js` manages appearance-aware install metadata, service-worker registration, and updates.
11. `app.js` renders the onboarding gate, family workspace, editors, Settings, search, SVG interaction, and print atlas.

All modules attach to `window.LocalApp`. Every load anonymously fetches the encrypted vault before opening the workspace. Decryption and package validation happen locally. Only Owner and Editor publication uses GitHub's write API; the service worker never intercepts or caches vault traffic.

## Schema v13

The durable state is normalized into this shape:

```json
{
  "schemaVersion": 13,
  "meta": {
    "appVersion": "0.0.1.75",
    "buildId": "0.0.1.75",
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp",
    "lastMutationId": "stable id",
    "tombstones": { "records": [], "documents": [], "people": [], "relationships": [], "places": [], "residences": [] },
    "package": { "format": "mcfamily-package", "version": "1", "datasetVersion": "16.0.0", "accessMode": "editor", "auditHistory": [] }
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

Relationships are independent records. Parent-child records contain `parentId`, `childId`, an independent Lineal/Non-Lineal `lineage` role, and a biological/adoptive/step/foster/guardian/unknown `kind`. A child may have at most one Lineal parent and multiple distinct Non-Lineal parents. Saving a Lineal link assigns the child's source `lineage-id` from its parent's path and recursively rebases the Lineal descendant branch. Partner records contain two person ids, a derived status, optional start/end dates and place, and notes; authoritative `partner-type` and `end-reason` values remain in source fields for exact package round-tripping. Validation rejects missing people, self-links, duplicate unordered partner pairs, duplicate parent-child pairs, multiple Lineal parents for one child, and directed parent ancestry cycles.

Derived family concepts are never copied onto people. `family.js` builds them from relationships so edits cannot leave contradictory ancestor, sibling, descendant, or family-unit arrays behind.

The dataset 16 ZIP package preserves the current state model through five exact CSV schemas. McRelations uses schema 2.0; the other files use schema 1.0. McMetadata carries the Editor/Member/Viewer access mode and compatibility details without dedicated columns. Historical application-state and transfer schemas are intentionally unsupported. Data-only publications advance through `16.0.x` patch versions without changing those schemas or the website build.

## Initialization and persistence

A normal load is locked behind the hosted passphrase gate. `cloud.js` fetches and validates the ciphertext envelope, tests the entered passphrase against every configured grant locally, requires exactly one match, decrypts that grant's full or redacted record, and hands the decrypted bytes to `portability.js`. No account label or role is listed before sign-in. That parser still accepts only a dataset 16 package with exactly `McPeople.csv`, `McPlaces.csv`, `McRelations.csv`, `McResidences.csv`, and `McMetadata.csv`, and requires at least one valid person. Before the first vault exists, an existing local Editor copy becomes Owner Setup; a fresh Owner browser can open one validated private recovery ZIP directly from the missing-vault gate. There is no blank-family or demo bypass.

Dismissed hint ids, dismissed What’s New versions, Directory visibility, and favorite P references live separately in `mcfamily.device-preferences.v1`. The record contains no names, contacts, Notes, or other family content and is overlaid after local load, recovery, import, or hosted decryption. Favorite references are filtered against the loaded people. Lock preserves the record while removing decrypted state and recovery; Reset Preferences clears dismissals and Directory visibility while retaining favorites, and Erase Everything clears it.

McPeople contains one stable P-referenced row per person and no parent or partner columns. McRelations contains all authoritative Person-to-Person parent and partner links, with parent lineage role separated from parent type. McPlaces contains reusable physical addresses, while McResidences assigns people to places. McMetadata declares package/dataset/file-schema versions, exact record counts, access mode, family settings, compatibility details, and append-only audit events. Package validation completes before any current state is touched and rejects ZIP damage, wrong filenames, schema drift, count mismatches, invalid identifiers/dates, broken cross-file references, false redaction claims, duplicate links, multiple Lineal parents, Lineage inconsistencies, and ancestry cycles.

## Encrypted hosted access

The Pages repository and public ciphertext-only `mcdata` repository are intentionally separate. McFamily generates one `data/mcfamily/McFamily-access.json` vault containing access grants plus the separately encrypted full and Viewer family packages; there is no second encrypted-directory file. The vault uses random AES-256-GCM full and redacted data keys. Each named grant derives a wrapping key from its unique passphrase with PBKDF2-SHA-256 and a unique salt, then wraps only the data key that role may open. The fixed Owner and every Editor grant wrap both data keys, each Member wraps the full-data key, and each Viewer wraps only the redacted-data key. Passphrases, readable CSV, and GitHub tokens never enter the vault. Version-1 vaults with the original fixed `editor`, `pii`, and `redacted` ids remain valid; new recipient grants use stable random role-prefixed ids and unique shown names retained for access management and audit identity.

Every online load fetches `McFamily-access.json` anonymously with `no-store`, validates its format, and requires a current passphrase. A wrong, removed, or rotated grant cannot unwrap a data key. The decrypted package must pass the same strict parser as a recovery import, including physical redaction checks for Viewer. Lock removes the decrypted browser state and recovery snapshot, reloads the application, and requires the passphrase again without publishing or modifying the hosted vault. Revocation applies on the recipient's next reload; a static web application cannot retract information already seen or copied.

Admin and Editor publication requires a fine-grained GitHub token limited to the public encrypted-data repository with Contents read/write access. Tokens live only in session or local browser storage. A family publication compares the opened hosted baseline with publishable family content, excluding device-only preferences, and requires a manual Summary of What Changed only when generated Detailed Changes exist. It records the Owner as `Admin` or a named Editor by their signed-in label, advances the `16.0.x` patch, appends the summary plus generated details to one audit event, revalidates and encrypts full and redacted packages, and uses both vault revision and GitHub SHA to reject stale writes. Owner-only access publication creates, rotates, or removes grants without recording secret values; Owner Recovery is also Owner-only in Audit. Successful publications remain visible in McMetadata and Git history; Member and Viewer sign-ins are not centrally logged and the in-package audit is not tamper-proof.

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

Hosted passphrases provide client-side encrypted access roles without a custom backend. A public vault can be copied for offline passphrase guessing, so generated phrases must be long and unrelated. Browser storage after unlock, Owner recovery ZIPs, and Owner/Editor PDFs contain sensitive plaintext. Member and Viewer interfaces intentionally omit Audit, routine ZIP import/export, PDF, Developer data, and publication controls, but client-side UI restrictions cannot prevent a determined recipient from inspecting information already decrypted in their browser. Owner Developer Mode can apply a transient lower-role preview to the UI gates; the actual active session remains the Owner and the preview never changes cryptographic authority. Strong server-authenticated accounts, immediate session revocation, and central usage history remain future backend work.

No real family CSV, ZIP, or export belongs in the repository. Only synthetic data should be used for committed tests or documentation.

## PWA and offline strategy

`sw.js` precaches the public HTML, scripts, manifests, and install assets. Same-origin application requests use network-first revalidation and cached fallback, except the hosted vault path, which is never cached. The service worker never reads browser family state and has no sync endpoint. Unlock intentionally requires an online vault check so removed grants do not gain an offline bypass.

A waiting worker discovered while locked renders its refresh action directly on the passphrase gate, before credentials are entered. After unlock it uses the persistent new-version toast. Either refresh action activates the new worker and reloads with a cache-busting URL.
