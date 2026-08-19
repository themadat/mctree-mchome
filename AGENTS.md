# McFamily — Agent Instructions

Static, local-first HTML/CSS/JavaScript application. There is no required build step, runtime dependency, backend, account, or sign-in. `context/LLM_HANDOFF.md` is the durable source of truth for repository workflows and invariants; read it before implementing anything.

## Session start

1. Run `git status --short`. Existing and manual edits are authoritative; preserve them.
2. Read `context/LLM_HANDOFF.md` and `context/WISHES.md`.
3. If a feature is in flight, inspect `git log --oneline -5`, `git diff main...HEAD --stat`, and the `## Resume` section of its plan document.

## Working rules

- Search with `rg` before reading broad ranges. Keep edits narrow and never reformat unrelated code.
- Keep McFamily static, dependency-free at runtime, and usable from an ordinary static host.
- Central identity, versions, limits, and relationship vocabularies live in `assets/js/config.js`.
- Preserve the strict initialized-CSV gate, directory/tree/profile workspace, single Notes modal, Settings/Roadmap, local backup status, recovery, themes, accessibility, installation, and offline behavior.
- Never add a demo-family or blank-family first-run bypass. Never commit real family data; test with synthetic fixtures only.
- Keep additions narrow and configurable. Compatibility fields may retain legacy record/document data so old backups remain readable.
- Relationship records are authoritative. Reject missing references, self-links, duplicates, and ancestry cycles; derive family groupings rather than storing them on people.
- Application versions use `major.minor.patch.build`. Every completed update increments build. An explicit major/minor/patch change resets build to `1` unless specified otherwise. Keep version/build, dated release, HTML asset queries, and service-worker cache/build ids identical.
- Use semantic HTML, labelled controls, visible focus, safe URLs, escaped user text, touch-sized controls, and reduced-motion support.
- Use the shared inline SVG symbol catalog for standard interface icons; do not use emoji or font glyphs.
- Verify proportionally: syntax, manifest parsing, asset paths, `git diff --check`, schema/import/relationship behavior, desktop/mobile/print, and online/offline reloads.
- Stop local preview servers before the final response.

## Workflow shorthands

- `wish`: capture a scoped idea in `context/WISHES.md`; do not plan or implement it.
- `plan`: investigate a wish and write/revise `context/WISH-###-<slug>-PLAN.md`; do not implement it.
- `start`: implement an approved plan, maintain Resume, update app/build versions, and verify.
- `cut`: finalize the active line as a release, update version/release/cache surfaces, close the wish, and run the full release checklist.

Detailed contracts are in `context/LLM_HANDOFF.md`. Do not silently advance lifecycle stages.

## End of turn

After changing files:

1. Give a concise outcome and verification summary.
2. Give exactly one copy-paste shell command that stages only completed-request files, commits with subject `Version - Text`, and pushes the current branch.

Use `git add .` only when every status entry belongs to the request; otherwise list only task files and call out unrelated changes. Never use `git add -A` when user-owned files are present. Do not commit or push unless explicitly asked. If no files changed, do not suggest an empty commit.
