# McFamily

McFamily is a private, local-first family atlas that runs as a static GitHub Pages app. It visualizes family relationships, keeps addresses and other profile information together, and builds a print-ready atlas for saving as PDF.

There is no backend, account, cloud database, or runtime dependency. Family data stays in browser storage and moves only through an explicit CSV import or export. The published repository must never contain a real family CSV or private family data.

Current version: `0.0.1.17` (`major.minor.patch.build`).

## What it does

- Opens only after importing the cleaned McLineage CSV or a native McFamily CSV with at least one person on first launch.
- Shows a focus tree around a home person and a whole-family overview of connected and isolated people.
- Supports two-axis scrolling, pan, zoom, fit, separate ancestor and descendant depths, keyboard selection, touch, and accessible relationship descriptions.
- Orders each Family Tree generation by numeric lineage ID; past partners appear chronologically to the left of the lineage person and exactly one current spouse appears to the right.
- Can reveal likely other-parent branches as lighter, display-only lines without changing relationship records.
- Provides a header-opened directory with first/last-name sorting, A–Z quick jumps, lifespan and lineage context, and broad search across names, contact details, places, heritage, and notes.
- Lets people be starred directly in search, pins favorites above other matches, and provides a Favorites-only search control beside the search field.
- Supports partial/fuzzy matches that return the tree to Focus, collapsible side panels, a resizable desktop tree/profile split, and concise or detailed tree cards.
- Keeps portrait placeholders and internal person references out of the ordinary workspace; Developer Mode reveals references for troubleshooting.
- Presents person-to-root, two-digit Lineage IDs with the selected person's first segment emphasized, followed by direct-parent-linked Names and generation readings with one full-width family summary.
- Uses compact open Parents, Siblings, Partners, and Children groups that include likely co-parents, and places Notes at the end of each profile.
- Uses absolute lineage generations rooted at George McMillen (1745) as Gen 0; unknown ordinals read simply as `Child of`.
- Lets the person panel close and clear selection; choosing any Family Tree person reopens it without a separate Show person control.
- Keeps family-record add, edit, relationship, home-person, and deletion controls visibly paused during the current build-out.
- Retains structured profiles for people, multiple addresses, phones, emails, life events, and typed parent or partner relationships.
- Rejects missing references, duplicate relationships, self-links, and ancestry cycles.
- Keeps a recovery snapshot before destructive replacement or deletion.
- Exports a complete editable McFamily CSV and creates a print-only family atlas for the browser's Save as PDF command.
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
assets/js/core/state.js        Schema v7 migration, normalization, fuzzy matching, and validation
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

Schema v7 supports up to 1,500 people so the 607-row McLineage source and its spouse records fit safely. Dates accept `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` with exact, about, before, or after qualifiers. Relationships are stored as explicit records; ancestry, descendants, siblings, family units, and lineage labels are derived when needed.

Older application states migrate without discarding the single Notes document or retained compatibility fields. A first import must be a supported CSV containing at least one valid person.

## CSV and PDF workflow

The primary maintainer owns the canonical private CSV file:

1. Import the cleaned source CSV or latest native McFamily CSV.
2. Add or update people and relationships.
3. Export a new McFamily CSV from Settings and store it privately.
4. Distribute replacement CSV files to editors or print/PDF atlases to readers.

Imports replace the current family after a summary and confirmation. McFamily creates a recovery snapshot first; it does not merge concurrent copies.

`Print / Save PDF` builds a report with a cover, statistics, legend, compact generation-grouped family maps named for their top sibling, and a detailed profile for every person. Use the native print dialog's Save as PDF destination.

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
