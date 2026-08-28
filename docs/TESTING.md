# Verification

Testing is risk-based. Do not rerun the entire historical acceptance suite for a narrow change.

## Tier 1 — every code change

From the repository root:

```sh
node scripts/verify.mjs
```

If `node` is not on PATH, use the bundled Node executable reported by the Codex workspace dependency tool. The script checks all runtime JavaScript syntax, both manifests and their icons, config/HTML/service-worker version alignment, asset references, current-only compatibility markers, the runtime-only Pages workflow, and `git diff --check`.

Review `git status --short` and the diff. Confirm no private packages, decrypted data, tokens, passphrases, screenshots with PII, generated test output, or unrelated files are staged.

## Tier 2 — targeted browser checks

Serve the repository over HTTP with `?local=1` for local package tests. Use synthetic data unless a private local verification is explicitly required. Test the changed surface at desktop (about 1440×900) and mobile (about 390×844), plus keyboard-only operation.

| Area changed | Minimum browser checks |
| --- | --- |
| State/storage | Current schema reload; wrong schema rejection; local recovery; hosted memory mode; favorites survive Lock; no full hosted state in localStorage |
| Package/data | Valid current ZIP round trip; missing/extra/reordered header rejection; bad counts/references/ids/cycles rejection; no mutation before confirmation |
| Hosted access | Unknown/wrong/revoked passphrase; each role projection; connection status; stale revision rejection; audit actor/detail; Lock clears decrypted state |
| Editing | Add/edit/delete person; name propagation; auto lineage id; parent/partner validation; place/residence/contact edits; one audit line per field change |
| Tree | Summary vs Details; name basis/length; focus/full tree; partner order/lines; adoption/non-Lineal toggle; zoom/pan/scroll; selection and panel resize |
| List/search | Fuzzy three-name search; favorites picker; living/contact filters; first/last sort; alphabet jump; role-redacted search fields |
| Profile/Notes | Complete known/unknown values; clickable relatives; role visibility; Developer-only Imported Source; Notes last and editor-only |
| CSS/responsive | No horizontal page overflow; dialogs/sheets fit viewport; visible focus; 200% text; reduced motion; light/dark/system |
| PWA/offline | Install metadata; first online load; second offline reload; update prompt; Reload activates new worker; vault is not served from cache |
| Print | Preview all pages; half-inch margins; repeated directory header; cards never split; no controls/P ids/source/Notes; all allowed people and contacts present |

Always watch console/page errors. Check accessible names, focus restoration, Escape/close behavior, touch targets, and unsafe text such as `<script>`, quotes, commas, newlines, and spreadsheet-formula prefixes when the changed area accepts input.

## Tier 3 — release gate

Run Tier 1, then complete all of the following before `cut`:

1. **Version surfaces:** config version/build and sole release entry, every HTML query/label, service-worker cache/asset version, README, handoff, and release date agree. A major/minor/patch cut resets build to `1`.
2. **Clean-device access matrix:** Admin, each named Editor, Member, Viewer, wrong password, revoked password, and shared/duplicate-password rejection. Confirm source/edit/export/Directory visibility exactly matches the role contract, including Admin-only Favorites restore and Developer Mode starting off for every non-Admin grant.
3. **Private recovery:** offline-store a current Editor ZIP securely, import it on a clean local browser, validate counts and home person, export again, and reopen the result. Never add it to Git.
4. **Publication:** test connection with the intended fine-grained token; publish a harmless synthetic change in a safe test vault or verify production only when authorized; confirm revision, dataset patch, audit actor/details, stale-tab conflict, and Git history rollback instructions.
5. **Family scenarios:** single person, multiple/current/former partners, adoption with multiple Non-Lineal parents, disconnected component, pedigree collapse, missing dates, presumed deceased, international address, and a large synthetic family near supported limits.
6. **Print:** inspect cover, maps, root/Generation 3 grouping, special Lineal styling, compact directory, living/deceased dates, household partners/phone/address, page breaks, and light/dark source modes.
7. **Accessibility/responsive:** screen-reader spot check of tree relationships and dialogs, keyboard traversal/shortcuts, focus after close/delete, reduced motion, 200% text, mobile orientation, touch pan/zoom, and no clipped controls.
8. **PWA/deploy:** manifest parse, icons/startup images, fresh install, online→offline reload, prior-worker→new-worker update, and production URL smoke test after the generated Pages deployment succeeds. Confirm the live HTML, config, and service worker all report the new version.
9. **Security:** rotate development passphrases/tokens, confirm token repository scope is minimal, inspect public vault metadata only (never print ciphertext or secrets), and search the diff for private names/addresses/contact data.
10. **Repository:** clean status except release files, no ignored artifact accidentally forced into Git, Pages source remains `main`/root with no duplicate publishing workflow, and preview server stopped.

## 1.0 decision record

Before the first 1.0 cut, explicitly accept these static-app limits:

- passphrases are bearer secrets, not identities or MFA accounts;
- read-only visits cannot be audited by GitHub;
- concurrent edits are serialized only at publication through remote revision checks;
- rollback is a manual Git-history operation;
- browser print/PDF varies slightly by engine;
- very large family trees prioritize navigability over a single-page overview.

If any of those must change, it is a product/architecture project, not release cleanup.
