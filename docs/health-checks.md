# API health checks

`GET /api/health` and `GET /api/health-check` call `getSystemHealth(apiUrl)`.
Both return HTTP 200 when all executed checks pass, or 503 when any fail.
Always parse the response JSON, including for HTTP 503.

## Route checker

`checkAllRoutes(apiUrl)` accepts a backend base URL including `/api` and returns
an object keyed by HTTP method and route pattern, for example `GET /schools`.

The checker requests these public endpoints concurrently:

- `GET /schools?limit=1`
- `GET /schools/meta/filters`
- `GET /programs?limit=1`
- `GET /assessments/questions`
- `GET /catalog/status`

After the list requests finish, it checks `/schools/:id` and `/programs/:id`
using the first returned record IDs. Empty or failed lists cause detail probes
to be skipped. No records are created for health checks.

Each executed route returns `status` (`healthy` or `unhealthy`) and
`responseTime` in milliseconds. Requests time out after three seconds, reject
redirects, and require a successful HTTP status and valid JSON. This checks
availability, not every response field or business workflow. Detail requests
depend on list requests, so the route check can take about six seconds.

Protected GET routes, action routes (POST/PATCH/PUT/DELETE), and both health
routes appear with `status: "skipped"` and a `reason`. A skipped route is **not
verified healthy** and does not make the aggregate unhealthy. Protected and
action routes need separate integration tests with credentials and isolated
fixtures. Calling a health route from itself would cause recursion.

## System response

`getSystemHealth` returns:

- `status`: `ok` or `unavailable` based on executed checks.
- `database`: `connected` or `disconnected`.
- `timestamp`: ISO timestamp.
- `checks.database`: dedicated PostgreSQL `SELECT 1` probe.
- `checks.assessment`: the assessment route result, retained for the frontend.
- `checks.scraping`: validates the latest recorded catalog run, including its age.
- `routes`: the complete route inventory and each result or skip reason.

Scraping health checks recorded results; it does not start a scrape. The
catalog status endpoint is also checked separately for HTTP availability.

The existing dashboard consumes `checks`; consumers can iterate over `routes`
to display the additional results. Maintain `PUBLIC_ROUTES`,
`PROTECTED_ROUTES`, and `ACTION_ROUTES` in `src/utils/api-health-check.js` when
adding or changing routes. The inventory is explicit, not auto-discovered.

## Verification

From `backend/xlore-u`, run `node --test test/health.test.js`.
The tests use local HTTP requests and mocked dependencies; they do not verify
the production database or live scraping sources.
