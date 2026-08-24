# Agent handoff

Start a new session with:

```text
Continue work in /Users/stripes/Documents/GitHub/mctree-mchome. Read AGENTS.md and context/LLM_HANDOFF.md first. Preserve manual edits and run git status --short before editing.
```

This repository is McFamily, a static, local-first family atlas. Version `0.0.1.55` uses a latest-only schema v11 browser namespace and exact 34-column McLineage v13 onboarding, structured Birth/Current/Preferred/Maiden names, Preferred → Current → Birth display fallback, compact four-row profile names with wider one-line labels, grouped Name Preferences with Preferred/Legal/Lineal and Short/Full controls, explicit NONE/UNKNOWN/UNKNOWN PRESUMED death descriptors, stable P-formatted McLineage person rows with complete root-to-person lineage paths, user-facing Lineal and Non-Lineal relationships, JSON partner relationship records, perspective-aware older-marriage status, compact parallel prior-partner placement, aligned compact profile-property values with natural-language ages, absolute root-based generations, fuzzy search with all three structured names in a taller, wider results panel, persistent favorite people selectable from search or profiles, a one-shot favorites dropdown, Developer Mode Favorites-file recovery, a header-toggled directory with combinable status and kinship filters plus A–Z jumps, selection-aware icon-labelled Full Tree/Lineage and Details/Summary controls, grouped symbol-labelled ancestor/descendant depths defaulting to 10, centered Family Tree control headings with evenly sized Name Preferences toggles, a zoom suffix before the native steppers, toggled dashed Non-Lineal parent branches with fixed symbols, standard-fill Lineal cards with bold muted-red outlines and lifespan-row marks, faded-red Lineal parent edges, gold partner edges with question-mark unknown status, a two-axis-scrollable lineage-ordered Family Tree, compact 20/50/30 default directory/tree/profile desktop splits with persistent resizing and drag-only developer position readouts, compact Family Line rows, relationship groups with generation and ordering context near the top of profiles, a complete native CSV v2 transfer format, a temporarily read-only family directory, Title Case section headings, and six-column, Generation-3-line-grouped print maps with deceased shading and a Developer Mode preview. There is no backend, account, GitHub Sync, cloud database, or runtime dependency.

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
- Preserve the schema-v11 privacy, validation, latest-only storage, accessibility, and offline invariants below.
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
- `assets/js/core/state.js`: schema v11 normalization, fuzzy matching, and validation; no historical state migrations.
- `assets/js/core/family.js`: indexes, derived relationships, connected components, generations, and deterministic layout.
- `assets/js/core/storage.js`: local save and single recovery snapshot.
- `assets/js/core/portability.js`: cleaned-source mapping and complete private CSV export/replacement import.
- `assets/js/core/components.js`: dialogs, popovers, toasts, and focus lifecycle.
- `assets/js/core/pwa.js`: installation, service-worker registration, and updates.
- `docs/MCFAMILY_CSV.md`: accepted source columns and canonical transfer-format contract.
- `sw.js`: public offline shell only.

## Data and privacy invariants

- Never commit a real family CSV, spreadsheet, PDF, screenshot, name list, address, phone, email, heritage note, or family note. `assets/data/` is ignored; use synthetic committed fixtures only.
- First launch accepts only the exact 34-column McLineage v13 CSV or a current native `mcfamily-csv-v2` CSV containing at least one person. There is no demo family, blank-family path, JSON/GEDCOM import, or bypass.
- The gate is not security or authentication. Account roles, revocation, and audit history remain a clearly marked future-backend wishlist item.
- Maximum family size is 1,500 people.
- Export CSV is the complete editable plaintext transfer file. Imports replace; they do not merge. Later replacement and person deletion create recovery first.
- Deleting the final person leaves an initialized empty workspace.
- Parent and partner links are explicit records. Reject missing references, self-links, duplicates, and directed ancestry cycles.
- Derive ancestors, descendants, siblings, units, and lineage labels; do not cache them on people.
- Use only `mcfamily.state.v11` and `mcfamily.recovery.v3`; do not load, unwrap, or migrate earlier browser state or recovery snapshots.

## Application invariants

- Keep the runtime static, dependency-free, backend-free, and hostable on ordinary GitHub Pages.
- Preserve Directory, Family Tree, and Profile as the coordinated main workspace.
- The workspace starts directly with its panes. Family title, privacy label, counts, Add Person, and PDF controls are not repeated below the application title bar.
- The header Directory control sits left of Search and toggles the directory open or closed; Favorites sits right of Search. Both use an icon above a visible label. Local save/backup status sits in the top toolbar immediately left of Add and opens backup settings. The directory title bar contains its search field, embedded result-count pill, and close control. Visible Filter By and Sort By controls sit below it. Filter By is a checkbox menu that combines living/deceased/unknown status with Lineal and Non-Lineal scopes; Sort By supports first or last name. The A–Z rail follows the filtered results. Directory and Profile panes collapse independently where both are present.
- Person search results show Preferred, Current, and Lineal name variants in three roomy horizontal columns inside a centered panel that extends lower down the viewport; narrow mobile layouts return them to compact stacked rows. Results expose an accessible, strongly highlighted Favorite toggle. The selected-person title bar has the same Favorite action. Favorite person IDs persist in normalized UI state and sort above other fuzzy matches. Favorites opens a one-time dropdown of every starred person without changing the search query, scope, placeholder, or header-button styling; typing immediately returns to ordinary family search. Developer Mode can save the starred P references to a small private `mcfamily-favorites` JSON file and restore that exact set independently of browser storage. Deleting a person removes their favorite ID.
- Tree nodes use narrow, vertically compact cards; the toolbar groups Name Preferences, Tree View, Card View, Levels, and Zoom under centered visible headings. Name Preferences offers equal-height, evenly distributed Preferred (Display), Legal (Current), or Lineal (Birth) toggles plus Short or Full length; the parenthetical name roles are visually de-emphasized. The selected-person title and relationship links follow the active tree source at full length, while its Lineage section always uses full Lineal Birth names. Preferred falls back to Legal and then Lineal when blank. Zoom places its `%` suffix inside the editable number control between the value and native up/down steppers. Names with up to three parts stay stacked, while names with four or more parts balance across three fitted lines without increasing card width. Summary remains the default and Details retains its extra context. The Lineal mark shares the larger lifespan row. Neither mode uses portrait or initial placeholders. Living people show only the known birth year; other unknown lifespan years use `????`. Deceased nodes use a light-brown card. Generation rows sort by numeric source lineage ID before fallback placement. Recorded partners sit together when possible. Up to two past partners appear chronologically on the Lineal person's left at two-thirds scale. One is vertically centered; with two, the oldest aligns to the full-size cards' top and the next aligns to their bottom. Their straight horizontal lines attach 25% from the top or bottom of the compact card so they clear the name area. Exactly one current or latest death-ended Non-Lineal spouse appears full-size on the right. Bright gold partner lines distinguish current marriages (solid), previous marriages (dashed), never-married partnerships (dotted), and unknown relationships (repeated question marks). The Key lists those four partner states in that order, then shows deceased shading, the Bloodline outline, and Lineal/Non-Lineal parent lines. Faded muted-red edges trace Lineal parents, and selecting a Lineal person temporarily uses the same accent border as any other selected person. Current cleaned McLineage imports derive history from each JSON relationship type and end reason; a latest marriage ended by death remains the displayed spouse, while divorce, separation, annulment, and unknown endings stay historical. Lineage view has independent numeric Ancestors and Descendants depth controls with directional symbols to the left; person search selections return to Lineage.
- ?? Lineal is an off-by-default, persisted icon-and-label tree-toolbar button backed by `ui.hideUnplacedLineage`. It appears only in Full Tree. While off, it removes people whose stored source `lineage-id` is `99`, plus anyone whose every relationship points only at them, from the tree; the focused person is never hidden. Enabling the control renders and centers those people at natural scale. Stored `99` segments display as `??` in ordinary UI. Those people stay in the directory and search, but printable atlases omit them, their isolated branches, and their contribution to print counts. Its question-person symbol remains outlined in both states.
- Partner history sequences by start date when both partnerships have one and by `relationship_order` otherwise, so an out-of-wedlock partnership with no start date still sorts by its order. Source `relationship_order` is a chronological 1..n per person, oldest first.
- A source `relationship_type` of `partnership` is a never-married partnership. It reads Never married in profiles and print and draws the dotted partner line whatever its end reason.
- Non-Lineal Lines is an off-by-default, persisted icon-and-two-line-label tree-toolbar button. Imported `parent-affinal-person-id` links remain stored as internal `affinal`-kind parent relationships; the tree hides those edges while the button is off and draws them as lighter dashed branches while it is on. Its slash-drop symbol remains filled in both states. Lineal links stay solid in both states, and the toggle never mutates relationships. Ordinary UI labels use Lineal and Non-Lineal.
- Internal stable `P` references remain in data but are visible only in Developer Mode, including printed cross-references. New and reset preferences default to light appearance.
- Section headings, form section titles, and dialog titles use Title Case; body copy, field labels, buttons, and empty-state messages stay sentence case. Directory rows without a lineage path read `No Lineage ID`.
- The directory title bar wraps its search input and result-count pill in one bordered control so the full `Search Directory…` placeholder stays visible at the default width; the pill shows the total alone until a filter or search narrows it. Filter By and Sort By render as identically sized controls, and Sort By uses a custom chevron rather than native select chrome.
- Ancestors and Descendants depth controls accept 0 through `controls.maxTreeDepth` (10).
- A floating Key sits at the upper right of the Family Tree canvas. It is a collapsible `details` panel whose swatches reuse the live relationship edges and add deceased-card and Bloodline-outline samples; only its summary takes pointer events so canvas drags pass through. D toggles Directory, F opens Favorites, K toggles this Key, X dismisses the visible What's New banner, and R activates the visible new-version reload action.
- Profiles and print show partial source dates that the strict normalized value cannot hold, formatted with `??` and `????` placeholders such as `December ??, 1979` and `June 2, 19??`. Ages come from the known prefix of a partial value and are prefixed with `~`; an unknown year displays `UNKNOWN`. Stored normalized date values stay strict.
- Profiles and print carry a perspective-aware Marital Status row derived from the most recent partnership: married, widowed, divorced, separated, never married for a partnership that was never a marriage, and unknown for a person with no partnership records. A marriage ended by death reads Married when both spouses are deceased. If one spouse is living and the current unended spouse is deceased, the living person's status reads Widowed while the deceased person's status remains Married. The relationship record is not rewritten. The vocabulary and base partner-status mapping live in `config.maritalStatuses` and `config.maritalStatusByPartnerStatus`.
- Each Partners row reads `(year :: Status)` using the same marital vocabulary, such as `(1912 :: Widowed)`.
- Lineage shows the complete two-digit source ID from oldest ancestor to selected person, or `None` when there is no ID. Its first three segments are italic and its final segment is bold, including bold italic when they overlap. Sources use direct `parent-consanguinity-person-id` bloodline references and optional `parent-affinal-person-id` spouse-parent references. Lineage paths always read root-to-person; there is no reversal, name-prefix, or lineage-level fallback. A single Family Line heading introduces paired name/reading rows whose cells share height and center vertically; each left cell reads `Name [## | G#]`, and each right cell reads in the form `Gen 6, 5th Child of Max` using the parent's first whitespace-separated name. A person without recorded parent lineage reads `No parent lineage.` Ancestor, sibling, and descendant totals span beneath both columns on one line. Every resolved name remains linked. George McMillen (1745) is G0, James is G1, George (1818) is G2, and Albon/Newton/Lucian are G3. Unknown positions omit the ordinal; the root reads `Gen 0, Root ancestor`.
- McLineage v13 uses one stable row per person and exactly 34 top-level headers in the documented order; every header is hyphenated. Partners have their own P record IDs, blank source-row and lineage fields, and are connected by the originating person's `partner-relationships-json` array immediately before `notes`. Nested JSON property keys remain underscored. Missing, extra, reordered, or underscore-named top-level columns are rejected rather than migrated.
- Current source dates are normalized to `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`, or use question marks for unknown digits with the `partial` descriptor. `invalid` is not accepted. Birth descriptors are `year`, `month`, `day`, `partial`, or `UNKNOWN` and cannot be blank. A known death value uses `year`, `month`, `day`, or `partial` and marks the person deceased. A blank death value must use `NONE`, `UNKNOWN`, or `UNKNOWN PRESUMED`: these map authoritatively to living, explicitly deceased with an unknown date, and presumed deceased. McLineage v13 materializes age, early-generation, and partner inference into `UNKNOWN PRESUMED` rather than recomputing it from browser time. Profiles show Born, Died, Age, Living Status, and Marital Status; Gender and Pronouns remain stored but are hidden for now. Unknown visible values use `UNKNOWN`, except a living person's Died value is `----`. The home-person eyebrow reads Root Ancestor. Age uses ordinary one-line property styling with natural years/months wording; deceased people combine age at death with italic `Would be`, a bold-italic current age, and italic `today`.
- Lineage sits directly after identity details, above Relationships, on screen and in print. Selected-person property labels use a 126px column, and Names labels stay on one line, including `Preferred (Display)`. Profile relationships use compact, initially open Parents, Siblings, Partners, and Children groups in that order, after Lineage and before contact sections. Parents, siblings, and children show their generation; parents show Lineal or Non-Lineal; siblings and children show two-digit birth order plus birth year; partners show marriage year. Lineal parents sort first, and the current partner appears first in bold before reverse-chronological de-emphasized previous partners. Screen and print profiles use the same group order and context. Person Notes appear after Relationships, and Imported Source is the final information section.
- Closing Selected Person clears selection and collapses the panel. Full Tree does the same automatically, and Lineage stays disabled until a person is selected. Selecting any Family Tree node reopens the profile and enables Lineage; do not restore a Show person control in the tree toolbar.
- At desktop widths, narrow-gutter pointer/keyboard separators resize Directory, Family Tree, and Selected Person horizontally. The defaults put Directory at 20% and the Tree/Selected Person separator at 70% (a 20/50/30 module balance); the first user resize changes the layout to persisted pixel widths. Developer Mode adds a left-side SVG measurement bracket for every visible generation labelled with that generation's full-size card width and height; it also shows only the actively dragged separator's live workspace position percentage. Separators are absent from tablet/mobile layouts.
- The Family Tree title bar groups Ancestors and Descendants in one bordered control, defaults both depths to 10, places each title above a full-input-height symbol and narrow number field, gives both toggles the same 48px height, and right-justifies the equally tall zoom/actions group.
- The tree canvas supports native horizontal and vertical scrolling in addition to drag pan, zoom, and Fit. Ordinary wheel input scrolls; Ctrl/Command-wheel zooms.
- `features.familyEditing` is currently false. Keep the visible Add, Connect, Edit, and Delete mutation controls disabled and visibly greyed until the maintainer is ready to enable editing. Do not expose Set as home in the selected-person profile.
- The SVG supports focus/overview, all components and isolated people, pan, zoom, fit, touch, keyboard selection, accessible relationship text, and reduced motion.
- Standard controls use the shared inline SVG catalog rather than emoji or icon fonts.
- Controls use native elements, labels, visible focus, touch-sized targets, and safe rendered user text.
- Avoid horizontal overflow and preserve safe-area behavior at mobile widths.
- Print builds semantic HTML for compact combined opening content, counts, legend, six-column generation maps, a dense three-column Person Directory, and Family Notes. Put the George McMillen (1745) component first at Generation 0 and group Generation 4+ beneath `Generation 3 Line` headers. Label every retained component `Root Ancestor`; omit the Jon Couts map component while keeping Jon in the Person Directory, and omit stored `99`/`??` lineage people and their isolated branches. Give Lineal cards a clearly visible faded-red outline, use stronger orientation highlights plus the Bloodline symbol for Lineal Newton, Albon, and Lucian members only, shade deceased map and directory entries brown, and keep map names within two lines with adaptive type sizing. Each directory entry contains only the full name, app-styled Lineage ID, and root-to-person first-name progression. Developer Mode previews the same report in-app; ordinary mode uses native browser print. Do not restore the removed alphabetical index unless explicitly requested.
- Keep the single Notes modal, Settings/Help/Releases/Roadmap, recovery, themes, installation, and service-worker update handling.
- The icon click changes theme; press-and-hold toggles Developer Mode without also changing theme. Developer Mode adds `DEV` to the version pill; Beta stays separate.

## Version invariant

Versions use `major.minor.patch.build`. Every completed application update increments build. A major/minor/patch change resets build to `1` unless the user specifies another number. Keep `identity.version`, `identity.buildId`, newest dated release, `index.html` queries, and `sw.js` cache/build ids identical.

## Verification baseline

Use the bundled workspace Node runtime if system Node is unavailable. Run JavaScript syntax checks, parse both manifests, validate local asset references, run `git diff --check`, and serve through an HTTP server.

Follow `docs/TESTING.md`. At minimum cover strict onboarding, cleaned-source import, native CSV round-trip/recovery errors, people and relationship CRUD, cycle rejection, search, focus and overview graph, large synthetic layout, desktop/mobile overflow, keyboard/accessibility, print content, online reload, and offline shell. Stop preview servers afterward.

## End of turn

After file changes, give a concise outcome and verification summary followed by exactly one copy-paste command that stages only task files, commits with subject `Version - Text`, and pushes the current branch. Use `git add .` only when every change belongs to the task; otherwise name task files explicitly. Do not run it unless explicitly requested.
