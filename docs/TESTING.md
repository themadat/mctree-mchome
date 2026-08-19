# Verification checklist

Use synthetic families only.

## Automated baseline

- [ ] Every JavaScript file and `sw.js` passes `node --check`.
- [ ] Both manifests parse as JSON.
- [ ] Every local HTML `src`/`href`, manifest icon, and service-worker shell path exists.
- [ ] `git diff --check` is clean.
- [ ] The visible version, build id, asset queries, newest release, cache name, and asset version all match.
- [ ] No console errors appear during tested workflows.

## Initialization, migration, and portability

- [ ] A fresh profile shows only the introduction, privacy warning, and CSV picker.
- [ ] No demo family, blank-family action, GEDCOM action, or bypass appears.
- [ ] A valid cleaned McLineage or native McFamily CSV with at least one person shows a summary and opens the family.
- [ ] Unknown headers, missing required cells, zero-person first import, malformed CSV, oversized file, duplicate ids, unsafe headers, self-links, duplicate links, and ancestry cycles are rejected without replacing state.
- [ ] Cleaned-source orphan parent references and non-normalized dates are reported and remain available in source details.
- [ ] Legacy schema states migrate without losing Notes or retained compatibility fields.
- [ ] Export/import round trips every person field, relationship field, preference, and Note.
- [ ] Later replacement creates recovery before changing state; Restore recovery returns the prior family.
- [ ] Private export and PDF warnings are visible.
- [ ] Reload restores the current family, selection, tree mode, node detail mode, collapsed panes, filters, theme, and Notes.

## Editing and derived relationships

- [ ] Add and edit a person with partial dates, qualifiers, non-Latin text, international address lines, phones, email, heritage, and notes.
- [ ] Add and remove repeated contacts without losing adjacent entries.
- [ ] Connect biological, adoptive, step, foster, guardian, and unknown parents.
- [ ] Connect every partner status with dates, place, and notes.
- [ ] Self-link, duplicate-link, missing-reference, and ancestry-cycle errors are clear and non-destructive.
- [ ] Parents, children, partners, siblings, ancestors, descendants, and lineage labels update from relationships.
- [ ] Set Home changes the focus root.
- [ ] Deleting a person confirms, snapshots, removes attached links, and can recover.
- [ ] Deleting the final person leaves an initialized empty workspace with Add Person.

## Tree and directory

- [ ] Focus mode shows the selected/home person's configured ancestor and descendant depth plus partners and siblings.
- [ ] Overview contains every connected component and isolated person.
- [ ] Single-person, multi-partner, adopted, disconnected, pedigree-collapse, and 1,500-person synthetic families render without exceptions.
- [ ] Pan, wheel/pinch zoom, zoom buttons, Fit, Reset, node click, and generation depth work.
- [ ] Arrow keys move between rendered nodes and Enter/Space selects.
- [ ] Every node and relationship has an understandable accessible label.
- [ ] Condensed cards are the default and show separate given/family name lines plus birth/death years, with no avatar or identifier; Detailed restores the fuller card.
- [ ] Partner pairs are adjacent when possible; married lines are solid, divorced lines are dotted, and other partner states remain distinguishable.
- [ ] Directory and selected-person panes collapse independently on desktop and can be reopened without losing selection or tree focus.
- [ ] Directory sorting and living/deceased/unknown filters work.
- [ ] Partial and in-order fuzzy search finds name, address, phone, email, birth/death place, heritage, general notes, Notes, Help, releases, and Roadmap.
- [ ] Heritage shows the imported name line and Lineage ID; activating the name line toggles the relationship-derived Son/Daughter/Child reading.
- [ ] A child listed from a parent's profile is labelled `Child`, without a redundant parent-kind suffix.

## Responsive and accessibility

- [ ] At 1280px, 768px, and 390px, page and body widths do not exceed the viewport.
- [ ] Desktop shows coordinated directory, tree, and detail panes.
- [ ] Mobile People/Tree/Profile tabs are touch-sized; choosing a person opens Profile.
- [ ] Dialogs fit the mobile viewport with one usable scrolling surface.
- [ ] Labels, landmarks, focus order, visible focus, live regions, and focus restoration are correct.
- [ ] Escape closes temporary UI; `/`, `?`, `N`, `V`, `T`, and supported navigation keys work outside fields.
- [ ] Reduced-motion mode removes nonessential animation.
- [ ] Light and dark themes retain readable contrast and status text.

## Print / Save PDF

- [ ] Report includes cover, statistics, relationship legend, alphabetical index, every family component, every person, and Family Notes.
- [ ] Every recorded contact, life, heritage, note, and relationship value appears.
- [ ] Person `P` and component `F` references remain stable within the report.
- [ ] Large components split by generation instead of shrinking one giant tree.
- [ ] Application controls are suppressed and print colors remain legible.
- [ ] Profiles and section headings use sensible page breaks; long addresses and URLs remain complete.
- [ ] Representative browser Save as PDF output is visually inspected.

## Offline and installation

- [ ] A fresh online load installs the current service worker and caches all shell assets.
- [ ] Reload works offline with the locally stored family.
- [ ] The worker does not cache or transmit family data.
- [ ] A build change shows the new-version toast and Force refresh activates the waiting worker.
- [ ] Both manifests install with correct McFamily identity and light/dark icons.
