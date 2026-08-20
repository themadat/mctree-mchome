# Agent handoff

Start a new session with:

```text
Continue work in /Users/stripes/Documents/GitHub/mctree-mchome. Read AGENTS.md and context/LLM_HANDOFF.md first. Preserve manual edits and run git status --short before editing.
```

This repository is McFamily, a static, local-first family atlas. Version `0.0.1.40` uses schema v8, strict current-schema-only private-CSV onboarding, stable P-formatted McLineage person rows with complete root-to-person lineage paths, user-facing Lineal and Non-Lineal relationships, JSON partner relationship records, death-record/age/partner-based presumed-deceased inference, perspective-aware unended-marriage status, staggered compact prior-partner cards, naturally written profile and print age details, absolute root-based generations, fuzzy search with persistent favorite people, a header-toggled directory with combinable status and kinship filters plus A–Z jumps, icon-labelled Full Tree/Lineage and Details/Summary controls, grouped symbol-labelled ancestor/descendant depths defaulting to 10, toggled dashed Non-Lineal parent branches with stateful symbols, standard-fill Lineal cards with bold muted-red outlines and corner marks, a two-axis-scrollable lineage-ordered Family Tree, compact 20/50/30 default directory/tree/profile desktop splits with persistent resizing and drag-only developer position readouts, compact Family Line rows, relationship groups with generation and ordering context near the top of profiles, a complete native CSV transfer format, a temporarily read-only family directory, Title Case section headings, and six-column, Generation-4-branch-grouped print maps with a Developer Mode preview. There is no backend, account, GitHub Sync, cloud database, or runtime dependency.

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
- The header Directory control sits left of Search and toggles the directory open or closed; Favorites sits right of Search. Both use an icon above a visible label. The directory title bar contains its search field, embedded result-count pill, and close control. Visible Filter By and Sort By controls sit below it. Filter By is a checkbox menu that combines living/deceased/unknown status with Lineal and Non-Lineal scopes; Sort By supports first or last name. The A–Z rail follows the filtered results. Directory and Profile panes collapse independently where both are present.
- Person search results expose a separate accessible star toggle. Favorite person IDs persist in normalized UI state, sort above other fuzzy matches, and are shown together when Favorites is active; deleting a person removes their favorite ID.
- Tree nodes use narrow cards that put every whitespace-separated name part on its own line and expand generation rows vertically as needed; Summary remains the default and Details retains its extra context. Neither mode uses portrait or initial placeholders. Unknown lifespan years use `????`, and deceased nodes use a light-brown card. Generation rows sort by numeric source lineage ID before fallback placement. Recorded partners sit together when possible. Up to two past partners appear chronologically on the Lineal person's left at 75% scale; the oldest is top-aligned and the next bottom-aligned so the oldest partner's edge passes above the middle card. Exactly one current Non-Lineal spouse appears full-size on the right. Only the current marriage is solid, never-married partnerships are dotted, and every other partner history is dashed. Current cleaned McLineage imports derive history from each JSON relationship type and end reason; any recorded end reason, including `UNKNOWN`, produces a past state so the person keeps no current partner. Lineage view has independent numeric Ancestors and Descendants depth controls with directional symbols to the left, grouped Out/In/Fit buttons, and an editable zoom percentage; person search selections return to Lineage.
- Show ?? Lineal is an off-by-default, persisted tree-toolbar checkbox backed by the compatibility field `ui.hideUnplacedLineage`. While off, it removes people whose stored source `lineage_id` is `99`, plus anyone whose every relationship points only at them, from both tree modes; the focused person is never hidden. Stored `99` segments display as `??` in ordinary UI and print surfaces. Those people stay in the directory, search, print, and counts. Its question-person symbol is outlined while hidden and filled while shown.
- Partner history sequences by start date when both partnerships have one and by `relationship_order` otherwise, so an out-of-wedlock partnership with no start date still sorts by its order. Source `relationship_order` is a chronological 1..n per person, oldest first.
- A source `relationship_type` of `partnership` is a never-married partnership. It reads Never married in profiles and print and draws the dotted partner line whatever its end reason.
- Non-Lineal Lines is an off-by-default, persisted tree-toolbar checkbox. Imported `parent_affinal_person_id` links remain stored as internal `affinal`-kind parent relationships; the tree hides those edges while the checkbox is off and draws them as lighter dashed branches while it is on. Its slash-drop symbol is outlined while hidden and filled while shown. Lineal links stay solid in both states, and the toggle never mutates relationships. Technical source field names remain unchanged for CSV compatibility, but ordinary UI labels use Lineal and Non-Lineal.
- Internal stable `P` references remain in data but are visible only in Developer Mode, including printed cross-references. New and reset preferences default to light appearance.
- Section headings, form section titles, and dialog titles use Title Case; body copy, field labels, buttons, and empty-state messages stay sentence case. Directory rows without a lineage path read `No Lineage ID`.
- The directory title bar wraps its search input and result-count pill in one bordered control so the full `Search Directory…` placeholder stays visible at the default width; the pill shows the total alone until a filter or search narrows it. Filter By and Sort By render as identically sized controls, and Sort By uses a custom chevron rather than native select chrome.
- Ancestors and Descendants depth controls accept 0 through `controls.maxTreeDepth` (10).
- A floating Key sits at the lower right of the Family Tree module. It is a collapsible `details` panel whose swatches reuse the live edge classes, and only its summary takes pointer events so canvas drags pass through.
- Profiles and print show partial source dates that the strict normalized value cannot hold, formatted with `??` and `????` placeholders such as `December ??, 1979` and `June 2, 19??`. Ages come from the known prefix of a partial value and are prefixed with `~`; an unknown year yields no age. Stored normalized date values stay strict.
- Profiles and print carry a perspective-aware Marital Status row derived from the most recent partnership: married, widowed, divorced, separated, never married for a partnership that was never a marriage, and unknown for a person with no partnership records. When a current marriage has no recorded ending, two deceased spouses remain Married; if one spouse is living and the current spouse is deceased, the living person's status reads Widowed while the deceased person's status remains Married. The relationship record is not rewritten. The vocabulary and base partner-status mapping live in `config.maritalStatuses` and `config.maritalStatusByPartnerStatus`.
- Each Partners row reads `(year :: Status)` using the same marital vocabulary, such as `(1912 :: Widowed)`.
- Lineage shows the complete two-digit source ID from oldest ancestor to selected person. Its first three segments are italic and its final segment is bold, including bold italic when they overlap. Sources use direct `parent_consanguinity_person_id` bloodline references and optional `parent_affinal_person_id` spouse-parent references. Lineage paths always read root-to-person; there is no reversal, name-prefix, or lineage-level fallback. A single Family Line heading introduces paired name/reading rows whose cells share height and center vertically; each left cell reads `Name [## | G#]`, and each right cell reads in the form `Gen 6, 5th Child of Max` using the parent's first whitespace-separated name. Ancestor, sibling, and descendant totals span beneath both columns on one line. Every resolved name remains linked. George McMillen (1745) is G0, James is G1, George (1818) is G2, and Albon/Newton/Lucian are G3. Unknown positions omit the ordinal; the root reads `Gen 0, Root ancestor`.
- Current McLineage sources use one stable row per person. Partners have their own P record IDs, blank source-row and lineage fields, and are connected by the originating person's `partner_relationships_json` array immediately before `notes`. Each JSON object has a stable R ID, partner P reference, relationship type/order, start/end date fields, and end reason. Only this schema imports: `descendant_*` dates, `spouse_#_*` slots, `lineage_parent_id`, `parent_lineage_id`, `lineage_level_##_name`, `root_ancestor_##_name`, and `legacy_page_reference` sources are rejected, and a McLineage CSV missing a current column names the missing columns.
- Current source dates are blank, normalized to `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`, or use question marks for unknown digits with the `partial` descriptor. `invalid` is not accepted. Person descriptors are `year`, `month`, `day`, `partial`, `UNKNOWN`, or blank, and birth descriptors cannot be blank. A known death value marks the person deceased. Without one, a known birth date beyond age 100 is deceased and labelled Presumed deceased, a known birth date within 100 years is living, and a missing birth value is unknown. An otherwise unknown-status partner of a presumed-deceased person is also presumed deceased; this inference can propagate through partner history but never overwrites a known living status. Neither the `UNKNOWN` death descriptor nor lineage position marks anyone deceased. Profiles and print output use one Age row: deceased people combine age at death (or `???`) with `Would be #y today`; living ages use the same compact year/month notation, including months below age two.
- Lineage sits directly after identity details, above Relationships, on screen and in print. Profile relationships use compact, initially open Parents, Siblings, Partners, and Children groups in that order, after Lineage and before contact sections. Parents, siblings, and children show their generation; parents show Lineal or Non-Lineal; siblings and children show two-digit birth order plus birth year; partners show marriage year. Lineal parents sort first, and the current partner appears first in bold before reverse-chronological de-emphasized previous partners. Screen and print profiles use the same group order and context. Person Notes appear after Relationships, and Imported Source is the final information section.
- Closing Selected Person clears selection and collapses the panel. Selecting any Family Tree node reopens it; do not restore a Show person control in the tree toolbar.
- At desktop widths, narrow-gutter pointer/keyboard separators resize Directory, Family Tree, and Selected Person horizontally. The defaults put Directory at 20% and the Tree/Selected Person separator at 70% (a 20/50/30 module balance); the first user resize changes the layout to persisted pixel widths. Developer Mode shows only the actively dragged separator's live workspace position percentage, and only for the duration of that drag. Separators are absent from tablet/mobile layouts.
- The Family Tree title bar groups Ancestors and Descendants in one bordered control, defaults both depths to 10, gives both toggles the same 48px height, and right-justifies the equally tall zoom/actions group.
- The tree canvas supports native horizontal and vertical scrolling in addition to drag pan, zoom, and Fit. Ordinary wheel input scrolls; Ctrl/Command-wheel zooms.
- `features.familyEditing` is currently false. Keep the visible Add, Connect, Edit, and Delete mutation controls disabled and visibly greyed until the maintainer is ready to enable editing. Do not expose Set as home in the selected-person profile.
- The SVG supports focus/overview, all components and isolated people, pan, zoom, fit, touch, keyboard selection, accessible relationship text, and reduced motion.
- Standard controls use the shared inline SVG catalog rather than emoji or icon fonts.
- Controls use native elements, labels, visible focus, touch-sized targets, and safe rendered user text.
- Avoid horizontal overflow and preserve safe-area behavior at mobile widths.
- Print builds semantic HTML for compact combined opening content, counts, legend, six-column generation maps, every person profile, cross-references, and Family Notes. Put the George McMillen (1745) component first at Generation 0 and group Generation 5+ beneath Generation 4 family lines. Omit P references, individual Notes, and Imported Source fields from Person Directory profiles. Developer Mode previews the same report in-app; ordinary mode uses native browser print. Do not restore the removed alphabetical index unless explicitly requested.
- Keep the single Notes modal, Settings/Help/Releases/Roadmap, recovery, themes, installation, and service-worker update handling.
- The icon click changes theme; press-and-hold toggles Developer Mode without also changing theme. Developer Mode adds `DEV` to the version pill; Beta stays separate.

## Version invariant

Versions use `major.minor.patch.build`. Every completed application update increments build. A major/minor/patch change resets build to `1` unless the user specifies another number. Keep `identity.version`, `identity.buildId`, newest dated release, `index.html` queries, and `sw.js` cache/build ids identical.

## Verification baseline

Use the bundled workspace Node runtime if system Node is unavailable. Run JavaScript syntax checks, parse both manifests, validate local asset references, run `git diff --check`, and serve through an HTTP server.

Follow `docs/TESTING.md`. At minimum cover strict onboarding, cleaned-source import, native CSV round-trip/recovery errors, people and relationship CRUD, cycle rejection, search, focus and overview graph, large synthetic layout, desktop/mobile overflow, keyboard/accessibility, print content, online reload, and offline shell. Stop preview servers afterward.

## End of turn

After file changes, give a concise outcome and verification summary followed by exactly one copy-paste command that stages only task files, commits with subject `Version - Text`, and pushes the current branch. Use `git add .` only when every change belongs to the task; otherwise name task files explicitly. Do not run it unless explicitly requested.
