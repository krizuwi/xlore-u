# API health checks

Current contract reviewed against `src/utils/api-health-check.js` on **19 October 2026**. Unlike dated rollout notes, this document describes the present response semantics.

`GET /api/health` and `GET /api/health-check` call `getSystemHealth(apiUrl)`.
Both return HTTP 200 for `ok` or `degraded`, and 503 for `unavailable`.
Database/core-route failures can make the system unavailable; slow responses or
noncritical collection/reporting failures remain visible as degraded without
claiming the assessment is offline. Always parse the JSON, including for 503.

## Route checker

`checkAllRoutes(apiUrl)` accepts a backend base URL including `/api` and returns
an object keyed by HTTP method and route pattern, for example `GET /schools`.

The checker probes these public endpoints with at most two in-flight requests:

- `GET /schools?limit=1`
- `GET /schools/meta/filters`
- `GET /programs?limit=1`
- `GET /assessments/questions`
- `GET /catalog/status`

After the list requests finish, it checks `/schools/:id` and `/programs/:id`
using the first returned record IDs. Empty or failed lists cause detail probes
to be skipped. No records are created for health checks.

Each executed route returns `status` (`healthy`, `slow`, or `unhealthy`) and
`responseTime` in milliseconds. Successful checks over 3000 ms are slow, not
automatically failed. HTTP requests time out after 10000 ms, reject
redirects, and require a successful HTTP status and valid JSON. This checks
availability, not every response field or business workflow. The assessment
also requires a nonempty question list with `availability.available === true`.
Detail probes depend on successful lists; timeout limits are per request,
not a guaranteed total duration for the complete report.

Protected GET routes, action routes (POST/PATCH/PUT/DELETE), and both health
routes appear with `status: "skipped"` and a `reason`. A skipped route is **not
verified healthy** and does not make the aggregate unhealthy. Protected and
action routes need separate integration tests with credentials and isolated
fixtures. Calling a health route from itself would cause recursion.

## System response

`getSystemHealth` returns:

- `status`: `ok`, `degraded`, or `unavailable` based on executed checks.
- `database`: `connected` or `disconnected`.
- `timestamp`: ISO timestamp.
- `checks.database`: dedicated PostgreSQL `SELECT 1` probe, with 5000 ms connection/query limits.
- `checks.assessment`: the assessment route result, retained for the frontend.
- `checks.scraping`: validates the latest recorded catalog run, including its age.
- `routes`: the complete route inventory and each result or skip reason.

Scraping health checks recorded results; it does not start a scrape or consume
AI credits. System computation reuses the already-fetched catalog-status payload
instead of issuing a duplicate request. No sources/run, stale outcomes, partial
collection, or blocked sources produce explicit warnings; a latest all-failed
collection can be unhealthy while the overall student system remains degraded.
Catalog staleness uses twice the configured updater interval.

Concurrent system-health requests share one in-flight check. Completed reports
are cached per process/base URL for 30 seconds, or five seconds when unavailable.
Inspect `timestamp`; cached values are not a fresh full check on every request.
Safe diagnostic codes/reasons avoid returning arbitrary database errors/secrets.

The existing dashboard consumes `checks`; consumers can iterate over `routes`
to display the additional results. Maintain `PUBLIC_ROUTES`,
`PROTECTED_ROUTES`, and `ACTION_ROUTES` in `src/utils/api-health-check.js` when
adding or changing routes. The inventory is explicit, not auto-discovered, and
does not enumerate every admin/feedback/new action route. Use the
[API reference](api-reference.md) for the mounted endpoint inventory. An absent
or skipped health entry must not be described as a successfully tested workflow.

## Verification

From the backend checkout root, run `node --test test/health.test.js`.
The tests use local HTTP requests and mocked dependencies; they do not verify
the production database or live scraping sources.
