# Verification checklist

Use synthetic families only.

## Automated baseline

- [ ] Every JavaScript file and `sw.js` passes `node --check`.
- [ ] Both manifests parse as JSON.
- [ ] Every local HTML `src`/`href`, manifest icon, and service-worker shell path exists.
- [ ] `git diff --check` is clean.
- [ ] The visible version, build id, asset queries, newest release, cache name, and asset version all match.
- [ ] No console errors appear during tested workflows.

## Initialization, current schema, and portability

- [ ] A fresh profile shows only the introduction, privacy warning, and ZIP picker.
- [ ] No demo family, blank-family action, GEDCOM action, or bypass appears.
- [ ] A valid dataset 16 ZIP with at least one person shows people, relationship, place, residence, dataset, state, and validation-group summaries before opening the family.
- [ ] The ZIP contains exactly the five root files `McPeople.csv`, `McPlaces.csv`, `McRelations.csv`, `McResidences.csv`, and `McMetadata.csv`; missing, extra, duplicate, nested, encrypted, unsupported-compression, truncated, bad-checksum, multi-disk, and oversized packages are rejected without replacing state.
- [ ] McRelations uses its exact ordered, hyphenated schema 2.0.0 header and every other file uses schema 1.0.0; unknown, missing, duplicate, unsafe, underscore-named, or reordered headers and malformed/oversized CSVs are rejected.
- [ ] Structured Birth, Current, and Preferred name parts plus Maiden Last import directly; `person-first-names`, `person-last-name`, and `person-name-sort` are absent.
- [ ] McPeople contains no parent or partner columns. McRelations holds every Lineal/Non-Lineal parent and partner row with unique IDs, positive order, resolvable people, and consistent type-specific fields.
- [ ] Every parent row independently records `parent-lineage` and `parent-type`; one child may have at most one Lineal parent and multiple distinct Non-Lineal parents without requiring a partner link to the Lineal parent. Missing, self, duplicate, invalid-classification, and multiple-Lineal-parent cases are rejected.
- [ ] Each partner relationship has one unique ID and unordered person pair; missing/self references, invalid types/orders/end reasons, inconsistent date pairs, and duplicate relationships are rejected.
- [ ] Relationship type plus end reason maps to married, partnered, widowed, divorced, separated, former, or unknown without a redundant source status field; an `UNKNOWN` end reason reads as former, so no partner of a person whose partnerships all ended is shown as current.
- [ ] Every current non-root lineage path extends its direct parent's path by exactly one segment; blank unlineaged people are accepted, while malformed, duplicate, or parent-mismatched paths are rejected.
- [ ] Current source date values accept blank, `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or the same shapes with `?` in unknown digit positions; question-mark values require `partial`, `invalid` descriptors are rejected, and birth descriptors reject blank.
- [ ] Current `person-*` identity/date columns import lineage and partner rows consistently: a known death value imports as deceased; a blank death value requires `NONE`, `UNKNOWN`, or `UNKNOWN PRESUMED`; those descriptors import as living, deceased, and presumed deceased respectively.
- [ ] McPlaces requires unique L IDs and a physical address value. McResidences requires unique RS IDs, exact TRUE/FALSE current flags, resolvable P/L references, and unique person/place/start links.
- [ ] The requested private residence resolves through its McResidences row to its McPlaces row and displays the complete address without embedding it in McPeople.
- [ ] McMetadata declares the supported package/dataset versions, exact counts, family data, all five schema rows, and at least one valid audit event; duplicates, missing rows, count mismatches, bad timestamps/JSON, and unresolved home person are rejected.
- [ ] Profile life details use one ordinary one-line `Age` row: living ages are compact, ages below two use months, deceased ages read `#y at death · #y today`, and unavailable ages read `UNKNOWN`.
- [ ] Desktop defaults to a thin-gutter 20/50/30 Directory/Tree/Profile split, both separators resize with pointer and keyboard input, the first resize persists both widths, a usable tree width remains, and live position percentages appear only in Developer Mode.
- [ ] State v13 reloads from `mcfamily.state.v13`; older state and recovery keys are ignored and the dataset 16 import gate appears instead.
- [ ] Startup removes only older versioned `mcfamily.state.v#` and `mcfamily.recovery.v#` keys, preserving current state and unrelated local-storage entries so the package has quota to persist.
- [ ] A state with any schema version other than v13 is rejected rather than unwrapped or migrated.
- [ ] One ZIP export/import round trip preserves all five files, 16 name columns, people, places, residences, relationships, preferences, Notes, package metadata, and audit history.
- [ ] Missing required Birth First/Last values normalize to `UNKNOWN`; the importer does not derive structured names from removed flat columns.
- [ ] Partial source dates remain in source details, produce a partial-only preview warning, and do not become invented normalized dates in editable/native state.
- [ ] Later replacement creates recovery before changing state; Restore recovery returns the prior family.
- [ ] Private export and PDF warnings are visible.
- [ ] Reload restores the current family, selection, tree mode, node detail mode, collapsed panes, filters, theme, and Notes.

## Editing and derived relationships

- [ ] Selected-person Add, Connect, Edit, and Delete controls are disabled and greyed while `features.familyEditing` is false; Set as home is absent.
- [ ] The selected-person header orders Delete, Edit, and X; Relationships owns Add and Connect. All four mutation controls use the supplied icon-over-label symbols.
- [ ] Identity properties appear as Born, Died, Age, Living Status, and Marital Status; Gender and Pronouns remain hidden. Missing values read `UNKNOWN`, except a living person's Died value is `----`. Ages use the same visual weight as adjacent values and natural years/months wording.
- The remaining mutation checks in this section apply when a developer temporarily enables `features.familyEditing` for regression testing.
- [ ] Add and remove repeated contacts without losing adjacent entries.
- [ ] Connect biological, adopted, step, foster, guardian, and unknown parent types independently as Lineal or Non-Lineal, rejecting a second Lineal parent while accepting multiple Non-Lineal parents.
- [ ] Connect every partner status with dates, place, and notes.
- [ ] Self-link, duplicate-link, missing-reference, and ancestry-cycle errors are clear and non-destructive.
- [ ] Parents, children, partners, siblings, ancestors, descendants, and lineage labels update from relationships.
- [ ] Set Home changes the focus root.
- [ ] Deleting a person confirms, snapshots, removes attached links, and can recover.
- [ ] Deleting the final person leaves an initialized empty workspace with Add Person.

## Tree and directory

- [ ] Lineage mode shows the selected/home person's configured ancestor and descendant depth plus partners and siblings.
- [ ] Full Tree contains every connected component and isolated person.
- [ ] The toolbar centers Name Preferences, Tree View, Card View, Levels, and Zoom over their groups; orders Full Tree before Lineage and Details before Summary; keeps both internal Name Preferences toggle groups equal-height without overflow; de-emphasizes `(Display)`, `(Current)`, and `(Birth)`; removes the old Source Name, Length, and Zoom % labels; and places `%` between the zoom value and its native up/down arrows.
- [ ] Single-person, multi-partner, adopted, disconnected, pedigree-collapse, and 1,500-person synthetic families render without exceptions.
- [ ] Pan, Ctrl/Command-wheel and pinch zoom, right-aligned grouped icon-over-label Out/In/Fit buttons, direct zoom percentage entry, node click, and grouped numeric ancestor/descendant steppers with labels above their inputs work; both depths default to 10.
- [ ] Natural-size Family Tree layouts expose horizontal and vertical scrolling when needed; ordinary wheel input scrolls and Ctrl/Command-wheel zooms.
- [ ] Arrow keys move between rendered nodes and Enter/Space selects.
- [ ] Every node and relationship has an understandable accessible label.
- [ ] Summary cards are the default; Lineal (Birth) and Short name settings are the defaults. Legal and Full switches persist independently, both Summary and Details stay narrow, full names with four or more parts balance across three fitted lines without widening cards, and generation rows grow as needed. Living people show only their birth year; other unknown years use `????`. Lineal cards retain the standard living or deceased fill and use a bold muted-red outline plus a compact lineage symbol on the lifespan row.
- [ ] Selected profiles show the compact four-row Names section before Lineage with 126px property labels; `Preferred (Display)` remains on one line. The profile title and relationship links follow the active tree name source at full length, while every Family Line name always uses the full Lineal Birth name.
- [ ] Partner pairs are adjacent when possible; bright, heavier gold distinguishes the current marriage's solid line, a previous marriage's dashed line, never married's dotted line, and unknown status's repeated question marks from muted-red Lineal parent edges in both the tree and Key.
- [ ] Family Tree rows use numeric lineage order rather than alphabetical names; Seth Lauer appears before Jared Lauer.
- [ ] A multi-partner Lineal person is preceded by up to two two-thirds-scale past partners from earliest to latest and followed by the full-size current or latest death-ended Non-Lineal spouse. One left partner is vertically centered; two align with the full-size cards' top and bottom. Their straight horizontal links are parallel and attach 25% from the top or bottom of each compact card, clearing the name containers.
- [ ] Christine Perrietta McMillen renders with Ray Shanaman on her left using a divorced line and Howard David Weiss as the only partner on her right using a married line.
- [ ] Non-Lineal Lines uses a compact two-line label and the filled slash-drop symbol in both states; it is disabled by default and hides `non-lineal` parent edges, while enabling it draws every accessible light dashed branch. Lineal biological edges remain solid, while Lineal adoption is dashed muted red.
- [ ] Only the current or latest death-ended marriage draws a solid partner line; previous marriages are dashed, never-married partnerships are dotted, and unknown relationships use repeated question marks.
- [ ] Both spouses in a marriage ended by death read Married when both are deceased; a surviving spouse reads Widowed while the deceased spouse reads Married. The latest death-ended spouse stays on the right with a solid line unless a later relationship exists.
- [ ] Lineal parent edges use faded muted red, Lineal adoption uses a dashed muted-red edge, and selecting a Lineal person replaces its lineage outline with the normal selected-person accent border.
- [ ] The floating Key sits at the upper right of the Family Tree canvas, collapses and reopens, stays inside the module at mobile widths, does not block canvas drags, and includes brown deceased-card, red Bloodline-outline, Lineal parent, dashed Lineal adoption, and Non-Lineal parent samples after the four marriage states.
- [ ] ?? Lineal appears only in Full Tree, is unpressed by default, keeps stored `99`-lineage people and anyone linked only to them out of the tree, keeps the focused person visible, and leaves directory and search counts unchanged; its outlined question-person symbol remains unchanged when enabled, and enabling it centers the revealed people at natural scale.
- [ ] Stored lineage segment `99` displays as `??` in the directory, profile Lineage block, and imported-source details, while PDF output omits those people and their isolated branches.
- [ ] A never-married partnership with no start date sorts by `relationship_order`, draws the dotted line, and reads Never married; P012 shows Heather Munz to the left of Tina Magri, and P244 lists Heather as her Non-Lineal parent.
- [ ] Partial source dates appear in profiles and print as `December ??, 1979`, `August ??, 1943`, `June 2, 19??`, and `1981`; ages from a partial value begin with `~`, an unknown year shows `UNKNOWN`, living ages read like `45 years old` or `15 months old`, and deceased ages read like `80 years old at death · Would be 176 today` with the requested italic/bold emphasis.
- [ ] Marital Status reads Married, Widowed, Divorced, Separated, Never married, or Unknown from the most recent partnership, Unknown when no partnership is recorded, and each Partners row reads `(year :: Status)`. With no recorded ending, two deceased spouses remain Married; if one current spouse is living and the other deceased, the living spouse reads Widowed and their tree line remains solid.
- [ ] Ancestors and Descendants accept 0 through 10 and clamp anything larger.
- [ ] Selecting a person from global search or a filtered directory returns the Family Tree to Lineage mode.
- [ ] Desktop dividers resize modules with pointer drag and Left/Right/Home/End keys, persist locally, and disappear below 960px; their percentages are hidden unless Developer Mode is on and that exact divider is actively dragged. Developer Mode also adds a non-interactive left-side scale bracket for each visible generation labelled with its full-size bubble width and height.
- [ ] Directory and selected-person panes collapse independently and can be reopened without losing selection or tree focus; the header Directory control toggles the directory both open and closed, including mobile routing back to the tree.
- [ ] Directory search and its result-count pill share one bordered title-bar control, the full `Search Directory…` placeholder is visible at the default 20% width, and the pill shows only the total until a filter or search narrows it; Filter By and Sort By are visible labels on identically sized controls.
- [ ] Filter By is a checkbox menu that supports multiple living/deceased/unknown and Lineal/Non-Lineal selections; status choices combine within their facet, kinship choices combine within their facet, and the two facets intersect.
- [ ] Directory first/last-name sorting and A–Z quick jumps work on the filtered result set.
- [ ] Directory rows show `[birth – death]` with `????` for unknown years followed by the lineage ID, except living people show `[birth]` without a death separator or placeholder; tree cards follow the same rule.
- [ ] Internal stable `P` references are absent throughout ordinary app and print views and appear only in Developer Mode.
- [ ] Partial and in-order fuzzy search finds name, address, phone, email, birth/death place, heritage, general notes, Notes, Help, releases, and Roadmap, but does not match a person solely through the imported `Source Last Modified By` value.
- [ ] Directory appears left of Search and Favorites appears right; both show an icon above their visible name, while local save/backup status sits immediately left of Add without causing desktop or mobile overflow.
- [ ] Every desktop person search result uses the wider, taller panel to show Preferred, Current, and Lineal names in three horizontal columns; narrow mobile results stack those variants without page overflow. Starring one persists across reloads, pins it above unstarred matches, and exposes an obvious gold accessible pressed state without activating the person.
- [ ] Developer Mode saves the current starred P references to a private `mcfamily-favorites` JSON file and restores that exact set after a browser-state reset; malformed, oversized, wrong-version, and missing-person entries report safely.
- [ ] Favorites never highlights or acts as an on/off scope. Each click opens every starred person in the dropdown without clearing the current query; typing returns immediately to ordinary family search, and unstarred or deleted people disappear immediately.
- [ ] Lineage preserves the normalized root-to-person source order, two-digit-pads every segment, italicizes the first three segments, and bolds the final segment; overlapping emphasis is bold italic.
- [ ] George McMillen (1745) is labelled G0, James G1, George (1818) G2, and Albon/Newton/Lucian G3 in Family Line brackets.
- [ ] Adam's imported lineage is `01.01.01.03.05.05.05.01` with the first three segments italic and the final `01` bold, and its Family Line begins `Adam [01 | G7]`, then `Melanie [05 | G6]`; the corresponding readings begin `Gen 7, 1st Child of Melanie`, then `Gen 6, 5th Child of Max`.
- [ ] A Family Line heading introduces paired name/reading rows with equal row heights and vertically centered cells; the family totals span both columns on one line, there is no visible Reading heading, missing Lineage ID reads `None`, missing parent lineage reads `No parent lineage.`, and the root reads `Gen 0, Root ancestor`.
- [ ] Every resolved first-name parent link selects that person and focuses the tree; unknown positions read `Gen #, Child of FirstName` without an ordinal.
- [ ] Parents, Siblings, Partners, and Children are compact open groups in that order; the bloodline parent is first, siblings and children are in birth order, and Melanie's Parents group contains both Max and Martha through display-only co-parent inference.
- [ ] Partners lists the current partner first in bold, followed by prior partners in reverse history order with de-emphasized styling.
- [ ] Identity shows Born, Died, Age, Living Status, and Marital Status with `UNKNOWN` fallbacks, except living Died is `----`; Gender and Pronouns are absent. Age uses ordinary one-line styling, and the configured home person is labelled Root Ancestor. Lineage appears immediately afterward and above Relationships; Notes follows Relationships, and Imported Source is final. Albon shows both parents and all six siblings.
- [ ] The profile X closes the module, clears directory/tree selection, disables the empty mobile Person tab, and a Family Tree selection reopens the profile without a Show person button. Full Tree also closes and deselects the profile; Lineage is disabled until a person is selected.
- [ ] A child listed from a parent's profile is labelled `Child`, without a redundant parent classification suffix.
- [ ] Parents, Siblings, and Children headings show the correct `Gen #`; parents show combined context such as `(Lineal :: Adopted)` and `(Non-Lineal :: Biological)`.
- [ ] The P569 adoption fixture lists P380 first as `Lineal :: Adopted`, then both P877 and P914 as `Non-Lineal :: Biological`; its tree always shows the dashed muted-red P380 branch and reveals both biological branches only with Non-Lineal Lines enabled.
- [ ] Siblings and children show two-digit birth order and birth year as `(01 :: 1991)`, including `????` for an unknown year.
- [ ] Partners show the relationship start year as their marriage year, or `????` when no year is recorded.
- [ ] Screen and print profiles use the same Parents, Siblings, Partners, Children order and relationship context.

## Responsive and accessibility

- [ ] At 1280px, 768px, and 390px, page and body widths do not exceed the viewport.
- [ ] Desktop shows coordinated directory, tree, and detail panes.
- [ ] Mobile Directory/Family Tree/Person tabs are touch-sized; choosing a person opens Person.
- [ ] Dialogs fit the mobile viewport with one usable scrolling surface.
- [ ] Labels, landmarks, focus order, visible focus, live regions, and focus restoration are correct.
- [ ] Escape closes temporary UI; `/`, `?`, `D`, `F`, `K`, `N`, `V`, `X`, `R`, `T`, and supported navigation keys work outside fields. X acts only while What's New is visible, and R acts only while the new-version reload action is visible.
- [ ] Reduced-motion mode removes nonessential animation.
- [ ] Light and dark themes retain readable contrast and status text.

## Print / Save PDF

- [ ] Report includes compact combined opening content, statistics, relationship legend, every family map, a compact Person Directory, and Family Notes, with no separate alphabetical person index.
- [ ] Each Person Directory item contains only the full name, app-styled Lineage ID, and root-to-person first-name progression in the form `:: George -> James -> George -> Albon`.
- [ ] The first map names George McMillen (1745) as the root ancestor at Generation 0, every retained component uses the Root Ancestor label, and Jon Couts remains in Person Directory but has no Family Map component.
- [ ] Family-map rows use six compact columns and contain only names and years.
- [ ] Generation 4 and later people, including Non-Lineal partners, are grouped beneath a `Generation 3 Line` header with no unassigned branch when lineage can be resolved.
- [ ] Lineal map cards use a clearly visible faded-red outline; Lineal Newton, Albon, and Lucian members use the stronger orientation highlight plus a Bloodline symbol, while Theophilus and Lucian Lynn Kretzing do not. Every deceased map and Person Directory entry uses brown shading, and every map name fits within two lines.
- [ ] Stored `99`/`??` lineage people and their isolated branches do not appear in Family Maps, Person Directory profiles, or PDF statistics.
- [ ] Developer Mode opens the report in a modal without invoking the native print dialog; closing it restores focus. Ordinary mode retains native printing.
- [ ] Application controls are suppressed and print colors remain legible.
- [ ] Compact directory entries avoid internal breaks and flow in three columns so many people fit on each page.
- [ ] Representative browser Save as PDF output is visually inspected.

## Offline and installation

- [ ] A fresh online load installs the current service worker and caches all shell assets.
- [ ] Reload works offline with the locally stored family.
- [ ] The worker does not cache or transmit family data.
- [ ] A build change shows the new-version toast and Force refresh activates the waiting worker.
- [ ] Both manifests install with correct McFamily identity and light/dark icons.
