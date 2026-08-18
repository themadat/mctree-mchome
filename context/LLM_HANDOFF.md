# Agent handoff

Start a new session with:

```text
Continue work in /Users/stripes/Documents/GitHub/app-template. Read AGENTS.md and context/LLM_HANDOFF.md first. Preserve manual edits and run git status --short before editing.
```

This repository is a focused application foundation. It includes the reusable top bar with centered global search, a blank main workspace, a single plain-text Notes modal, a replaceable demonstration Roadmap inside Settings, combined floating storage/sync status, local persistence/recovery, optional GitHub Sync, install assets, and the offline shell. The removed Records interface, multi-note workspace, rich-text editor, and app-space Roadmap are not part of the template.

## Workflows

### `wish`

Record an idea in `context/WISHES.md` without planning or implementing it.

- Check for duplicates and use the next `WISH-###` id.
- Capture behavior, rationale, priority, effort, acceptance criteria, constraints, affected files, and material open questions.
- Set the status to `Proposed`.

### `plan`

Investigate a wish without implementing it.

- Create or revise `context/WISH-###-slug-PLAN.md`.
- Put a `## Resume` section first, followed by decisions, scope, non-goals, file map, accessibility/responsive considerations, tests, and open questions.
- Link it from the wish and set the status to `Planned`.
- Do not change runtime files, build ids, or cache ids.

### `start`

Implement an approved plan.

- Read the wish and plan, set the wish to `Active`, and keep the Resume section current.
- Add only the architecture the real feature needs. Do not reintroduce the former Records interface, rich-text editor, or a speculative framework.
- Use `major.minor.patch.build` versions. For every completed application update, increment the fourth `build` component. When the user chooses a new major, minor, or patch value, reset `build` to `1` unless they specify it. Keep `identity.buildId` equal to the full version, add or update the matching dated release entry, update the build queries in `index.html`, and update `CACHE_NAME` plus `ASSET_VERSION` in `sw.js` together.
- Verify the affected desktop, mobile, accessibility, and offline behavior.

### `cut`

Finalize an active line as a release.

- Confirm the semantic version and update `identity.version`.
- Confirm the major, minor, and patch values, set the fourth build component to `1` unless another value is requested, and use that full version for the build and service-worker cache ids.
- Update the manifests and README when public identity or behavior changed.
- Mark the wish `Shipped`, record its version/date, and archive its plan when useful.
- Run the complete verification baseline below.

Do not silently move from one lifecycle stage to another.

## Repository map

- `index.html`: sticky shell, blank workspace, Notes, Settings, dialogs, and live regions.
- `assets/css/app.css`: themes, safe areas, components, module layouts, and responsive behavior.
- `assets/js/config.js`: identity, version/build id, assets, themes, Help, releases, and Roadmap data.
- `assets/js/icons.js`: inline SF Symbol SVG catalog.
- `assets/js/app.js`: rendering, event wiring, shortcuts, theme, Developer Mode, and Beta detection.
- `assets/js/core/`: state, storage, reusable components, portability, GitHub Sync, and PWA behavior.
- `assets/icons/`: editable SVG sources and generated install assets.
- `manifest.webmanifest` and `manifest-dark.webmanifest`: install metadata.
- `sw.js`: minimal offline shell.
- `README.md`: setup, customization, icons, SSH, and hosting instructions.

## Invariants

- Keep the runtime static, dependency-free, backend-free, and hostable as ordinary files.
- Preserve the single Notes modal and Settings Roadmap unless the user explicitly removes or replaces them. Keep the blank main application workspace open to concrete app-specific work.
- The built-in application icon click changes theme; press-and-hold toggles Developer Mode without also changing theme.
- Developer Mode adds `DEV` to the single version pill. Beta remains a separate environment pill.
- Standard interface icons use inline SF Symbol SVGs rather than emoji or icon fonts.
- New controls use native elements, accessible names, visible focus, and touch-sized hit areas.
- Avoid horizontal overflow and preserve safe-area and reduced-motion behavior.
- Every application update advances the fourth component of the visible `major.minor.patch.build` version, with the same full value used for the build id, release, asset queries, and service-worker cache.

## Verification baseline

From the repository root:

```sh
for file in assets/js/*.js sw.js; do node --check "$file" || exit 1; done
node -e "const fs=require('fs'); for (const file of ['manifest.webmanifest','manifest-dark.webmanifest']) JSON.parse(fs.readFileSync(file,'utf8'));"
git diff --check
python3 -m http.server 8000
```

Check desktop and mobile layout, no horizontal overflow, centered global search, blank main workspace, Notes editing and persistence, Settings Roadmap filtering/sorting, Settings tabs, combined floating storage/sync status, sync setup, modified and unmodified shortcuts, contextual hints, SVG controls, theme click/T shortcut, Developer Mode hold/toggle-back, Beta detection, fresh online reloads, bottom new-version toast with its arrow-only Force refresh action, and offline reload. Stop the server afterward.

## End of turn

After file changes, give one concise outcome/verification summary followed by exactly one copy-paste command that stages only task files, commits with the exact subject shape `Version - Text`, and pushes the current branch. Use `git add .` when `git status --short` confirms all changes belong to the task; otherwise name the task files explicitly. Do not run it unless explicitly requested.
