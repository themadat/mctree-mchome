# Wish ledger

This is the durable, developer-facing backlog used by the `wish`, `plan`, `start`, and `cut` workflows. It is not application state and is never included in user backups.

Next id: `WISH-002`

## Active wishes

### WISH-001 — Known birth order with unknown birthdays

- Status: Active
- Priority: P1
- Effort: Medium
- Target: Unscheduled
- Plan: context/WISH-001-birth-order-PLAN.md
- Released: —
- Affected modules: Person editor, shared family ordering, Lineage ID calculation, Settings Data Cleanup, state and package persistence.

Behavior:
When editing a person whose birthday is unknown, an editor can record their known position among siblings, including before, between, or after siblings with known birthdays. Birth order is distinct from the birthday and from the calculated Lineage ID. Settings → Data Cleanup includes a dedicated list of all Lineal people with unknown birthdays, with a direct route to edit each person and review their birth order.

Rationale:
An unknown birthday does not imply the youngest child. Birth order may be known even when the date is not. Current ordering puts unknown dates last, which can misrepresent sibling order and the resulting lineage numbering.

Acceptance criteria:

- Lineage IDs remain calculated and cannot be edited manually.
- Every assigned Lineage ID is unique across the dataset; no ordering edit or recalculation may create duplicates.
- An editor can position an unknown-birthday child before, between, or after siblings without inventing a birthday, including ordering multiple unknown-birthday siblings.
- Saving a birth-order change recalculates affected sibling and descendant Lineage IDs consistently and preserves uniqueness.
- Profiles, sibling/child lists, Tree, Outline, and their printed output use the same resolved sibling order.
- Data Cleanup lists all Lineal people with unknown birthdays, including those whose birth order has already been recorded; the list distinguishes recorded order from order still needing review.
- Recorded birth order survives save, reload, and package export/import.

Constraints and assumptions:

- Preserve relationship-authoritative lineage eligibility: only eligible Lineal Biological/Adopted links allocate child lineage segments.
- Preserve the exact five-file, latest-only package contract; determine any required schema/version changes during planning.
- Keep editing accessible and limited to existing editing roles; preserve static, offline-capable operation.
- Unresolved birth order must not be presented as confirmed merely because a deterministic fallback places a person last.

Implementation decisions:

- Unknown and incomplete birthdays allow recorded order. A full birthday restores date order.
- Changing the Lineal parent clears the old placement.
- Implemented in 0.0.1.145; awaiting an explicitly requested release cut.

## Entry template

```md
### WISH-### — Short title

- Status: Proposed | Planned | Active | Shipped | Parked
- Priority: P0 | P1 | P2 | P3
- Effort: Small | Medium | Large | X-large
- Target: Unscheduled | Patch | Minor | Major | x.y.z
- Plan: — | context/WISH-###-slug-PLAN.md
- Released: — | x.y.z on YYYY-MM-DD
- Affected modules: ...

Behavior:
Describe what a user can do and the expected result.

Rationale:
Explain the problem or opportunity without prescribing unnecessary implementation.

Acceptance criteria:

- Observable outcome one.
- Observable outcome two.

Constraints and assumptions:

- Compatibility, accessibility, offline, privacy, or architecture constraints.

Open questions:

- Only questions that materially affect scope or design.
```

When adding a wish, replace `Next id` with the following unused number. Keep shipped entries for a compact historical index; detailed public release prose belongs in `assets/js/config.js`, not here.
