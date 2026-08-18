# App Template — Agent Instructions

Static, local-first HTML/CSS/JavaScript application. There is no required build step, runtime dependency, backend, account, or sign-in. `context/LLM_HANDOFF.md` is the durable source of truth for agent workflows and repository-specific invariants; read it before implementing anything.

## Session start

1. Run `git status --short`. Existing and manual edits are authoritative; preserve them.
2. Read `context/LLM_HANDOFF.md` and `context/WISHES.md`.
3. If a feature is in flight, inspect `git log --oneline -5`, `git diff main...HEAD --stat`, and the `## Resume` section of its plan document.

## Working rules

- Search with `rg` before reading broad file ranges. Keep edits narrow and never reformat unrelated code.
- Keep the application static, dependency-free at runtime, and usable from an ordinary static host.
- Central identity, versions, and shell settings live in `assets/js/config.js`.
- Preserve the focused foundation: top bar with centered search, blank main workspace, single Notes modal, demonstrative Roadmap inside Settings, combined floating storage/sync status, local persistence/recovery, and optional GitHub Sync. Do not restore the removed Records interface, multi-note workspace, rich-text editor, or an app-space Roadmap without an explicit request.
- Keep additions narrow and configurable. The compatibility state may retain legacy record/document fields so older backups and sync copies remain readable.
- Application versions use `major.minor.patch.build`. Every completed application update increments the fourth `build` number. An explicit major, minor, or patch change resets `build` to `1` unless the user specifies another value. Keep `identity.buildId` identical to the full four-part `identity.version`, add or update the matching dated release entry, and update the build queries in `index.html` plus the service-worker cache/build ids. Wish, plan, and agent-instruction-only edits do not change the app version unless explicitly requested.
- Use semantic HTML, labelled controls, visible focus, safe URLs, and escaped user text.
- Use the shared inline SVG symbol catalog for interface icons whenever an appropriate symbol exists; do not use emoji or font glyphs for standard controls.
- Verify proportionally: JavaScript syntax, manifest JSON parsing, `git diff --check`, referenced asset paths, and relevant desktop/mobile/offline workflows.
- Stop local preview servers before the final response.

## Workflow shorthands

Treat these one-word user requests as repository workflows:

- `wish`: capture a scoped idea in `context/WISHES.md`; do not plan or implement it.
- `plan`: investigate a wish and write or revise `context/WISH-###-<slug>-PLAN.md`; do not implement it.
- `start`: implement an approved plan, maintain its Resume block, update the app and build versions, and verify the work.
- `cut`: finalize the active line as a release, update all version/release/cache surfaces, close the wish, and run the full release checklist.

The detailed contracts are in `context/LLM_HANDOFF.md`. Do not silently advance from one lifecycle stage to another.

## End of turn

After changing files, finish with:

1. A concise outcome summary and verification result.
2. Exactly one copy-paste-ready shell command that stages only the files belonging to the completed request, commits them with the exact subject shape `Version - Text`, and pushes the current branch to `origin`.

Command shape:

```bash
git add . && git commit -m "X.Y.Z.B - Describe the completed change" && git push origin <current-branch>
```

Do not run the commit or push unless the user explicitly asks. Use `git add .` when `git status --short` confirms every change belongs to the completed request; otherwise list only the task files and call out the unrelated changes. Never use `git add -A` when unrelated or user-owned changes are present. If no files changed, do not suggest an empty commit.
