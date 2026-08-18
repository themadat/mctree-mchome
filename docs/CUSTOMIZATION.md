# Customization

## Rename the application

Change `identity` in `assets/js/config.js`, then mirror user-visible fallback metadata in `index.html`, `manifest.webmanifest`, and `manifest-dark.webmanifest`. Update repository and support URLs before publishing.

## Replace demonstration data

- Edit `demoDocuments()` in `assets/js/core/state.js` for the first-run note.
- Edit `roadmap` and `releases` in `assets/js/config.js`.
- Keep stable ids and valid ISO dates.
- Do not ship secrets, personal data, or domain-specific source-application content.

## Themes

Base theme variables live at the top of `assets/css/app.css`. Editable user values are normalized in `state.js` and applied in `app.js`. Add a preset to `config.themes` with `accent`, `accent2`, `success`, `warning`, and `danger` six-digit hex values.

## Keyboard shortcuts

Add a visible entry to `SHORTCUTS` in `assets/js/app.js`, add `data-shortcut` to the related control when a hint is useful, and handle the key in `handleGlobalKeydown()`. Ignore shortcuts in editable controls and always retain a visible, keyboard-operable action.

## Add a record type or module

1. Define a narrow default and normalizer in `assets/js/core/state.js`.
2. Add migration handling before changing stored shapes.
3. Add a semantic module surface and navigation control in `index.html`.
4. Add render and event functions in `assets/js/app.js`.
5. Add responsive and reduced-motion styles.
6. Include the collection in export/sync payloads only if users manage it.
7. Document and test empty, loading, disabled, offline, and error states that apply.

Avoid generic abstractions until a second real module needs the same behavior.

## Remove optional modules

- Roadmap: remove its Settings tab/panel and event/render code, then set `features.roadmap` to `false`. Release history can remain without planned/wishlist views.
- GitHub Sync: remove `core/sync.js`, its script tag, settings/status markup, related event wiring, and its `sw.js` cache entry. Keep JSON backup/restore.
- Developer tools: set `features.developerTools` to `false` and remove the Developer panel if it will never be used.
- Contextual hints: set `features.hints` to `false` and remove hint/settings markup if desired.
- Notes: remove its top-bar control, modal, and event code. Retain legacy document migration fields until old backups no longer need support.

## Publish a version

Versions use `major.minor.patch.build`. Increment the fourth component for every completed application update. If a major, minor, or patch value changes, reset the build component to `1` unless another value is required. Add the newest release card first, show its date beside its version in the release log, keep `buildId` equal to the full version, update manifest text if public metadata changed, update the build queries in `index.html`, and set the matching `CACHE_NAME` and `ASSET_VERSION` in `sw.js`. Use the commit subject `Version - Text`, then run the complete checklist in `docs/TESTING.md`.

## Icons and PWA assets

Follow the size and export instructions in the README. Keep the service worker asset list synchronized with renamed files and verify light, dark, maskable, touch, favicon, and splash variants.
