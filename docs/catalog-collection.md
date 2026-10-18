# Catalog collection: Standard, AI, and Hybrid

Current source reviewed **19 October 2026**. Collection changes school/catalog history and may use paid AI credits. This guide does not claim that every enabled source is reachable or every extracted fact is correct.

## Basic flow

```text
Select intended school / eligible sources
  -> Validate official host and source ownership
  -> Discover/extract facts
  -> Validate programs/profile data
  -> Save each successful source transactionally
  -> Record source snapshots, batch outcome, and changed fields
```

The admin Automation page manages sources/mode/schedule and intended university-specific runs. Finished runs are searchable/filterable and paginated (15 per history page); run detail includes source results, returned items, errors, and saved changes. Older runs can lack the detailed snapshots added by migration 021.

## Sources and discovery

`catalog_sources` stores the school, official URL, allowed host, type, parser settings, enabled state, and schedule/status metadata. Admin source creation requires the university's official HTTPS website and a program catalog on its host/subdomain. It creates/enables profile and program-catalog source records.

Direct fetching enforces trusted HTTPS destinations, school/host ownership, redirect checks, robots policy, pacing, timeout, and response-size limits. Do not bypass explicit robots disallows or use another university's page as a substitute.

For program catalogs, direct discovery reads official degree links and structured page JSON, checking unclear linked pages one level deep with a bounded maximum of 16 detail pages. Recognized BoldDesk sections can use their public article list, paged until the reported count is complete. Incomplete/malformed public lists fail rather than being presented as a complete catalog. Offering records retain available degree/source URLs.

## Modes and evidence limits

| Mode | Behavior |
| --- | --- |
| Standard | Direct official link/structured-data discovery and deterministic parser |
| AI | Try direct discovery; use hosted extraction when appropriate direct discovery is empty or fails |
| Hybrid | Prefer direct/standard results; use hosted extraction when needed |

School profile extraction remains deterministic. The AI path is restricted to program-catalog processing. Explicit robots disallow is not a reason to retry via Hybrid. Some retryable direct HTTP/network/public-list failures can reach the hosted fallback; an external provider's own requests are not the same as our controlled direct fetcher.

There are two hosted extraction evidence levels:

- **HTML-backed:** prepared page content is sent; returned program names are checked against readable supplied text.
- **URL-backed:** the provider receives the trusted official URL. Returned university identity and title structure are checked, but our backend cannot independently prove every returned title appeared on the page if direct content was unavailable. Treat this as provider-supplied information requiring review.

AI names can link existing known catalog aliases; they cannot independently create a new program. Titles discovered from verified official degree links can create qualifying program records. None of these paths guarantees current tuition, a complete degree list, or admission eligibility.

## Configuration and costs

Set `SGAI_API_KEY` only in the backend environment. `SGAI_TIMEOUT_MS` defaults to **120000**. This is separate from the standard page request timeout and does not extend Vercel/platform execution limits.

The admin capability reports key presence, not provider authentication or available credits. Missing keys prevent AI/Hybrid selection. Invalid key, depleted credits, rate limiting, or timeout are explicit failures, not a reason to announce success or silently switch the saved mode. Choosing AI does not necessarily consume credits if direct discovery succeeds, but starting a run may do so.

Never put the key in frontend variables, a README, request screenshots, or source control. A disclosed key requires provider-side rotation; adding an ignore rule does not revoke it.

## Transactions and truthful outcomes

The updater uses a transaction-scoped advisory lock to prevent overlapping work. Per-source savepoints roll back a failed source's catalog updates while preserving successful sources in the batch. Fatal batch database errors roll back batch catalog changes. Empty/no-due-source work should not create misleading successful history.

History can be completed, partial, or failed. Read both succeeded/checked counts and per-source errors; an HTTP 200 from the run endpoint does not by itself mean every source succeeded. The admin UI retains distinct success/partial/failure notifications.

The updater does not remove an offering solely because a source becomes inaccessible. Unknown fees stay unknown (`NULL`); do not infer free tuition from missing data. Review `catalog_change_log` and official source evidence before relying on changed facts.

## Scheduler versus Vercel

`src/server.js` starts the scheduler only for a persistent non-Vercel server. It checks due work after about ten seconds and then each minute, using persisted preferences/source timing. `CATALOG_UPDATE_ENABLED=false` disables startup scheduling; default is true.

Vercel does **not** start this scheduler. Saving Daily/Weekly preferences does not create a cron job, queue, or always-running worker. A durable/serverless-safe scheduled worker is separate work. Do not claim scheduled updates occurred without checking recorded run timestamps.

## Safe maintenance

- `npm run catalog:status`: read existing database status.
- `npm run catalog:check`: fetch/inspect enabled official pages without saving catalog/source outcomes; external traffic still occurs.
- `npm run catalog:update`: perform collection and write outcomes/catalog changes, potentially using AI credits.
- Admin `POST /api/admin/scraping/run`: run an intended selected university's enabled sources.

For 403/robots restrictions, obtain permission or use verified manual catalog maintenance. For empty extraction, find a valid program-containing official page and review its parser/discovery path. For AI failures, check private provider configuration and limits without exposing the key. Preserve history and do not repeatedly run broad collection merely to replace a warning with a green indicator.

See [operations](operations.md), [health reporting](health-checks.md), and the dated [reliability investigation](scraping-reliability.md) for further context.
