# Shared components

## Onboarding gate

An uninitialized browser shows only the McFamily introduction, privacy explanation, and CSV picker. The import preview reports people, relationships, addresses, and source warnings before it can open the family. Current cleaned sources validate normalized descendant date values and explicit year, month, day, partial, unknown, or blank descriptors; older date-column names remain compatible. There is no blank-family, demo, JSON/GEDCOM, or authentication bypass.

## Family workspace

Desktop coordinates a header-toggled directory, SVG Family Tree, and profile columns; global Add and PDF actions live only in the application title bar. The directory and selected-person columns can be closed independently so the Family Tree can fill the workspace, and pointer/keyboard dividers resize its horizontal splits. Developer Mode shows a divider percentage only during an active pointer drag. Directory search and its result-count pill share one bordered control in the module title bar, so the full `Search Directory…` placeholder stays readable at the default width; the pill shows the total alone until a filter or search narrows the list. Visible Filter By and Sort By controls are the same size and provide a checkbox menu for combinable living-status and Lineal/Non-Lineal filters plus first/last-name sorting; Sort By draws its own chevron instead of native select chrome. Lifespan and lineage context remain in each row, and the A–Z quick-jump rail follows the filtered results. Mobile uses touch-sized Directory, Family Tree, and Person tabs; selecting a person from the directory opens Person. All modes share the same selected-person state.

The Family Tree toolbar puts Full Tree to the left of Lineage and Details to the left of the default Summary view. Each mode uses an icon over its visible label. Directional symbols sit to the left of the native Ancestors and Descendants number controls, which accept 0 through 10. The toolbar also includes an off-by-default Show ?? Lineal checkbox, a right-aligned editable zoom percentage with icon-over-label Out, In, and Fit actions, and an off-by-default Non-Lineal Lines overlay. The two display toggles use outline symbols while hidden and filled symbols while shown. Depths default to 10, and every toolbar group or toggle shares one control height. Recorded Non-Lineal parent links are hidden while the overlay is off and drawn as light dashed branches while it is on; faded muted-red parent edges trace the Lineal bloodline. Its canvas scrolls horizontally and vertically whenever the natural-size layout exceeds the viewport; ordinary wheel input scrolls and Ctrl/Command-wheel zooms. Cards are narrow and stack every whitespace-separated name part on a new line, expanding the generation row vertically when needed. Lineal cards preserve the standard living or deceased fill and use a bold muted-red outline plus a bottom-right lineage symbol, while selection replaces either lineage or ordinary borders with the same accent stroke. Neither tree mode uses a portrait or initial placeholder, and internal person references appear only in Developer Mode. Up to two previous partners stay to the left in oldest-to-newest order at 75% scale; the oldest is top-aligned and the next bottom-aligned, while the current Non-Lineal spouse remains full-size on the right. Current marriages are solid, previous marriages are dashed, never-married partnerships are dotted, and unknown relationships use repeated question marks. A collapsible Key floats at the lower right of the module and lists those four partner states before the parent lines. Person nodes are native SVG buttons by role and expose accessible labels; relationship paths also have textual descriptions.

## Person and relationship editors

The selected-person header places icon-over-label Delete and Edit actions immediately before the X close control. Add and Connect use the same convention in the Relationships heading. There is no selected-person Set as home action. Identity properties are ordered Born, Died, Age, Living Status, and Marital Status before optional gender and pronouns; Age uses natural wording and separates the primary number from supporting context. The person dialog uses structured name and life fields plus repeatable address, phone, and email groups. Add Relative creates a person and a relationship in one flow. Connect Relative links existing people. Relationship metadata lives only on relationship records.

Destructive controls use the shared confirmation dialog. Deleting a person creates recovery and removes all attached relationships. Validation errors are shown without closing the editor or changing stored data.

## Dialogs and focus

`components.openDialog()` records its trigger, opens a native modal, and moves focus to the requested or first appropriate control. Closing restores focus. Confirmation, message, import-preview, person, relationship, Notes, and Settings dialogs use this lifecycle. On small screens application dialogs become full-screen surfaces with a single scrolling panel.

## Toasts and status

`components.toast()` reports saves, exports, imports, recovery, and update availability through reusable status UI. The floating status shows local save and backup state only. Completion and errors are also announced in polite or assertive live regions as appropriate.

## Notes

Notes remains one large plain-text textarea. It opens from the header or `N`, autosaves locally, and returns focus when closed. The compatibility `documents` collection is normalized to `app-notes`, and older multi-note content is consolidated during migration.

## Global search

`/` focuses global search outside editable controls. Directory sits to its left and Favorites to its right; both follow the header icon-over-label convention, and Directory toggles its pane in either direction. Directory and global search support partial substrings and in-order fuzzy characters. Results include people, contact data, life places, heritage, notes, the Notes document, Help topics, releases, and Roadmap items; the imported `Source Last Modified By` metadata value is intentionally excluded. Person rows pair the main result action with a separate star toggle. Starred people persist locally, sort before other matching people, and appear together when Favorites is active. A person result selects that person, returns the Family Tree to Lineage mode, and routes to Profile on mobile.

## Lineage

Lineage appears directly under identity details and above Relationships. Identity details show partial source dates with `??` and `????` placeholders when the strict normalized value cannot hold them. Age uses natural wording such as `34 years old` or `75 years at death`, prefixes approximate values with `About`, and places a deceased person's present-day comparison on a quieter second line. Living Status and a perspective-aware Marital Status follow Age. When a current marriage has no recorded ending, two deceased partners remain Married; when only one is living, the living person's status reads Widowed. Partners rows read `(year :: Status)` from the same perspective.

The selected-person profile presents the complete two-digit source Lineage ID from oldest ancestor to selected person. The first three segments are italic and the final segment is bold, so a one-, two-, or three-part ID ends with bold italic text. A Family Line heading introduces paired name and relationship-reading cells built from direct lineage-parent references; each left cell uses `Name [## | G#]`. Each pair shares one row height and centers its content vertically so wrapped names remain aligned with its reading. Ancestor, sibling, and descendant totals span both columns beneath the rows. Every resolved person remains linked to their profile and tree focus. Readings include the generation and the parent's first whitespace-separated name, such as `Gen 6, 5th Child of Max`; unknown positions omit only the ordinal, and the root reads `Gen 0, Root ancestor`. The printable atlas includes the same ID, Family Line, reading, and totals without interactive controls.

Relationships use compact, initially open Parents, Siblings, Partners, and Children groups in that order. Parents, siblings, and children show their generation. Parent names identify Lineal or Non-Lineal roles, siblings and children show two-digit birth order and birth year, and partners show marriage year. The recorded Lineal parent appears first, and the current partner appears first in bold before reverse-chronological, de-emphasized previous partners. Screen and print profiles preserve the same order and context. Notes appear after Relationships, and Imported Source is the final information section.

Family Tree generation rows compare the numeric lineage segments directly in root-to-person order rather than falling back to display names. Partner arrangement places every relationship with a recorded ending on the Lineal person's left in chronological order and exactly one unended current partner on the right. Cleaned McLineage JSON objects retain relationship type and end reason as the authoritative history; a blank ending can be interpreted against both people's living status without rewriting the imported record, and stable relationship order remains a deterministic fallback.

The profile X closes the panel and clears the selected-person state. Its Family Tree focus remains in place, and selecting a tree node reopens the profile. There is no separate Show person control.

Family-record mutation controls remain visible but disabled while `features.familyEditing` is false. This includes adding, editing, connecting, removing, and deleting. Home-person assignment remains internal while editing is paused.

## Print report

The print host remains hidden and inaccessible during normal operation. Print / Save PDF builds it from normalized state and normally invokes the native dialog; in Developer Mode it instead copies the report into a closable in-app preview. Compact opening content flows into six-column family maps. George McMillen (1745) is the first root at Generation 0, and Generation 4 and later are grouped beneath Generation 3 family lines. Every component is labelled by its root ancestor, while unresolved `99`/`??` lineage branches are omitted. Each generation begins on its own row and contains name-and-years cards without IDs. Lineal cards have faded-red outlines; Theophilus, Albon, and Lucian are specially highlighted, and adaptive name type keeps names to two lines. Detailed alphabetical profiles follow without P references, individual Notes, or Imported Source fields.

## Icon conventions

Use the shared inline SVG catalog in `assets/js/icons.js` for standard controls. Controls still need visible text or an accessible name; state is never communicated by icon or color alone.
