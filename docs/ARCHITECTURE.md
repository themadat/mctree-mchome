# Architecture

McFamily is one static application shell with no runtime dependencies. Scripts attach modules to `window.LocalApp` in the order listed by `index.html`; `app.js` initializes them after `DOMContentLoaded`. All data-bearing DOM output uses text nodes or sanitized HTML.

## Runtime layers

```text
config + icons
      ↓
utils → state → storage
      ↓       ↘
family  portability → cloud
      ↘ components ↙
          app
           ↓
          pwa
```

`config.js` is the single source for identity, versions, limits, storage keys, access and relationship vocabularies, help, release, and roadmap content. `state.js` owns the in-memory shape. `portability.js` is the trust boundary for packages. `cloud.js` is the trust boundary for encrypted hosted access.

## Application state v14

The normalized state contains:

```text
schemaVersion
meta
  appVersion, buildId, timestamps, lastMutationId
  package: format, version, datasetVersion, accessMode, auditHistory
workspace
  family: title, initializedAt, homePersonId
  people, relationships, places, residences
  documents: one Notes document
preferences
  appearance, controls, installation
ui
  selection, tree/List settings, panel sizes, favorites, support state
modules
  family, documents, roadmap
```

State v14 deliberately omits retired generic records and sync tombstones. `normalize()` accepts only the exact current schema, rebuilds derived person addresses from places/residences, consolidates Notes, sanitizes values, and validates relationship/place references and ancestry cycles.

## Persistence modes

Local development (`?local=1` on localhost) stores full state in `mcfamily.state.v14` with recovery in `mcfamily.recovery.v6`. Older versioned McFamily state/recovery keys are removed rather than migrated. Current favorites and List visibility also live in the PII-free device-preference record.

Hosted mode keeps decrypted family state and the publication baseline in memory. Lock/reload clears it. Only compact device preferences, non-secret connection coordinates, a session-scoped token, and a “hosted seen” flag may persist. Ordinary mutation is local until Update successfully publishes; revision/SHA verification prevents overwriting another publication.

## Data model

People store five-part Birth/Lineal, Current/Legal, and Preferred/Display names plus maiden last name, life data, contacts, heritage, notes, and imported source. Places store normalized postal fields, an optional household phone, notes, and source. Residences connect people to places. Relationship records are either parent-child or partner and carry their own vocabulary, dates, order, and source metadata.

Family derivation uses relationships at render time. Lineage ids are validated paths from one Lineal parent; Non-Lineal parents do not extend the path. Multiple partners and multiple Non-Lineal parents are supported. State normalization applies limited current-data inferences such as presumed deceased status without rewriting source values.

The exact five-file ZIP/CSV contract is in `MCFAMILY_CSV.md`.

## Encrypted hosted access

The public data repository stores one `mcfamily-encrypted-vault` JSON object containing metadata, passphrase grants, and AES-GCM ciphertext for full and redacted packages. The website fetches it anonymously with `cache: no-store`.

Each grant uses PBKDF2 to wrap only the keys permitted by its role. On sign-in, the browser tries the entered passphrase against all grants and requires exactly one match; labels and roles are not exposed before authentication. Full and redacted package bytes are independently encrypted. Every decrypted package still passes the exact package validator before becoming state.

Non-Admin grants always open with Developer Mode disabled even if the encrypted full-data package was saved while an Admin had it enabled. Editors may enable it deliberately for their current session; read-only roles cannot use it.

Admin publishes access changes and bulk packages; Admin/Editor publish ordinary changes. Publication verifies the configured repository/token and current remote revision, appends an audit event, derives the redacted package, encrypts both views, and writes through the GitHub Contents API. Git history provides rollback of publications. The app cannot audit anonymous reads or protect a shared passphrase from being forwarded.

## UI and print

The tree is vanilla SVG with relationship-derived layout, pan/zoom, focus/full modes, keyboard navigation, and accessible node descriptions. A central icon-over-label Tree/Outline control switches to the DOM-based, depth-first descendant view over the same relationship index; Outline keeps only the latest spouse or partner beside each compact single-line descendant row, uses indentation instead of parent-child connectors, and exposes right/down chevrons for branch state. The List and profile are DOM views over the same state; no separate search index is persisted. Panels are responsive, collapsible, and resizable.

Print output is generated into a print-only DOM immediately before `window.print()`. Directory contains household contact cards, Outline emits the complete expanded descendant order for its chosen root and permits long names to wrap without ellipsis, Groups contains the generation maps, and Tree tiles the current live SVG layout across landscape pages at the selected zoom. Outline and Tree use a simple explicit `@page { size: letter landscape }` rule so unsupported margin-box declarations cannot invalidate orientation. CSS uses half-inch page margins, repeated directory headings, `break-inside: avoid` rows/cards, and print-safe colors.

The Save dialog keeps session identity, hosted dataset/date, and GitHub connection state in two-line tiles within its persistent header. The main publication section is a compact ordered workflow—one-line publisher, equal-height next patch, Bulk Upload, Update—followed by an inline summary input and one full-width row per calculated change.

## PWA and deployment

`sw.js` precaches only the static shell. Navigations use network-first with offline shell fallback; same-origin static assets use network-first with cache fallback. Vault/GitHub requests are cross-origin and are never intercepted.

The repository's GitHub Pages setting publishes the root of `main` through GitHub's generated **pages build and deployment** workflow. That generated deployment is the sole authoritative production result; there is no checked-in publisher or duplicate `gh-pages` copy. Because every committed path is public and may be web-addressable, private family data and credentials must never enter this repository.

## Security boundary

Static encryption reduces accidental exposure but is not an identity system. Security depends on private passphrases, a scoped GitHub token on editing devices, trusted client code, and prompt revocation when a secret is shared. PII must never enter this repository, issue trackers, logs, screenshots, or test fixtures.
