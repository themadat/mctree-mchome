# Architecture

## Layers

The application is a static page with ordered scripts and no module loader:

1. `config.js` defines identity, feature flags, themes, help, releases, and demonstration Roadmap content.
2. `icons.js` provides reusable inline SF Symbol SVG markup.
3. `core/utils.js` provides escaping, sanitization, URL/color validation, ids, dates, and hashing.
4. `core/state.js` owns defaults, normalization, migrations, validation, export envelopes, sync payloads, and collection merging.
5. `core/storage.js` loads and autosaves browser state, stores the optional token separately, and manages one recovery copy.
6. `core/components.js` implements dialogs, choices, menus/popovers, loading UI, toasts, and long press.
7. `core/portability.js` handles safe JSON import and export.
8. `core/sync.js` implements optional GitHub synchronization.
9. `core/pwa.js` manages appearance-aware install metadata, device detection, service-worker registration, and update messaging.
10. `app.js` renders the shell and Settings modules and binds interactions and shortcuts. The main workspace intentionally starts blank.

All modules attach to `window.LocalApp`. Runtime network access occurs only after the user configures or invokes GitHub Sync.

## State model

The current model is version 4:

```json
{
  "schemaVersion": 4,
  "meta": {
    "appVersion": "0.0.1.2",
    "buildId": "0.0.1.2",
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp",
    "lastMutationId": "stable id",
    "tombstones": { "records": [], "documents": [] }
  },
  "workspace": {
    "title": "My App",
    "records": [],
    "documents": [
      {
        "id": "app-notes",
        "title": "Notes",
        "html": "Escaped plain text"
      }
    ]
  },
  "preferences": {
    "appearance": {},
    "controls": {},
    "hints": {},
    "installation": {}
  },
  "ui": {
    "activeModule": "roadmap",
    "selectedDocumentId": "app-notes",
    "search": "",
    "documents": {},
    "panels": {},
    "navigation": {},
    "seenReleaseVersion": "",
    "supportTab": "settings"
  },
  "modules": {
    "documents": {},
    "roadmap": {},
    "cloudSync": {}
  }
}
```

The single Notes modal continues to use the legacy `documents` collection and `html` field so older exports remain compatible. New editing is plain text; it is escaped before being stored in the stable `app-notes` document. Fresh Notes are blank, and normalization removes the exact former demonstration sentence while preserving all other user text. The v3→v4 migration consolidates multiple older documents into this one note and keeps their titles as section headings. Empty `records` and related tombstone/UI fields are retained only as backward-compatibility scaffolding for older backups and sync data. There is no Records interface or demonstration record data.

The GitHub token is never part of application state. It lives under a separate per-device storage key and is excluded from export, sync payloads, diagnostics, and visible fields after entry.

## Persistence and migration

Startup checks the current storage key and then known legacy keys. Every candidate runs through wrapper unwrapping, sequential migration, normalization, sanitization, and validation. Malformed saved state falls back to a valid recovery copy or a fresh default without replacing an import file.

User mutations update metadata and schedule an autosave. Storage failures emit an application event that becomes an actionable toast. Import, cloud download, merge, reset, and other replacements create or preserve recovery data as appropriate.

Add a migration by creating `migrateNtoNPlus1`, registering it in `migrations`, increasing `schemaVersion`, and adding a fixture that proves renamed, removed, split, or combined values preserve user content.

## GitHub conflict strategy

The sync module stores a baseline target, SHA, and content hash after a successful sync. A remote check compares local, remote, and baseline hashes:

- Local only: upload.
- Remote only: download after saving a recovery copy.
- Equal: report Current.
- No baseline or missing remote file: request a first-sync decision.
- Both changed: offer merge, upload, download, or cancel.

Merging chooses the newer note for each stable id, honors newer deletion tombstones, and takes preferences from the newer whole state while preserving local per-device cloud configuration. Requests are sequenced and aborted to prevent overlap and stale responses. Checks repeat periodically, on visibility, and when connectivity returns.

## Accessibility and responsive behavior

The shell uses landmarks, native buttons and inputs, native dialogs, tabs, status regions, and explicit ARIA state. Opening a dialog moves focus; closing restores the trigger. Escape closes temporary UI. All primary actions have keyboard and touch equivalents.

Notes uses one spacious modal on desktop and a full-screen editor on mobile. Settings also becomes a full-screen dialog with one scrolling content surface. Safe-area variables, 16px mobile form controls, reduced motion, and horizontal overflow protection are built into the shared stylesheet.

## PWA and offline strategy

`sw.js` precaches the application shell, all core scripts, manifests, and light/dark assets. Same-origin application requests use the network first with cache revalidation, then fall back to the cached shell when offline. Optional GitHub API traffic remains network-only. A waiting service worker triggers a persistent bottom **New version available** toast. Its accessible clockwise-arrow action activates the waiting worker and reloads through a cache-busting URL so installed PWAs can update immediately.
