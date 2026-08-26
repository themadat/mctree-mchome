# McFamily package and CSV contract

Inside every hosted encrypted record, McFamily stores one complete ZIP package. Owner and Editor may also import or export that same structure as a private recovery file. The current dataset `17.0.x` series and package format `mcfamily-package` version `1` require exactly these five UTF-8 CSV files at the ZIP root:

```text
McPeople.csv
McPlaces.csv
McRelations.csv
McResidences.csv
McMetadata.csv
```

Loose CSVs, nested directories, missing files, extra files, encrypted ZIP entries, unsupported compression, damaged checksums, and packages larger than 5 MB are rejected. ZIP entries may be stored or deflated. These files contain sensitive plaintext even though they are packaged in a ZIP; store recovery copies privately and never commit a real package or extracted family file.

The hosted `mcfamily-encrypted-vault` JSON envelope is different from a ZIP. It contains AES-GCM ciphertext for separate full and redacted ZIP payloads, public non-secret revision metadata, and passphrase-wrapped data keys for active grants. The public vault never contains a passphrase, GitHub token, or readable CSV filename/content. McFamily validates the envelope first, decrypts only the payload authorized for the selected grant, and then applies every ZIP and CSV check documented below.

CSV uses RFC 4180-style quoting. Every file has one exact, ordered, hyphenated header row. McFamily rejects missing, additional, duplicate, renamed, underscore-form, or reordered columns rather than guessing or migrating older schemas. The only transition exception is the Admin-only opening of the already-hosted dataset 16 vault described below; no v16 ZIP can be selected as an ordinary or bulk import. Export escapes formula-looking cell values, and the importer removes only the corresponding export escape.

## McPeople.csv

One stable person per row. Parent and partner fields are not stored here.

```text
record-id,person-name-birth-prefix,person-birth-name-first,person-birth-name-middle,person-birth-name-last,person-birth-name-suffix,person-name-current-prefix,person-current-name-first,person-current-name-middle,person-current-name-last,person-current-name-suffix,person-name-preferred-prefix,person-preferred-name-first,person-preferred-name-middle,person-preferred-name-last,person-preferred-name-suffix,person-name-maiden-last,lineage-id,person-date-birth-value,person-date-birth-descriptor,person-date-death-value,person-date-death-descriptor,notes,source-last-modified-date,source-last-modified-by,source-row-number,data-quality-notes
```

- `record-id` is a unique `P` reference with at least three digits, such as `P001`.
- Birth First/Last and Current First/Last are required. Each Birth, Current, and Preferred name has Prefix, First, Middle, Last, and Suffix parts. Maiden Last is separate.
- Display preference remains Preferred, then Current, then Birth.
- `lineage-id` is a unique root-to-person path of two-digit dotted segments. Each non-root path must extend its Lineal parent's path by one segment. When an Editor creates a Lineal parent link, McFamily previews and assigns this path automatically, preserving a valid existing child segment or using the next available `01`–`98` segment. Compatibility value `99` remains the unresolved `??` lineage.
- Known dates use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. Question-mark partial dates use the same shapes and the `partial` descriptor.
- Birth descriptors are `year`, `month`, `day`, `partial`, or `UNKNOWN` and cannot be blank.
- A blank death date requires `NONE`, `UNKNOWN`, or `UNKNOWN PRESUMED`, meaning living, deceased with unknown date, or presumed deceased. A known death date uses `year`, `month`, `day`, or `partial`.

## McPlaces.csv

One reusable physical place per row.

```text
place-id,place-label,address-line-1,address-line-2,city,region,postal-code,country,notes,source-last-modified-date,source-last-modified-by,source-row-number,source-pcard,source-notes
```

`place-id` is a unique `L` reference with at least four digits. At least one physical-address field must be present. People do not embed these address fields; `McResidences.csv` links them. Dataset 17 uses McPlaces schema `2.0.0`; its final three source fields preserve the McDirectory row lookup number, pcard, and source Notes. Source modification date and actor remain separate. Those source properties are visible only to Owner/Editor while Developer Mode is enabled.

The private dataset 17.0.0 package contains the approved McDirectory address records. Their values remain only in ignored private working files and the encrypted hosted vault.

## McRelations.csv

One authoritative Person-to-Person relationship per row.

```text
relationship-id,relationship-type,person-1-id,person-2-id,parent-lineage,parent-type,partner-type,relationship-order,date-start-value,date-start-descriptor,date-end-value,date-end-descriptor,end-reason,place-id,notes,source-last-modified-date,source-last-modified-by
```

For `parent-child`, `person-1-id` is the parent and `person-2-id` is the child. `parent-lineage` is `lineal` or `non-lineal`, while `parent-type` is independently `biological`, `adoptive`, `step`, `foster`, `guardian`, or `unknown`; partner-only fields must be blank. A child may have at most one Lineal parent and any number of distinct Non-Lineal parents. A Non-Lineal parent does not need a partner row connecting them to the Lineal parent. The earlier `parent_consanguinity_person_id` and `parent_affinal_person_id` fields are now represented by explicit Lineal and Non-Lineal relationship rows. This applies the requested `parent_lineal_person_id` / `parent_non-lineal_person_id` terminology without reintroducing singular person columns that cannot represent multiple parents.

For `partner`, both person IDs are unordered partners, both parent fields are blank, and `partner-type` is `marriage`, `partnership`, or `UNKNOWN`. `end-reason` is `death`, `divorce`, `separation`, `annulment`, `UNKNOWN`, or blank. A blank reason means no recorded ending. Editors can update both fields independently from the partner row in a selected-person profile; an entered end date requires an end reason. `relationship-order` is a positive chronological sequence used when dates do not establish order.

Relationship IDs are unique. Both people and an optional `place-id` must resolve. Self-links, duplicates, inconsistent type-specific fields, invalid date pairs, and ancestry cycles are rejected.

## McResidences.csv

One Person-to-Place assignment per row.

```text
residence-id,person-id,place-id,residence-label,is-current,date-start-value,date-start-descriptor,date-end-value,date-end-descriptor,notes,source-last-modified-date,source-last-modified-by
```

`residence-id` is a unique `RS` reference with at least four digits. `person-id` and `place-id` must resolve, `is-current` is exactly `TRUE` or `FALSE`, and duplicate person/place/start-date assignments are rejected.

Dataset 17.0.0 assigns the approved current `Home` residences from the reviewed McDirectory report. Actual identifiers and addresses remain private.

## McMetadata.csv

Metadata makes the package self-describing and auditable.

```text
metadata-id,metadata-type,subject,key,value,recorded-at,recorded-by,details
```

Required single-value rows declare:

- package format, package version, dataset version, and people/relationship/place/residence counts;
- access mode as `editor`, `pii-viewer`, or `redacted-viewer`;
- family title, initialized timestamp, home person, created/updated timestamps, Notes, and settings JSON;
- schema `2.0.0` exactly once for `McPlaces.csv` and `McRelations.csv`, and schema `1.0.0` exactly once for each other filename.

At least one `audit` row is required. Audit rows record a stable ID, file or package subject, action, timestamp, actor, and details. Imports and exports append audit events, and the full history remains in future exports. Declared counts must exactly match the other four files; the home person must resolve.

An Editor package contains the full record and enables application editing when opened by an Owner or Editor grant. A Member package contains the same full record but opens read-only and retains the stable internal access value `pii-viewer`. The family `settings-json` carries compatibility details that have no dedicated column in the five current schemas: labelled phone/email arrays, gender/pronouns, life places, heritage background, and free-text relationship place. Addresses remain authoritative McPlaces plus McResidences records. A Viewer package retains the stable internal value `redacted-viewer` and must have zero McPlaces and McResidences rows, blank family Notes, blank person and relationship notes, no relationship place references, and no supplemental profile/relationship detail maps. Export also clears contact arrays and unstructured notes before CSV generation and scrubs audit actors/details. The importer rejects a package labelled `redacted-viewer` if those structural redaction rules do not hold. Package access mode is still validated after hosted decryption; physical redaction, rather than a UI flag, removes private fields from the Viewer payload.

Hosted family publications increment the final dataset patch number (`17.0.0` → `17.0.1` → `17.0.2`) while all five schemas remain unchanged. Each normal publication appends a `published-hosted-family` audit event; a major Admin package cutover appends `published-bulk-package`; passphrase changes append a hosted-access event without recording secrets. A publication based on an earlier vault revision or changed GitHub file SHA is rejected and must be reapplied after reload.

## Import transaction

McFamily parses into a candidate state before touching the current family. Validation covers ZIP integrity and contents, five exact schemas, required metadata, dataset/package versions, CSV shape and limits, IDs, counts, date descriptors, names, Lineage paths, relationship rules, Person-to-Place links, and ancestry cycles. A successful preview reports record counts and the number of validation groups that passed. Any failure reports the reason and leaves current browser data unchanged.

Normal launch requires a current hosted vault, an active passphrase, and an initialized decrypted family with at least one valid person. Before the first vault exists, the Owner may use the explicit recovery control to open one valid Editor ZIP and create initial hosted access. Later recovery imports are Owner/Editor-only, show a comparison, and require confirmation. In hosted use the encrypted GitHub version remains unchanged until Update; local-only setup may save one browser recovery snapshot before replacement. Imports never merge concurrent copies.

Admin may instead choose Bulk Upload in Audit for a complete newer dataset package. McFamily runs the same strict package validation before showing a record-count and change review, requires an audit summary, verifies the GitHub revision and SHA, encrypts full and redacted views with the existing active grants, publishes the vault, and only then replaces the one local working copy. The prior version remains recoverable through GitHub history. The dataset 17 cutover build can open the existing dataset `16.0.x` hosted vault for Admin only; ordinary imports remain dataset 17-only, and normal Update plus access changes remain blocked until Admin publishes the validated v17 package.

## Private conversion helper

`scripts/build-mcfamily-package.mjs` converts the ignored private dataset 15 ZIP into dataset 16. It upgrades McRelations to schema 2.0, records the first adoption with multiple Non-Lineal biological parents, appends the required person and audit rows, and writes the five files as one uncompressed ZIP. Its default input and output are ignored by Git. Run it only where the private source package is already available:

```sh
node scripts/build-mcfamily-package.mjs
```

`scripts/build-v17-address-package.mjs` executes the approved McDirectory address-assignment report against the latest private dataset 16 package. It creates McPlaces schema 2 records, residence links, phone/email details, and audit events, validates the resulting counts and references, then writes and reopens one dataset 17 ZIP. The one blocked contact-only row is intentionally omitted rather than guessed:

```sh
node scripts/build-v17-address-package.mjs
```

The ZIP is the complete editable transfer artifact. Print / Save PDF remains the readable, non-importable distribution artifact.
