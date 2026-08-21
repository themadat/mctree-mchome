

I have been convinced to support MULTIPLE Files instead of one CSV import. The important thing is this must be a single file import/export process so maybe a zip directory or something like that could work. Also it must be valid, don't except a bad import if data doesn't match up. run checks and notify!

McPeople      // Individual people (this is McLineage renamed)
McPlaces      // Physical places (home addresses)
McRelations   // Person ↔ Person
McResidences  // Person ↔ Place
McMetadata    // Schema, versions, imports, audit history

Parents and relations from the McLineage can be moved to McRelations

Lets start with just one McPlaces record (id L0001): 1900 Paintrock Cv; Cedar Park, TX 78613 and assign it P383

McMetadata is going to need to be updated to account for all these changes and track changes across multiple files


Support adoption (multiple non-lineal parents)
Since we are touching the data document rename parent_consanguinity_person_id to parent_lineal_person_id and parent_affinal_person_id to parent_non-lineal_person_id

First candidate for this will be P569. Adopted by P380 (used dashed muted red line for lineal adoption and add to key). non-lineal parents are P877 and a new person needs to be created Name Unknown. Relationship of this new person to P877 is unknown type and time, but should be before relation to P380. For these unique cases in parents relationship denote Lineal :: Adopted and Non-Lineal :: Biological


Move files to cloud

need to create an audit trail when enable audits



McLineage, McMetadata, McRelations, McLocations can all be different files

Future:

Gender? Pronouns?
ParentType: Biological, Adoptive, Step, Foster
PartnerStatus: Married, Divorced, Widowed, Partnered, Never Married
take care of 99 lineage

Audit Log
const __APPLE_TERMINAL_ON_RECTANGLE_FILL = `<svg class="sf-symbol" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 35.7861 30.5566"><g><rect height="30.5566" opacity="0" width="35.7861" x="0" y="0"/><path d="M27.3848 6.09375L12.3291 6.09375C8.48145 6.09375 6.12305 8.44238 6.12305 12.2705L6.12305 22.5391L5.84961 22.5391C3.05664 22.5391 1.55273 21.0449 1.55273 18.2764L1.55273 6.17676C1.55273 3.41309 3.05664 1.91406 5.84961 1.91406L23.0957 1.91406C25.8502 1.91406 27.3564 3.38708 27.3848 6.09375Z"/><path d="M33.8672 12.2705L33.8672 24.375C33.8672 27.1338 32.3584 28.6328 29.5801 28.6328L12.3291 28.6328C9.54102 28.6328 8.03711 27.1436 8.03711 24.375L8.03711 12.2705C8.03711 9.50684 9.54102 8.0127 12.3291 8.0127L29.5801 8.0127C32.3584 8.0127 33.8672 9.51172 33.8672 12.2705ZM18.6084 17.3682C18.1055 17.3682 17.7051 17.7637 17.7051 18.2617C17.7051 18.7695 18.1006 19.1846 18.6084 19.1846L22.7832 19.1846C23.3008 19.1846 23.6865 18.7695 23.6865 18.2617C23.6865 17.7637 23.3008 17.3682 22.7832 17.3682ZM12.9736 13.9746L15.3418 15.4053L12.9785 16.8359C11.8945 17.5 12.8271 19.1455 13.999 18.4033L17.1533 16.4111C17.9004 15.9521 17.8662 14.8486 17.1533 14.3945L13.999 12.417C12.8271 11.6797 11.8896 13.3301 12.9736 13.9746Z"/></g></svg>`;
