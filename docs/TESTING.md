# Verification

Testing is risk-based. Do not rerun the entire historical acceptance suite for a narrow change.

## Tier 1 — every code change

From the repository root:

```sh
node scripts/verify.mjs
```

If `node` is not on PATH, use the bundled Node executable reported by the Codex workspace dependency tool. The script checks all runtime JavaScript syntax, both manifests and their icons, config/HTML/service-worker/Pages-workflow version alignment, asset references, current-only compatibility markers, the sole Pages publisher, and `git diff --check`.

Review `git status --short` and the diff. Confirm no private packages, decrypted data, tokens, passphrases, screenshots with PII, generated test output, or unrelated files are staged.

## Tier 2 — targeted browser checks

Serve the repository over HTTP with `?local=1` for local package tests. Use synthetic data unless a private local verification is explicitly required. Test the changed surface at desktop (about 1440×900) and mobile (about 390×844), plus keyboard-only operation.

| Area changed | Minimum browser checks |
| --- | --- |
| State/storage | Current schema reload; wrong schema rejection; local recovery; hosted memory mode; favorites survive Lock; no full hosted state in localStorage |
| Package/data | Valid current ZIP round trip; missing/extra/reordered header rejection; bad counts/references/ids/cycles rejection; no mutation before confirmation |
| Hosted access | Unknown/wrong/revoked passphrase; each role projection; connection status; stale revision rejection; audit actor/detail; Lock clears decrypted state |
| Editing | Add/edit/delete person; name propagation; auto lineage id; parent/partner validation; a new relative defaults to the related person's current address, opt-out removes the untouched copy, and editing detaches it; place/residence/contact edits; one audit line per field change |
| Data Cleanup | Admin and Editor can open the dedicated Settings sidebar section without Developer Mode; Member and Viewer cannot see or activate it; all eight requested groups begin collapsed, expand independently, show accurate counts, and open the affected person or relationship; every exact placeholder name part is identified even when another valid name exists; intentionally blank Unknown people remain supported; current partner-address comparison ignores ended partnerships and absent addresses |
| Tree | Summary vs Details; name basis/length; focus/full tree; partner order/lines; adoption/non-Lineal toggle; zoom/pan/scroll; selection and panel resize |
| List/search | Fuzzy three-name search; favorites picker; living/contact filters; first/last sort; alphabet jump; role-redacted search fields |
| Profile/Notes | Complete known/unknown values; clickable relatives; role visibility; Developer-only Imported Source; Notes last and editor-only |
| CSS/responsive | No horizontal page overflow; dialogs/sheets fit viewport; visible focus; 200% text; reduced motion; light/dark/system |
| PWA/offline | Install metadata; first online load; second offline reload; update prompt; Reload activates new worker; vault is not served from cache |
| Tree and Outline | Tree sibling branches center beneath their specific parent or parent couple, retain those parents' left-to-right order when a later branch is wider, and never overlap neighboring family branches; the central icon-over-label switch swaps between matching Tree and Outline toolbars; Outline has no separate title/eyebrow header; View, Name Preferences, and the compact Root control share one horizontal alignment; Name Preferences update Outline names; the searchable root picker contains only the Root Ancestor and Lineal descendants, filters as typed, shows the chosen root's total Outline people in a pill, and Reset Root restores the Root Ancestor; Generation labels stay Root-Ancestor-relative when the Outline root changes; every action stacks its icon above its label; Expand All and Condense All put capitalized All on line two; Condense Lineage appears immediately before Lineage with its requested shared icon, is disabled without an in-scope selected person, collapses branches outside the selected person's direct lineage, and leaves the selected person's entire descendant subtree expanded; Root/Expand/Condense use their requested shared icons with outward Expand and inward Condense artwork rotated 90 degrees; branch controls show `>` when condensed and `v` when expanded; every person occupies one compact line; fully known birth/death dates have visible line separation without increasing row height; selecting or searching a visible person reveals the path and vertically centers that person's row, including a selected visible spouse; only the latest spouse or partner appears with the same consistent card width as Lineal people and a neutral edge; no partner placeholder appears; relationship type/date occupy two centered bar lines; branch collapse and lineage highlighting remain correct |
| Print | Every Directory, Labels, Groups, Outline, and Tree action opens an in-app preview before native print; the preview header places icon-and-text Print beside Close; Tree and Outline actions are labelled Print and share the printer symbol while the Tree view retains its tree symbol; Directory, Groups, Outline, and Labels use Letter portrait while Tree alone uses Letter landscape; Directory, Groups, and Outline show fixed Letter preview sheets, page counts, and preview gaps, then use matching native breaks without alternating blank pages; they reuse native print typography/grids so simulated fill is accurate; Outline uses one explicit 8.5-by-11-inch physical sheet per planned page, a zero-margin `@page`, and true half-inch internal padding on every side; repeated report headings; rows/cards never split or overflow their sheet; the native PDF page count equals the planned Outline page count with no orphan continuation sheets; Outline fills portrait pages with up to 44 currently expanded compact rows, omits the chevron gutter, keeps Generation close to the person card, and wraps full names instead of clipping; maps absent from Directory; Full Tree pages never exceed eight generation levels or ten people in one generation row, while focused Lineage pages never exceed twelve levels or sixteen people across; Tree always prints at 100% regardless of live zoom, repeats a boundary level vertically, keeps partner groups together when possible, keeps a descendant branch with its parent when dividing horizontally, collision-packs repeated parent/spouse context without overlapping cards, compacts Details metadata onto one row except for Developer references, and labels level/across sections; no controls/P ids/source/Notes; all allowed people and contacts present |
| Save layout | Two-line header tiles show signed-in identity, dataset/date, and GitHub status; publication controls read title, one-line publisher, equal-height next patch, Bulk Upload, Update; summary uses an inline placeholder and every calculated change occupies its own row |
| Tree defaults | Fresh Ancestors/Descendants are 10; a pre-0.0.1.105 persisted Descendants value of 3 migrates once to 10; a newly selected 3 remains selectable; generation rows use a 40px gap; percentage steppers change zoom by 5%; Reset appears between In and Fit with an icon above its label and restores 100%; native Tree print requests letter landscape |

Always watch console/page errors. Check accessible names, focus restoration, Escape/close behavior, touch targets, and unsafe text such as `<script>`, quotes, commas, newlines, and spreadsheet-formula prefixes when the changed area accepts input.

## Tier 3 — release gate

Run Tier 1, then complete all of the following before `cut`:

1. **Version surfaces:** config version/build and sole release entry, every HTML query/label, service-worker cache/asset version, Pages workflow name, README, handoff, and release date agree. A major/minor/patch cut resets build to `1`.
2. **Clean-device access matrix:** Admin, each named Editor, Member, Viewer, wrong password, revoked password, and shared/duplicate-password rejection. Confirm source/edit/export/Directory visibility exactly matches the role contract, including Admin-only Favorites restore and Developer Mode starting off for every non-Admin grant.
3. **Private recovery:** offline-store a current Editor ZIP securely, import it on a clean local browser, validate counts and home person, export again, and reopen the result. Never add it to Git.
4. **Publication:** test connection with the intended fine-grained token; publish a harmless synthetic change in a safe test vault or verify production only when authorized; confirm revision, dataset patch, audit actor/details, stale-tab conflict, and Git history rollback instructions.
5. **Family scenarios:** single person, multiple/current/former partners, adoption with multiple Non-Lineal parents, disconnected component, pedigree collapse, missing dates, presumed deceased, international address, and a large synthetic family near supported limits.
6. **Print:** inspect cover, maps, root/Generation 3 grouping, special Lineal styling, compact directory, living/deceased dates, household partners/phone/address, page breaks, and light/dark source modes.
7. **Accessibility/responsive:** screen-reader spot check of tree relationships and dialogs, keyboard traversal/shortcuts, focus after close/delete, reduced motion, 200% text, mobile orientation, touch pan/zoom, and no clipped controls.
8. **PWA/deploy:** manifest parse, icons/startup images, fresh install, online→offline reload, prior-worker→new-worker update, and production URL smoke test after the checked-in Pages workflow succeeds. Confirm its notification name and Actions run title show the current app/version and versioned commit subject, and that live HTML, config, and service worker report the same version.
9. **Security:** rotate development passphrases/tokens, confirm token repository scope is minimal, inspect public vault metadata only (never print ciphertext or secrets), and search the diff for private names/addresses/contact data.
10. **Repository:** clean status except release files, no ignored artifact accidentally forced into Git, Pages uses GitHub Actions only with no simultaneous branch publisher or second deployment workflow, and preview server stopped.

## 1.0 decision record

Before the first 1.0 cut, explicitly accept these static-app limits:

- passphrases are bearer secrets, not identities or MFA accounts;
- read-only visits cannot be audited by GitHub;
- concurrent edits are serialized only at publication through remote revision checks;
- rollback is a manual Git-history operation;
- browser print/PDF varies slightly by engine;
- very large family trees prioritize navigability over a single-page overview.

If any of those must change, it is a product/architecture project, not release cleanup.
