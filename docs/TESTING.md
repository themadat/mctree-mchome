# Verification checklist

Use synthetic families only.

## Automated baseline

- [ ] Every JavaScript file and `sw.js` passes `node --check`.
- [ ] Both manifests parse as JSON.
- [ ] Every local HTML `src`/`href`, manifest icon, and service-worker shell path exists.
- [ ] `git diff --check` is clean.
- [ ] The visible version, build id, asset queries, newest release, cache name, and asset version all match.
- [ ] No console errors appear during tested workflows.

## Initialization, migration, and portability

- [ ] A fresh profile shows only the introduction, privacy warning, and CSV picker.
- [ ] No demo family, blank-family action, GEDCOM action, or bypass appears.
- [ ] A valid cleaned McLineage or native McFamily CSV with at least one person shows a summary and opens the family.
- [ ] Unknown headers, missing required cells, zero-person first import, malformed CSV, oversized file, duplicate ids, unsafe headers, self-links, duplicate links, and ancestry cycles are rejected without replacing state.
- [ ] Current cleaned-source `P` record IDs and direct `parent_consanguinity_person_id` references import without remapping; `record_id` is first, both parent-role fields are adjacent, `person_name_sort` follows `person_last_name`, `source_row_number` immediately precedes `data_quality_notes`, `lineage_id` is a unique two-digit root-to-person path except for isolated `99` records, and removed legacy columns are absent.
- [ ] Every populated `parent_affinal_person_id` resolves to a distinct person paired with the consanguinity parent through `partner_relationships_json` and imports as an `affinal`-kind second parent; missing, self, duplicate, non-partner, and partial parent-role schemas are rejected.
- [ ] Current partner rows import as their own P-referenced people; their source-row and lineage fields are blank, each JSON partner P reference resolves, and no duplicate people are synthesized.
- [ ] Each current partner relationship has one unique R ID and unordered person pair; malformed JSON, missing/self references, invalid types/orders/end reasons, inconsistent date pairs, and duplicate relationships are rejected.
- [ ] Relationship type plus end reason maps to married, partnered, widowed, divorced, separated, former, or unknown without a redundant source status field; an `UNKNOWN` end reason reads as former, so no partner of a person whose partnerships all ended is shown as current.
- [ ] A McLineage CSV missing any current column is rejected by name, and `descendant_*`, `spouse_#_*`, `lineage_parent_id`, `parent_lineage_id`, `lineage_level_##_name`, `root_ancestor_##_name`, and `legacy_page_reference` files no longer import.
- [ ] Every current non-root lineage path extends its direct parent's path by exactly one segment; blank unlineaged people are accepted, while malformed, duplicate, or parent-mismatched paths are rejected.
- [ ] Current source date values accept blank, `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or the same shapes with `?` in unknown digit positions; question-mark values require `partial`, `invalid` descriptors are rejected, and birth descriptors reject blank.
- [ ] Current `person_*` identity/date columns import lineage and partner rows consistently: a known death value imports as deceased, a birth date beyond age 100 without a death value imports as presumed deceased, a birth date within 100 years imports as living, and a missing birth value imports as unknown. An `UNKNOWN` death descriptor and lineage position alone never mark anyone deceased, so people such as Adam (1991) and Melanie (1961) are Living.
- [ ] Profile and print life details use one `Age` row: living ages are compact, ages below two include months, and deceased ages read `#y | Would be #y today` or `??? | Would be #y today` when the death date is unknown.
- [ ] Desktop defaults to a thin-gutter 20/50/30 Directory/Tree/Profile split, both separators resize with pointer and keyboard input, the first resize persists both widths, a usable tree width remains, and live position percentages appear only in Developer Mode.
- [ ] Loading schema v7 state migrates the same cleaned-source life statuses to schema v8 and saves them under the v8 storage key without losing family data.
- [ ] Partial source dates remain in source details, produce a partial-only preview warning, and do not become invented normalized dates in editable/native state.
- [ ] Older direct `parent_lineage_id` and `lineage_parent_id` sources and legacy lineage-path `parent_lineage_id` or lineage-name sources remain importable.
- [ ] Legacy schema states migrate without losing Notes or retained compatibility fields.
- [ ] Export/import round trips every person field, relationship field, preference, and Note.
- [ ] Later replacement creates recovery before changing state; Restore recovery returns the prior family.
- [ ] Private export and PDF warnings are visible.
- [ ] Reload restores the current family, selection, tree mode, node detail mode, collapsed panes, filters, theme, and Notes.

## Editing and derived relationships

- [ ] Family-record add, edit, relationship, home-person, remove, and delete controls are disabled and greyed while `features.familyEditing` is false.
- The remaining mutation checks in this section apply when a developer temporarily enables `features.familyEditing` for regression testing.
- [ ] Add and remove repeated contacts without losing adjacent entries.
- [ ] Connect biological, adoptive, step, foster, guardian, and unknown parents.
- [ ] Connect every partner status with dates, place, and notes.
- [ ] Self-link, duplicate-link, missing-reference, and ancestry-cycle errors are clear and non-destructive.
- [ ] Parents, children, partners, siblings, ancestors, descendants, and lineage labels update from relationships.
- [ ] Set Home changes the focus root.
- [ ] Deleting a person confirms, snapshots, removes attached links, and can recover.
- [ ] Deleting the final person leaves an initialized empty workspace with Add Person.

## Tree and directory

- [ ] Focus mode shows the selected/home person's configured ancestor and descendant depth plus partners and siblings.
- [ ] Overview contains every connected component and isolated person.
- [ ] Single-person, multi-partner, adopted, disconnected, pedigree-collapse, and 1,500-person synthetic families render without exceptions.
- [ ] Pan, Ctrl/Command-wheel and pinch zoom, grouped icon-over-label Out/In/Fit buttons, direct zoom percentage entry, node click, and independent numeric ancestor/descendant steppers with labels above their inputs work.
- [ ] Natural-size Family Tree layouts expose horizontal and vertical scrolling when needed; ordinary wheel input scrolls and Ctrl/Command-wheel zooms.
- [ ] Arrow keys move between rendered nodes and Enter/Space selects.
- [ ] Every node and relationship has an understandable accessible label.
- [ ] Condensed cards are the default; both card modes are narrow, put every whitespace-separated name part on its own line, grow generation rows for taller names, show birth/death years with `????` for either unknown year, and keep deceased cards light brown.
- [ ] Partner pairs are adjacent when possible; married lines are solid, death-ended lines are solid and subdued, divorced lines are dotted, and other partner states remain distinguishable.
- [ ] Family Tree rows use numeric lineage order rather than alphabetical names; Seth Lauer appears before Jared Lauer.
- [ ] A multi-partner lineage person is preceded by past partners from earliest to latest and followed by the current married partner.
- [ ] Christine Perrietta McMillen renders with Ray Shanaman on her left using a divorced line and Howard David Weiss as the only partner on her right using a married line.
- [ ] Affinal Lines is disabled by default and hides recorded `affinal` parent edges; enabling it draws them as accessible light dashed branches while consanguinity edges stay solid.
- [ ] Only the current marriage draws a solid partner line; never-married partnerships are dashed, ended-unknown partnerships render as a `????` glyph line, and divorced, separated, and widowed links are dotted.
- [ ] The floating Key sits at the lower right of the Family Tree module, collapses and reopens, stays inside the module at mobile widths, and does not block canvas drags.
- [ ] Partial source dates appear in profiles and print as `December ??, 1979`, `August ??, 1943`, `June 2, 19??`, and `1981`; ages from a partial value carry `~` and an unknown year shows no age.
- [ ] Marital Status reads Married, Widowed, Divorced, Separated, Never married, or Unknown from the most recent partnership, Unknown when no partnership is recorded, and each Partners row reads `(year :: Status)`.
- [ ] Ancestors and Descendants accept 0 through 10 and clamp anything larger.
- [ ] Selecting a person from global search or a filtered directory returns the Family Tree to Focus mode.
- [ ] The desktop tree/profile divider resizes both modules with pointer drag and Left/Right/Home/End keys, persists locally, and disappears below 960px.
- [ ] Directory and selected-person panes collapse independently and can be reopened without losing selection or tree focus; the header Directory control toggles the directory both open and closed, including mobile routing back to the tree.
- [ ] Directory search and its result-count pill share one bordered title-bar control, the full `Search Directory…` placeholder is visible at the default 20% width, and the pill shows only the total until a filter or search narrows it; Filter By and Sort By are visible labels on identically sized controls.
- [ ] Filter By is a checkbox menu that supports multiple living/deceased/unknown and Consanguineal/Affinal selections; status choices combine within their facet, kinship choices combine within their facet, and the two facets intersect.
- [ ] Directory first/last-name sorting and A–Z quick jumps work on the filtered result set.
- [ ] Directory rows show `[birth – death]` with `????` for unknown years followed by the lineage ID; other lifespan surfaces use the same four-character placeholder.
- [ ] Internal stable `P` references are absent throughout ordinary app and print views and appear only in Developer Mode.
- [ ] Partial and in-order fuzzy search finds name, address, phone, email, birth/death place, heritage, general notes, Notes, Help, releases, and Roadmap, but does not match a person solely through the imported `Source Last Modified By` value.
- [ ] Directory appears left of Search and Favorites appears right; both show an icon above their visible name without causing desktop or mobile overflow.
- [ ] Starring a person search result persists across reloads, pins them above unstarred matches, and exposes an accessible pressed state without activating the person.
- [ ] Favorites opens every starred person with an empty search, allows narrowing that list, and shows useful empty guidance; unstarred or deleted people disappear immediately.
- [ ] Lineage preserves the normalized root-to-person source order, two-digit-pads every segment, italicizes the first three segments, and bolds the final segment; overlapping emphasis is bold italic.
- [ ] George McMillen (1745) is labelled G0, James G1, George (1818) G2, and Albon/Newton/Lucian G3 in Family Line brackets.
- [ ] Adam's imported lineage is `01.01.01.03.05.05.05.01` with the first three segments italic and the final `01` bold, and its Family Line begins `Adam [01 | G7]`, then `Melanie [05 | G6]`; the corresponding readings begin `Gen 7, 1st Child of Melanie`, then `Gen 6, 5th Child of Max`.
- [ ] A Family Line heading introduces paired name/reading rows with equal row heights and vertically centered cells; the family totals span both columns on one line, there is no visible Reading heading, and the root reads `Gen 0, Root ancestor`.
- [ ] Every resolved first-name parent link selects that person and focuses the tree; unknown positions read `Gen #, Child of FirstName` without an ordinal.
- [ ] Parents, Siblings, Partners, and Children are compact open groups in that order; the bloodline parent is first, siblings and children are in birth order, and Melanie's Parents group contains both Max and Martha through display-only co-parent inference.
- [ ] Partners lists the current partner first in bold, followed by prior partners in reverse history order with de-emphasized styling.
- [ ] Relationships appears immediately after identity details and before Lineage, Notes follows Relationships, and Imported Source is the final information section on screen and in each printable person profile; Albon shows both parents and all six siblings.
- [ ] The profile X closes the module, clears directory/tree selection, disables the empty mobile Person tab, and a Family Tree selection reopens the profile without a Show person button.
- [ ] A child listed from a parent's profile is labelled `Child`, without a redundant parent-kind suffix.
- [ ] Parents, Siblings, and Children headings show the correct `Gen #`; parents show `(Consanguinity)` or `(Affinity)`.
- [ ] Siblings and children show two-digit birth order and birth year as `(01 :: 1991)`, including `????` for an unknown year.
- [ ] Partners show the relationship start year as their marriage year, or `????` when no year is recorded.
- [ ] Screen and print profiles use the same Parents, Siblings, Partners, Children order and relationship context.

## Responsive and accessibility

- [ ] At 1280px, 768px, and 390px, page and body widths do not exceed the viewport.
- [ ] Desktop shows coordinated directory, tree, and detail panes.
- [ ] Mobile Directory/Family Tree/Person tabs are touch-sized; choosing a person opens Person.
- [ ] Dialogs fit the mobile viewport with one usable scrolling surface.
- [ ] Labels, landmarks, focus order, visible focus, live regions, and focus restoration are correct.
- [ ] Escape closes temporary UI; `/`, `?`, `N`, `V`, `T`, and supported navigation keys work outside fields.
- [ ] Reduced-motion mode removes nonessential animation.
- [ ] Light and dark themes retain readable contrast and status text.

## Print / Save PDF

- [ ] Report includes cover, statistics, relationship legend, every family map, every person profile, and Family Notes, with no alphabetical person index.
- [ ] Every recorded contact, life, heritage, note, and relationship value appears.
- [ ] Family maps are named for their top sibling; compact map items contain only names and years, while detailed relationship cross-references show stable person `P` references only in Developer Mode.
- [ ] Large components split by generation instead of shrinking one giant tree.
- [ ] Application controls are suppressed and print colors remain legible.
- [ ] Profiles and section headings use sensible page breaks; long addresses and URLs remain complete.
- [ ] Representative browser Save as PDF output is visually inspected.

## Offline and installation

- [ ] A fresh online load installs the current service worker and caches all shell assets.
- [ ] Reload works offline with the locally stored family.
- [ ] The worker does not cache or transmit family data.
- [ ] A build change shows the new-version toast and Force refresh activates the waiting worker.
- [ ] Both manifests install with correct McFamily identity and light/dark icons.
