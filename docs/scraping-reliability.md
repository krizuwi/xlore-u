# Catalog collection reliability

## Findings checked on 2026-10-13

The latest recorded manual run selected Ateneo only and failed at robots.txt with HTTP 403. University of Makati has the same access refusal. These are not database, assessment or deployment-region failures. Timeout increases do not resolve HTTP 403. No user-agent impersonation, proxy, CAPTCHA bypass or ignoring robots policies is implemented.

Read-only fetch/extraction checks of all 17 enabled sources found 11 usable pages and 6 source checks needing intervention:

- Ateneo school profile and UMak programs: robots.txt HTTP 403.
- Both TUP sources: HTTPS robots.txt redirects to `http://www.tup.edu.ph/404error.php`. The collector refuses the insecure redirect. The actual catalog pages return HTTP 200, but that does not establish an available robots policy.
- Mapua program source (`https://support.mapua.edu.ph/kb/section/12`) and UST programs (`https://www.ust.edu.ph/academics/programs/`): zero recognizable programs with the configured extraction selectors. An HTTP 200 response must not be presented as a successful program verification. Both need verified program-containing sources or dedicated extraction support.

These checks are current observations, not guarantees of future availability or full catalog coverage. No source was disabled or replaced, and existing school/program descriptions, offerings, assessment records and source/run history were not changed during these checks.

## Implemented safeguards

- Use a transaction-scoped PostgreSQL advisory lock, compatible with Supabase transaction pooling. Session-scoped locks can otherwise outlive the client or be unlocked on another pooled connection.
- Skip empty/due-less runs without inserting misleading `completed` history rows.
- Use source savepoints: failed updates roll back their programs, offerings, verification timestamps and change logs. Other valid sources can complete in the batch.
- Roll back a fatal batch database error and record a failed batch with zero saved changes. A lost process also causes the database transaction/lock to release; no partially committed source is retained.
- Validate extracted content before accepting a cached unchanged hash. No recognized programs is a real failure. Homepage identity can be verified without inventing a missing description.
- Validate redirects before contacting them; require HTTPS and allowed hosts, and check the destination's robots policy on page redirects. Continue respecting the configured user agent, host pacing and robots disallow rules.
- Apply the selected request timeout to the robots fetch as well (with an 8-second maximum for robots).
- Show access-blocked and other actionable diagnostics in Scraping Management, and surface manual-job errors alongside the succeeded/checked count.

## Verification and operation

`npm run catalog:check` performs read-only official-page fetch and extraction checks. A nonzero exit status means at least one source needs review. It does not run collection, mark sources successful, or write catalog or assessment data.

Backend tests include source and batch rollback, no-op history, empty extraction, unchanged empty hashes, robots 403/disallow and unsafe redirect checks. Real PostgreSQL rollback verification used connection-local temporary tables, confirmed source and batch rollback, and compared public-table hashes before/after to verify that catalog, source history and assessment records were unchanged. Frontend tests cover truthful blocked-source status and safe error rendering.

Frontend and backend were deployed together on 2026-10-13. Backend deployment `dpl_85R32TYrBqnFZGfT8MTqV9MjRwYH` is Ready on `https://xlore-u-api.vercel.app`, with the function in Tokyo (`hnd1`). Frontend deployment `dpl_5GXMdAL57BYLFbNaKj14bBNfYjY5` is Ready on `https://xlore-u-beta.vercel.app`; its served bundle is `/assets/index-D__D3Hd6.js` and contains the new blocked-source diagnostic UI.

Post-deployment read-only smoke checks confirmed HTTP 200 for the health, school, program, question-bank and catalog-status endpoints, correct frontend CORS, and authenticated-only admin scraping access (anonymous HTTP 401). Database and assessment checks were healthy; the active bank contained 20 questions. Overall health remains `degraded` and scraping remains `unhealthy` because the existing latest manual Ateneo-only run failed. No collection job or database write was triggered by deployment verification.

Deployment does not grant access to blocked sites or make the zero-extraction sources work. Do not run a broad production collection merely to replace a failing health result. For inaccessible sources, obtain university permission or use verified manual maintenance. For empty extraction sources, verify a program-containing source and extractor before activation. Keep historical failures and never delete existing offerings solely because a scrape failed.

Automatic scheduling currently runs only in the long-lived local backend; `src/server.js` does not start the scheduler on Vercel. A serverless-safe scheduled worker is a separate operational step, not enabled by this change.
