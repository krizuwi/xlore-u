// Read-only report generation from the reviewed batch and post-import audit.
import fs from 'node:fs/promises';
const [manifestFile, auditFile, outputFile] = process.argv.slice(2);
const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
const audit = JSON.parse(await fs.readFile(auditFile, 'utf8'));
const reasons = new Map([
  ['AMA Computer College – Makati', ['https://ama.edu.ph/contact-us.html', 'Published AMA-system offerings were not sufficiently assigned to this campus. Obtain its current campus-specific course list.']],
  ['AMA Computer College – Parañaque', ['https://ama.edu.ph/contact-us.html', 'Published AMA-system offerings were not sufficiently assigned to this campus. Obtain its current campus-specific course list.']],
  ['AMA Computer University – Main Campus', ['https://www.amaes.edu.ph/main.html', 'System-wide degree lists mix institutions/campuses. Confirm which degrees are currently offered at the main campus.']],
  ['Arellano University – Apolinario Mabini Campus', ['https://arellano.edu.ph/admission/programs-offered/', 'Reviewed official listing identifies basic education rather than college offerings at this campus. Confirm the catalog record instead of inventing degrees.']],
  ['Global City Innovative College', ['https://global.edu.ph/', 'The reviewed current website did not provide a dependable current degree list. Obtain an official college prospectus.']],
  ['Parañaque City College', ['https://paranaquecitycollege.edu.ph/', 'No sufficiently verifiable current degree list from the reviewed official web pages. Obtain a current official prospectus.']],
  ['Philippine Merchant Marine School – Manila Campus', ['https://pmms.edu.ph/', 'Current official site identifies Las Piñas; the Manila record may reflect a former location. Confirm campus identity before assigning maritime degrees.']],
  ['Saint Rita College – Manila', ['https://srcm.edu.ph/', 'Reviewed current site emphasizes basic education. Historical college references do not establish current tertiary offerings.']],
  ['STI College Ortigas-Cainta', ['https://www.sti.edu/campuses/ortigas-cainta', 'Already inactive and located in Rizal outside NCR. Description filled, but deliberately not reactivated or assigned active offerings.']],
  ['Systems Plus Computer College – Caloocan', ['https://spcc.edu.ph/', 'Current reviewed pages did not establish a reliable complete tertiary list. Do not substitute the similarly named Angeles institution.']],
  ['University of Caloocan City – Camarin Campus (North)', ['https://www.ucc-caloocan.edu.ph/', 'University-wide program lists do not safely determine campus assignments. Engineering at Bagong Silang must not be assigned to Camarin automatically.']],
  ['University of Caloocan City – South Campus', ['https://www.ucc-caloocan.edu.ph/', 'University-wide program lists do not safely determine campus assignments. Obtain a current South Campus prospectus.']],
  ['Valenzuela City Polytechnic College', ['https://www.tesda.gov.ph/Uploads/File/Diploma/2024%20Recognized%20Diploma%20as%20of%20December%202024.pdf', 'TESDA page 13 records four recognized diplomas under the renamed Valenzuela City Technological College as of December 2024. Recognition does not establish current intake/availability. The researched valtech.stoatic.com site explicitly states it is unofficial and was not used for import.']]
]);
const groups = new Map();
for (const entry of manifest.entries) {
  const current = groups.get(entry.schoolName) ?? { count: 0, sources: new Set() };
  current.count += 1; current.sources.add(entry.sourceUrl); groups.set(entry.schoolName, current);
}
const lines = ['# Catalog maintenance: 2026-10-11', '',
  'Applied to the configured shared database: 402 school–program links across 29 previously empty school records, 119 new program records, and 5 previously blank school descriptions. No school or user records were deleted.', '',
  'The database now has 678 active program records, zero blank school descriptions and zero blank descriptions among active programs. Existing program fields and offering metadata were preserved. Unknown tuition was left unknown, not estimated.', '',
  `Post-import checks: question bank unchanged = ${audit.questionBankUnchanged}; original program records unchanged = ${audit.originalProgramsUnchanged}; unexpected school field changes = ${audit.unexpectedSchoolChanges.length}.`, '',
  'A full catalog/question backup and insert receipt are stored privately outside the repository. No user-account or assessment-result data was modified. Inactive campuses remain inactive.', '',
  'These links establish published offerings, not a guarantee of current admission slots. This is not a completeness claim for every school. Some current official pages retain older award titles; confirm current admission-year names where noted in the manifest. New brief program descriptions are editorial summaries based on the named discipline, not copied official curricula. New interest tags are curated engineering metadata, not psychometric validation.', '',
  '## Imported school coverage and official sources', '',
  '| School | Linked programs | Sources |', '| --- | ---: | --- |',
  ...[...groups].map(([name, group]) => `| ${name} | ${group.count} | ${[...group.sources].map((url, index) => `[Official source ${index + 1}](${url})`).join('; ')} |`), '',
  'Only explicitly campus-labelled RTU offerings were imported; the main campus has six confirmed entries and Pasig has one. Their complete lists still require campus confirmation. Other imported schools may also offer programs beyond the reviewed pages.', '',
  "St. Luke’s Doctor of Medicine is recorded as Postgraduate and excluded from school-leaver assessment recommendations. Certificates, diplomas and associate awards retain their award levels instead of being labelled bachelor degrees.", '',
  '## Remaining empty school records: 12 active, 1 inactive', '',
  'These are unresolved records, not evidence that the institution has no programs.', '',
  '| School | Status | Evidence / required action |', '| --- | --- | --- |',
  ...audit.remainingSchools.map(school => {
    const [url, reason] = reasons.get(school.school_name) ?? ['', 'Further official confirmation required.'];
    return `| ${school.school_name} | ${school.is_active_available ? 'Active; unresolved' : 'Inactive; unchanged'} | ${reason} ${url ? `[Reviewed source](${url})` : ''} |`;
  }), '',
  '## Existing metadata discrepancies preserved for administrator review', '',
  '- STI Las Piñas is named as that campus, but its current record has a Manila city/address description inconsistent with its official campus identity. The imported programs follow the named Las Piñas campus; existing nonblank location fields were not overwritten. Correct the address/coordinates through admin after confirming the record.',
  '- STI Fairview has an existing description referring to Cubao. Its programs follow the named Fairview campus; the existing nonblank description was not overwritten.',
  '- Valenzuela Polytechnic appears under the newer Valenzuela City Technological College name in official sources. Resolve the name/identity and current intake before assigning the older registered diplomas.', '',
  '## Description sources', '',
  ...manifest.schoolDescriptions.map(item => `- ${item.schoolName}: [Official source](${item.sourceUrl})`), '',
  'The Ateneo main about URL returned 403; the descriptive identity was cross-checked against its institution-hosted research document: [Ateneo institutional context, section 2.3](https://research.ateneo.edu/ws/portalfiles/portal/40046749/Promoting%20Equity%20and%20Assuring%20Teaching%20and%20Learning%20Quality_%20Magi.pdf). No access controls were bypassed.', '',
  '## Reproducibility', '',
  '`database/catalog/remaining-schools-verified-2026-10-11.json` records every reviewed school ID/name, award level and official source URL. `scripts/apply-verified-catalog.js` defaults to read-only dry run; applying requires an absolute backup directory outside the repository, database identity checks, table locks, a serializable transaction, preserved-old-link checks and unchanged-question-bank verification. A repeat dry run after import should propose zero new records.', ''];
await fs.writeFile(outputFile, lines.join('\n'));
console.log(JSON.stringify({ reportWritten: true, importedSchools: groups.size, remainingEmptySchools: audit.remainingSchools.length }));
