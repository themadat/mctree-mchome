# Goal
Keep search text session-only and prevent another publisher's searches from being restored.
# Status
COMPLETE
# Checkpoint
None.
# Completed
- Added shared search-free snapshots to package, local/recovery, and diagnostic persistence.
- Cleared searches from older packages and local/recovery loads.
- Synchronized version 0.0.1.140 and documented session-only search.
# Remaining
- None.
# Verification
- Build: PASS (static asset/version checks; no build step)
- Tests: PASS (desktop/mobile ZIP round trips for all access modes; legacy package/local/recovery loads; live-search preservation; reload; keyboard search/Escape; favorites; hosted memory and Lock)
- Lint: PASS (runtime syntax and diff checks)
- Review: PASS (persistence boundaries, non-mutating snapshots, existing package compatibility, and final diff reviewed)
# Next
User may commit and push 0.0.1.140; no repository commit or push was performed.
# Decisions
- Cover global, List, and roadmap searches; preserve other settings and device favorites.
- Never mutate the active search merely because the user exports or saves.
- Do not commit or push without user instruction.
