# McFamily

McFamily is a private family atlas that runs as a static GitHub Pages app. It visualizes family relationships, keeps addresses and other profile information together, builds a print-ready atlas, and opens the latest encrypted family record from one public link.

There is no custom backend, account provider, cloud database, or runtime dependency. The separate public `mcdata` repository contains only an AES-GCM encrypted vault; readable family CSVs, passphrases, and GitHub tokens never belong in either public repository.

Current version: `0.0.1.70` (`major.minor.patch.build`).

## What it does

- Automatically fetches the encrypted hosted vault, identifies the matching access grant from one passphrase field, and opens only after its authorized package decrypts and validates.
- Shows a Lineage tree around a selected person and a Full Tree view of connected and isolated people.
- Supports two-axis scrolling, pan, directly editable zoom and 0-10 depth numbers, fit, keyboard selection, touch, and accessible relationship descriptions.
- Orders each Family Tree generation by numeric lineage ID; up to two prior partners appear chronologically at two-thirds size to the left of the Lineal person, while the current or latest death-ended spouse remains full-size on the right. One prior partner is vertically centered; two align to the full-size cards' top and bottom, with their parallel links attached one-quarter from the outer edge of each compact card. Bright gold partner lines distinguish current marriages (solid), previous marriages (dashed), never-married partnerships (dotted), and unknown relationships (question marks), with a floating key in the corner of the tree.
- Draws any number of recorded Non-Lineal parent links as dashed branches only while the two-line Non-Lineal Lines control is on. Lineal parent edges use faded muted red, with adoption dashed and explained in the Key, without changing relationship records. Its filled symbol remains fixed in both states. Selected Lineal and Non-Lineal cards share the same accent border.
- Marks Lineal tree cards with a bold muted-red outline and a compact lineage symbol beside the lifespan while preserving the standard living or deceased fill.
- Can hide `99`-lineage people from Full Tree with a persisted `?? Lineal` control whose outlined symbol remains fixed; enabling it centers the revealed people. The control is hidden in Lineage view, while those people remain available in directory and search. Printable atlases omit unresolved `99`/`??` lineage branches.
- Records out-of-wedlock partnerships as never-married relationships with no start date, sequenced by relationship order.
- Provides a header-toggled directory with title-bar search and result count, visible Filter By and Sort By controls, combinable status and Lineal/Non-Lineal checkbox filters, A–Z quick jumps, lifespan and lineage context, and broad search across names, contact details, places, heritage, and notes.
- Lets people be starred directly in search or from the selected-person panel, remembers those favorites separately on the device through hosted refreshes and Lock, and opens them as a one-time dropdown without changing or highlighting the ordinary search scope. Developer Mode adds a Restore shortcut beside Favorites for a saved Favorites JSON file.
- Shows Preferred (Display), Legal (Current), Lineal (Birth), and Maiden names as four compact profile rows; the Family Tree can use any of the first three as its name source and can show Short or Full names.
- Keeps local save/backup status in the top toolbar and provides D, F, K, X, and R shortcuts for Directory, Favorites, the tree Key, What's New dismissal, and update reload.
- Supports partial/fuzzy matches that return the tree to Lineage, collapsible side panels, compact 20/50/30 default desktop splits with persistent resizing, and Summary tree cards that balance names with four or more parts across three fitted lines without widening the card.
- Keeps portrait placeholders and internal person references out of the ordinary workspace; Developer Mode reveals references and a left-side generation bubble scale for visual troubleshooting.
- Presents complete oldest-to-newest, two-digit Lineage IDs with the first three ancestral segments italicized and the selected person's final segment bold, followed by a compact direct-parent-linked Family Line with each name's lineage number and generation.
- Keeps people, places, person-to-person relationships, person-to-place residences, and package metadata in separate exact-schema CSV files inside one ZIP artifact.
- Opens Audit immediately left of Add so separately named Editors can publish under their own audit username and Owners can add, rotate, or revoke each passphrase independently.
- Lets the signed-in Owner click the role pill in Developer Mode to preview Editor, Member, or Viewer behavior without changing the vault, package, or active credentials.
- Imports known and question-mark partial source dates; person death descriptors explicitly distinguish living (`NONE`), deceased with an unknown date (`UNKNOWN`), and presumed deceased (`UNKNOWN PRESUMED`).
- Shows partial source dates such as `December ??, 1979`, keeps a natural-language Age property on one line, and fills unknown visible identity properties with `UNKNOWN`. Living profiles use `----` for Died, and living people show only their birth year in directory and tree lifespans. Gender and Pronouns remain stored but are temporarily hidden from person details.
- Uses compact open Parents, Siblings, Partners, and Children groups near the top of each profile, with combined parent role/type labels such as `Lineal :: Adopted` and `Non-Lineal :: Biological`, birth order and year for siblings and children, marriage years for partners, and current-first partner history. Imported Source appears only to Owner or Editor access in Developer Mode.
- Uses absolute lineage generations rooted at George McMillen (1745) as Gen 0; readings use concise forms such as `Gen 6, 5th Child of Max`.
- Lets the person panel close and clear selection; choosing any Family Tree person reopens it without a separate Show person control.
- Enables family-record Add, Connect, Edit, Delete, person and family Notes, family-title, recovery ZIP, PDF, publishing, and imported-source inspection only for Owner or Editor access; imported source additionally requires Developer Mode. Member and Viewer modes omit Add from the title bar and omit Add, Connect, Edit, and Delete from Selected Person, along with Audit, Notes, imported-source search, routine import, export, PDF, developer-data, and publishing controls.
- Uses a compact person form whose Birth (Lineal), Current (Legal), and Preferred (Display) names each stay on one weighted five-part row. Birth typing seeds Current and Preferred until either target field is edited. Date descriptors are derived from blank, exact, or question-mark partial values; invalid formats are marked and blocked.
- Retains structured profiles for people, multiple addresses, phones, emails, life events, and typed parent or partner relationships.
- Rejects a damaged or malformed ZIP, missing/extra/reordered columns, bad metadata counts, missing references, duplicate relationships, self-links, and ancestry cycles before replacement.
- Keeps a recovery snapshot before destructive replacement or deletion.
- Exports a complete editable McFamily ZIP and creates a print-only family atlas with brown deceased entries, stronger faded-red Lineal outlines, and Bloodline-symbol orientation highlights for Newton, Albon, and Lucian. Jon Couts remains in the directory but is omitted as a map root.
- Preserves Notes, Settings, themes, accessibility, installation, and offline support from the application foundation.

## Run locally

From the repository folder:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Use a local server rather than opening `index.html` directly so the service worker and install behavior can run.

On a fresh browser profile, McFamily intentionally has no demo family or blank-workspace bypass. The normal path is the passphrase gate. Before the first vault exists, the Owner may open one validated recovery ZIP on their existing browser and use Audit to publish the first encrypted vault.

## Privacy model

Everyone uses the same public application link. Passphrases wrap random AES-256 data keys with PBKDF2 and AES-GCM; the passphrase itself never leaves the browser:

- **Owner** decrypts full data and may edit, publish, add or rotate passphrases, and revoke grants.
- Each named **Editor** decrypts full data and may edit and publish under their own automatic audit identity, but cannot manage passphrases.
- Each named **Member** decrypts full profile data read-only, including addresses and contacts, without a Notes interface, imported-source search, or routine export controls.
- Each named **Viewer** can decrypt only a separately encrypted record where places, residences, contacts, family Notes, and unstructured record notes were physically removed before encryption.

- Passphrases require eight characters. Three unrelated words are recommended because short phrases are easier to guess from the public encrypted file; never reuse a personal password.
- Revocation removes future online sign-in after reload; it cannot erase information already viewed, copied, photographed, or retained in a running browser session.
- The public data repository must contain ciphertext only. Store Owner recovery ZIPs and PDFs privately.
- Access usernames are non-secret vault metadata. Use a first name or nickname, not an email address or another sensitive identifier.
- Do not commit real names, addresses, phone numbers, email addresses, heritage notes, or family notes.
- Use synthetic people for tests and screenshots.
- Browser storage is per browser profile and device. Lock clears the decrypted local family and recovery snapshot, reloads, and requires the passphrase again without publishing anything. Favorites, dismissed hints, dismissed What’s New banners, and Directory visibility remain on that device.
- Each publisher still needs a fine-grained GitHub token limited to `mcdata` with Contents read/write permission; the token stays outside the vault.
- Member and Viewer sign-ins cannot be centrally recorded without a backend or a write credential. Published family and access changes remain in McMetadata and Git history.

## Project structure

```text
index.html                     Application shell, forms, dialogs, and print report host
assets/css/app.css             Themes, family workspace, responsive, and print styles
assets/js/config.js            Identity, version, enums, help, releases, and roadmap
assets/js/icons.js             Shared inline SVG symbol catalog
assets/js/app.js               Rendering, editing, search, tree interaction, and print atlas
assets/js/core/state.js        Schema v13 normalization, fuzzy matching, and validation
assets/js/core/family.js       Relationship indexes, derived family groups, and graph layout
assets/js/core/storage.js      Local persistence and recovery snapshot
assets/js/core/portability.js  Strict five-file ZIP validation, export, preview, and replacement import
assets/js/core/cloud.js        Passphrase cryptography, encrypted GitHub vault publication, revocation, and audit UI
assets/js/core/components.js   Dialogs, popovers, toasts, and focus management
assets/js/core/pwa.js          Install metadata, offline worker, and update notice
manifest*.webmanifest          Light and dark install metadata
sw.js                          Versioned offline application shell
docs/                          Architecture, package/CSV contract, customization, and test checklists
context/                       Durable agent workflow and wish ledger
data/                          Local-only private working files; ignored by Git in full
```

## Data limits and current-version storage

Schema v13 supports up to 1,500 people, 6,000 relationships, 5,000 places, and 10,000 residences. Dates accept `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` with exact, about, before, or after qualifiers. Parent records independently store a Lineal/Non-Lineal role and parent type, allowing one Lineal and multiple Non-Lineal parents per child. Ancestry, descendants, siblings, family units, and lineage labels are derived when needed.

McFamily uses a v13-only browser-storage namespace and does not load or migrate earlier application states. Every decrypted hosted payload is still a strict dataset 16 package and must contain at least one valid person. The website accepts patch revisions in the current `16.0.x` data series while keeping all five file schemas exact.

## Encrypted hosted access workflow

The default vault is `themadat/mcdata`, branch `main`, at `data/mcfamily/McFamily-access.json`. That repository must be public so link-only readers can download the ciphertext anonymously. McFamily generates this one JSON file with the access grants and both encrypted family packages inside it; do not manually upload a ZIP or create a second encrypted-directory file. The repository must contain no readable family CSV or ZIP.

1. The Owner opens their current Editor recovery ZIP once, opens **Audit**, and enters a fine-grained GitHub token limited to `mcdata` with Contents read/write access.
2. Set the Owner username and passphrase, then add every Editor, Member, and Viewer with a unique shown name and a unique passphrase. Names remain public audit metadata but are not shown on the sign-in screen. Save new phrases before closing the dialog.
3. Choose **Publish Access Changes**. McFamily validates the family, builds full and physically redacted packages in memory, encrypts them with different random data keys, wraps only the appropriate key for each passphrase, and publishes one ciphertext-only JSON vault.
4. Send everyone the ordinary Pages link plus their passphrase. They do not choose an account or role and never receive a ZIP; McFamily identifies the matching grant locally.
5. Editors record what changed and choose **Publish Family Update**. McFamily uses the signed-in username as the audit actor, advances the dataset patch, appends the event, revalidates, encrypts both current views with the existing data keys, checks the remote revision/SHA, and replaces the vault.
6. To revoke an Editor, the Owner chooses **Revoke** on that username and publishes Access Changes. To rotate access, enter a new passphrase for that person and publish. Member and Viewer grants remain independently revocable.

If somebody publishes first, the stale publication is rejected. Reload, sign in again, and reapply the edit; McFamily never guesses at a merge. GitHub history and McMetadata preserve successful publications, but the in-package audit is not cryptographically tamper-proof.

## Local ZIP and PDF workflow

An Owner may keep a private recovery ZIP outside GitHub:

1. Import the latest McFamily ZIP.
2. Add or update people and relationships.
3. Open **Audit** and download the recovery ZIP.
4. Do not send this file to ordinary viewers; their passphrase opens the hosted encrypted family automatically.

The ZIP contains `McPeople.csv`, `McPlaces.csv`, `McRelations.csv`, `McResidences.csv`, and `McMetadata.csv`. Imports replace the current family only after ZIP integrity, all five exact schemas, metadata counts, IDs, links, lineage paths, and ancestry cycles pass validation. McFamily creates a recovery snapshot first; it does not merge concurrent copies.

`Print / Save PDF` builds a report whose cover, statistics, legend, and six-column Family Maps flow together without forced opening-page breaks. George McMillen (1745) leads the maps as Generation 0, and Generation 4 and later are grouped beneath Generation 3 family lines. Every retained component is labelled by its root ancestor; Jon Couts is omitted as a map root and unresolved `99`/`??` lineage branches are omitted. Lineal cards use a clearly visible faded-red outline, stronger orientation highlights and Bloodline symbols are limited to Lineal Newton, Albon, and Lucian members, deceased entries use brown shading, and adaptive name type keeps map names within two lines. The compact three-column Person Directory shows only each full name, styled Lineage ID, and root-to-person first-name progression. Use the native print dialog's Save as PDF destination; Developer Mode opens the same report in an in-app preview instead.

## Host on GitHub Pages

Publish the repository contents without changing relative paths. Use HTTPS so the service worker and install features are available. Keep `sw.js` at the repository root because its location defines the offline scope.

The service worker caches only the public application shell and assets. It never caches the encrypted vault, decrypted family packages, GitHub responses, passphrases, or tokens. Passphrase sign-in intentionally requires an online vault check so removed grants do not receive an offline bypass.

## Versioning

Every completed application change advances the fourth build number. Keep these surfaces identical:

- `identity.version` and `identity.buildId` in `assets/js/config.js`
- the newest dated release entry
- asset query strings in `index.html`
- `CACHE_NAME` and `ASSET_VERSION` in `sw.js`

Changing major, minor, or patch resets the build to `1` unless another value is explicitly chosen.

## Icons

Editable and generated assets are in `assets/icons/`. If filenames change, update `index.html`, both manifests, `assets/js/config.js`, and `sw.js`. Preserve light, dark, maskable, touch, favicon, and splash variants.

## Agent workflow

`AGENTS.md` and `context/LLM_HANDOFF.md` define the repository workflow:

- `wish`: record an idea only.
- `plan`: investigate and document it only.
- `start`: implement an approved plan.
- `cut`: finalize a release.

After a completed change, agents provide one copy-paste command that stages only relevant files, commits with the subject `Version - Text`, and pushes the current branch. Agents do not commit or push unless explicitly asked.
