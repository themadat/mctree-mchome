# Agent handoff

Start a new session with:

```text
Continue work in /Users/stripes/Documents/GitHub/mctree-mchome. Read AGENTS.md and context/LLM_HANDOFF.md first. Preserve manual edits and run git status --short before editing.
```

This repository is McFamily, a static, local-first family atlas. Version `0.0.1.29` uses schema v8, strict private-CSV onboarding, stable P-formatted McLineage person rows with complete root-to-person lineage paths, explicit consanguineous and affinal parent references, JSON partner relationship records, explicit and age-based presumed-deceased inference, profile and print age estimates, absolute root-based generations, fuzzy search with persistent favorite people, a header-toggled directory with combinable status and kinship filters plus A–Z jumps, direct numeric ancestor/descendant depths and zoom, optional display-only affinal branches, a two-axis-scrollable lineage-ordered Family Tree with compact stacked-name cards, persistent resizable directory/tree/profile desktop splits and developer position readouts, compact Family line rows, relationship groups with generation and ordering context, a complete native CSV transfer format, a temporarily read-only family directory, and compact top-sibling-labelled print maps. There is no backend, account, GitHub Sync, cloud database, or runtime dependency.

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
- Preserve the schema-v8 privacy, validation, compatibility, accessibility, and offline invariants below.
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
- `assets/js/core/state.js`: schema v8, migrations, normalization, fuzzy matching, and validation.
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
- The header Directory control sits left of Search and toggles the directory open or closed; Favorites sits right of Search. Both use an icon above a visible label. The directory title bar contains its search field, embedded result-count pill, and close control. Visible Filter By and Sort By controls sit below it. Filter By is a checkbox menu that combines living/deceased/unknown status with Consanguineal and Affinal scopes; Sort By supports first or last name. The A–Z rail follows the filtered results. Directory and Profile panes collapse independently where both are present.
- Person search results expose a separate accessible star toggle. Favorite person IDs persist in normalized UI state, sort above other fuzzy matches, and are shown together when Favorites is active; deleting a person removes their favorite ID.
- Tree nodes use narrow cards that put every whitespace-separated name part on its own line and expand generation rows vertically as needed; condensed remains the default and detailed retains its extra context. Neither mode uses portrait or initial placeholders. Unknown lifespan years use `????`, and deceased nodes use a light-brown card. Generation rows sort by numeric source lineage ID before fallback placement. Recorded partners sit together when possible, with past partners chronologically on the left and exactly one current spouse on the right; married links are solid, death-ended links are solid and subdued, and divorced links are dotted. Current cleaned McLineage imports derive those states from each JSON relationship type and end reason; legacy spouse slots retain their earlier status mapping. Focus view has independent numeric Ancestors and Descendants depth controls, grouped Out/In/Fit buttons, and an editable zoom percentage; person search selections return to Focus.
- Affinal Lines is an off-by-default, persisted tree-toolbar checkbox. When enabled, it adds a lighter display-only branch from a plausible visible partner to the existing recorded parent-child line at a junction; it never mutates relationships.
- Internal stable `P` references remain in data but are visible only in Developer Mode, including printed cross-references. New and reset preferences default to light appearance.
- Lineage shows the complete two-digit source ID from oldest ancestor to selected person. Its first three segments are italic and its final segment is bold, including bold italic when they overlap. Current cleaned sources use direct `parent_consanguinity_person_id` bloodline references and optional `parent_affinal_person_id` spouse-parent references; older direct `parent_lineage_id`, `lineage_parent_id`, person-to-root, and name/prefix sources remain importable. A single Family line heading introduces paired name/reading rows whose cells share height and center vertically; each left cell reads `Name [## | G#]`, and each right cell reads in the form `Gen 6, 5th Child of Max` using the parent's first whitespace-separated name. Ancestor, sibling, and descendant totals span beneath both columns on one line. Every resolved name remains linked. George McMillen (1745) is G0, James is G1, George (1818) is G2, and Albon/Newton/Lucian are G3. Unknown positions omit the ordinal; the root reads `Gen 0, Root ancestor`.
- Current McLineage sources use one stable row per person. Partners have their own P record IDs, blank source-row and lineage fields, and are connected by the originating person's `partner_relationships_json` array immediately before `notes`. Each JSON object has a stable R ID, partner P reference, relationship type/order, start/end date fields, and end reason. Older spouse-slot and embedded-spouse rows remain importable.
- Current source dates are blank, normalized to `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`, or use question marks for unknown digits with the `partial` descriptor. `invalid` is not accepted. Person descriptors are `year`, `month`, `day`, `partial`, `UNKNOWN`, or blank, and birth descriptors cannot be blank. A known death date, an explicit `UNKNOWN` death descriptor, a G0-G4 lineage position, or a birth year more than 100 years ago marks the person deceased. When no death date is present, the profile labels that result Presumed deceased. Normalization refreshes already-saved cleaned-source statuses to this rule. Profiles and print output estimate current age, age at death, and counterfactual current age where the available date precision permits it; ages under two include months. Partial source values remain visible in imported source details but are not forced into McFamily's stricter editable/native date value. Legacy descendant date columns remain importable.
- Profile relationships use compact, initially open Parents, Siblings, Partners, and Children groups in that order. Parents, siblings, and children show their generation; parents show Consanguinity or Affinity; siblings and children show two-digit birth order plus birth year; partners show marriage year. Bloodline parents sort first, and the current partner appears first in bold before reverse-chronological de-emphasized previous partners. The Parents display may infer a recorded parent's partner as a likely co-parent when partnership dates overlap the child's birth; this is a display-only inference and does not create a relationship record. Screen and print profiles use the same group order and context. Person Notes appear after Relationships, and Imported source is the final information section.
- Closing Selected Person clears selection and collapses the panel. Selecting any Family Tree node reopens it; do not restore a Show person control in the tree toolbar.
- At desktop widths, persisted pointer/keyboard separators resize Directory, Family Tree, and Selected Person horizontally. Developer Mode shows each separator's live workspace position percentage. Separators are absent from tablet/mobile layouts.
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
