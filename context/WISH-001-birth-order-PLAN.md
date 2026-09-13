# WISH-001 — Known birth order

Authorized for implementation directly by the user on 2026-09-13.

## Design

Store optional birth position on the authoritative eligible Lineal parent-child relationship. Serialize a relationship-to-position map in McMetadata settings-json, preserving the exact five CSV schemas and all role projections. Share ordering between lineage calculation, profiles, Outline, and print; Tree uses the calculated paths. Reject duplicate nonempty Lineage IDs at state/package validation.

The editor supports unknown and incomplete birthdays. Full birthdays return to date order; changing the Lineal parent clears the placement. Unrecorded positions stay provisional. Data Cleanup lists every unknown Lineal birthday, including recorded placements and root ancestors.

## Resume

- Implementation complete for app 0.0.1.145.
- Shared ordering, calculated lineage rebuilds, person editor, all-role metadata persistence, and cleanup group implemented.
- Verification: repository gate plus regression tests for multiple unknown positions, full-date reset, all-role ZIP round trips, invalid positions, and duplicate Lineage ID rejection.
- Isolated Chromium browser with synthetic data: desktop/mobile editing, focused keyboard control, reload persistence, unique descendant renumbering, full-date reset, cleanup list, Outline, and print preview passed with no page errors.
- Remaining: release cut only when explicitly requested.
- Wish remains Active until an explicitly requested release cut.
