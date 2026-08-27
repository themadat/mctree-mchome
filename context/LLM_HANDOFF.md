# McFamily implementation contract

McFamily `0.0.1.98` is a dependency-free static family atlas. It uses latest-only application schema v14 and strict dataset `17.0.x` packages. The hosted app anonymously downloads public ciphertext, matches a passphrase locally, and decrypts only the corresponding view. There is no backend, account provider, cloud database, package manager, or runtime build.

Read only the task-relevant detail after this file:

- data/package work: `docs/MCFAMILY_CSV.md`
- architecture, storage, access, or cloud work: `docs/ARCHITECTURE.md`
- verification or release work: `docs/TESTING.md`
- explicit lifecycle work: `context/WISHES.md` and the named plan

## Non-negotiable invariants

- Never commit real family data, decrypted ZIPs, vault keys, passphrases, or GitHub tokens.
- Fresh local browsers have no demo or blank-family bypass. They require a valid initialized current ZIP. Hosted browsers require a valid current encrypted vault and passphrase.
- The data package contains exactly five root CSV files with exact ordered headers. Reject missing/additional files or columns, malformed ZIP/CSV, bad counts or ids, missing references, duplicate/self relationships, invalid vocabularies, and ancestry cycles before mutation.
- Relationship records are authoritative. Derive ancestors, descendants, siblings, family units, and lineage; do not duplicate them on people.
- A child has at most one Lineal parent and may have multiple Non-Lineal parents. Lineage ids derive from the Lineal parent path. Adoption can therefore be Lineal/Adopted while biological parents are Non-Lineal/Biological.
- Owner/Editor receive full editing data; Member receives full PII read-only without Notes; Viewer receives a separately encrypted redacted package without contacts, places, residences, Notes, or unstructured source notes.
- Imported Source appears/searches only for Owner/Editor in Developer Mode. Notes are available only to Owner/Editor. Read-only roles do not get routine export, import, PDF, recovery, developer, or publishing controls.
- Hosted decrypted state is memory-only. Device storage may retain only non-PII preferences such as favorites and dismissed UI state. `?local=1` on localhost may persist the full current state for development.
- The passphrase gate appears on every hosted reload. The service worker must never cache the encrypted vault or GitHub API responses.
- Preserve semantic controls, labels, focus restoration, keyboard/touch use, escaped text, safe URLs, reduced motion, and print privacy.

## Current module map

- `index.html`: static shell, workspace, dialogs, access gate, support panels.
- `assets/css/app.css`: tokens, responsive layout, tree/directory/profile styling, print atlas.
- `assets/js/config.js`: identity, four-part version, schema/data versions, storage keys, limits, relationship/access vocabularies, help, one current release entry, roadmap.
- `core/utils.js`: sanitization, formatting, ids, dates, fuzzy helpers.
- `core/state.js`: schema-v14 defaults, current-only normalization/validation, names, status inference, role projections.
- `core/storage.js`: local debounce/recovery, hosted memory mode, compact device preferences.
- `core/family.js`: relationship derivation and SVG layout.
- `core/portability.js`: exact dataset-17 ZIP/CSV parse, validation, projection, export.
- `core/cloud.js`: public vault fetch, Web Crypto grants, GitHub Contents API publication, audit/access UI.
- `core/components.js`: dialogs, loading, messages, toasts.
- `core/pwa.js`: manifest/theme/install/service-worker lifecycle.
- `app.js`: rendering, editors, search, tree controls, directory, profile, print.
- `scripts/verify.mjs`: fast repository baseline.

## Behavior contracts

- Directory search is fuzzy across all name variants and allowed family fields. Favorites are device preferences, not search scope state. Contact filters and indicators apply to living people.
- Tree cards support Summary (name only) and Details (name, years, contact and Lineal symbols). Name basis is Lineal/Birth, Legal/Current, or Preferred/Display; length is Short or Full. Full tree and focus mode preserve documented partner and lineage placement.
- Selecting a person opens the profile; closing it deselects. Search selections return to focus mode. Directory/profile panels are collapsible and horizontally resizable.
- Editors can add/edit people, places, contacts, and relationships. Lineage id is always visible but auto-generated from parents. Preferred follows changed legal name; maiden last initially follows birth last. Each saved field-level change produces an audit line.
- Audit is the single hosted save center: connection status, unpublished changes, Update, strict Admin bulk upload, access publication, and Lock. GitHub revision/SHA checks prevent overwriting a newer vault.
- Print creates browser-print HTML: cover/stats/legend, generation maps, and the compact Directory of McMillen Clan. Cards stay together within half-inch margins; P ids, imported source, and Notes are omitted where specified.

## Version and lifecycle

Application versions are `major.minor.patch.build`. Every completed app change increments build. An explicit major/minor/patch release resets build to `1`; the first 1.0 cut is `1.0.0.1`, even if called “1.0.0” conversationally. Keep config identity/build, sole release entry, HTML queries/labels, service-worker cache/asset version, and current docs identical.

Lifecycle commands are exact:

- `wish`: add a ledger entry only.
- `plan`: investigate/write a plan only.
- `start`: implement an approved plan and maintain Resume.
- `cut`: release the active line, close its wish, and run the complete release gate.

Do not silently move between stages. Ordinary direct changes do not require a wish.

## Verification

For every code change run `node scripts/verify.mjs` (use the bundled Node executable if `node` is not on PATH). Then run only the task-relevant browser checks in `docs/TESTING.md`. A release cut uses that document's full gate, including clean-device roles, package round trip, print, offline update, manifests/assets, and deployed smoke test. Stop preview servers before handing off.
