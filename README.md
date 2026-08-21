# McFamily

McFamily is a private, local-first family atlas that runs as a static GitHub Pages app. It visualizes family relationships, keeps addresses and other profile information together, and builds a print-ready atlas for saving as PDF.

There is no backend, account, cloud database, or runtime dependency. Family data stays in browser storage and moves only through an explicit CSV import or export. The published repository must never contain a real family CSV or private family data.

Current version: `0.0.1.50` (`major.minor.patch.build`).

## What it does

- Opens only after importing the cleaned McLineage CSV or a native McFamily CSV with at least one person on first launch.
- Shows a Lineage tree around a selected person and a Full Tree view of connected and isolated people.
- Supports two-axis scrolling, pan, directly editable zoom and 0-10 depth numbers, fit, keyboard selection, touch, and accessible relationship descriptions.
- Orders each Family Tree generation by numeric lineage ID; up to two prior partners appear chronologically at two-thirds size to the left of the Lineal person, while the current or latest death-ended spouse remains full-size on the right. One prior partner is vertically centered; two align to the full-size cards' top and bottom, with their parallel links attached one-quarter from the outer edge of each compact card. Bright gold partner lines distinguish current marriages (solid), previous marriages (dashed), never-married partnerships (dotted), and unknown relationships (question marks), with a floating key in the corner of the tree.
- Draws recorded Non-Lineal parent links as dashed branches only while the two-line Non-Lineal Lines control is on, leaving faded muted-red edges for the Lineal bloodline and never changing relationship records. Its filled symbol remains fixed in both states. Selected Lineal and Non-Lineal cards share the same accent border.
- Marks Lineal tree cards with a bold muted-red outline and a compact lineage symbol beside the lifespan while preserving the standard living or deceased fill.
- Can hide `99`-lineage people from Full Tree with a persisted `?? Lineal` control whose outlined symbol remains fixed; enabling it centers the revealed people. The control is hidden in Lineage view, while those people remain available in directory and search. Printable atlases omit unresolved `99`/`??` lineage branches.
- Records out-of-wedlock partnerships as never-married relationships with no start date, sequenced by relationship order.
- Provides a header-toggled directory with title-bar search and result count, visible Filter By and Sort By controls, combinable status and Lineal/Non-Lineal checkbox filters, A–Z quick jumps, lifespan and lineage context, and broad search across names, contact details, places, heritage, and notes.
- Lets people be starred directly in search or from the selected-person panel, pins favorites above other matches, and opens favorites as a one-time dropdown without changing or highlighting the ordinary search scope.
- Shows Preferred (Display), Legal (Current), Lineal (Birth), and Maiden names as four compact profile rows; the Family Tree can use any of the first three as its name source and can show Short or Full names.
- Keeps local save/backup status in the top toolbar and provides D, F, K, X, and R shortcuts for Directory, Favorites, the tree Key, What's New dismissal, and update reload.
- Supports partial/fuzzy matches that return the tree to Lineage, collapsible side panels, compact 20/50/30 default desktop splits with persistent resizing, and Summary tree cards that balance names with four or more parts across three fitted lines without widening the card.
- Keeps portrait placeholders and internal person references out of the ordinary workspace; Developer Mode reveals references and a left-side generation bubble scale for visual troubleshooting.
- Presents complete oldest-to-newest, two-digit Lineage IDs with the first three ancestral segments italicized and the selected person's final segment bold, followed by a compact direct-parent-linked Family Line with each name's lineage number and generation.
- Imports every current McLineage row as one stable person and expands `partner_relationships_json` into explicit partner records; only the current McLineage schema is accepted, and a file missing a required column names it.
- Imports known and question-mark partial source dates; a recorded death or a birth date beyond age 100 marks someone deceased or presumed deceased, an unknown-status partner of any deceased person is also presumed deceased, and unknown Lineal members in Generations 0 through 4 are presumed deceased. A birth date within 100 years still means living, with a concise Age row in profiles and print when birth data permits.
- Shows partial source dates such as `December ??, 1979`, keeps a natural-language Age property on one line, and fills unknown visible identity properties with `UNKNOWN`. Living profiles use `----` for Died, and living people show only their birth year in directory and tree lifespans. Gender and Pronouns remain stored but are temporarily hidden from person details.
- Uses compact open Parents, Siblings, Partners, and Children groups near the top of each profile, with generation labels, Lineal/Non-Lineal parent roles, birth order and year for siblings and children, marriage years for partners, and current-first partner history; Imported Source finishes each profile.
- Uses absolute lineage generations rooted at George McMillen (1745) as Gen 0; readings use concise forms such as `Gen 6, 5th Child of Max`.
- Lets the person panel close and clear selection; choosing any Family Tree person reopens it without a separate Show person control.
- Keeps family-record Add, Connect, Edit, and Delete controls visibly paused during the current build-out; profile actions use icon-over-label controls in their relevant sections.
- Retains structured profiles for people, multiple addresses, phones, emails, life events, and typed parent or partner relationships.
- Rejects missing references, duplicate relationships, self-links, and ancestry cycles.
- Keeps a recovery snapshot before destructive replacement or deletion.
- Exports a complete editable McFamily CSV and creates a print-only family atlas with brown deceased entries, stronger faded-red Lineal outlines, and Bloodline-symbol orientation highlights for Newton, Albon, and Lucian. Jon Couts remains in the directory but is omitted as a map root.
- Preserves Notes, Settings, themes, accessibility, installation, and offline support from the application foundation.

## Run locally

From the repository folder:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Use a local server rather than opening `index.html` directly so the service worker and install behavior can run.

On a fresh browser profile, McFamily intentionally has no demo family or blank-workspace bypass. Select the private cleaned McLineage CSV or a native export described in [`docs/MCFAMILY_CSV.md`](docs/MCFAMILY_CSV.md).

## Privacy model

The first-launch import is an onboarding gate, not authentication. Anyone who can open the deployed files can load the application, and anyone who possesses a backup or exported PDF can read its private contents.

- Store CSV exports and PDFs privately.
- Do not commit real names, addresses, phone numbers, email addresses, heritage notes, or family notes.
- Use synthetic people for tests and screenshots.
- Browser storage is per browser profile and device. Clearing site data removes the active local copy.
- The visible accounts wishlist requires a future authenticated backend; it cannot be provided securely by GitHub Pages alone.

## Project structure

```text
index.html                     Application shell, forms, dialogs, and print report host
assets/css/app.css             Themes, family workspace, responsive, and print styles
assets/js/config.js            Identity, version, enums, help, releases, and roadmap
assets/js/icons.js             Shared inline SVG symbol catalog
assets/js/app.js               Rendering, editing, search, tree interaction, and print atlas
assets/js/core/state.js        Schema v8 migration, normalization, fuzzy matching, and validation
assets/js/core/family.js       Relationship indexes, derived family groups, and graph layout
assets/js/core/storage.js      Local persistence and recovery snapshot
assets/js/core/portability.js  Private CSV mapping, export, preview, and replacement import
assets/js/core/components.js   Dialogs, popovers, toasts, and focus management
assets/js/core/pwa.js          Install metadata, offline worker, and update notice
manifest*.webmanifest          Light and dark install metadata
sw.js                          Versioned offline application shell
docs/                          Architecture, CSV contract, customization, and test checklists
context/                       Durable agent workflow and wish ledger
```

## Data limits and compatibility

Schema v8 supports up to 1,500 people so the current 912-person McLineage source fits safely. Dates accept `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` with exact, about, before, or after qualifiers. Relationships are stored as explicit records; ancestry, descendants, siblings, family units, and lineage labels are derived when needed.

Older application states migrate without discarding the single Notes document or retained compatibility fields. A first import must be a supported CSV containing at least one valid person.

## CSV and PDF workflow

The primary maintainer owns the canonical private CSV file:

1. Import the cleaned source CSV or latest native McFamily CSV.
2. Add or update people and relationships.
3. Export a new McFamily CSV from Settings and store it privately.
4. Distribute replacement CSV files to editors or print/PDF atlases to readers.

Imports replace the current family after a summary and confirmation. McFamily creates a recovery snapshot first; it does not merge concurrent copies.

`Print / Save PDF` builds a report whose cover, statistics, legend, and six-column Family Maps flow together without forced opening-page breaks. George McMillen (1745) leads the maps as Generation 0, and Generation 4 and later are grouped beneath Generation 3 family lines. Every retained component is labelled by its root ancestor; Jon Couts is omitted as a map root and unresolved `99`/`??` lineage branches are omitted. Lineal cards use a clearly visible faded-red outline, stronger orientation highlights and Bloodline symbols are limited to Lineal Newton, Albon, and Lucian members, deceased entries use brown shading, and adaptive name type keeps map names within two lines. The compact three-column Person Directory shows only each full name, styled Lineage ID, and root-to-person first-name progression. Use the native print dialog's Save as PDF destination; Developer Mode opens the same report in an in-app preview instead.

## Host on GitHub Pages

Publish the repository contents without changing relative paths. Use HTTPS so the service worker and install features are available. Keep `sw.js` at the repository root because its location defines the offline scope.

The service worker caches only the public application shell and assets. It never uploads family data or makes synchronization requests. Online reloads revalidate the shell; offline reloads use the cached application and the browser's local family state.

## Versioning

Every completed application change advances the fourth build number. Keep these surfaces identical:

- `identity.version` and `identity.buildId` in `assets/js/config.js`
- the newest dated release entry
- asset query strings in `index.html`
- `CACHE_NAME` and `ASSET_VERSION` in `sw.js`

Changing major, minor, or patch resets the build to `1` unless another value is explicitly chosen.

## Icons

Editable and generated assets are in `assets/icons/`. If filenames change, update `index.html`, both manifests, `assets/js/config.js`, and `sw.js`. Preserve light, dark, maskable, touch, favicon, and splash variants.

## Agent workflow

`AGENTS.md` and `context/LLM_HANDOFF.md` define the repository workflow:

- `wish`: record an idea only.
- `plan`: investigate and document it only.
- `start`: implement an approved plan.
- `cut`: finalize a release.

After a completed change, agents provide one copy-paste command that stages only relevant files, commits with the subject `Version - Text`, and pushes the current branch. Agents do not commit or push unless explicitly asked.
