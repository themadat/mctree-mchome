# App Template

A static, local-first HTML application foundation with no build step, runtime dependency, backend, account, or sign-in.

The template starts on the pre-launch `0.0.1` line at version `0.0.1.2` (`major.minor.patch.build`). Routine updates increment the fourth number.

The included product surface is intentionally focused:

- Sticky application header with version, Beta, centered global search, Notes, and Settings controls.
- Blank main application workspace ready for app-specific content.
- Single plain-text Notes modal that starts empty and autosaves locally.
- Replaceable Roadmap inside Settings with search, view filters, and sorting.
- Settings, searchable Help, What’s New, release history, shortcut reference, and Roadmap views.
- Optional GitHub Contents API synchronization with explicit conflict choices and manual JSON backup/restore.
- Contextual hints, toast and live announcements, keyboard shortcuts, shortcut-hint mode, and hidden Developer Mode.
- Installable offline PWA shell with light/dark assets and a bottom new-version toast with an icon-only Force refresh action.

## Run locally

From the repository folder:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Use a local server instead of opening `index.html` directly so the service worker and PWA behavior can run.

## Start a new application

1. Update identity, version, release notes, help, roadmap data, repository links, and feature flags in `assets/js/config.js`.
2. Mirror the public name and description in `manifest.webmanifest`, `manifest-dark.webmanifest`, and the fallback metadata in `index.html`.
3. Leave the default Notes document blank or add intentional starter text in `demoDocuments()` inside `assets/js/core/state.js`.
4. Build the application-specific interface inside the blank `main` element. Extend or replace Notes and the Settings Roadmap only when the new app needs different behavior.
5. Use `major.minor.patch.build` versions. Increment the fourth number for every completed application update; when intentionally changing major, minor, or patch, reset the build number to `1` unless another value is required. Keep `identity.buildId` equal to the full version, add the matching dated release entry, update the build query values in `index.html`, and update `CACHE_NAME` plus `ASSET_VERSION` in `sw.js` together.

## Project structure

```text
index.html                     Application shell, blank workspace, Notes, and dialogs
assets/css/app.css             Theme, layout, components, and responsive behavior
assets/js/config.js            Identity, versions, themes, help, releases, and roadmap
assets/js/icons.js             Inline SF Symbol SVG catalog
assets/js/app.js               Application rendering, actions, and keyboard wiring
assets/js/core/state.js        Defaults, normalization, migrations, validation, and merge
assets/js/core/storage.js      Local persistence, secret storage, and recovery copies
assets/js/core/components.js   Dialogs, popovers, menus, toasts, and loading UI
assets/js/core/portability.js  JSON export, validation preview, and import
assets/js/core/sync.js         Optional GitHub synchronization state machine
assets/js/core/pwa.js          PWA assets, update notices, and device detection
assets/icons/                  Editable and generated application assets
manifest*.webmanifest          Light and dark install metadata
sw.js                          Offline shell and update cache
docs/                          Architecture, components, customization, and test checklists
context/                       Agent wish, plan, start, and cut workflow
```

## Update the application icons

Editable sources and generated install assets are in `assets/icons/`. Keep the existing filenames unless you also update every reference in `index.html`, both manifests, `assets/js/config.js`, and `sw.js`.

1. Replace `app-icon-light.svg` and `app-icon-dark.svg` with square SVG artwork. Keep important artwork inside the central 80% for maskable crops.
2. Replace `favicon.svg`.
3. Export the light icon to:

   - `icon-192.png` at 192 × 192
   - `icon-512.png` at 512 × 512
   - `icon-512-maskable.png` at 512 × 512
   - `apple-touch-icon.png` at 180 × 180

4. Export the dark icon to:

   - `icon-192-dark.png` at 192 × 192
   - `icon-512-dark.png` at 512 × 512
   - `icon-512-maskable-dark.png` at 512 × 512
   - `apple-touch-icon-dark.png` at 180 × 180

5. Replace `splash-light.svg` and `splash-dark.svg`, then export `splash-light.png` and `splash-dark.png` at 1170 × 1170.
6. Advance the fourth component of the app version, use the same full version as the build identifier, add the matching release entry, update the build queries in `index.html`, and update both `CACHE_NAME` and `ASSET_VERSION` in `sw.js` so installed copies receive the assets.

Example Inkscape exports:

```sh
inkscape assets/icons/app-icon-light.svg --export-filename=assets/icons/icon-512.png --export-width=512 --export-height=512
inkscape assets/icons/app-icon-dark.svg --export-filename=assets/icons/icon-512-dark.png --export-width=512 --export-height=512
```

Verify the favicon, launcher icon, maskable crop, and splash artwork in both appearances.

## Set up GitHub SSH for repository work

This controls Git clone, pull, and push from your computer. It is separate from the optional in-app sync module, which uses the GitHub Contents API and a fine-grained token because a browser cannot use your SSH key.

1. Check for an existing key:

   ```sh
   ls -al ~/.ssh
   ```

2. If `id_ed25519` and `id_ed25519.pub` do not exist, create them:

   ```sh
   ssh-keygen -t ed25519 -C "YOUR_GITHUB_EMAIL"
   ```

3. On macOS, load the key and save it in Keychain:

   ```sh
   eval "$(ssh-agent -s)"
   ssh-add --apple-use-keychain ~/.ssh/id_ed25519
   ```

4. Copy the public key and add it in GitHub under **Settings → SSH and GPG keys → New SSH key**:

   ```sh
   pbcopy < ~/.ssh/id_ed25519.pub
   ```

   Never upload or share the private file without `.pub`.

5. Test authentication and set the repository’s SSH remote:

   ```sh
   ssh -T git@github.com
   git remote set-url origin git@github.com:OWNER/REPOSITORY.git
   git remote -v
   git push -u origin main
   ```

If Git reports `Permission denied (publickey)`, confirm the key is loaded and attached to the correct GitHub account. A prompt for the SSH key’s passphrase is local; it is not a GitHub password.

## Configure optional in-app GitHub Sync

Open **Settings → Storage & GitHub** and provide:

- Repository owner and name.
- Branch and JSON file path.
- A fine-grained personal access token limited to the selected repository with **Contents: Read and write** permission.

The token stays in browser storage on that device, is never included in exports or diagnostics, and is not displayed again. The Sync button checks local and remote state before choosing upload, download, merge, or conflict handling. JSON export/import remains the fallback.

## Host as a static site

Upload the repository contents without changing their relative paths. Use HTTPS in production so service-worker and install features are available. Keep `sw.js` at the application root because its location defines the offline scope.

The service worker checks the network first for same-origin application files, and `index.html` gives build-stamped URLs to the application assets. An ordinary browser refresh therefore retrieves a consistent current set of HTML, CSS, and JavaScript when online, then falls back to the cached shell when offline. When a waiting worker is ready, a persistent **New version available** toast appears at the bottom. Its clockwise-arrow action force-activates that worker and reloads with a cache-busting URL, including in the installed PWA.

## Agent workflow

`AGENTS.md` and `context/LLM_HANDOFF.md` define the repository workflow:

- `wish`: record an idea only.
- `plan`: investigate and document it only.
- `start`: implement an approved plan.
- `cut`: finalize a release.

After a completed change, agents provide one copy-paste command that stages only relevant files, creates a commit in the form `Version - Text` (for example, `0.0.1.2 - Refine the pre-launch shell`), and pushes the current branch. When every working-tree change belongs to the update, the command uses `git add .`; if unrelated changes exist, it names only the relevant files. Agents do not run it unless explicitly asked.
