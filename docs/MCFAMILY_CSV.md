# McFamily CSV contract

McFamily accepts two private CSV shapes. Both contain sensitive plaintext and must be stored privately. Real family source files are ignored under `assets/data/` and must never be added to the published GitHub Pages repository.

## McLineage v14 source

The initial source is selected through the first-launch file picker. McFamily accepts only this exact 30-column v14 header row, in this order:

```text
record-id,person-name-birth-prefix,person-birth-name-first,person-birth-name-middle,person-birth-name-last,person-birth-name-suffix,person-name-current-prefix,person-current-name-first,person-current-name-middle,person-current-name-last,person-current-name-suffix,person-name-preferred-prefix,person-preferred-name-first,person-preferred-name-middle,person-preferred-name-last,person-preferred-name-suffix,person-name-maiden-last,lineage-id,parent-consanguinity-person-id,parent-affinal-person-id,person-date-birth-value,person-date-birth-descriptor,person-date-death-value,person-date-death-descriptor,partner-relationships-json,notes,source-last-modified-date,source-last-modified-by,source-row-number,data-quality-notes
```

Top-level McLineage headers use hyphens. McFamily rejects missing, additional, reordered, or underscore-named source columns instead of adapting an earlier source schema.

Each row represents exactly one person and uses a stable `P` reference such as `P001` in `record-id`. `lineage-id` is the complete lineage path from the oldest recorded ancestor to that person, with every child position stored as a two-digit dotted segment. For example, P044 is `01`, P228 is `01.01`, and P501 is `01.01.01.03.02.02.04.02.01.01`. `parent-consanguinity-person-id` directly references the Lineal parent row's `record-id`; `parent-affinal-person-id` optionally references the recorded partner row that is also a parent. Partner-only rows intentionally leave `source-row-number`, `lineage-id`, and both parent fields blank. `source-row-number` is the penultimate source column immediately before `data-quality-notes`.

Every person stores three five-part names: Birth, Current, and Preferred. Each has Prefix, First, Middle, Last, and Suffix, and each part may itself contain multiple words. Maiden Last Name is stored separately when Current Last differs from Birth Last. McFamily displays Preferred first, then Current, then Birth. A missing required Birth or Current First/Last is written as `UNKNOWN`; optional name parts remain blank.

The compatibility lineage value `99` remains stored in CSV for unplaced Lineal records. McFamily displays that segment as `??`; the Family Tree hides those records by default and exposes them with Show ?? Lineal.

`partner-relationships-json` is blank when the person has no recorded partners; otherwise it contains one JSON array. Each relationship is stored exactly once, on its originating person's row. Nested JSON property names remain underscored because they are values inside the CSV cell, not top-level headers. A current object has this shape:

```json
[{"relationship_id":"R001","partner_person_id":"P608","relationship_type":"marriage","relationship_order":1,"date_start_value":"1972-05-06","date_start_descriptor":"day","date_end_value":"","date_end_descriptor":"","end_reason":""}]
```

`relationship_id` is a stable `R` reference. `partner_person_id` must resolve to another person row. `relationship_type` is `marriage`, `partnership`, or `UNKNOWN`; `relationship_order` is a chronological 1..n sequence per person, oldest partnership first; it orders partnerships that have no start date. An out-of-wedlock partnership is recorded as `relationship_type` `partnership` with a blank start date and its own order, and it reads Never married regardless of its end reason. Start and end descriptors are `year`, `month`, `day`, `partial`, `UNKNOWN`, or blank and must match their values. `end_reason` is `death`, `divorce`, `separation`, `annulment`, `UNKNOWN`, or blank. A blank reason means no ending is recorded. Death, divorce, and separation map to widowed, divorced, and separated; annulment and `UNKNOWN` both map to former, because any recorded reason means the partnership ended even when the cause is not known. A relationship without an ending maps to married, partnered, or unknown from its type. Display status then uses both people's living status without changing the CSV: a marriage ended by death reads Married when both spouses are deceased, while a living spouse whose unended current partner is deceased reads Widowed. A person whose every partnership carries an end reason has no current partner in the tree or profile.

Missing partner references, self-links, duplicate `R` IDs, duplicate person pairs, malformed JSON, and inconsistent date fields are rejected. A unique, resolvable `parent-consanguinity-person-id` becomes the internal `biological` Lineal parent link. A populated `parent-affinal-person-id` becomes the internal `affinal` Non-Lineal parent link, and the two parent IDs must form a recorded partner pair. The Family Tree draws Lineal links as faded muted-red bloodline edges and Non-Lineal links only as the lighter dashed branch shown by Non-Lineal Lines.

Current dates use `person-date-birth-value`, `person-date-birth-descriptor`, `person-date-death-value`, and `person-date-death-descriptor`. Known values use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. A partial value may replace unknown digits anywhere with `?` and must use the `partial` descriptor. Birth descriptors are exactly `year`, `month`, `day`, `partial`, or `UNKNOWN`, and are never blank. A blank death value must use exactly `NONE`, `UNKNOWN`, or `UNKNOWN PRESUMED`: `NONE` means no death is recorded and the person is living, `UNKNOWN` means the person is explicitly deceased but the date is not known, and `UNKNOWN PRESUMED` means McLineage's age, early-generation, or partner evidence presumes the person deceased. A known death value uses `year`, `month`, `day`, or `partial` and marks the person deceased. `invalid` and blank descriptors are not accepted.

Partner start and end values inside `partner-relationships-json` retain the earlier known/partial/UNKNOWN-or-blank rule; `NONE` and `UNKNOWN PRESUMED` are person-death descriptors only. Partial source dates remain in source details and are reported separately because McFamily's editable/native date values remain normalized known dates. Profiles and print still display the partial value itself with `??` and `????` placeholders and compute an approximate `~` age from its known prefix. Other unrecognized source values are retained and reported rather than guessed. Notes and data-quality notes remain distinct. Every current source column is also retained in the person's source field map so an import does not silently discard information. The four obsolete legacy male/female directory-display columns are not part of v14; structured Birth, Current, Preferred, and Maiden names are authoritative.

McFamily does not overwrite or rewrite the selected source file. After edits, export a native McFamily CSV as the new canonical working copy.

## Native McFamily CSV

Native exports use UTF-8, RFC 4180-style quoting, and this fixed header row:

```text
mcfamily_csv_version,record_type,id,person_id,family_title,initialized_at,home_person_id,created_at,updated_at,order,birth_prefix,birth_first,birth_middle,birth_last,birth_suffix,current_prefix,current_first,current_middle,current_last,current_suffix,preferred_prefix,preferred_first,preferred_middle,preferred_last,preferred_suffix,maiden_last_name,living_status,gender,pronouns,birth_date,birth_date_qualifier,birth_place,death_date,death_date_qualifier,death_place,heritage_note,person_notes,address_label,address_current,address_line_1,address_line_2,city,region,postal_code,country,address_start_date,address_start_qualifier,address_end_date,address_end_qualifier,address_notes,contact_label,contact_value,relationship_type,parent_id,child_id,parent_kind,person_1_id,person_2_id,partner_status,relationship_start_date,relationship_start_qualifier,relationship_end_date,relationship_end_qualifier,relationship_place,relationship_notes,family_notes,source_json,settings_json
```

`mcfamily_csv_version` is `mcfamily-csv-v2` on every row. `record_type` determines which columns are used:

- `family`: family title, initialization time, and home person
- `person`: one complete structured profile, including all 16 dedicated naming columns
- `address`, `phone`, `email`: repeatable contact entries linked by person `id`
- `relationship`: a parent-child or partner record
- `note`: the single Family Notes document
- `settings`: preferences, UI state, modules, and metadata encoded in `settings_json`

`source_json` preserves source provenance and unmapped cleaned-source values. `settings_json` preserves state that does not fit a tabular person row. These cells contain JSON values inside CSV fields; they do not make the file a JSON backup.

## Validation and replacement

- First launch requires at least one valid person.
- Later imports may contain an initialized empty family.
- Imports validate unique IDs, references, self-links, duplicate links, and ancestry cycles.
- Imports replace the current workspace after preview and confirmation; they never merge concurrent copies.
- Replacement creates a recovery snapshot first.
- Files are limited to 5 MB, 12,000 rows, 200 columns, 1,500 people, and 6,000 relationships.
- Formula-looking cells are escaped on export to reduce spreadsheet formula injection risk and restored only when read back as a native McFamily CSV.

The native export is the complete editable transfer artifact. Print / Save PDF is the readable distribution artifact and is not re-importable.
