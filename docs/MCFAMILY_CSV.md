# McFamily CSV contract

McFamily accepts two private CSV shapes. Both contain sensitive plaintext and must be stored privately. Real family source files are ignored under `assets/data/` and must never be added to the published GitHub Pages repository.

## Cleaned McLineage source

The initial source is selected through the first-launch file picker. McFamily recognizes it from these required headers:

- `record_id`, `lineage_id`, and `lineage_parent_id`
- `descendant_first_names` and `descendant_last_name`

Current McLineage rows use stable `P` record references such as `P001`. `lineage_id` stores two-digit child positions from the person toward the lineage root, so a former root-to-person value such as `3.05.02.02` is represented as `02.02.05.03`. `legacy_page_reference` immediately follows `lineage_id`. `lineage_parent_id` directly references the parent row's `record_id`; `lineage_parent_name_full` repeats that person's full name for human readability but is not authoritative.

When present, descendant birth/death fields, the three spouse groups, legacy relationship status, notes, modification metadata, and data-quality fields are mapped too. Each source row becomes one primary person. Non-empty spouse slots become separate people and explicit partner relationships. When multiple spouse slots are populated, earlier slots are treated as divorced history and the final populated slot receives the row's current legacy relationship status. A unique, resolvable `lineage_parent_id` becomes a parent-child link with an unknown type. Missing or duplicate references are skipped and reported in the preview; the original values remain in source details. Older cleaned files that use `parent_lineage_id` and lineage-name columns remain importable for compatibility.

Current descendant dates use `descendant_date_birth_value`, `descendant_date_birth_descriptor`, `descendant_date_death_value`, and `descendant_date_death_descriptor`. Values are blank or use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`; nonblank descriptors are exactly `year`, `month`, `day`, or `UNKNOWN`. Birth descriptors are never blank. A blank death descriptor means living, while `UNKNOWN` means deceased with no normalized death value. G0-G4 descendants without a known death date use `UNKNOWN`. Older `descendant_birth_date_*` and `descendant_death_date_*` columns remain importable for compatibility.

Other source date values are retained in source details and reported rather than guessed. Notes and data-quality notes remain distinct. Every original source column is also retained in the person's source field map so an import does not silently discard information.

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
