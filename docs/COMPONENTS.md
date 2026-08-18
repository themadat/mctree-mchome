# Shared components

## Dialogs and choices

`components.openDialog()` stores the trigger, opens a native modal, and focuses the requested or first appropriate control. Closing restores focus. Confirmation, message, choice, import-preview, creation, and Settings dialogs share this lifecycle. On mobile, application dialogs become full-screen surfaces with one scrolling panel.

Use `components.confirm()` for destructive operations and `components.choose()` when the user must explicitly select among safe alternatives such as sync merge/upload/download.

## Menus and popovers

`components.openMenu()` renders an anchored menu into the shared popover. Positioning is clamped to the visible viewport, focus moves into the menu, arrow keys move between commands, and Escape closes and restores focus.

## Toasts, announcements, and loading

`components.toast()` updates the reusable `role="status"` toast and can include one text or SF Symbol action. Critical completion text can also be written to the assertive live region. `components.setLoading()` controls the modal loading overlay for operations such as connection tests.

## Empty and error states

Module empty states use one shared visual pattern with a heading, explanation, and optional visible recovery action. Sync, storage, import, and PWA failures use inline status, message dialogs, or persistent toasts depending on whether immediate action is required.

## Notes

Notes is one large, initially blank plain-text textarea in a native modal. It opens from the visible Notes control or `N`, autosaves locally, closes from the standard close control or Escape, and returns focus to its trigger. There is no redundant Done action or autosave heading. The compatibility `documents` collection remains in state and sync payloads, but normalization consolidates it to the stable `app-notes` document. Migration from earlier multi-note state retains each title as a section heading and preserves its text.

## Global search

`/` focuses the centered global search unless the user is already editing a field. Results include Notes, Help topics, release entries, and Roadmap items. Roadmap results open its Settings view; the main application workspace stays blank.

## Shortcut hints

Controls declare `data-shortcut`. When the configured modifier is held, a CSS badge appears without replacing the visible control. Global shortcuts use physical key codes and continue to work while Shift, Control, or Option is held; Command-key combinations remain available to the browser. Shortcuts never replace visible buttons or native interactions.

## Icon conventions

Use the inline SVG catalog in `assets/js/icons.js` whenever an appropriate SF Symbol exists. Controls still require meaningful visible text or an accessible name; state is never communicated by icon or color alone.
