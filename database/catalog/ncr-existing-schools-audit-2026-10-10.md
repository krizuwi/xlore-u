# Existing Metro Manila school-program catalog audit

Verified and applied: 10 October 2026. Batch: `ncr-existing-schools-verified-2026-10-10`.

## Applied result

- Inventory checked: 62 existing schools, 61 active and one inactive.
- Source-backed batch: 1,264 distinct school-program offerings across 58 active campuses.
- Added: 327 new shared program records and 1,118 school-program links across 54 campuses. Filled 36 previously empty campus catalogs.
- Database totals: 559 program records and 1,456 school-program links (previously 232 and 338).
- Four reviewed campuses needed no new links in this batch: STI Global City, STI Pasay-EDSA, TUP Manila, and PUP Parañaque.
- Transaction committed at 2026-10-10T11:12:40.641Z. All new links have an official source URL and verification timestamp. Existing programs, links, school details and availability records were verified byte-for-byte unchanged after JSON serialization.
- New tuition values remain NULL. No estimated tuition, admission guarantees, invented curricula, durations or career paths were added. Requirements direct users to official admissions information.
- No assessment questions, scoring weights or assessment-history records were modified. New-program interest tags and categories are explicitly internal title-based classifications, not classifications certified by each university.
- No deployment, Git commit or push was performed. The live API already serves the shared-database additions.

## Scope and limits

This is an additive undergraduate catalog expansion, not a claim that every pre-existing record is accurate or that every campus is exhaustive. Bachelor-level awards and separately named majors/specializations listed by the official institution were included. Combined bachelor/master pathways were retained where the school lists them as undergraduate entry programs; their curriculum details and multiple-award structure must be read on the official source. Senior high school, associate/diploma, graduate-entry medicine/law and graduate-only programs were not imported as bachelor degrees. Dentistry, optometry and veterinary professional degrees require a separate degree-level and campus/intake review, rather than being mislabeled Bachelor by this importer.

Program abbreviations and equivalent spellings were reconciled against existing records to prevent duplicate links. The manifest preserves `sourceTitle` as the institution's wording; `name` is the matched catalog title. Existing titles were not renamed. Program-level source URLs describe the first verified institution for a shared award; each newly added school-program link has its own campus-specific source.

## Remaining confirmation needed

- **Pamantasan ng Lungsod ng Valenzuela:** the current official [college page](https://valenzuela.plv.edu.ph/PLVWeb/colleges) relies on dynamic content. Its public college-data request returned a gateway timeout during this review. Older city profiles were not treated as a verified current intake list. Catalog remains empty pending current official program documentation.
- **Philippine Merchant Marine School – Manila Campus:** the current [official site](https://pmms.edu.ph/) identifies Las Piñas. Current offerings of a separate Manila campus could not be verified, so Las Piñas programs were not copied to it. The separate Manila campus record itself needs confirmation.
- **St. Luke's College of Medicine – William H. Quasha Memorial:** the [official college site](https://slmc-cm.edu.ph/) describes a graduate-entry medical course, not bachelor-level programs for school-leaver recommendations. No bachelor offerings were invented. Its old school website field also merits a separate reviewed correction.
- **STI Ortigas-Cainta:** inactive in the inventory and outside the NCR campus scope. Left untouched.
- **San Beda Manila:** verified existing CAS offerings and added Nursing plus the two current Education offerings. Its current [business admissions page](https://www.sanbeda.edu.ph/manila/admissions/cab) did not expose a usable program list. Historical graduation tables were not used as proof of current business intake. The current [CAS admissions list](https://www.sanbeda.edu.ph/manila/admissions/cas) also lists BSESS Major in Fitness and Sports Management; the conflicting older Physical Education page and lack of a verified full current award title were flagged instead of silently equating those degrees.
- **DLSU Manila:** current official business offerings were checked and added where missing. Some older imported records appear malformed or campus-ambiguous; this batch does not certify them as currently offered in Manila.
- **Mapúa:** current Intramuros and Makati official pages were handled separately. Computing/media, business and health offerings verified for Makati were not newly assigned to Intramuros. Intramuros Technical Communication is hidden in current public navigation and was not added solely because a sitemap URL still exists. Seda Hotel Manila Bay offerings were not assigned to the Intramuros campus record.
- **Other exclusions:** LPU offerings explicitly marked not offered in AY 2026–2027, CIIT Architecture marked offering soon, NEU Rizal-only Agriculture, and UP extension-campus offerings were not copied into NCR campus records.

## Pre-existing records requiring cleanup review

These were preserved because deleting or merging them could affect existing links, saved choices or historic recommendations. Their appearance in the database is not evidence of official accuracy.

| Existing catalog title | Linked school(s) |
| --- | --- |
| \\|B\\|a\\|c\\|h\\|e\\|l\\|o\\|r\\| \\|i\\|n\\| \\|E\\|l\\|e\\|m\\|e\\|n\\|t\\|a\\|r\\|y\\| \\|E\\|d\\|u\\|c\\|a\\|t\\|i\\|o\\|n\\| \\|(\\|B\\|E\\|E\\|D\\|)\\| \\|B\\|a\\|c\\|h\\|e\\|l\\|o\\|r\\| \\|o\\|f\\| \\|S\\|c\\|i\\|e\\|n\\|c\\|e\\| \\|i\\|n\\| \\|A\\|c\\|c\\|o\\|u\\|n\\|t\\|a\\|n\\|c\\|y\\| | Ateneo de Manila University; De La Salle University; Mapua University; National University; Pamantasan ng Lungsod ng Maynila; Polytechnic University of the Philippines; University of the East; University of the Philippines Diliman |
| \\|B\\|a\\|c\\|h\\|e\\|l\\|o\\|r\\| \\|o\\|f\\| \\|B\\|u\\|s\\|i\\|n\\|e\\|s\\|s\\| \\|T\\|e\\|c\\|h\\|n\\|o\\|l\\|o\\|g\\|y\\| \\|a\\|n\\|d\\| \\|L\\|i\\|v\\|e\\|l\\|i\\|h\\|o\\|o\\|d\\| \\|E\\|d\\|u\\|c\\|a\\|t\\|i\\|o\\|n\\| | Polytechnic University of the Philippines |
| \\|B\\|a\\|c\\|h\\|e\\|l\\|o\\|r\\| \\|o\\|f\\| \\|B\\|u\\|s\\|i\\|n\\|e\\|s\\|s\\| \\|T\\|e\\|c\\|h\\|n\\|o\\|l\\|o\\|g\\|y\\| \\|a\\|n\\|d\\| \\|L\\|i\\|v\\|e\\|l\\|i\\|h\\|o\\|o\\|d\\| \\|E\\|d\\|u\\|c\\|a\\|t\\|i\\|o\\|n\\| \\|m\\|a\\|j\\|o\\|r\\| \\|i\\|n\\| \\|H\\|o\\|m\\|e\\| \\|E\\|c\\|o\\|n\\|o\\|m\\|i\\|c\\|s\\| | Polytechnic University of the Philippines |
| \\|B\\|a\\|c\\|h\\|e\\|l\\|o\\|r\\| \\|o\\|f\\| \\|S\\|c\\|i\\|e\\|n\\|c\\|e\\| \\|i\\|n\\| \\|A\\|p\\|p\\|l\\|i\\|e\\|d\\| \\|E\\|c\\|o\\|n\\|o\\|m\\|i\\|c\\|s\\| \\|w\\|i\\|t\\|h\\| \\|s\\|p\\|e\\|c\\|i\\|a\\|l\\|i\\|z\\|a\\|t\\|i\\|o\\|n\\| \\|i\\|n\\| \\|E\\|c\\|o\\|n\\|o\\|m\\|i\\|c\\|s\\| \\|w\\|t\\|i\\|h\\| \\|M\\|a\\|n\\|a\\|g\\|e\\|m\\|e\\|n\\|t\\| | De La Salle University |
| \\|B\\|a\\|c\\|h\\|e\\|l\\|o\\|r\\| \\|o\\|f\\| \\|S\\|c\\|i\\|e\\|n\\|c\\|e\\| \\|i\\|n\\| \\|E\\|n\\|t\\|r\\|e\\|p\\|r\\|e\\|n\\|e\\|u\\|r\\|s\\|h\\|i\\|p\\| \\|(\\|B\\|S\\|E\\|N\\|T\\|R\\|E\\|P\\|)\\| \\|B\\|a\\|c\\|h\\|e\\|l\\|o\\|r\\| \\|o\\|f\\| \\|S\\|c\\|i\\|e\\|n\\|c\\|e\\| \\|i\\|n\\| \\|I\\|n\\|d\\|u\\|s\\|t\\|r\\|i\\|a\\|l\\| \\|E\\|n\\|g\\|i\\|n\\|e\\|e\\|r\\|i\\|n\\|g\\| | Polytechnic University of the Philippines |
| \\|B\\|a\\|c\\|h\\|e\\|l\\|o\\|r\\| \\|o\\|f\\| \\|S\\|e\\|c\\|o\\|n\\|d\\|a\\|r\\|y\\| \\|E\\|d\\|u\\|c\\|a\\|t\\|i\\|o\\|n\\| \\|(\\|B\\|S\\|E\\|d\\|)\\| \\|m\\|a\\|j\\|o\\|r\\| \\|i\\|n\\|:\\| | Polytechnic University of the Philippines |
| \\|B\\|a\\|c\\|h\\|e\\|l\\|o\\|r\\| \\|o\\|f\\| \\|T\\|e\\|c\\|h\\|n\\|o\\|l\\|o\\|g\\|y\\| \\|a\\|n\\|d\\| \\|L\\|i\\|v\\|e\\|l\\|i\\|h\\|o\\|o\\|d\\| \\|E\\|d\\|u\\|c\\|a\\|t\\|i\\|o\\|n\\| \\|(\\|B\\|T\\|L\\|E\\|d\\|)\\| \\|m\\|a\\|j\\|o\\|r\\| \\|i\\|n\\|:\\| | Polytechnic University of the Philippines |

Additional campus/title checks: the older Ateneo BS Business Administration seed differs from the current BS Management award; the Intramuros Mapúa seed includes computing programs now documented on Makati pages; some DLSU imported engineering/pathway titles may belong to Laguna rather than Manila. Duplicate or former-award aliases should be reviewed together with their record IDs before any merge, archive or rename.

## Per-campus coverage

“Reviewed” is the number of source-backed offerings in this batch, not certification of every pre-existing link. “After” includes preserved older links, including any needing cleanup. Zero additions can mean the reviewed courses were already linked.

| Existing school/campus | Before | Reviewed in batch | Added links | After |
| --- | ---: | ---: | ---: | ---: |
| \\|A\\|d\\|a\\|m\\|s\\|o\\|n\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 2 | 34 | 32 | 34 |
| \\|A\\|r\\|e\\|l\\|l\\|a\\|n\\|o\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|–\\| \\|M\\|a\\|i\\|n\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| \\|(\\|J\\|u\\|a\\|n\\| \\|S\\|u\\|m\\|u\\|l\\|o\\|n\\|g\\| \\|C\\|a\\|m\\|p\\|u\\|s\\|)\\| | 0 | 30 | 30 | 30 |
| \\|A\\|s\\|i\\|a\\| \\|P\\|a\\|c\\|i\\|f\\|i\\|c\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| | 0 | 11 | 11 | 11 |
| \\|A\\|s\\|i\\|a\\|n\\| \\|I\\|n\\|s\\|t\\|i\\|t\\|u\\|t\\|e\\| \\|o\\|f\\| \\|M\\|a\\|r\\|i\\|t\\|i\\|m\\|e\\| \\|S\\|t\\|u\\|d\\|i\\|e\\|s\\| | 0 | 9 | 9 | 9 |
| \\|A\\|t\\|e\\|n\\|e\\|o\\| \\|d\\|e\\| \\|M\\|a\\|n\\|i\\|l\\|a\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 5 | 48 | 45 | 50 |
| \\|C\\|e\\|n\\|t\\|r\\|a\\|l\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\|s\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| | 0 | 7 | 7 | 7 |
| \\|C\\|e\\|n\\|t\\|r\\|o\\| \\|E\\|s\\|c\\|o\\|l\\|a\\|r\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 12 | 53 | 41 | 53 |
| \\|C\\|I\\|I\\|T\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|o\\|f\\| \\|A\\|r\\|t\\|s\\| \\|a\\|n\\|d\\| \\|T\\|e\\|c\\|h\\|n\\|o\\|l\\|o\\|g\\|y\\| | 0 | 5 | 5 | 5 |
| \\|C\\|o\\|l\\|e\\|g\\|i\\|o\\| \\|d\\|e\\| \\|S\\|a\\|n\\| \\|J\\|u\\|a\\|n\\| \\|d\\|e\\| \\|L\\|e\\|t\\|r\\|a\\|n\\| | 14 | 12 | 12 | 26 |
| \\|D\\|e\\| \\|L\\|a\\| \\|S\\|a\\|l\\|l\\|e\\| \\|–\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|o\\|f\\| \\|S\\|a\\|i\\|n\\|t\\| \\|B\\|e\\|n\\|i\\|l\\|d\\|e\\| | 12 | 34 | 22 | 34 |
| \\|D\\|e\\| \\|L\\|a\\| \\|S\\|a\\|l\\|l\\|e\\| \\|A\\|r\\|a\\|n\\|e\\|t\\|a\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 0 | 10 | 10 | 10 |
| \\|D\\|e\\| \\|L\\|a\\| \\|S\\|a\\|l\\|l\\|e\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 143 | 11 | 2 | 145 |
| \\|E\\|m\\|i\\|l\\|i\\|o\\| \\|A\\|g\\|u\\|i\\|n\\|a\\|l\\|d\\|o\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|–\\| \\|M\\|a\\|n\\|i\\|l\\|a\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| | 0 | 25 | 25 | 25 |
| \\|E\\|n\\|d\\|e\\|r\\|u\\|n\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\|s\\| | 0 | 13 | 13 | 13 |
| \\|E\\|u\\|l\\|o\\|g\\|i\\|o\\| \\|"\\|A\\|m\\|a\\|n\\|g\\|"\\| \\|R\\|o\\|d\\|r\\|i\\|g\\|u\\|e\\|z\\| \\|I\\|n\\|s\\|t\\|i\\|t\\|u\\|t\\|e\\| \\|o\\|f\\| \\|S\\|c\\|i\\|e\\|n\\|c\\|e\\| \\|a\\|n\\|d\\| \\|T\\|e\\|c\\|h\\|n\\|o\\|l\\|o\\|g\\|y\\| | 0 | 39 | 39 | 39 |
| \\|F\\|a\\|r\\| \\|E\\|a\\|s\\|t\\|e\\|r\\|n\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 1 | 32 | 31 | 32 |
| \\|F\\|a\\|r\\| \\|E\\|a\\|s\\|t\\|e\\|r\\|n\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|–\\| \\|M\\|a\\|k\\|a\\|t\\|i\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| | 0 | 7 | 7 | 7 |
| \\|F\\|E\\|A\\|T\\|I\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 0 | 18 | 18 | 18 |
| \\|L\\|a\\| \\|C\\|o\\|n\\|s\\|o\\|l\\|a\\|c\\|i\\|o\\|n\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|M\\|a\\|n\\|i\\|l\\|a\\| | 0 | 10 | 10 | 10 |
| \\|L\\|y\\|c\\|e\\|u\\|m\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|–\\| \\|M\\|a\\|n\\|i\\|l\\|a\\| | 0 | 19 | 19 | 19 |
| \\|M\\|a\\|n\\|i\\|l\\|a\\| \\|C\\|e\\|n\\|t\\|r\\|a\\|l\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 0 | 16 | 16 | 16 |
| \\|M\\|a\\|n\\|u\\|e\\|l\\| \\|L\\|.\\| \\|Q\\|u\\|e\\|z\\|o\\|n\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 0 | 10 | 10 | 10 |
| \\|M\\|a\\|p\\|u\\|a\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 4 | 23 | 22 | 26 |
| \\|M\\|a\\|p\\|ú\\|a\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|–\\| \\|M\\|a\\|k\\|a\\|t\\|i\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| | 0 | 25 | 25 | 25 |
| \\|M\\|i\\|r\\|i\\|a\\|m\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| | 0 | 12 | 12 | 12 |
| \\|N\\|a\\|t\\|i\\|o\\|n\\|a\\|l\\| \\|T\\|e\\|a\\|c\\|h\\|e\\|r\\|s\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| | 0 | 24 | 24 | 24 |
| \\|N\\|a\\|t\\|i\\|o\\|n\\|a\\|l\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 3 | 27 | 25 | 28 |
| \\|N\\|e\\|w\\| \\|E\\|r\\|a\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 0 | 42 | 42 | 42 |
| \\|O\\|u\\|r\\| \\|L\\|a\\|d\\|y\\| \\|o\\|f\\| \\|F\\|a\\|t\\|i\\|m\\|a\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|–\\| \\|V\\|a\\|l\\|e\\|n\\|z\\|u\\|e\\|l\\|a\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| | 0 | 28 | 28 | 28 |
| \\|P\\|a\\|m\\|a\\|n\\|t\\|a\\|s\\|a\\|n\\| \\|n\\|g\\| \\|L\\|u\\|n\\|g\\|s\\|o\\|d\\| \\|n\\|g\\| \\|M\\|a\\|y\\|n\\|i\\|l\\|a\\| | 7 | 44 | 40 | 47 |
| \\|P\\|a\\|m\\|a\\|n\\|t\\|a\\|s\\|a\\|n\\| \\|n\\|g\\| \\|L\\|u\\|n\\|g\\|s\\|o\\|d\\| \\|n\\|g\\| \\|M\\|u\\|n\\|t\\|i\\|n\\|l\\|u\\|p\\|a\\| | 0 | 15 | 15 | 15 |
| \\|P\\|a\\|m\\|a\\|n\\|t\\|a\\|s\\|a\\|n\\| \\|n\\|g\\| \\|L\\|u\\|n\\|g\\|s\\|o\\|d\\| \\|n\\|g\\| \\|P\\|a\\|s\\|i\\|g\\| | 1 | 13 | 12 | 13 |
| \\|P\\|a\\|m\\|a\\|n\\|t\\|a\\|s\\|a\\|n\\| \\|n\\|g\\| \\|L\\|u\\|n\\|g\\|s\\|o\\|d\\| \\|n\\|g\\| \\|V\\|a\\|l\\|e\\|n\\|z\\|u\\|e\\|l\\|a\\| | 0 | 0 | 0 | 0 |
| \\|P\\|A\\|T\\|T\\|S\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|o\\|f\\| \\|A\\|e\\|r\\|o\\|n\\|a\\|u\\|t\\|i\\|c\\|s\\| | 0 | 7 | 7 | 7 |
| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\| \\|M\\|e\\|r\\|c\\|h\\|a\\|n\\|t\\| \\|M\\|a\\|r\\|i\\|n\\|e\\| \\|S\\|c\\|h\\|o\\|o\\|l\\| \\|–\\| \\|L\\|a\\|s\\| \\|P\\|i\\|ñ\\|a\\|s\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| | 0 | 7 | 7 | 7 |
| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\| \\|M\\|e\\|r\\|c\\|h\\|a\\|n\\|t\\| \\|M\\|a\\|r\\|i\\|n\\|e\\| \\|S\\|c\\|h\\|o\\|o\\|l\\| \\|–\\| \\|M\\|a\\|n\\|i\\|l\\|a\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| | 0 | 0 | 0 | 0 |
| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\| \\|N\\|o\\|r\\|m\\|a\\|l\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 0 | 15 | 15 | 15 |
| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\| \\|W\\|o\\|m\\|e\\|n\\|'\\|s\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 0 | 22 | 22 | 22 |
| \\|P\\|o\\|l\\|y\\|t\\|e\\|c\\|h\\|n\\|i\\|c\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| | 39 | 61 | 37 | 76 |
| \\|P\\|o\\|l\\|y\\|t\\|e\\|c\\|h\\|n\\|i\\|c\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| \\|–\\| \\|P\\|a\\|r\\|a\\|ñ\\|a\\|q\\|u\\|e\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| | 4 | 4 | 0 | 4 |
| \\|P\\|o\\|l\\|y\\|t\\|e\\|c\\|h\\|n\\|i\\|c\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| \\|–\\| \\|S\\|a\\|n\\| \\|J\\|u\\|a\\|n\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| | 0 | 6 | 6 | 6 |
| \\|P\\|o\\|l\\|y\\|t\\|e\\|c\\|h\\|n\\|i\\|c\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| \\|–\\| \\|T\\|a\\|g\\|u\\|i\\|g\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| | 0 | 11 | 11 | 11 |
| \\|Q\\|u\\|e\\|z\\|o\\|n\\| \\|C\\|i\\|t\\|y\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 0 | 10 | 10 | 10 |
| \\|S\\|a\\|n\\| \\|B\\|e\\|d\\|a\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|-\\| \\|A\\|l\\|a\\|b\\|a\\|n\\|g\\| | 0 | 16 | 16 | 16 |
| \\|S\\|a\\|n\\| \\|B\\|e\\|d\\|a\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| | 10 | 3 | 3 | 13 |
| \\|S\\|a\\|n\\| \\|S\\|e\\|b\\|a\\|s\\|t\\|i\\|a\\|n\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|–\\| \\|R\\|e\\|c\\|o\\|l\\|e\\|t\\|o\\|s\\| \\|d\\|e\\| \\|M\\|a\\|n\\|i\\|l\\|a\\| | 0 | 16 | 16 | 16 |
| \\|S\\|t\\|.\\| \\|L\\|u\\|k\\|e\\|’\\|s\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|o\\|f\\| \\|M\\|e\\|d\\|i\\|c\\|i\\|n\\|e\\| \\|–\\| \\|W\\|i\\|l\\|l\\|i\\|a\\|m\\| \\|H\\|.\\| \\|Q\\|u\\|a\\|s\\|h\\|a\\| \\|M\\|e\\|m\\|o\\|r\\|i\\|a\\|l\\| | 0 | 0 | 0 | 0 |
| \\|S\\|T\\|I\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|G\\|l\\|o\\|b\\|a\\|l\\| \\|C\\|i\\|t\\|y\\| | 8 | 8 | 0 | 8 |
| \\|S\\|T\\|I\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|O\\|r\\|t\\|i\\|g\\|a\\|s\\|-\\|C\\|a\\|i\\|n\\|t\\|a\\| (inactive) | 0 | 0 | 0 | 0 |
| \\|S\\|T\\|I\\| \\|C\\|o\\|l\\|l\\|e\\|g\\|e\\| \\|P\\|a\\|s\\|a\\|y\\|-\\|E\\|D\\|S\\|A\\| | 5 | 5 | 0 | 5 |
| \\|T\\|e\\|c\\|h\\|n\\|o\\|l\\|o\\|g\\|i\\|c\\|a\\|l\\| \\|I\\|n\\|s\\|t\\|i\\|t\\|u\\|t\\|e\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| \\|–\\| \\|M\\|a\\|n\\|i\\|l\\|a\\| | 0 | 9 | 9 | 9 |
| \\|T\\|e\\|c\\|h\\|n\\|o\\|l\\|o\\|g\\|i\\|c\\|a\\|l\\| \\|I\\|n\\|s\\|t\\|i\\|t\\|u\\|t\\|e\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| \\|–\\| \\|Q\\|u\\|e\\|z\\|o\\|n\\| \\|C\\|i\\|t\\|y\\| | 0 | 11 | 11 | 11 |
| \\|T\\|e\\|c\\|h\\|n\\|o\\|l\\|o\\|g\\|i\\|c\\|a\\|l\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| | 48 | 48 | 0 | 48 |
| \\|T\\|e\\|c\\|h\\|n\\|o\\|l\\|o\\|g\\|i\\|c\\|a\\|l\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| \\|–\\| \\|T\\|a\\|g\\|u\\|i\\|g\\| \\|C\\|a\\|m\\|p\\|u\\|s\\| | 0 | 22 | 22 | 22 |
| \\|T\\|r\\|i\\|n\\|i\\|t\\|y\\| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|A\\|s\\|i\\|a\\| | 3 | 19 | 19 | 22 |
| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|d\\|a\\|d\\| \\|d\\|e\\| \\|M\\|a\\|n\\|i\\|l\\|a\\| | 0 | 18 | 18 | 18 |
| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|A\\|s\\|i\\|a\\| \\|a\\|n\\|d\\| \\|t\\|h\\|e\\| \\|P\\|a\\|c\\|i\\|f\\|i\\|c\\| | 0 | 13 | 13 | 13 |
| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|M\\|a\\|k\\|a\\|t\\|i\\| | 0 | 23 | 23 | 23 |
| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|S\\|a\\|n\\|t\\|o\\| \\|T\\|o\\|m\\|a\\|s\\| | 5 | 96 | 92 | 97 |
| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|E\\|a\\|s\\|t\\| | 2 | 24 | 23 | 25 |
| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| \\|D\\|i\\|l\\|i\\|m\\|a\\|n\\| | 7 | 67 | 62 | 69 |
| \\|U\\|n\\|i\\|v\\|e\\|r\\|s\\|i\\|t\\|y\\| \\|o\\|f\\| \\|t\\|h\\|e\\| \\|P\\|h\\|i\\|l\\|i\\|p\\|p\\|i\\|n\\|e\\|s\\| \\|M\\|a\\|n\\|i\\|l\\|a\\| | 3 | 17 | 17 | 20 |

## Verification and reproducibility

- Additive importer: `scripts/apply-verified-catalog.js`.
- Reviewed manifest: `database/catalog/ncr-existing-schools-verified-2026-10-10.json`.
- Re-running the read-only dry run after apply reported **0 new programs and 0 new links**.
- Post-import checks confirmed all 327 new program IDs and all 1,118 new links from the receipt, official source/date metadata on every new link, unchanged old rows and NULL tuition on every new link.
- Live API checks returned HTTP 200 and exactly the expected program counts for all 58 reviewed campuses. Sample totals: Ateneo 50, OLFU Valenzuela 28, Mapúa Makati 25 and Asia Pacific College 11. Ateneo's total includes two preserved older seed offerings not certified by the current 48-program list.
- Backend syntax check passed for 63 JavaScript files; all 95 automated tests passed.
- Local public-catalog backup: `../../work/catalog-backup-before-2026-10-10.json.gz.b64` (gzip-compressed JSON encoded as base64; no environment credentials or user-account records).
- Import receipt: `../../work/catalog-import-receipt-2026-10-10.json.gz.b64`. Receipt IDs identify precisely the additions; restoration/removal would need a separate reviewed operation, not a wholesale database reset.

## Official source index

These are the source URLs attached to reviewed entries. Availability is subject to each institution's current admissions notices, campus and academic year. Admissions offices remain authoritative for current intake.

### Adamson University

- [Official source](https://www.adamson.edu.ph/v1/?page=programs-of-study)

### Arellano University – Main Campus (Juan Sumulong Campus)

- [Official source](https://arellano.edu.ph/admission/programs-offered/)

### Asia Pacific College

- [Official source](https://apc.edu.ph/)

### Asian Institute of Maritime Studies

- [Official source](https://www.aims.edu.ph/schools.php)

### Ateneo de Manila University

- [Official source](https://docs.google.com/document/d/1HN2QTabR_hqRWgy3W_CkhP6lTFPWuSQ45fF8IBWB4cQ/preview)

### Central Colleges of the Philippines

- [Official source](https://www.ccp.edu.ph/engineering.php)
- [Official source](https://www.ccp.edu.ph/computerstudies.php)
- [Official source](https://www.ccp.edu.ph/businessadmin.php)
- [Official source](https://www.ccp.edu.ph/artsandsciences.php)
- [Official source](https://www.ccp.edu.ph/architecture.php)

### Centro Escolar University

- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/1.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/2.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/2.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/1.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/4.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/6.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/5.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/76.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/9.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/10.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/8.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/7.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/84.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/85.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/82.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/81.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/89.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/88.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/87.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/86.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/92.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/90.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/91.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/11.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/96.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/95.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/93.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/94.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/109.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/99.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/98.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/courses/97.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/13.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/14.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/16.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/23.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/25.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/24.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/26.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/27.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/28.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/110.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/109.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/111.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/122.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/123.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/124.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/125.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/137.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/126.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/141.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/138.html)
- [Official source](https://www.ceu.edu.ph/static/academics/academic-programs/187.html)

### CIIT College of Arts and Technology

- [Official source](https://www.ciit.edu.ph/level/bachelors-degree/)

### Colegio de San Juan de Letran

- [Official source](https://www.letran.edu.ph/Academics/College_CBAA)

### De La Salle – College of Saint Benilde

- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/creative-industries-management/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/fine-arts-in-culture-based-arts/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/cybersecurity/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/fashion-design-and-merchandising/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/marketing-management/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/performing-arts-major-in-dance/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/architecture/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/real-estate-management/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/export-and-global-business-management/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/film/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/hospitality-and-luxury-management/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/animation/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/business-management/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/bachelor-in-sign-language-interpretation/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/production-design/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/information-systems/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/governance-and-public-affairs/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/holistic-disciplines/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/interior-design/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/business-intelligence-and-analytics/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/industrial-design/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/business-solutions-and-applications/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/human-resource-management/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/game-design-and-development/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/photography/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/social-innovation-and-entrepreneurship/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/music-production/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/diplomacy-and-international-affairs/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/tourism-management/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/culinary-arts-management/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/theater-arts/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/multimedia-arts/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/international-hospitality-management-vatel-programme/)
- [Official source](https://www.benilde.edu.ph/programs/undergraduate-programs/applied-deaf-studies/)

### De La Salle Araneta University

- [Official source](https://www.dlsau.edu.ph/academics/ted/index.html)

### De La Salle University

- [Official source](https://old.dlsu.edu.ph/colleges/rvrcob/undergraduate-degree-programs/)

### Emilio Aguinaldo College – Manila Campus

- [Official source](https://www.eac.edu.ph/admissions-eacm/)

### Enderun Colleges

- [Official source](https://www.enderuncolleges.com/our-programs/)

### Eulogio "Amang" Rodriguez Institute of Science and Technology

- [Official source](https://earist.edu.ph/office-of-the-registrar/program-offerings/)

### Far Eastern University

- [Official source](https://www.feu.edu.ph/undergraduate-programs/)

### Far Eastern University – Makati Campus

- [Official source](https://www.feu.edu.ph/feu-makati/)

### FEATI University

- [Official source](https://www.featiu.edu.ph/college-php/)

### La Consolacion College Manila

- [Official source](https://www.lccm.edu.ph/)

### Lyceum of the Philippines University – Manila

- [Official source](https://manila.lpu.edu.ph/admissions/program-offerings/)

### Manila Central University

- [Official source](https://mcu.edu.ph/academic/college/)
- [Official source](https://mcu.edu.ph/academic/college/college-of-nursing/)
- [Official source](https://mcu.edu.ph/academic/college/college-of-pharmacy/)

### Manuel L. Quezon University

- [Official source](https://www.mlqu.edu.ph/academic/school-of-business/)
- [Official source](https://www.mlqu.edu.ph/academic/school-of-engineering/)
- [Official source](https://www.mlqu.edu.ph/academic/school-of-architecture/)

### Mapua University

- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-chemical-biological-and-materials-engineering-and-sciences/bachelor-of-science-in-chemical-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-industrial-engineering-and-engineering-management/bachelor-of-science-in-industrial-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-architecture-industrial-design-and-the-built-environment/bachelor-of-science-in-architecture)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-civil-environmental-and-geological-engineering/bachelor-of-science-in-civil-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-electrical-electronics-and-computer-engineering/bachelor-of-science-in-electrical-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-electrical-electronics-and-computer-engineering/bachelor-of-science-in-computer-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-mechanical-manufacturing-and-energy-engineering/bachelor-of-science-in-mechanical-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-mechanical-manufacturing-and-energy-engineering/bachelor-of-science-in-energy-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-electrical-electronics-and-computer-engineering/bachelor-of-science-in-electronics-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-architecture-industrial-design-and-the-built-environment/bachelor-of-science-in-industrial-design)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-architecture-industrial-design-and-the-built-environment/bachelor-of-science-in-interior-design)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-electrical-electronics-and-computer-engineering/bachelor-of-science-in-artificial-intelligence-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-foundational-studies-and-education/bachelor-of-physical-education-major-in-sports-wellness-and-management)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-foundational-studies-and-education/bachelor-of-science-in-physics)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-chemical-biological-and-materials-engineering-and-sciences/bachelor-of-science-in-biological-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-civil-environmental-and-geological-engineering/bachelor-of-science-in-environmental-and-sanitary-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-chemical-biological-and-materials-engineering-and-sciences/bachelor-of-science-in-chemistry)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-civil-environmental-and-geological-engineering/bachelor-of-science-in-construction-engineering-and-management)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-mechanical-manufacturing-and-energy-engineering/bachelor-of-science-in-manufacturing-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-civil-environmental-and-geological-engineering/bachelor-of-science-in-geology)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-chemical-biological-and-materials-engineering-and-sciences/bachelor-of-science-in-materials-science-and-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-industrial-engineering-and-engineering-management/bachelor-of-science-in-management-engineering)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/intramuros-campus/school-of-architecture-industrial-design-and-the-built-environment/bachelor-of-science-in-environmental-planning)

### Mapúa University – Makati Campus

- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-information-technology/bachelor-of-science-in-information-technology)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-information-technology/bachelor-of-science-in-cybersecurity)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-media-studies/bachelor-of-arts-in-digital-journalism)
- [Official source](https://support.mapua.edu.ph/kb/article/110/bachelor-of-science-in-business-administration)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-information-technology/bachelor-of-science-in-computer-science)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-information-technology/bachelor-of-science-in-entertainment-and-multimedia-computing)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-information-technology/bachelor-of-science-in-data-science)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-media-studies/bachelor-of-arts-in-digital-film)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-media-studies/bachelor-of-arts-in-multimedia-arts)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-information-technology/bachelor-of-science-in-information-systems)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-media-studies/bachelor-of-arts-in-advertising-design)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-media-studies/bachelor-of-arts-in-broadcast-media)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/et-yuchengco-school-of-business-in-collaboration-with-arizona-state-university)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-nursing-in-collaboration-with-arizona-state-university)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-health-sciences-in-collaboration-with-arizona-state-university/bs-biology)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-health-sciences-in-collaboration-with-arizona-state-university/bs-physical-therapy)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-health-sciences-in-collaboration-with-arizona-state-university/bs-pharmacy)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-health-sciences-in-collaboration-with-arizona-state-university/bs-medical-technology)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-health-sciences-in-collaboration-with-arizona-state-university/bs-psychology)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-health-sciences-in-collaboration-with-arizona-state-university/bs-radiologic-technology)
- [Official source](https://www.mapua.edu.ph/pages/academics/undergraduate/makati-campus/school-of-health-sciences-in-collaboration-with-arizona-state-university/ab-psychology)

### Miriam College

- [Official source](https://mc.edu.ph/heu/undergraduate/)

### National Teachers College

- [Official source](https://ntc.edu.ph/thank-you/)

### National University

- [Official source](https://national-u.edu.ph/nu-manila/)

### New Era University

- [Official source](https://neu.edu.ph/main/academics)

### Our Lady of Fatima University – Valenzuela Campus

- [Official source](https://fatima.edu.ph/college-undergraduate-programs-tuition-fees-valenzuela-campus/)

### Pamantasan ng Lungsod ng Maynila

- [Official source](https://web13.plm.edu.ph/media/downloads/manuals/Approved_2025_Student_Manual.pdf)

### Pamantasan ng Lungsod ng Muntinlupa

- [Official source](https://www.plmun.edu.ph/program-offered.php)

### Pamantasan ng Lungsod ng Pasig

- [Official source](https://plpasig.edu.ph/2026/05/15/congratulations-to-our-successful-plp-applicants/)

### PATTS College of Aeronautics

- [Official source](https://www.patts.edu.ph/academics/academic-programs)

### Philippine Merchant Marine School – Las Piñas Campus

- [Official source](https://pmms.edu.ph/programs.html)

### Philippine Normal University

- [Official source](https://www.pnu.edu.ph/program-offerings/)

### Philippine Women's University

- [Official source](https://www.pwu.edu.ph/school-list/arts-and-sciences/)
- [Official source](https://www.pwu.edu.ph/school-list/cbibe/)
- [Official source](https://www.pwu.edu.ph/school-list/education/)
- [Official source](https://www.pwu.edu.ph/school-list/foodtech/)
- [Official source](https://www.pwu.edu.ph/school-list/hzb-sird/)
- [Official source](https://www.pwu.edu.ph/school-list/music/)
- [Official source](https://www.pwu.edu.ph/school-list/nursing/)
- [Official source](https://www.pwu.edu.ph/school-list/nutrition/)
- [Official source](https://www.pwu.edu.ph/school-list/pharmacy/)
- [Official source](https://www.pwu.edu.ph/school-list/tourism/)
- [Official source](https://www.pwu.edu.ph/school-list/hospitality-management/)

### Polytechnic University of the Philippines

- [Official source](https://www.pup.edu.ph/academic/undergrad)

### Polytechnic University of the Philippines – Parañaque Campus

- [Official source](https://www.pup.edu.ph/paranaque/)

### Polytechnic University of the Philippines – San Juan Campus

- [Official source](https://www.pup.edu.ph/sanjuan/)

### Polytechnic University of the Philippines – Taguig Campus

- [Official source](https://www.pup.edu.ph/taguig/undergraduate)

### Quezon City University

- [Official source](https://qcu.edu.ph/enrollment-reports/)

### San Beda College - Alabang

- [Official source](https://sanbeda-alabang.edu.ph/programs/tertiary-education/school-of-arts-sciences-and-education-sase/)
- [Official source](https://sanbeda-alabang.edu.ph/programs/tertiary-education/school-of-business-accountancy-and-management-sbam/)
- [Official source](https://sanbeda-alabang.edu.ph/programs/tertiary-education/school-of-engineering-and-technology-set/)

### San Beda University

- [Official source](https://www.sanbeda.edu.ph/manila/admissions/coe)
- [Official source](https://www.sanbeda.edu.ph/manila/admissions/con)

### San Sebastian College – Recoletos de Manila

- [Official source](https://sscrmnl.edu.ph/academics/college/college-of-arts-and-sciences/)
- [Official source](https://sscrmnl.edu.ph/academics/college/college-of-accountancy-business-administration-and-computer-studies/)
- [Official source](https://sscrmnl.edu.ph/academics/college/college-of-international-hospitality-management/)

### STI College Global City

- [Official source](https://www.sti.edu/campuses-details.asp?campus_id=R0xP)

### STI College Pasay-EDSA

- [Official source](https://www.sti.edu/campuses-details.asp?campus_id=VEFG)

### Technological Institute of the Philippines – Manila

- [Official source](https://dru.tip.edu.ph/home/program/engineering)
- [Official source](https://dru.tip.edu.ph/best-of-tip/abet/)

### Technological Institute of the Philippines – Quezon City

- [Official source](https://dru.tip.edu.ph/home/program/engineering)
- [Official source](https://dru.tip.edu.ph/best-of-tip/abet/)

### Technological University of the Philippines

- [Official source](https://tup.edu.ph/undergraduate/admission/undergraduate-programs)

### Technological University of the Philippines – Taguig Campus

- [Official source](https://www.tupt.edu.ph/academics/department/caad)
- [Official source](https://www.tupt.edu.ph/academics/department/maad)
- [Official source](https://www.tupt.edu.ph/academics/department/eaad)
- [Official source](https://www.tupt.edu.ph/academics/department/basd)

### Trinity University of Asia

- [Official source](https://www.tua.edu.ph/college-of-allied-health-sciences/)
- [Official source](https://www.tua.edu.ph/slcn/)
- [Official source](https://www.tua.edu.ph/academic-programs/case/)
- [Official source](https://www.tua.edu.ph/ibam/)

### Universidad de Manila

- [Official source](https://udmwebsite.udm.edu.ph/colleges/)

### University of Asia and the Pacific

- [Official source](https://smn.uap.asia/)
- [Official source](https://sec.uap.asia/)
- [Official source](https://sed.uap.asia/)
- [Official source](https://sse.uap.asia/programs/bachelors-programs/)

### University of Makati

- [Official source](https://www.umak.edu.ph/admissions/apply-college/admission-requirements/)
- [Official source](https://www.umak.edu.ph/academics/college/ccis/)
- [Official source](https://www.umak.edu.ph/academics/college/science/)
- [Official source](https://www.umak.edu.ph/academics/college/cthm/)

### University of Santo Tomas

- [Official source](https://www.ust.edu.ph/accountancy/)
- [Official source](https://www.ust.edu.ph/commerce/)
- [Official source](https://www.ust.edu.ph/arts-and-letters/)
- [Official source](https://www.ust.edu.ph/science/)
- [Official source](https://www.ust.edu.ph/education/)
- [Official source](https://www.ust.edu.ph/engineering/)
- [Official source](https://www.ust.edu.ph/information-and-computing-sciences/)
- [Official source](https://www.ust.edu.ph/pharmacy/)
- [Official source](https://www.ust.edu.ph/rehabilitation-sciences/)
- [Official source](https://www.ust.edu.ph/tourism-and-hospitality-management/)
- [Official source](https://www.ust.edu.ph/fine-arts-and-design/)
- [Official source](https://www.ust.edu.ph/architecture/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-bassoon/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-choral-conducting/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-clarinet/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-composition/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-double-bass/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-flute/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-french-horn/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-guitar/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-jazz/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-musicology/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-music-education/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-music-theatre/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-music-technology/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-oboe/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-orchestral-conducting/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-percussion/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-piano/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-saxophone/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-trombone/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-trumpet/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-tuba/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-viola/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-violin/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-violoncello/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-music-in-performance-major-in-voice/)
- [Official source](https://www.ust.edu.ph/academics/programs/bachelor-of-science-in-nursing/)
- [Official source](https://www.ust.edu.ph/physical-education-and-athletics/)

### University of the East

- [Official source](https://www.ue.edu.ph/mla/cas-curricular-offerings-2/)
- [Official source](https://www.ue.edu.ph/mla/ccss-curricular-offerings/)
- [Official source](https://www.ue.edu.ph/mla/ceduc-curricular-offerings/)
- [Official source](https://www.ue.edu.ph/mla/cengg-mla-curricular-offerings/)

### University of the Philippines Diliman

- [Official source](https://our.upd.edu.ph/forms/GEN%20INFO%20UG%20FOREIGN.pdf)

### University of the Philippines Manila

- [Official source](https://our.upm.edu.ph/index.php/acadprograms)
