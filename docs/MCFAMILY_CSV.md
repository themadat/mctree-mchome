# McFamily CSV contract

McFamily accepts two private CSV shapes. Both contain sensitive plaintext and must be stored privately. Real family source files are ignored under `assets/data/` and must never be added to the published GitHub Pages repository.

## Cleaned McLineage source

The initial source is selected through the first-launch file picker. McFamily recognizes it from these base headers:

- `record_id`, `lineage_id`, `parent_consanguinity_person_id`, and `parent_affinal_person_id`
- `person_first_names` and `person_last_name`
- `person_date_birth_value`, `person_date_birth_descriptor`, `person_date_death_value`, and `person_date_death_descriptor`
- `partner_relationships_json`

Every header above is required. McFamily reads only this current schema: earlier `descendant_*` date columns, `spouse_#_*` slots, `lineage_parent_id`, `parent_lineage_id`, `lineage_level_##_name`, `root_ancestor_##_name`, and `legacy_page_reference` sources are no longer importable, and a McLineage CSV missing any current column is rejected with the missing column names.

Current McLineage rows use stable `P` record references such as `P001`, and every row represents exactly one person. `record_id` is the first column. `lineage_id` is the complete lineage path from the oldest recorded ancestor to that person, with every child position stored as a two-digit dotted segment. For example, P044 is `01`, P228 is `01.01`, and P501 is `01.01.01.03.02.02.04.02.01.01`. `parent_consanguinity_person_id` directly references the bloodline parent row's `record_id`; `parent_affinal_person_id` optionally references the recorded partner row that is also a parent. Partner-only rows intentionally leave `source_row_number`, `lineage_id`, and both parent fields blank. `person_name_sort` follows `person_last_name`, and `source_row_number` is the penultimate source column immediately before `data_quality_notes`. Former legacy page references are prefixed to `data_quality_notes` and are no longer a separate column.

`partner_relationships_json` is blank when the person has no recorded partners; otherwise it contains one JSON array. Each relationship is stored exactly once, on its originating person's row. A current object has this shape:

```json
[{"relationship_id":"R001","partner_person_id":"P608","relationship_type":"marriage","relationship_order":1,"date_start_value":"1972-05-06","date_start_descriptor":"day","date_end_value":"","date_end_descriptor":"","end_reason":""}]
```

`relationship_id` is a stable `R` reference. `partner_person_id` must resolve to another person row. `relationship_type` is `marriage`, `partnership`, or `UNKNOWN`; `relationship_order` is a positive integer used for deterministic history ordering. Start and end descriptors are `year`, `month`, `day`, `partial`, `UNKNOWN`, or blank and must match their values. `end_reason` is `death`, `divorce`, `separation`, `annulment`, `UNKNOWN`, or blank. A blank reason means no ending is recorded. Death, divorce, and separation map to widowed, divorced, and separated; annulment and `UNKNOWN` both map to former, because any recorded reason means the partnership ended even when the cause is not known. A relationship without an ending maps to married, partnered, or unknown from its type. Widowed, divorced, separated, and former are past states, so a person whose every partnership carries an end reason has no current partner in the tree or profile.

Missing partner references, self-links, duplicate `R` IDs, duplicate person pairs, malformed JSON, and inconsistent date fields are rejected. A unique, resolvable `parent_consanguinity_person_id` becomes the `biological` parent link. A populated `parent_affinal_person_id` becomes an `affinal` parent link, and the two parent IDs must form a recorded partner pair. The Family Tree draws `biological` links as solid bloodline edges and `affinal` links only as the lighter dashed branch shown by the Affinal Lines toggle.

Current dates use `person_date_birth_value`, `person_date_birth_descriptor`, `person_date_death_value`, and `person_date_death_descriptor`. Known values use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. A partial value may replace unknown digits anywhere with `?` and must use the `partial` descriptor. Other nonblank descriptors are exactly `year`, `month`, `day`, or `UNKNOWN`; `invalid` is not accepted. Birth descriptors are never blank. A known death value marks the person deceased. When no death value is recorded, a known birth date beyond age 100 presumes death, a known birth date within 100 years means living, and a missing birth value means unknown. A blank or `UNKNOWN` death descriptor does not by itself mark someone deceased, and lineage position never does.

Partner start and end values inside `partner_relationships_json` follow the same known/partial rule. Partial source dates remain in source details and are reported separately because McFamily's editable/native date values remain normalized known dates. Profiles and print still display the partial value itself with `??` and `????` placeholders and compute an approximate `~` age from its known prefix. Other unrecognized source values are retained and reported rather than guessed. Notes and data-quality notes remain distinct. Every current source column is also retained in the person's source field map so an import does not silently discard information, including the `legacy_male_display_*`, `legacy_female_display_*`, and `retain_maiden_name` compatibility columns that the current file still carries.

McFamily does not overwrite or rewrite the selected source file. After edits, export a native McFamily CSV as the new canonical working copy.

## Native McFamily CSV

Native exports use UTF-8, RFC 4180-style quoting, and this fixed header row:

```text
mcfamily_csv_version,record_type,id,person_id,family_title,initialized_at,home_person_id,created_at,updated_at,order,given_name,middle_name,family_name,birth_name,preferred_name,suffix,display_name,living_status,gender,pronouns,birth_date,birth_date_qualifier,birth_place,death_date,death_date_qualifier,death_place,heritage_note,person_notes,address_label,address_current,address_line_1,address_line_2,city,region,postal_code,country,address_start_date,address_start_qualifier,address_end_date,address_end_qualifier,address_notes,contact_label,contact_value,relationship_type,parent_id,child_id,parent_kind,person_1_id,person_2_id,partner_status,relationship_start_date,relationship_start_qualifier,relationship_end_date,relationship_end_qualifier,relationship_place,relationship_notes,family_notes,source_json,settings_json
```

`mcfamily_csv_version` is `mcfamily-csv-v1` on every row. `record_type` determines which columns are used:

- `family`: family title, initialization time, and home person
- `person`: one complete structured profile
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
