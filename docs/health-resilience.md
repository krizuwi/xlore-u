# System health checks

## Findings on 2026 10 13

The deployed assessment returned 20 available questions with HTTP 200 on consecutive direct checks. The database was connected. The old report intermittently marked assessment/program routes unhealthy at its 3000 ms cutoff while probing five routes concurrently and querying catalog status twice. An additional scraper warning came from a recorded partial run with 15 of 16 sources succeeded and two currently enabled failed sources.

Both blocked sources returned HTTP 403 when checking robots.txt: Ateneo de Manila and University of Makati. Collection must not bypass these restrictions. The University of Makati programs source was also linked to University of Santo Tomas. Migration 020 corrects only that source's school association, guarded by its existing ID, school, URL, host and the verified UMak school website. It does not alter source failures/history, programs, school offerings, school profiles, questionnaires or saved results.

## Changes

- HTTP probes allow 10000 ms, with successful responses above 3000 ms labelled slow instead of failed. Database checks retain separate 5000 ms connection/query limits.
- At most two route requests are in flight. The scraper check reuses the catalog-status response rather than issuing another request.
- Concurrent health requests share one probe round. Completed reports are cached per local server for 30 seconds, or five seconds for an unavailable report. Report timestamps remain visible; results are copied so consumers cannot mutate cached reports.
- Actual database, public core-route and unavailable/empty-question-bank failures remain unavailable with HTTP 503. Malformed JSON, HTTP failures, timeouts and connection failures have bounded, safe reasons; credentials and arbitrary database exception messages are never returned.
- Slow responses, partial/stale catalog runs and noncritical catalog reporting/collection failures produce a degraded HTTP 200 report, never a false all-healthy report. Collection failures remain visible independently of assessment readiness.
- The admin dashboard supports healthy, slow, warning and unhealthy reports, displays reasons and provides a catalog-review link. Its metric counts healthy services rather than implying all nonhealthy checks are disconnected.
- Catalog processing verifies a source's allowed domain against the associated school's official website before fetching or saving data. Legacy HTTP website metadata is checked by hostname only; actual scraped URLs continue to require HTTPS and the robots policy is unchanged.

## Verification and rollout

All 221 backend tests ran with 219 passing and two opt-in tests skipped. All 118 frontend tests passed, with lint and build passing. Tests cover unavailable/empty questionnaires, genuine 500 and database failures, malformed responses, partial/all-failed collections, blocked-source warnings, safe reason text, bounded concurrency, cached/in-flight report sharing and source ownership. Browser checks confirmed warning and failed states, route details and desktop/mobile layout.

Against the actual database with a one-connection local pool, the new report showed the database connected and assessment healthy in 352 ms, with catalog access restrictions explicitly shown as a warning. The first report took 1450 ms and the cached report took 2 ms. Migration 020 was tested in a rollback-only transaction: exactly one association changed, all 17 source ownership checks passed, and hashes of schools, programs, offerings and saved assessment tables were unchanged. The source correction was rolled back and the original source snapshot retained outside Git. No collection job was run, no assessment was submitted, and no protected data was exported.

The frontend and backend must deploy together because the health response includes degraded/slow/warning states; older clients only accept the previous status values. The external 403 sources still require verified manual maintenance or permission/an accessible authorized source; no health check can grant that access.

## Production rollout on 2026 10 13

At the user's deployment request, migration 020 was applied and both applications deployed. Backend deployment `dpl_9vbqJzrMe6XshqksZYvc9rBqRUuB` serves `https://xlore-u-api.vercel.app`; frontend deployment `dpl_8BaBxsxawsDr6EQQCJq8YpGAW268` serves `https://xlore-u-beta.vercel.app`, bundle `/assets/index-By0Ii8RG.js`. Both are Ready.

Before/after database hashes confirmed that the migration changed only the intended source association and its update timestamp. Other source records and failure history were preserved. The catalog retained 100 schools, 678 programs and 1858 school offerings; 25 questionnaire records and all 12 assessments, 240 responses, 12 career profiles and 576 recommendations remained unchanged by the migration.

Two live health requests returned HTTP 200 with degraded status, a healthy database and healthy assessment (1691 ms). The catalog warning explicitly reported the 15-of-16 partial run and two access-blocked sources. The second request reused the same report timestamp and took 290 ms over the network, versus 2867 ms for the initial request. Live questionnaire availability confirmed 20 active questions. The deployed frontend contains the new warnings, reasons and catalog review link. No collection job, assessment submission, commit or push was performed during this deployment.

## Region alignment on 2026 10 13

At the user's explicit request, backend `vercel.json` was added with the single function region `hnd1` (Tokyo, AWS `ap-northeast-1`), matching the configured Supabase pooler region. No runtime routes, database credentials, authentication settings or database records were changed. The single region is saved in source configuration so future deployments using this checkout retain it. The file remains uncommitted until a separate commit request.

Backend deployment `dpl_3T3UWXNhCdPKkF79tJ8hBZsdEinT`, URL `https://xlore-u-bk0txfoz2-unicourse02-2670.vercel.app`, is Ready and serves the existing API aliases. Vercel inspect reports the API function in `hnd1`; live response IDs also confirm execution in `hnd1`. The build itself ran in Washington; build location is not function execution location.

Read-only live checks confirmed HTTP 200 from health, school/program catalogs and assessment questions, the expected frontend CORS origin, 20 available active questions, a responding frontend and HTTP 401 for anonymous administrator settings access. One check measured database health at 27 ms and assessment at 54 ms. These are observed samples, not a controlled performance benchmark or an uptime guarantee. All 222 backend tests ran with 220 passing and two opt-in tests skipped; syntax checks passed for 95 files.

The most recent catalog run changed independently to a manual failed run (zero of one sources succeeded, finished 2026-10-13T11:46:33Z). Catalog collection remains explicitly failed while database/assessment readiness stays operational. Both configured blocked-source records still report HTTP 403. No scraper run was started and no failure record was overwritten during region alignment; those external collection issues are not resolved by moving the API.
