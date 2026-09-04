# McFamily

McFamily is a private family atlas: an interactive lineage tree, indented descendant Outline, searchable people list, person/place editor, saved-change history, and print-ready family directory. It is plain HTML, CSS, and JavaScript with no runtime dependencies or custom backend.

Current pre-1.0 version: `0.0.1.120`. Application versions use `major.minor.patch.build`; the first repository 1.0 cut is therefore `1.0.0.1`.

## Use McFamily

The production app is [themadat.github.io/mctree-mchome](https://themadat.github.io/mctree-mchome/). It downloads a public **encrypted** vault, asks for a passphrase, and decrypts the matching view in the browser. It never publishes plaintext family data with this repository.

Access roles are:

- **Admin:** full data, editing, publishing, bulk upload, access management, and saved-change history.
- **Editor:** named full-data editing and publishing access.
- **Member:** PII read-only without export controls.
- **Viewer:** redacted read-only data without addresses or contacts.

Passphrases are not online accounts. Anyone who knows one can use that grant until Admin rotates or removes it. GitHub records publications, not read-only visits.

For local development, serve the repository rather than opening `file://`:

```sh
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/?local=1`. Local mode persists the current state in browser storage and accepts the same exact ZIP package used by hosted mode.

## Data contract

One import/export ZIP contains exactly these five root files:

- `McPeople.csv`
- `McPlaces.csv`
- `McRelations.csv`
- `McResidences.csv`
- `McMetadata.csv`

The current reader accepts only dataset `17.0.x` and the exact ordered schemas documented in [docs/MCFAMILY_CSV.md](docs/MCFAMILY_CSV.md). It validates ids, counts, references, relationship vocabulary, duplicate records, and ancestry cycles before replacing data. Real packages, decrypted exports, passphrases, and tokens must remain outside this repository.

## Repository map

```text
index.html                  Application shell and dialogs
assets/css/app.css          Screen, responsive, and print styling
assets/js/config.js         Identity, versions, limits, vocabularies, help, release, roadmap
assets/js/core/             State, storage, family, package, cloud, component, and PWA modules
assets/js/app.js            Workspace rendering and interaction
assets/icons/               Deployed PWA assets
scripts/verify.mjs          Fast dependency-free repository verification
context/LLM_HANDOFF.md      Current implementation invariants for agents
context/WISHES.md           Explicit lifecycle backlog
docs/                       Current architecture, data, and test contracts
```

Historical implementation detail belongs in Git, not the runtime release list or always-read documentation.

## Development and verification

Run the fast baseline after every change:

```sh
node scripts/verify.mjs
```

It checks JavaScript syntax, manifests, version alignment, asset references, retired compatibility tokens, the absence of a duplicate Pages publisher, and `git diff --check`. Use [docs/TESTING.md](docs/TESTING.md) to select browser tests for the area changed; run its full release gate only for a release cut.

Architecture and privacy boundaries are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Do not commit synthetic or real data fixtures unless they are explicitly safe and necessary.

## Publishing

GitHub Pages is configured to publish the repository's `main` branch from its root. The generated **pages build and deployment** run is the authoritative production result; no second workflow copies the site to `gh-pages`.

An application release must keep these surfaces identical:

- `assets/js/config.js` identity version/build and sole current release entry
- every `?v=` query and visible version in `index.html`
- `CACHE_NAME` and `ASSET_VERSION` in `sw.js`
- current documentation

The private encrypted family vault is published separately from inside McFamily and remains recoverable through its data repository history.

## Before 1.0

Use the full gate in [docs/TESTING.md](docs/TESTING.md), confirm a current private recovery ZIP can be opened, rotate any passphrase or token exposed during development, verify role behavior on clean devices, inspect the printed directory, and confirm the deployed service worker upgrades from the prior release. The actual 1.0 version bump is a separate release operation.
