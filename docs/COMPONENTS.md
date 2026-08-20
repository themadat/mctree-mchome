# Shared components

## Onboarding gate

An uninitialized browser shows only the McFamily introduction, privacy explanation, and CSV picker. The import preview reports people, relationships, addresses, and source warnings before it can open the family. Current cleaned sources validate normalized descendant date values and explicit year, month, day, partial, unknown, or blank descriptors; older date-column names remain compatible. There is no blank-family, demo, JSON/GEDCOM, or authentication bypass.

## Family workspace

Desktop coordinates a header-toggled directory, SVG Family Tree, and profile columns; global Add and PDF actions live only in the application title bar. The directory and selected-person columns can be closed independently so the Family Tree can fill the workspace, and a pointer/keyboard divider resizes the tree/profile split horizontally. Directory search and its result-count pill share one bordered control in the module title bar, so the full `Search Directory…` placeholder stays readable at the default width; the pill shows the total alone until a filter or search narrows the list. Visible Filter By and Sort By controls are the same size and provide a checkbox menu for combinable living-status and consanguineal/affinal filters plus first/last-name sorting; Sort By draws its own chevron instead of native select chrome. Lifespan and lineage context remain in each row, and the A–Z quick-jump rail follows the filtered results. Mobile uses touch-sized Directory, Family Tree, and Person tabs; selecting a person from the directory opens Person. All modes share the same selected-person state.

The Family Tree toolbar controls focus/overview mode, condensed/detailed cards, native number-stepper ancestor and descendant depths from 0 to 10, a grouped editable zoom percentage with icon-over-label Out, In, and Fit actions, and an off-by-default Affinal Lines overlay. Recorded affinal parent links are hidden while the overlay is off and drawn as light dashed branches while it is on, so the solid edges always trace the consanguinity bloodline. Its canvas scrolls horizontally and vertically whenever the natural-size layout exceeds the viewport; ordinary wheel input scrolls and Ctrl/Command-wheel zooms. Cards are narrow and stack every whitespace-separated name part on a new line, expanding the generation row vertically when needed. Unknown year slots use `????`, and deceased cards use a light-brown surface. Neither tree mode uses a portrait or initial placeholder, and internal person references appear only in Developer Mode. Partner pairs are kept adjacent when their generation allows it, with previous partnerships to the left in oldest-to-newest order and the current spouse alone on the right. Only the current marriage draws a solid line; a never-married partnership is dashed, a partnership that ended for an unrecorded reason is drawn as a `????` glyph line, and divorced, separated, and widowed links are dotted. A collapsible Key floats at the lower right of the module and reuses the live edge classes for its swatches. Person nodes are native SVG buttons by role and expose accessible labels; relationship paths also have textual descriptions.

## Person and relationship editors

The person dialog uses structured name and life fields plus repeatable address, phone, and email groups. Add Relative creates a person and a relationship in one flow. Connect Relative links existing people. Relationship metadata lives only on relationship records.

Destructive controls use the shared confirmation dialog. Deleting a person creates recovery and removes all attached relationships. Validation errors are shown without closing the editor or changing stored data.

## Dialogs and focus

`components.openDialog()` records its trigger, opens a native modal, and moves focus to the requested or first appropriate control. Closing restores focus. Confirmation, message, import-preview, person, relationship, Notes, and Settings dialogs use this lifecycle. On small screens application dialogs become full-screen surfaces with a single scrolling panel.

## Toasts and status

`components.toast()` reports saves, exports, imports, recovery, and update availability through reusable status UI. The floating status shows local save and backup state only. Completion and errors are also announced in polite or assertive live regions as appropriate.

## Notes

Notes remains one large plain-text textarea. It opens from the header or `N`, autosaves locally, and returns focus when closed. The compatibility `documents` collection is normalized to `app-notes`, and older multi-note content is consolidated during migration.

## Global search

`/` focuses global search outside editable controls. Directory sits to its left and Favorites to its right; both follow the header icon-over-label convention, and Directory toggles its pane in either direction. Directory and global search support partial substrings and in-order fuzzy characters. Results include people, contact data, life places, heritage, notes, the Notes document, Help topics, releases, and Roadmap items; the imported `Source Last Modified By` metadata value is intentionally excluded. Person rows pair the main result action with a separate star toggle. Starred people persist locally, sort before other matching people, and appear together when Favorites is active. A person result selects that person, returns the Family Tree to Focus mode, and routes to Profile on mobile.

## Lineage

Identity details show partial source dates with `??` and `????` placeholders when the strict normalized value cannot hold them, derive ages from the known prefix with a `~` marker, and add a Marital Status row taken from the most recent partnership. Partners rows read `(year :: Status)`.

The selected-person profile presents the complete two-digit source Lineage ID from oldest ancestor to selected person. The first three segments are italic and the final segment is bold, so a one-, two-, or three-part ID ends with bold italic text. A Family Line heading introduces paired name and relationship-reading cells built from direct lineage-parent references; each left cell uses `Name [## | G#]`. Each pair shares one row height and centers its content vertically so wrapped names remain aligned with its reading. Ancestor, sibling, and descendant totals span both columns beneath the rows. Every resolved person remains linked to their profile and tree focus. Readings include the generation and the parent's first whitespace-separated name, such as `Gen 6, 5th Child of Max`; unknown positions omit only the ordinal, and the root reads `Gen 0, Root ancestor`. The printable atlas includes the same ID, Family Line, reading, and totals without interactive controls.

Relationships use compact, initially open Parents, Siblings, Partners, and Children groups in that order. Parents, siblings, and children show their generation. Parent names identify Consanguinity or Affinity, siblings and children show two-digit birth order and birth year, and partners show marriage year. The recorded bloodline parent appears first, and the current partner appears first in bold before reverse-chronological, de-emphasized previous partners. A parent's partner is displayed as a likely co-parent when partnership dates permit, without adding or changing an explicit relationship record. Screen and print profiles preserve the same order and context. Notes appear after Relationships, and Imported Source is the final information section.

Family Tree generation rows compare the numeric lineage segments directly in root-to-person order rather than falling back to display names. Partner arrangement then places divorced, former, separated, or widowed partners on the lineage person's left in chronological order and exactly one current married or partnered person on the right. Cleaned McLineage JSON objects derive partner status from relationship type and end reason, and any recorded end reason yields a past state; stable relationship order remains a deterministic fallback.

The profile X closes the panel and clears the selected-person state. Its Family Tree focus remains in place, and selecting a tree node reopens the profile. There is no separate Show person control.

Family-record mutation controls remain visible but disabled while `features.familyEditing` is false. This includes adding, editing, connecting, removing, deleting, and changing the home person.

## Print report

The print host remains hidden and inaccessible during normal operation. Print / Save PDF builds it from normalized state, reveals it only to print media, invokes the native dialog, then cleans up the transient print state. The report moves directly from its guide into compact family maps named for their top sibling; each generation begins on its own row and contains name-and-years cards without IDs. Detailed alphabetical profiles follow the maps.

## Icon conventions

Use the shared inline SVG catalog in `assets/js/icons.js` for standard controls. Controls still need visible text or an accessible name; state is never communicated by icon or color alone.
