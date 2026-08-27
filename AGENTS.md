# McFamily agent instructions

McFamily is a dependency-free static HTML/CSS/JavaScript family atlas. `context/LLM_HANDOFF.md` is the short, durable implementation contract.

## Start

1. Run `git status --short`; preserve all existing/manual work.
2. Read `context/LLM_HANDOFF.md`.
3. Read `context/WISHES.md` only for `wish`, `plan`, `start`, or `cut` work.
4. For active planned work, inspect the plan's `## Resume`, `git log --oneline -5`, and `git diff main...HEAD --stat`.

## Work

- Search with `rg`; keep changes narrow and do not reformat unrelated code.
- Keep runtime static, dependency-free, accessible, offline-capable, and safe on an ordinary static host.
- Central identity, versions, limits, access modes, and relationship vocabularies live in `assets/js/config.js`.
- The current five-file McFamily ZIP contract is exact and latest-only. Never add demo/blank first-run bypasses or commit real family data.
- Relationships are authoritative. Reject missing references, self-links, duplicates, and ancestry cycles; derive relatives and lineage.
- Use semantic HTML, labels, visible focus, escaped text, safe URLs, touch targets, reduced motion, and the shared inline SVG catalog.
- Application versions are `major.minor.patch.build`. Every completed app update increments build; a requested major/minor/patch change resets build to `1`. Keep config, release entry, HTML queries, and service-worker ids identical.

## Lifecycle shorthand

- `wish`: record an idea in `context/WISHES.md`; do not plan or build it.
- `plan`: investigate and write `context/WISH-###-slug-PLAN.md`; do not build it.
- `start`: implement an approved plan and maintain its Resume section.
- `cut`: finish the active release, update version/release/cache surfaces, close the wish, and run the release gate.

Do not silently advance lifecycle stages.

## Verify

Run `node scripts/verify.mjs` (or the bundled Node path) after every code change. Add only the targeted browser/print/offline checks listed in `docs/TESTING.md`; run its full release gate for `cut`.

## Finish

After changing files, report the outcome and verification. Give exactly one copy-paste command that stages only request files, commits with subject `Version - Text`, and pushes the current branch. Use `git add .` only when every status entry belongs to the request. Do not commit or push unless explicitly asked.
