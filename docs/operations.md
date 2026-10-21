# Setup, deployment, and maintenance

Source reviewed **19 October 2026**. Commands run against the environment you select; this document does not grant permission to modify production. Never paste private values into issue reports, screenshots, or Git.

## Local setup

1. Clone the `backend` and `frontend` branches into separate folders; see each root README.
2. Use a supported Node/npm version compatible with both packages. Inspect the installed Vite package's Node engine requirement; the backend's `>=20` alone is not sufficient for all frontend releases.
3. Run `npm ci` in each folder to use its lockfile. Deliberate dependency changes require reviewing the resulting lockfile.
4. Create local `.env` files from `.env.example` only if absent. Do not overwrite an existing private configuration blindly.
5. Configure a test/development PostgreSQL database. Copy connection details from the provider; never invent its pooler host/username.
6. Configure private backend secrets, exact frontend origins, and optional services below. Set `CATALOG_UPDATE_ENABLED=false` if automatic collection is not intended.
7. Confirm the database target; review `npm run migrate:status`, then intentionally apply `npm run migrate` using a direct/session connection.
8. Start backend and frontend in separate terminals with `npm run dev`. Backend normally uses port 4001; Vite binds to `127.0.0.1:5173` and prints the actual URL.

The backend's `predev` runs Google HTTPS, migration status, and email configuration checks. `npm start` skips those preflight commands, but still requires valid configuration/schema. A persistent server's scheduler checks due work after about ten seconds, then every minute; it respects saved schedule/source eligibility rather than blindly collecting every minute.

## Environment reference

### Frontend — public build-time values

| Name | Meaning |
| --- | --- |
| `VITE_API_URL` | API base including `/api`; local fallback `http://localhost:4001/api` |
| `VITE_GOOGLE_CLIENT_ID` | Existing Google Web OAuth client ID; must match backend verifier |
| `VITE_PUBLIC_SUPPORT_EMAIL` | Real owner-approved public policy/support contact; no automatic admin-email fallback |
| `VITE_IDLE_NOTICE_TEST_MS` | Development-only accelerated inactivity check; not for production configuration |

All `VITE_*` values are potentially visible to browsers. Restart local Vite after changes; rebuild/redeploy production frontend assets. An example value does not create a working mailbox.

### Backend — private runtime/configuration values

| Name | Meaning / source default |
| --- | --- |
| `NODE_ENV`, `PORT` | Environment and local port; defaults development/4001 |
| `FRONTEND_URL` | Comma-separated exact allowed origins; local default `http://localhost:5173` |
| `DATABASE_URL` | Required PostgreSQL runtime connection |
| `MIGRATION_DATABASE_URL` | Direct/session connection override for migration scripts |
| `DB_SSL` | `disable`, `require` (default), or `verify-full` |
| `DB_SSL_CA` | Required CA certificate for `verify-full`; escaped newlines supported |
| `DB_POOL_MAX` | Default 1 on Vercel, 5 on persistent local server; serverless code caps at 2 |
| `DB_IDLE_TIMEOUT_MS` | Default 1000 on Vercel, 30000 locally; serverless cap 1000 |
| `DB_CONNECT_TIMEOUT_MS` | Default 10000 |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Different strong private signing secrets; development defaults rejected in production |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_DAYS` | Defaults `15m` / 7 days |
| `GOOGLE_CLIENT_ID` | Verifier audience matching the frontend's Web OAuth client |
| `EMAIL_ENABLED` | Default false; email registration/recovery need enabled delivery |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP server, default port 465 and secure true |
| `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Private SMTP credentials and approved sender; sender falls back to configured SMTP user |
| `CATALOG_UPDATE_ENABLED` | Default true; scheduler startup only on persistent server |
| `CATALOG_UPDATE_INTERVAL_HOURS` | Default 168; collection/staleness logic also uses saved preferences/source intervals |
| `CATALOG_REQUEST_TIMEOUT_MS` | Default 15000; distinct from hosted AI timeout |
| `CATALOG_MAX_RESPONSE_BYTES` | Default 5000000 |
| `CATALOG_MIN_HOST_DELAY_MS` | Default 1500 |
| `CATALOG_MAX_SOURCES_PER_RUN` | Default 20 |
| `CATALOG_USER_AGENT` | Collector identification string; review deployment-appropriate identity/contact |
| `SGAI_API_KEY` | Backend-only ScrapeGraphAI key; missing key disables AI/Hybrid selection |
| `SGAI_API_URL` | Hosted API base; default defined in `src/config.js` |
| `SGAI_TIMEOUT_MS` | Hosted AI timeout, default 120000 (120 seconds) |
| `FEEDBACK_RELEASE` | Optional extra server-side release identity input; do not use a user-supplied release as authority |

Vercel supplies platform variables such as `VERCEL`, `VERCEL_URL`, and `VERCEL_DEPLOYMENT_ID`; do not copy platform tokens into source. Specialized maintenance/opt-in-test flags are documented in their scripts/tests, not normal production requirements.

`DB_SSL=require` encrypts transport but this implementation does not validate the certificate chain in that mode. `verify-full` enables chain validation with a supplied CA. Do not equate the two or disable Google HTTPS verification to fix a local certificate problem.

## Email and Google setup

Use SMTP credentials supplied by the sender/provider. With Gmail, an authorized App Password is different from a normal account password or Xlore U password. `npm run email:check` checks configured transport without sending a message; it cannot prove every recipient will receive mail. Disabling email does not disable existing password sign-in, but email registration, resend, and recovery cannot complete normally.

Google uses an ID-token callback verified by the backend. Keep the existing Web OAuth client and matching frontend/backend client IDs. Its **Authorized JavaScript origins** must include every actual frontend origin used, for example:

```text
https://www.xloreu.com
https://xloreu.com
https://xlore-u-beta.vercel.app
http://127.0.0.1:5173
http://localhost:5173
```

Only authorize origins you intend to support. An origin has scheme/host/optional port, not `/login` or another path. `origin_mismatch` is not fixed by changing database passwords or adding a fabricated redirect flow. Backend CORS and Google origins are separate settings. If only an authorized origin changes in Google, a new app client ID/build is not inherently required; client-ID or frontend env changes do require matching rebuild/restart/configuration.

`npm run google:check` tests signing-key HTTPS access, not a full interactive account login. On supported Windows Node versions, the app adds trusted system roots while preserving certificate verification.

## Database and hosting

Use the Supabase **transaction pooler** for Vercel runtime. Keep migration execution on a direct/session connection because it uses a session advisory lock. A small serverless pool avoids reserving too many provider connections. See [pooling](vercel-database-pooling.md) and [database guide](database-guide.md).

Backend `vercel.json` specifies Tokyo (`hnd1`), aligned with the project's database deployment choice. A build log's build-machine region is not necessarily the executing function region. Region alignment reduces avoidable latency; it does not guarantee no timeouts or unlimited capacity.

GoDaddy manages `xloreu.com` DNS, Vercel serves the site, and the canonical frontend is `https://www.xloreu.com` with the root domain redirecting to it. Use the current project's Vercel domain instructions for DNS values, not a copied historical IP/target. Do not alter unrelated NS/MX/TXT records to fix an application API error.

Production frontend origins currently intended for API access are `https://www.xloreu.com`, `https://xloreu.com`, and `https://xlore-u-beta.vercel.app`. Review the actual backend `FRONTEND_URL` configuration; a correct DNS record does not automatically authorize a new origin.

## Release checklist

For the 20 October institution/community extension, first read the [rollout requirements](institution-portal.md#migration-policy-and-verification). Apply any pending 024–028 before the matching backend (026 for admin comments, 027 for notifications, 028 for private moderation/suspension notices), and roll out frontend/backend registration policy version `2026-10-20-v2` together. Approval pauses the school's collection sources; do not re-enable them without reviewing ownership/edit conflicts.

Suspension commits before SMTP is attempted. Check the application's suspension-email status in the admin queue; failed/pending attempts can be retried there after fixing SMTP. An interrupted `sending` lease becomes retryable after two minutes. Restored or superseded suspensions are cancelled before sending. There is no installed background delivery worker: unresolved work requires admin retry. `sent` means SMTP accepted the message, not inbox delivery; a lost DB acknowledgement after acceptance can cause duplicate delivery on retry despite a stable Message-ID. Never test this by suspending a real institution or emailing a real recipient. Verify transport with `npm run email:check` and use mocked SMTP/rollback fixtures for automated tests.

1. **Review work:** Check `git status`, current branch, diff, and teammate changes in each checkout. Preserve unrelated/uncommitted work. Do not force-push, reset, or overwrite configuration to make a merge easy.
2. **Review data changes:** List pending migrations and confirm an appropriate backup/restore plan and target database. Keep applied filenames intact, including both distinct `022` migrations. Do not make the Vercel build apply migrations automatically.
3. **Verify locally:** Run the frontend/backend commands below. Review failures and skip reasons; do not relabel skipped live checks as passed.
4. **Review environments:** Public frontend inputs belong in the frontend project; secrets only in backend settings. Confirm API/CORS/Google origin alignment. Rotate exposed secrets through the relevant provider; changing README text does not revoke one.
5. **Review uploads:** `.gitignore` and `.vercelignore` are separate controls. Exclude `.env*`, environment exports, tokens, caches, unrelated files, and private data. Existing tracked sensitive files need owner-approved removal/history/rotation work; ignore rules alone do not erase them. Never deploy with a public-source flag.
6. **Apply authorized migrations:** Use the reviewed direct/session migration connection. Run only intended pending migrations, not seed resets or destructive recreations.
7. **Deploy intentionally:** Use the correct folder/project. If API contracts change, coordinate both deployments. When using the authenticated Vercel CLI, review `.vercel/project.json` privately, then use `vercel deploy --prod` only when publishing is authorized. A production command changes live aliases.
8. **Smoke-check without writes:** Read health, schools, programs, active questions, page deep links, and expected CORS. Anonymous admin requests should be rejected. Do not register accounts, consume attempts, send recovery emails, or call `/admin/scraping/run` just for health checks.
9. **Report truthfully:** State what deployed, what tests ran, and what warnings remain. A key's presence is not proof of validity/credits. A new release may open a feedback cycle without deleting old responses.

Deployment does not mean the work was committed or pushed. After reviewing/staging intended files and committing on each correct branch, push separately:

```powershell
git push origin frontend
```

```powershell
git push origin backend
```

Run each command in its corresponding checkout. Do not push private `.env` changes; do not assume which branch a terminal is on.

## Verification commands and boundaries

Frontend:

```powershell
npm test
npm run check
npm run build
```

Backend:

```powershell
npm test
npm run check
```

These are the normal automated suite/lint/syntax/build checks, not a full live service audit. Some tests opt in to PostgreSQL with explicit environment flags, including `ASSESSMENT_STORAGE_POSTGRES_TEST=true`; review the relevant test and use an isolated database before enabling one. Rollback fixtures are not permission to experiment on real users.

No ordinary source edit or deployment requires running collection. `catalog:update` changes records/history and may consume AI credits. `catalog:check` fetches external official pages without catalog writes; it is not a purely offline check. A local scheduler can also collect after startup if left enabled.

## Maintenance and troubleshooting

| Symptom | Safe next check |
| --- | --- |
| Site loads but “Failed to fetch” | Network request URL, API health, frontend build-time API URL, exact CORS origin |
| Google `origin_mismatch` | Existing OAuth client and exact authorized JavaScript origin |
| Google verification fails locally | Matching client IDs, system time, supported Node trusted roots, `google:check`; never bypass TLS |
| Connection limit / `EMAXCONNSESSION` | Runtime pooler mode and small pool; use direct/session separately for migrations |
| Missing table/column | Reviewed migration status against the intended database; do not reset schema |
| Assessment unavailable | Question-bank availability, mappings, settings references, admin validation, DB health |
| HTTP 409 during assessment/edit | Used attempt or changed bank/settings version; inspect message, reload/review without deleting old data |
| No recommendations | Selected field, active eligible offerings, explicit filters, unknown fees/location; do not invent a match |
| Scraping warning/403 | Source ownership/official URL, robots/access policy, diagnostic; seek permission or maintain verified data manually |
| AI failure/timeout | Backend key presence, provider validity/credits, selected mode, separate hosted timeout, platform execution limits |
| Schedule saved but nothing runs | Persistent scheduler/worker actually running; Vercel does not start it |
| Missing image | API media URL, attached school reference, remote host permission, upload/rights; uploads alone are not attachment |
| SMTP failure | Enabled flag, sender configuration, SMTP credentials/network; never print the password |

Check source quality after collection: returned records are not proof every fact is correct. Review changed fields/official pages and preserve failures for audit. Do not repeatedly retry blocked sources or scrape broadly just to make the health indicator green.

Establish provider-appropriate database backups and a tested restore process. Document a real support contact, deletion/retention process, and minor-user safeguards before treating draft policies as finished. Current local-storage tokens, process-local rate limits, allowlisted admin identity, and profile-password-change session behavior still warrant security review; no MFA or comprehensive audit is claimed.
