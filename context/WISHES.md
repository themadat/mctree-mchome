# Wish ledger

This is the durable, developer-facing backlog used by the `wish`, `plan`, `start`, and `cut` workflows. It is not application state and is never included in user backups.

Next id: `WISH-001`

## Active wishes

None yet.

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
