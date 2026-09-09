# Goal
Prevent alternating blank pages when printing mailing labels.
# Status
COMPLETE
# Checkpoint
None.
# Completed
- Made label pages indivisible blocks with an inset grid shared by preview and native print.
- Reset native print body layout and synchronized version 0.0.1.139.
# Remaining
- None.
# Verification
- Build: PASS (static asset/config checks; no build step)
- Tests: PASS (Chromium PDF page counts/content and Chromium/WebKit screen/print geometry at 390/1440px for 1, 30, 31, 60, 181 labels)
- Lint: PASS (JavaScript syntax and diff checks)
- Review: PASS (request, Avery dimensions, scoped CSS, versions, and clean diff reviewed)
# Next
User may commit/push 0.0.1.139 and confirm printing from the affected iOS device.
# Decisions
- Preserve Avery 5260 label dimensions and use synthetic data only.
- Do not commit or push without user instruction.
- Native iOS print dialog not available; standalone macOS WebKit print harness timed out and was stopped.
