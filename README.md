# Xlore U — Backend

Student enrollment extension (22 October 2026): dashboard self-reports, private admin student search, school/city analytics, reasoned suspension/restore and suspension-email retry. Requires migration 029 before deployment; see [student enrollment guide](docs/student-enrollment.md).

The Node.js/Express REST API for Xlore U, a school and college-program exploration platform for Metro Manila students. PostgreSQL is hosted on Supabase; application accounts and authorization are handled by this backend, not Supabase Auth.

Documentation reviewed against the source on **19 October 2026**. This date is not a claim that production data, credentials, or every external source was retested.

## Documentation

- [Institution accounts, school posts, likes, comments, replies, notifications and rollout](docs/institution-portal.md) — added 20 October 2026; migrations 024–028 required before deployment, including private moderation reasons and suspension email status/retry.
- [Documentation index and reading order](docs/README.md)
- [Simple system walkthrough and architecture](docs/system-overview.md)
- [API reference and current request formats](docs/api-reference.md)
- [Database structure and migrations](docs/database-guide.md)
- [Configuration, setup, deployment, testing, and troubleshooting](docs/operations.md)
- [Assessment rules and editable settings](docs/assessment-template-v2.md)
- [Health reporting](docs/health-checks.md)
- [Catalog collection and AI modes](docs/catalog-collection.md)

## What the backend does

- Email registration/verification, Google sign-in, password recovery, sessions, and profile updates.
- Server-enforced new-account policy acceptance and optional private home pins.
- School/program searches, detail pages, media delivery, saved items, and three-school comparisons.
- Editable assessment questions, routing/settings, read-only preview, saved answers, and recommendations.
- Personalized dashboard, school-visit records, and release-based student feedback.
- Protected administrator catalog/media management, assessment management, logs, and collection controls.
- Separate institution sign-in/registration, one-school admin-approved claims/new-school requests, own-school editing, institution name/password account settings, moderated school posts, student likes/comments.
- Official-source collection in Standard, AI, or Hybrid mode with per-source outcomes and change history.
- Bounded health checks for the database, questionnaire availability, public routes, and recorded collection results.

## Technology

| Part | Technology |
| --- | --- |
| Language/runtime | JavaScript ES modules on Node.js |
| HTTP server/API | Express 5, JSON REST endpoints |
| Database | PostgreSQL hosted on Supabase, using `pg` |
| Passwords and sessions | bcrypt, JWTs, hashed refresh-token records |
| Google verification | Google Auth Library |
| Email | Nodemailer and configured SMTP |
| Page extraction | Cheerio, robots-parser, optional ScrapeGraphAI |
| Configuration/security middleware | dotenv, Helmet, CORS, express-rate-limit |
| Hosting | Vercel; backend region configured as Tokyo (`hnd1`) |

Exact dependency versions are recorded in `package-lock.json`. Installed packages alone do not prove that a feature is used: the normal database path is `pg`, not the Supabase browser Data API.

## Local setup

Use Git, npm, and a supported Node release. `package.json` declares Node `>=20`; choose a release also supported by the frontend toolchain. Keep your Node version consistent with the team's deployment settings.

If this checkout does not exist yet:

```powershell
git clone -b backend https://github.com/krizuwi/xlore-u.git xlore-u-backend
Set-Location xlore-u-backend
```

Inside the backend folder:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Configure `.env` with your private PostgreSQL connection, two different strong JWT signing secrets, and the frontend origins. Use values supplied by the project owner/provider; do not invent a database hostname or copy secrets into source files.

For a persistent local server, copy a **direct/session** connection from Supabase's Connect dialog. For serverless runtime use the transaction pooler; migrations need a separate direct/session `MIGRATION_DATABASE_URL`. See [operations](docs/operations.md) and [pooling details](docs/vercel-database-pooling.md).

Then:

```powershell
npm run migrate:status
npm run migrate
npm run dev
```

`migrate` changes the database selected by the connection string. Verify the target and backup arrangements first; do not use a shared production database for experiments. Migration status can create its tracking table on a completely new database.

The API normally runs at `http://localhost:4001/api`. `npm run dev` first checks Google HTTPS, migration status, and email configuration; a failed prerequisite can prevent startup. `npm start` runs the server without those preflight scripts, but does not fix missing configuration or schema.

**Local startup may start real collection:** `CATALOG_UPDATE_ENABLED` defaults to true. Set it to false for documentation work, demonstrations, and tests where catalog updates or AI credit use are not intended.

## Commands

| Command | Purpose / side effects |
| --- | --- |
| `npm run dev` | Preflight checks, then nodemon; can start the local collection scheduler |
| `npm start` | Start the API; can start the local scheduler |
| `npm test` | Automated tests; live PostgreSQL tests require explicit opt-in |
| `npm run check` | JavaScript syntax checks |
| `npm run migrate:status` | Show schema migration state |
| `npm run migrate` | Apply pending SQL migrations to the configured database |
| `npm run db:init` | Alias for `npm run migrate` |
| `npm run google:check` | Check Google signing-key HTTPS connectivity, not a full user login |
| `npm run email:check` | Check configured SMTP without sending an email |
| `npm run catalog:status` | Read collection/source status |
| `npm run catalog:check` | Fetch/check official sources; no catalog writes, but makes external requests |
| `npm run catalog:update` | Run collection; writes catalog/history and may use AI credits |

## Source map

```text
src/app.js                 Express middleware and registered API routers
src/server.js              Persistent server startup; scheduler excluded on Vercel
src/config.js              Validated environment configuration
src/routes/                HTTP endpoints and auth/error middleware
src/services/              Assessment, proximity, catalog, email, media, feedback
src/db/                    PostgreSQL connection pool and query adapter
src/utils/                 Security helpers, search, health checks, errors
database/migrations/       Ordered, tracked SQL migrations
database/*.json            Assessment seed/template data, not the live authority
scripts/                   Migrations, diagnostics, maintenance
test/                      Unit and regression tests
requests.http              Manual API request examples
```

## Key rules and limitations

- The starting assessment has 15 equal-vote career questions plus five unscored practical questions. Active admin mappings/settings determine the current flow; adding/archiving core questions can change the count.
- Recommendations are rule-based field/catalog matching, not an AI prediction or probability of success. Admin changes do not automatically rescore stored attempts.
- One assessment is the default; an administrator can explicitly enable repeat attempts. Do not reset a student's data just to demonstrate the assessment.
- Distances use the confirmed home pin first, otherwise a labeled city-center estimate when available. They are straight-line kilometres, not road distance or travel time.
- Unknown offering tuition stays `NULL`, not zero or an invented price. Source facts and media rights still need human review.
- Admin access is restricted by the existing server-side verified-account allowlist, not a general multi-role management system. Keep its sign-in identity separate from public support documentation.
- AI/Hybrid require a backend-only `SGAI_API_KEY`; timeout defaults to 120000 ms. A configured key does not prove valid credits or a successful run.
- The persistent local server starts the scheduler; Vercel does not. A saved schedule alone does not provision a cron/worker.
- New-account policies are drafts pending owner review and a real public contact. Do not claim legal certification or an implemented deletion/retention workflow.

## Production and collaboration

The website is [www.xloreu.com](https://www.xloreu.com). Its separate API is `https://xlore-u-api.vercel.app/api`. Vercel hosts both applications; Supabase hosts PostgreSQL; GoDaddy manages the domain/DNS.

Use the backend Vercel project for database, JWT, SMTP, Google verification, and ScrapeGraph settings. Never put them in frontend `VITE_*` values or uploaded files. The API's `FRONTEND_URL` is a comma-separated allowlist of exact frontend origins.

Work on branch `backend`. Review `git status`, fetch teammate changes, and preserve local work before merging. After reviewing and committing intended changes, use `git push origin backend`. A commit, a push, and a deployment are separate operations; see the [release checklist](docs/operations.md#release-checklist).
