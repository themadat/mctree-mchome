# McFamily implementation contract

McFamily `0.0.1.122` is a dependency-free static family atlas. It uses latest-only application schema v14 and strict dataset `17.0.x` packages. The hosted app anonymously downloads public ciphertext, matches a passphrase locally, and decrypts only the corresponding view. There is no backend, account provider, cloud database, package manager, or runtime build.

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
- Owner/Editor receive full editing data; Member receives full PII read-only; Viewer receives a separately encrypted redacted package without contacts, places, residences, or unstructured source notes.
- Imported Source appears/searches only for Owner/Editor in Developer Mode. Read-only roles do not get routine export, import, Directory print, recovery, developer, or publishing controls.
- Non-Admin grants always start with Developer Mode off, even if the encrypted full-data package was published while it was enabled. Editors may enable it deliberately during their current session.
- Hosted decrypted state is memory-only. Device storage may retain only non-PII preferences such as favorites and List visibility. `?local=1` on localhost may persist the full current state for development.
- The passphrase gate appears on every hosted reload. The service worker must never cache the encrypted vault or GitHub API responses.
- Preserve semantic controls, labels, focus restoration, keyboard/touch use, escaped text, safe URLs, reduced motion, and print privacy.

## Current module map

- `index.html`: static shell, workspace, dialogs, access gate, support panels.
- `assets/css/app.css`: tokens, responsive layout, tree/list/profile styling, print atlas.
- `assets/js/config.js`: identity, four-part version, schema/data versions, storage keys, limits, relationship/access vocabularies, help, one current release entry, roadmap.
- `core/utils.js`: sanitization, formatting, ids, dates, fuzzy helpers.
- `core/state.js`: schema-v14 defaults, current-only normalization/validation, names, status inference, role projections.
- `core/storage.js`: local debounce/recovery, hosted memory mode, compact device preferences.
- `core/family.js`: relationship derivation and SVG layout.
- `core/portability.js`: exact dataset-17 ZIP/CSV parse, validation, projection, export.
- `core/cloud.js`: public vault fetch, Web Crypto grants, GitHub Contents API publication, Save/access UI.
- `core/components.js`: dialogs, loading, messages, toasts.
- `core/pwa.js`: manifest/theme/install/service-worker lifecycle.
- `app.js`: rendering, editors, search, tree controls, people List, profile, print.
- `scripts/verify.mjs`: fast repository baseline.

## Behavior contracts

- The header keeps search centered independently of the action group. Favorites is anchored inside the search field after the `/` hint; the toolbar orders Save, Add, List, then Directory before the remaining output/settings actions. Outline belongs in the central Tree/Outline view switch, not the application toolbar. Responsive layouts give search a full row before controls can overlap.
- List search is fuzzy across all name variants and allowed family fields. Favorites are device preferences, not search scope state. Contact filters and indicators apply to living people.
- Tree cards support Summary (name only) and Details (name, years, contact and Lineal symbols). Name basis is Lineal/Birth, Legal/Current, or Preferred/Display; length is Short or Full. Full tree and focus mode preserve documented partner and lineage placement.
- Selecting a person opens the profile; closing it deselects. Search selections return to focus mode. The initialized application remains fixed within the viewport so only the List, Tree, and Person panes scroll vertically; those panels are collapsible and horizontally resizable.
- Editors can add/edit people, places, contacts, and relationships. A profile’s left-aligned relationship toolbar uses Add, Edit, and Delete. Add groups Parent/Child/Partner under New Person and Existing Person; after an Existing Person role is selected, the current profile person and relationship type stay fixed while only the other-person search and relevant relationship fields remain editable. Edit and Delete group the person’s current links under Parents, Partners, and Children before continuing to the focused form or delete confirmation. Connect Existing People has fuzzy name/date/lineage/id search. A nameless Unknown person may preserve a known partnership without inventing spouse details. Parent-child links use Biological, Adopted, Step, Foster, Guardian, or Unknown status. Only Biological and Adopted links may drive Lineage ID allocation or Lineal tree styling; legacy Lineal Step/Foster/Guardian/Unknown values remain loadable but are treated as Non-Lineal until Admin corrects them. Children remain in birth order, but Step/Foster/Guardian/Unknown children show their relationship type and do not consume `01`, `02`, etc. Sibling lists include Self, place unknown birth years last, and use the parent carrying the Lineal sibling branch as their relationship context, so Step children remain Step while Biological/Adopted siblings receive birth-order numbers. Step-only children do not display a stale Lineage ID, and Check & Update removes it. Marriages without a recorded ending remain current even when partner layout places another relationship first. Parent changes rebuild affected birth-ordered sibling branches, and Editor/Admin can force a full branch check from a profile. Admin’s bad Lineage ID and unknown/invalid relationship lists are directly under Settings → Admin → Data Cleanup. Preferred follows changed legal name; maiden last initially follows birth last. Each saved field-level change produces an audit line.
- Save is the single hosted save center: its two-line status tiles carry signed-in identity, dataset/date, and GitHub status; its publishing row uses one-line publisher and equal-height next-patch/actions above an inline summary input and full-width change list. GitHub revision/SHA checks prevent overwriting a newer vault.
- Directory prints only the compact Directory of McMillen Clan contact cards. Outline is an interactive, depth-first descendant list with compact single-line rows that follow the shared Name Preferences, life dates, the latest spouse or partner, centered two-line relationship type/date labels, scan bars, chevron branch controls, and optional selected-lineage highlighting; spouse cards match Lineal card widths, do not carry the Lineal accent, and people without partners have no placeholder copy. Its compact toolbar-aligned searchable root picker offers only the Root Ancestor and that person's Lineal descendants, shows the chosen root's total Outline people in a pill, and Reset Root returns directly to the Root Ancestor. Tree and Outline switch between matching toolbars without a separate Outline heading, with icons above all control labels; Root/Expand/Condense use the shared SVG catalog and Expand/Condense remain directionally distinct after their 90-degree rotation. Outline's letter-landscape print includes the complete expanded outline while wrapping long names instead of clipping them. Groups owns the Root Ancestor/Generation 3 generation maps. Tree always requests letter landscape and paginates the live Full Tree or focused lineage at its current card, name, level, line-visibility, and zoom settings. Ancestors and Descendants default to 10; the obsolete persisted Descendants value of 3 migrates to 10 once. All four use dated titles; contact cards stay together within half-inch margins, and P ids/imported source/notes remain omitted.

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
