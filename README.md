# Xlore U Backend

REST API for Xlore U, an intelligent college-program and institution matching platform for senior high school students in Metro Manila.

- Node.js and Express API
- PostgreSQL through the `pg` driver
- Hosted Supabase PostgreSQL for development, so Docker is not required
- Ordered SQL migrations recorded in `schema_migrations`
- Environment-based configuration
- Routes, middleware, services, database configuration, scripts, and tests kept separate
- Vite-compatible frontend API configuration

## Features

- Registration, six-digit verification, login, refresh tokens, logout, and profile/password updates
- Password hashing with bcrypt and short-lived JWT access tokens
- School and college-program directory with search, filters, sorting, and pagination
- Tuition, accreditation, scholarship, program, and map-coordinate data
- Profile assessment with explainable program and institution recommendations
- Assessment history and saved results
- One assessment submission per account; paid retakes are not available yet
- Saved schools and programs
- Side-by-side comparison limited to three schools
- Personalized dashboard summary
- Seed catalog with eight Metro Manila institutions and eight programs
- Automatic weekly refresh from configured official school and program pages
- robots.txt compliance, per-host delays, response limits, trusted-host validation, and source audit logs
- Security headers, CORS, rate limiting, prepared queries, request limits, and centralized errors

## Project structure

```text
xlore-u-backend/
|-- database/
|   `-- migrations/
|       |-- 001_initial_schema.sql
|       |-- 002_seed_catalog.sql
|       |-- 003_catalog_updater.sql
|       |-- 004_catalog_source_tuning.sql
|       |-- 005_clean_scraped_program_names.sql
|       |-- 006_add_sti_global_city.sql
|       |-- 007_keep_sti_campus_url.sql
|       `-- 008_keep_verified_school_address.sql
|-- scripts/
|   |-- migrate.js
|   `-- check-syntax.js
|-- src/
|   |-- db/pool.js
|   |-- middleware/
|   |-- routes/
|   |-- services/
|   |-- utils/
|   |-- app.js
|   |-- config.js
|   `-- server.js
|-- test/
|-- requests.http
|-- .env.example
`-- package.json
```

## Run in VS Code with Supabase

This setup uses Supabase to host PostgreSQL. Only Node.js and VS Code run on your computer.

### 1. Install the prerequisites

Install:

1. [Node.js 20 LTS or newer](https://nodejs.org/)
2. [Visual Studio Code](https://code.visualstudio.com/)
3. Create a free [Supabase](https://supabase.com/) account

For downloading it for the first time:
git clone -b backend https://github.com/krizuwi/xlore-u.git xlore-u-backend

for github push:
cd "YOUR PATH FILE"
git push -u origin backend

for github pull:
cd "YOUR PATH FILE"
git switch backend
git pull origin backend

### 2. Create a Supabase PostgreSQL project

1. Sign in to Supabase.
2. Select **New project**.
3. Choose an organization, project name, region, and a strong database password.
4. Wait until the project finishes provisioning.
5. Open the project and click **Connect** at the top.
6. Select **Session pooler** and copy its connection string.

Session pooler mode is suitable for a long-running local Node server and works on IPv4 networks. Do not manually invent the host or username; copy the complete value shown by Supabase.

### 3. Open Xlore U in VS Code

Use **File > Open Folder** and select the `xlore-u-backend` folder, or run:

```powershell
code .
```

### 4. Install packages

Open **Terminal > New Terminal** and run:

```powershell
npm install
```

### 5. Create `.env`

```powershell
Copy-Item .env.example .env
```

Open `.env` and replace `DATABASE_URL` with the Session pooler connection string copied from Supabase. Replace `[YOUR-PASSWORD]` with the database password.

Example format only:

```text
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@POOLER_HOST:5432/postgres
DB_SSL=require
```

If the password contains characters such as `@`, `#`, `?`, `/`, or spaces, URL-encode the password before placing it in the connection string. Never put the database URL in frontend code or commit `.env`.

`DB_SSL=require` encrypts the Supabase pooler connection without requiring a locally installed provider CA. For strict certificate-chain verification, use `DB_SSL=verify-full` and set `DB_SSL_CA` to the provider CA certificate.

For development, also replace the example JWT secrets with two different long random strings.

### Configure verification and password-reset email

The backend sends both six-digit codes through SMTP. For a Gmail sender, enable
2-Step Verification on the sender account and create a 16-character Google App
Password. Put the following values in the backend `.env` (the app password is
not the normal Gmail password):

```text
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sender@gmail.com
SMTP_PASS=your-16-character-app-password
EMAIL_FROM=Xlore U <your-sender@gmail.com>
```

Keep these settings only in the backend. Run `npm run email:check` to verify the
SMTP login without sending a message. When email is disabled, existing accounts
can still sign in, but account creation, code resending, and password recovery
return a clear configuration error.

### 6. Apply the database migrations

```powershell
npm run migrate
```

Expected first-run output:

```text
Applying 001_initial_schema.sql
Applying 002_seed_catalog.sql
Applied 8 migration(s).
```

Migrations are transactional, run once, and are recorded in `schema_migrations`. Check their status any time with:

```powershell
npm run migrate:status
```

Do not paste the migrations into the browser frontend. They run only from the backend terminal using the private database connection.

### 7. Start the API

```powershell
npm run dev
```

The terminal should show:

```text
Xlore U API is running at http://localhost:4001
```

Open [http://localhost:4001/api/health](http://localhost:4001/api/health). A successful result contains:

```json
{
  "status": "ok",
  "database": "connected"
}
```

After the environment and migrations are configured, you can also press **F5** and select **Run Xlore U API**.

### Automatic catalog updates

The API checks configured official institution pages once a week while the backend is running. The first scheduled check starts about ten seconds after `npm run dev`. If the computer or backend is off, no scheduled check can run; the next check happens after the server starts again.

Run an update immediately:

```powershell
npm run catalog:update
```

Inspect every source and its latest result:

```powershell
npm run catalog:status
```

The updater adds newly discovered bachelor programs, links confirmed offerings to their institution, refreshes official website/profile details, and records every database change in `catalog_change_log`. It never removes an offering merely because a page is temporarily unavailable. Unknown tuition is stored as `NULL` and shown as **Contact school**, rather than inventing a price.

Only URLs in `catalog_sources` are fetched. Each URL has an `allowed_host`; redirects outside that official domain are rejected. Pages blocked by robots.txt, anti-bot protection, an invalid content type, or a response-size limit are skipped and recorded in the status instead of being forced.

Control the schedule in the backend `.env`:

```text
CATALOG_UPDATE_ENABLED=true
CATALOG_UPDATE_INTERVAL_HOURS=168
CATALOG_REQUEST_TIMEOUT_MS=15000
CATALOG_MAX_RESPONSE_BYTES=5000000
CATALOG_MIN_HOST_DELAY_MS=1500
CATALOG_MAX_SOURCES_PER_RUN=20
```

Restart `npm run dev` after changing these settings. To add another institution source, add a row to `catalog_sources` using the official HTTPS URL, the official base domain in `allowed_host`, and either `school_profile` or `program_catalog` as its type.

### 8. Test the complete flow

Install the VS Code **REST Client** extension, open `requests.http`, and click **Send Request** in this order:

1. Health check
2. Browse schools
3. Register
4. Open the verification email and copy its six-digit code
5. Verify the email
6. Log in
7. Paste the returned access token into the variable at the top of `requests.http`
8. Submit an assessment
9. Open the dashboard

Password-reset codes use the same configured sender and expire after 15 minutes.

## Alternative: locally installed PostgreSQL

If you do not want a hosted database, install PostgreSQL directly on Windows instead of Docker. Create a database named `xlore_u`, then use:

```text
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/xlore_u
DB_SSL=disable
```

Run `npm run migrate` and `npm run dev` exactly as above. Supabase is recommended for the simplest setup because it avoids installing and maintaining the database service on this computer.

## Connect a Vite frontend

Add this to the frontend's `.env`:

```text
VITE_API_URL=http://localhost:4001/api
```

Use a shared API helper:

```js
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4001/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error?.message ?? "Request failed");
  }
  return response.status === 204 ? null : response.json();
}
```

The browser calls only the Express API. It does not receive the PostgreSQL password or connect directly to Xlore U tables in Supabase.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Check Google and PostgreSQL, then start the API with automatic restart |
| `npm start` | Start normally |
| `npm run migrate` | Apply pending PostgreSQL migrations |
| `npm run migrate:status` | Show applied and pending migrations |
| `npm run catalog:update` | Refresh catalog data from official pages now |
| `npm run catalog:status` | Show the latest result for each catalog source |
| `npm test` | Run recommendation tests |
| `npm run check` | Check JavaScript syntax |

## API route summary

| Method and path | Authentication | Purpose |
|---|---:|---|
| `GET /api/health` | No | API and PostgreSQL health |
| `POST /api/auth/register` | No | Create an account |
| `POST /api/auth/verify-email` | No | Verify the six-digit code |
| `POST /api/auth/resend-verification` | No | Generate a replacement code |
| `POST /api/auth/login` | No | Get access and refresh tokens |
| `POST /api/auth/refresh` | No | Renew the access token |
| `POST /api/auth/logout` | No | Revoke the refresh session |
| `GET/PATCH /api/auth/me` | Yes | Read or update the user |
| `GET /api/schools` | No | Search and filter institutions |
| `GET /api/schools/meta/filters` | No | Get directory filter options |
| `GET /api/schools/:id` | No | Get institution details |
| `GET /api/programs` | No | Search and filter programs |
| `GET /api/programs/:id` | No | Get program details |
| `GET /api/assessments/questions` | No | Get assessment questions |
| `POST /api/assessments` | Yes | Score and save the first assessment; repeat submissions return 409 |
| `GET /api/assessments` | Yes | Get assessment history |
| `GET /api/assessments/:id/results` | Yes | Get previous results |
| `GET /api/saved` | Yes | Get saved schools/programs |
| `POST/DELETE /api/saved/schools/:id` | Yes | Save/remove a school |
| `POST/DELETE /api/saved/programs/:id` | Yes | Save/remove a program |
| `GET /api/comparison` | Yes | Get the active comparison |
| `POST/DELETE /api/comparison/schools/:id` | Yes | Add/remove a comparison school |
| `DELETE /api/comparison` | Yes | Clear the comparison |
| `GET /api/dashboard` | Yes | Get the personalized summary |
| `GET /api/catalog/status` | No | Get the latest catalog updater summary |

## Production notes

### Checking Google sign-in connectivity

Run `npm run google:check` in the same terminal used to start the API. It fetches
Google's public signing keys through the same HTTPS transport as sign-in; no
account or ID token is needed. The expected output is `Google HTTPS verification
passed`. It also reports the Node version and number of Windows trust roots.

On Windows, use a current Node 24 LTS release so Node can read the system trust
store. Google's client is configured with explicit default and system trusted
certificates and continues to enforce HTTPS certificate verification. After
restarting the backend, its startup output includes `Google HTTPS: explicit
trusted certificates`. If the check still fails, its network error code can be
used to diagnose the certificate or connection problem. Never disable TLS
verification to make sign-in work.

- The migration enables PostgreSQL row-level security on application tables without browser policies. This prevents Supabase's public Data API from becoming a second, unintended path around the Express API.
- Use a separate least-privilege PostgreSQL runtime role before production. Use the owner connection only for migrations.
- Keep `DATABASE_URL`, JWT secrets, and email credentials only in backend environments.
- Seed tuition, ratings, accreditations, and scholarship information are demonstration data and must be verified before public release.
- Automatic extraction is limited to facts present on configured official pages. Keep the source list reviewed and check `catalog_change_log` before treating scraped data as authoritative.
- Validate assessment questions and scoring with qualified educators or guidance counselors before treating recommendations as formal advice.
