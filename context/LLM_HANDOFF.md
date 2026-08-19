# Agent handoff

Start a new session with:

```text
Continue work in /Users/stripes/Documents/GitHub/mctree-mchome. Read AGENTS.md and context/LLM_HANDOFF.md first. Preserve manual edits and run git status --short before editing.
```

This repository is McFamily, a static, local-first family atlas. Version `0.0.1.23` uses schema v7, strict private-CSV onboarding, stable P-formatted McLineage person rows with complete root-to-person lineage paths, direct lineage-parent and spouse-record references, explicit known/partial/unknown source date descriptors, absolute root-based generations, fuzzy search with persistent favorite people, a header-toggled sortable directory with A–Z jumps, direct numeric ancestor/descendant depths and zoom, optional display-only co-parent branches, a two-axis-scrollable lineage-ordered condensed/detailed Family Tree, a resizable desktop tree/profile split, compact Family line rows, birth-ordered profile family groups, a complete native CSV transfer format, a temporarily read-only family directory, and compact top-sibling-labelled print maps. There is no backend, account, GitHub Sync, cloud database, or runtime dependency.

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
- The header Directory control sits left of Search and toggles the directory open or closed; Favorites sits right of Search. Both use an icon above a visible label. The directory module bar contains only the result count and close control. Directory and Profile panes collapse independently where both are present. Directory sorting supports first or last name, with an A–Z rail based on the filtered results.
- Person search results expose a separate accessible star toggle. Favorite person IDs persist in normalized UI state, sort above other fuzzy matches, and are shown together when Favorites is active; deleting a person removes their favorite ID.
- Tree nodes default to condensed given/family/lifespan cards and can switch to detailed cards; neither mode uses portrait or initial placeholders. Unknown lifespan years use `????`, and deceased nodes use a light-brown card. Generation rows sort by numeric source lineage ID before fallback placement. Recorded partners sit together when possible, with past partners chronologically on the left and exactly one current spouse on the right; married links are solid and divorced links are dotted. Cleaned McLineage imports treat all populated spouse slots before the last as prior/divorced and apply the source status to the last. Focus view has independent numeric Ancestors and Descendants depth controls, grouped Out/In/Fit buttons, and an editable zoom percentage; person search selections return to Focus.
- Other parent lines is an off-by-default, persisted tree-toolbar checkbox. When enabled, it adds a lighter display-only branch from a plausible visible partner to the existing recorded parent-child line at a junction; it never mutates relationships.
- Internal stable `P` references remain in data but are visible only in Developer Mode, including printed cross-references. New and reset preferences default to light appearance.
- Lineage shows the complete two-digit source ID from oldest ancestor to selected person. Its first three segments are italic and its final segment is bold, including bold italic when they overlap. Current cleaned sources use direct `parent_lineage_id` P references; older direct `lineage_parent_id`, person-to-root, and name/prefix sources remain importable. A single Family line heading introduces paired name/reading rows whose cells share height and center vertically; each left cell reads `Name [## | G#]`, and the right cell carries only the relationship reading. Ancestor, sibling, and descendant totals span beneath both columns on one line. Every resolved name remains linked. George McMillen (1745) is G0, James is G1, George (1818) is G2, and Albon/Newton/Lucian are G3. Unknown positions omit the ordinal and read `Child of …`; the root reads `Root ancestor`.
- Current McLineage sources use one stable row per person. Spouses have their own P record IDs, blank source-row and lineage fields, and are connected by `spouse_#_record_id`; older embedded-spouse rows remain importable.
- Current source dates are blank, normalized to `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`, or use question marks for unknown digits with the `partial` descriptor. `invalid` is not accepted. Person descriptors are `year`, `month`, `day`, `partial`, `UNKNOWN`, or blank; birth descriptors cannot be blank, a blank death descriptor means living, and `UNKNOWN` means deceased with no normalized date. Partial source values remain visible in imported source details but are not forced into McFamily's stricter editable/native date value. Legacy descendant date columns remain importable.
- Profile relationships use compact, initially open Parents, Siblings, Partners, and Children groups with names only, in that order. Bloodline parents sort first, siblings and children sort by birth date, and the current partner appears first in bold before reverse-chronological de-emphasized previous partners. The Parents display may infer a recorded parent's partner as a likely co-parent when partnership dates overlap the child's birth; this is a display-only inference and does not create a relationship record. Person Notes appear after Relationships, and Imported source is the final information section in both screen and print profiles.
- Closing Selected Person clears selection and collapses the panel. Selecting any Family Tree node reopens it; do not restore a Show person control in the tree toolbar.
- At desktop widths, a persisted pointer/keyboard separator resizes the Family Tree and Selected Person horizontally. It is absent from tablet/mobile layouts.
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
