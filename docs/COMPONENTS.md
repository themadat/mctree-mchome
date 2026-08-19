# Shared components

## Onboarding gate

An uninitialized browser shows only the McFamily introduction, privacy explanation, and CSV picker. The import preview reports people, relationships, addresses, and source warnings before it can open the family. There is no blank-family, demo, JSON/GEDCOM, or authentication bypass.

## Family workspace

Desktop coordinates a header-opened directory, SVG Family Tree, and profile columns; global Add and PDF actions live only in the application title bar. The directory and selected-person columns can be closed independently so the Family Tree can fill the workspace, and a pointer/keyboard divider resizes the tree/profile split horizontally. The directory sorts by first or last name, shows lifespan and lineage context, and has an A–Z quick-jump rail. Mobile uses touch-sized Directory, Family Tree, and Person tabs; selecting a person from the directory opens Person. All modes share the same selected-person state.

The Family Tree toolbar controls focus/overview mode, condensed/detailed cards, separate ancestor and descendant depths, zoom, fit, and an off-by-default Other parent lines overlay. The overlay uses light dashed branches and junctions to show plausible co-parents while leaving the stronger recorded parent-child path intact. Its canvas scrolls horizontally and vertically whenever the natural-size layout exceeds the viewport; ordinary wheel input scrolls and Ctrl/Command-wheel zooms. Condensed cards are the default and show given name, family name, and lifespan only. Neither tree mode uses a portrait or initial placeholder, and internal person references appear only in Developer Mode. Partner pairs are kept adjacent when their generation allows it; married links are solid, divorced links are dotted, and other partner states are dashed. Person nodes are native SVG buttons by role and expose accessible labels; relationship paths also have textual descriptions.

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

`/` focuses global search outside editable controls. Directory sits to its left and Favorites to its right; both follow the header icon-over-label convention. Directory and global search support partial substrings and in-order fuzzy characters. Results include people, contact data, life places, heritage, notes, the Notes document, Help topics, releases, and Roadmap items. Person rows pair the main result action with a separate star toggle. Starred people persist locally, sort before other matching people, and appear together when Favorites is active. A person result selects that person, returns the Family Tree to Focus mode, and routes to Profile on mobile.

## Lineage

The selected-person profile presents the two-digit source Lineage ID in person-to-root order and bolds the selected person's first segment. A Names heading introduces paired name and generation-reading cells built from direct lineage-parent references; each pair shares one row height and centers its content vertically so wrapped names remain aligned with their reading. Ancestor, sibling, and descendant totals span both columns beneath the rows. Every resolved person remains linked to their profile and tree focus. The reading uses absolute generations rooted at George McMillen (1745) as Gen 0; known positions read `ordinal Child of …` and unknown positions read only `Child of …`. The root receives its own Gen 0 line. The printable atlas includes the same ID, names, reading, and totals without interactive controls.

Relationships use compact, initially open Parents, Siblings, Partners, and Children groups containing linked names only, in that order. A parent's partner is displayed as a likely co-parent when partnership dates permit, without adding or changing an explicit relationship record. Notes appear after Relationships at the bottom of the screen and print profiles.

Family Tree generation rows compare the numeric lineage segments in root-to-person order, reversing the current person-to-root source representation for sorting rather than falling back to display names. Partner arrangement then places divorced, former, separated, or widowed partners on the lineage person's left in chronological order and exactly one current married or partnered person on the right. Cleaned McLineage spouse slots identify prior and current partners consistently across initial import and later reloads; relationship order remains a deterministic fallback.

The profile X closes the panel and clears the selected-person state. Its Family Tree focus remains in place, and selecting a tree node reopens the profile. There is no separate Show person control.

Family-record mutation controls remain visible but disabled while `features.familyEditing` is false. This includes adding, editing, connecting, removing, deleting, and changing the home person.

## Print report

The print host remains hidden and inaccessible during normal operation. Print / Save PDF builds it from normalized state, reveals it only to print media, invokes the native dialog, then cleans up the transient print state. The report moves directly from its guide into compact family maps named for their top sibling; each generation begins on its own row and contains name-and-years cards without IDs. Detailed alphabetical profiles follow the maps.

## Icon conventions

Use the shared inline SVG catalog in `assets/js/icons.js` for standard controls. Controls still need visible text or an accessible name; state is never communicated by icon or color alone.
