# Goal
Fix Safari Groups and Directory print spillover and alternating blank Outline sheets.
# Status
COMPLETE
# Checkpoint
0.0.1.143 complete; uncommitted, based on ef72377.
# Completed
- Made the temporary @page rule available before print media activates, fixing Safari's initial native margin calculation without reducing page density.
- Changed native Outline sheets to content-sized blocks inside half-inch page margins and reset its screen viewport flex layout.
- Preserved compact Directory headings, measured Groups fill, and continuation headings only across page boundaries.
- Updated version, release/cache surfaces, implementation contract, and targeted Safari verification instructions.
# Remaining
- None. Commit and push await explicit user instruction.
# Verification
- Build: PASS (static app; scripts/verify.mjs)
- Tests: PASS (six synthetic reports at desktop/mobile; enlarged text/dark/reduced motion; keyboard and focus restoration)
- Lint: PASS (syntax and git diff --check)
- Review: PASS (request scope, release alignment, content completeness, rendered final rows)
- Native: Safari initial preview matches Groups 3, Directory 6, and Outline 3 planned pages; Outline also passes with browser headers/footers off. Old Outline produces 6 pages. Corrected Safari PDF has 3 complete pages.
- PDFs: Chromium/native WebKit counts and all expected people pass for ordinary and complex Directory, Groups, and Outline; 61-label smoke test retains 3 sheets.
# Next
No implementation work remains. Use the supplied commit/push command when ready.
# Decisions
- Keep browser headers/footers supported; no browser-specific scaling or reduced page capacity.
- Only synthetic test data was used; generated outputs remain outside the repository.
- No commit or push was performed.
