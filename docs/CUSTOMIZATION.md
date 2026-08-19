# Customization

## Identity and version

Change `identity` in `assets/js/config.js`, then mirror public fallback metadata in `index.html`, `manifest.webmanifest`, and `manifest-dark.webmanifest`.

Versions use `major.minor.patch.build`. Every completed app update advances the fourth component. When major, minor, or patch changes, reset build to `1` unless another value is explicitly chosen. Keep the config version/build, newest dated release, HTML asset queries, and service-worker cache/version identical.

## Family vocabulary

Parent types, partner statuses, living statuses, date qualifiers, and the 1,500-person limit are centralized in `assets/js/config.js`. When adding an enum value, update normalizers, editor options, Help, print legend, and validation fixtures together. Never silently reinterpret an existing stored value.

## State changes

For a schema change:

1. Add narrow defaults and normalizers in `assets/js/core/state.js`.
2. Add a sequential migration that preserves existing content.
3. Increment `schemaVersion` and the storage key only when the durable shape requires it.
4. Update `docs/MCFAMILY_CSV.md` and synthetic fixtures.
5. Verify old states, export/import round trips, unsafe text, and invalid relationships.

Keep derived relationship information in `core/family.js`; do not duplicate ancestors, descendants, siblings, or lineage arrays on people.

## Private seed preparation

Follow `docs/MCFAMILY_CSV.md`. Keep the real canonical file private. This repository ignores `assets/data/`, allowing a maintainer to select a local working copy without publishing it. A committed test seed is allowed only when every value is unmistakably synthetic.

The first-launch file must be a supported CSV with at least one person. Do not add a convenience bypass to production code.

## Tree layout

Graph data and derived family semantics live in `core/family.js`; DOM rendering and pan/zoom interaction live in `app.js`; presentation lives in `app.css`. Keep node coordinates deterministic so keyboard order, screenshots, and print references remain predictable.

New relationship visuals must retain an accessible text description and print-safe distinction that does not rely only on color.

## Themes

Theme variables live near the top of `assets/css/app.css`. User values are normalized in `state.js` and applied in `app.js`. Add presets to `config.themes` with valid six-digit colors and check the tree, status, dialogs, and print output in light and dark appearance.

## Keyboard shortcuts

Add a visible shortcut entry in `assets/js/app.js`, add `data-shortcut` when a hint is useful, and handle the key outside editable controls. Always retain a visible keyboard-operable action.

## Icons and PWA assets

Editable and generated assets are in `assets/icons/`. Keep current names unless all references in HTML, manifests, config, and `sw.js` are updated. Verify favicon, touch, maskable, launcher, and splash variants in both appearances.

## Publishing

Never publish a real family CSV, exported PDF, screenshot with private information, authentication token, or generated family data. The Pages deployment consists only of public application code and assets.

Run the full checklist in `docs/TESTING.md` before publishing.
