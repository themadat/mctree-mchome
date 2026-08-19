# McFamily CSV contract

McFamily accepts two private CSV shapes. Both contain sensitive plaintext and must be stored privately. Real family source files are ignored under `assets/data/` and must never be added to the published GitHub Pages repository.

## Cleaned McLineage source

The initial source is selected through the first-launch file picker. McFamily recognizes it from these required headers:

- `record_id`, `lineage_id`, `parent_consanguinity_person_id`, and `parent_affinal_person_id`
- `person_first_names` and `person_last_name`

Current McLineage rows use stable `P` record references such as `P001`, and every row represents exactly one person. `record_id` is the first column. `lineage_id` is the complete lineage path from the oldest recorded ancestor to that person, with every child position stored as a two-digit dotted segment. For example, P044 is `01`, P228 is `01.01`, and P501 is `01.01.01.03.02.02.04.02.01.01`. `parent_consanguinity_person_id` directly references the bloodline parent row's `record_id`; `parent_affinal_person_id` optionally references the recorded spouse row that is also a parent. Spouse-only rows intentionally leave `source_row_number`, `lineage_id`, and both parent fields blank. `person_name_sort` follows `person_last_name`, and `source_row_number` is the penultimate source column immediately before `data_quality_notes`. Former legacy page references are prefixed to `data_quality_notes` and are no longer a separate column.

The three `spouse_#_record_id` columns connect an originating person row to spouse rows. Every populated spouse slot must have one resolvable reference, and missing, self, or duplicate spouse relationships are rejected. The accompanying spouse name/date fields remain as source compatibility context; the referenced spouse row's `person_*` columns are authoritative for that person's imported profile. When multiple spouse slots are populated, earlier slots are treated as divorced history and the final populated slot receives the row's current legacy relationship status. A unique, resolvable current `parent_consanguinity_person_id` becomes the biological lineage link. A populated `parent_affinal_person_id` becomes a second parent link and must resolve to a spouse reference on the consanguinity parent's row. Missing, self, duplicate, non-spouse, and incomplete parent-role references are rejected. Older cleaned files may retain embedded spouse data without spouse-record references; the importer creates compatibility spouse people for those files. Older direct `parent_lineage_id` and `lineage_parent_id` sources and legacy lineage-path `parent_lineage_id` or lineage-name sources also remain importable.

Current dates use `person_date_birth_value`, `person_date_birth_descriptor`, `person_date_death_value`, and `person_date_death_descriptor`. Known values use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. A partial value may replace unknown digits anywhere with `?` and must use the `partial` descriptor. Other nonblank descriptors are exactly `year`, `month`, `day`, or `UNKNOWN`; `invalid` is not accepted. Birth descriptors are never blank. A blank death descriptor means living, while `UNKNOWN` means deceased with no normalized death value. G0-G4 lineage people without a known death date use `UNKNOWN`. Older `descendant_date_*`, `descendant_birth_date_*`, and `descendant_death_date_*` columns remain importable for compatibility.

Spouse birth, death, and marriage values follow the same known/partial rule. Partial source dates remain in source details and are reported separately because McFamily's editable/native date values remain normalized known dates. Other unrecognized source values are retained and reported rather than guessed. Notes and data-quality notes remain distinct. Every current source column is also retained in the person's source field map so an import does not silently discard information; older files retain their compatibility-only fields when imported.

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
