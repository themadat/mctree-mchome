# Agent handoff

Start a new session with:

```text
Continue work in /Users/stripes/Documents/GitHub/mctree-mchome. Read AGENTS.md and context/LLM_HANDOFF.md first. Preserve manual edits and run git status --short before editing.
```

This repository is McFamily, a static, local-first family atlas. Version `0.0.1.11` uses schema v7, strict private-CSV onboarding, cleaned McLineage mapping, absolute root-based generations, fuzzy search, a header-opened sortable directory with A–Z jumps, separate ancestor/descendant depths, a two-axis-scrollable condensed/detailed Family Tree, a complete native CSV transfer format, a temporarily read-only family directory, and compact top-sibling-labelled print maps. There is no backend, account, GitHub Sync, cloud database, or runtime dependency.

The main product invariants are now the initialized import gate, directory/tree/profile workspace, single Notes modal, Settings Roadmap, local save/backup status, recovery copy, themes, accessibility, install assets, and offline shell. Do not restore the removed Records interface, multi-note workspace, rich-text editor, or GitHub Sync.

## Workflows

### `wish`

Record an idea in `context/WISHES.md` without planning or implementing it.

- Check for duplicates and use the next `WISH-###` id.
- Capture behavior, rationale, priority, effort, acceptance criteria, constraints, affected files, and material open questions.
- Set the status to `Proposed`.

### `plan`

Investigate a wish without implementing it.

- Create or revise `context/WISH-###-slug-PLAN.md`.
- Put a `## Resume` section first, followed by decisions, scope, non-goals, file map, accessibility/responsive considerations, tests, and open questions.
- Link it from the wish and set the status to `Planned`.
- Do not change runtime files, build ids, or cache ids.

### `start`

Implement an approved plan.

- Read the wish and plan, set the wish to `Active`, and keep Resume current.
- Add only the architecture the feature needs; keep the app static and dependency-free.
- Preserve the schema-v7 privacy, validation, compatibility, accessibility, and offline invariants below.
- Advance the four-part application version and verify affected workflows.

### `cut`

Finalize an active line as a release.

- Confirm the semantic version and reset build to `1` for a new major/minor/patch unless another value is requested.
- Update config identity, release notes, asset queries, manifests when needed, and service-worker ids.
- Mark the wish Shipped and record version/date.
- Run `docs/TESTING.md`.

Do not silently move between lifecycle stages.

## Repository map

- `index.html`: header, family forms, Notes, Settings, dialogs, print host, and live regions.
- `assets/css/app.css`: themes, family workspace, graph, responsive behavior, and print atlas.
- `assets/js/config.js`: identity, version/build, limits, relationship enums, Help, releases, and Roadmap.
- `assets/js/app.js`: onboarding, directory, profile, tree interaction, editing, search, Settings, and print assembly.
- `assets/js/core/state.js`: schema v7, migrations, normalization, fuzzy matching, and validation.
- `assets/js/core/family.js`: indexes, derived relationships, connected components, generations, and deterministic layout.
- `assets/js/core/storage.js`: local save and single recovery snapshot.
- `assets/js/core/portability.js`: cleaned-source mapping and complete private CSV export/replacement import.
- `assets/js/core/components.js`: dialogs, popovers, toasts, and focus lifecycle.
- `assets/js/core/pwa.js`: installation, service-worker registration, and updates.
- `docs/MCFAMILY_CSV.md`: accepted source columns and canonical transfer-format contract.
- `sw.js`: public offline shell only.

## Data and privacy invariants

- Never commit a real family CSV, spreadsheet, PDF, screenshot, name list, address, phone, email, heritage note, or family note. `assets/data/` is ignored; use synthetic committed fixtures only.
- First launch accepts only the cleaned McLineage CSV or a native `mcfamily-csv-v1` CSV containing at least one person. There is no demo family, blank-family path, JSON/GEDCOM import, or bypass.
- The gate is not security or authentication. Account roles, revocation, and audit history remain a clearly marked future-backend wishlist item.
- Maximum family size is 1,500 people.
- Export CSV is the complete editable plaintext transfer file. Imports replace; they do not merge. Later replacement and person deletion create recovery first.
- Deleting the final person leaves an initialized empty workspace.
- Parent and partner links are explicit records. Reject missing references, self-links, duplicates, and directed ancestry cycles.
- Derive ancestors, descendants, siblings, units, and lineage labels; do not cache them on people.
- Keep legacy Notes and compatibility fields readable through migration.

## Application invariants

- Keep the runtime static, dependency-free, backend-free, and hostable on ordinary GitHub Pages.
- Preserve Directory, Family Tree, and Profile as the coordinated main workspace.
- The workspace starts directly with its panes. Family title, privacy label, counts, Add Person, and PDF controls are not repeated below the application title bar.
- The header Directory control opens the directory; its module bar contains only the result count and close control. Desktop Directory and Profile panes collapse independently. Directory sorting supports first or last name, with an A–Z rail based on the filtered results.
- Tree nodes default to condensed given/family/lifespan cards and can switch to detailed cards; neither mode uses portrait or initial placeholders. Recorded partners sit together when possible, with solid married and dotted divorced links. Focus view has independent Ancestors and Descendants depth controls.
- Internal stable `P` references remain in data but are visible only in Developer Mode, including printed cross-references. New and reset preferences default to light appearance.
- Lineage shows a reversed, two-digit source ID with the selected person's segment first and bold, followed by a linked nearest-to-oldest name list and linked absolute-generation reading. George McMillen (1745) is Gen 0, James is Gen 1, George (1818) is Gen 2, and Albon/Newton/Lucian are Gen 3. Unknown positions omit the ordinal and read `Child of …`.
- Closing Selected Person clears selection and collapses the panel. Selecting any Family Tree node reopens it; do not restore a Show person control in the tree toolbar.
- The tree canvas supports native horizontal and vertical scrolling in addition to drag pan, zoom, and Fit. Ordinary wheel input scrolls; Ctrl/Command-wheel zooms.
- `features.familyEditing` is currently false. Keep person, relationship, home-person, and deletion mutation controls present but disabled and visibly greyed until the maintainer is ready to enable editing.
- The SVG supports focus/overview, all components and isolated people, pan, zoom, fit, touch, keyboard selection, accessible relationship text, and reduced motion.
- Standard controls use the shared inline SVG catalog rather than emoji or icon fonts.
- Controls use native elements, labels, visible focus, touch-sized targets, and safe rendered user text.
- Avoid horizontal overflow and preserve safe-area behavior at mobile widths.
- Print builds semantic HTML for cover, counts, legend, compact top-sibling-labelled generation maps, every person profile, cross-references, and Notes; native browser print produces the PDF. Do not restore the removed alphabetical index unless explicitly requested.
- Keep the single Notes modal, Settings/Help/Releases/Roadmap, recovery, themes, installation, and service-worker update handling.
- The icon click changes theme; press-and-hold toggles Developer Mode without also changing theme. Developer Mode adds `DEV` to the version pill; Beta stays separate.

## Version invariant

Versions use `major.minor.patch.build`. Every completed application update increments build. A major/minor/patch change resets build to `1` unless the user specifies another number. Keep `identity.version`, `identity.buildId`, newest dated release, `index.html` queries, and `sw.js` cache/build ids identical.

## Verification baseline

Use the bundled workspace Node runtime if system Node is unavailable. Run JavaScript syntax checks, parse both manifests, validate local asset references, run `git diff --check`, and serve through an HTTP server.

Follow `docs/TESTING.md`. At minimum cover strict onboarding, cleaned-source import, native CSV round-trip/recovery errors, people and relationship CRUD, cycle rejection, search, focus and overview graph, large synthetic layout, desktop/mobile overflow, keyboard/accessibility, print content, online reload, and offline shell. Stop preview servers afterward.

## End of turn

After file changes, give a concise outcome and verification summary followed by exactly one copy-paste command that stages only task files, commits with subject `Version - Text`, and pushes the current branch. Use `git add .` only when every change belongs to the task; otherwise name task files explicitly. Do not run it unless explicitly requested.
