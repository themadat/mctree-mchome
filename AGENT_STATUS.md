# Goal
Fix recurring blank label sheets in native print and reduce wasted Directory page space.
# Status
COMPLETE
# Checkpoint
1 (working tree on 9d68d8b; no checkpoint commit).
# Completed
- Retained the existing label change to use printable-area dimensions and physical page margins.
- Retained measured Directory household pagination and shared preview/native typography.
- Synchronized version 0.0.1.141, release notes, caches, and current documentation.
- Verified 27 Chromium/native WebKit PDFs: expected page counts, no blank pages or split households, all fixture content present, and unchanged Avery positions.
- Desktop/mobile preview, keyboard focus/print/Escape, layout restoration, and representative PDF visual checks pass.
- Complex Directory fixture now produces five PDF pages matching preview (previously nine); simple 90-household fixture drops from seven pages to six.
# Remaining
- None.
# Verification
- Build: PASS (0.0.1.141 static asset/version checks; no build step)
- Tests: PASS (27 synthetic PDFs, desktop/mobile, keyboard, and visual checks)
- Lint: PASS (baseline syntax/diff checks)
- Review: PASS (request scope, shared typography, sheet geometry, version alignment, and final diff)
# Next
User may commit and push 0.0.1.141. No commit or push was performed; the task preview server was stopped.
# Decisions
- Use only synthetic family data; preserve exact Avery positions and keep Directory households together.
- Version remains canonical in assets/js/config.js; checkpoints do not change its four-part format.
- The original recurring label failure was not reproduced with explicit Letter print settings; revised pagination and unchanged label positions passed both engines.
- Do not commit or push without instruction.
