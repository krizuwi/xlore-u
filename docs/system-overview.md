# Xlore U: simple system walkthrough

Source reviewed **19 October 2026**. This guide explains the implementation, not a certification of assessment accuracy, catalog accuracy, security completeness, or legal compliance.

## What the system is for

Xlore U helps students explore Metro Manila schools and college programs, identify a field to investigate through an interest assessment, and save or compare options. It supports decision-making; it does not apply to universities or guarantee admission.

## How the parts connect

```text
Student / Administrator
         |
         v
React website on Vercel       www.xloreu.com
         |
         | HTTPS requests and JSON responses
         v
Express API on Vercel         xlore-u-api.vercel.app/api
         |
         | Private parameterized SQL queries
         v
PostgreSQL on Supabase        Accounts, catalog, assessments, history

Other connections from the system:
  Google Identity Services    Sign-in credential, verified by the backend
  SMTP                       Verification and password-reset emails
  Official school websites   Reviewed catalog sources
  ScrapeGraphAI              Optional AI-assisted collection
  Google Maps / OSM tiles    Map display; no road-distance calculation
```

GoDaddy manages the domain/DNS; it does not run the application server or hold the application database. Supabase hosts PostgreSQL, but the application uses its own Express authentication and `pg` database connection rather than Supabase Auth or direct browser table access.

## Languages and tools

| Name | What it does here |
| --- | --- |
| JavaScript | Frontend behavior and backend logic |
| JSX / HTML | React screen structure and the browser entry document |
| CSS | Styling, themes, alignment, and responsive layouts |
| SQL | Database structure, queries, and migrations |
| JSON | API messages, settings, and structured stored data |
| React / React Router | Components, page state, and navigation |
| Node.js / Express | Runs the backend and receives HTTP requests |
| Vite / npm | Frontend builds, dependencies, and project commands |
| Git / GitHub | Local version history and team code sharing |
| Vercel / Supabase | Application hosting and database hosting |

The product uses JavaScript, not a separate Python machine-learning model. SQL data is relational, with JSONB used where structured snapshots/settings are useful.

## A student's journey

1. **Explore:** Browse school/program directories and school details without signing in.
2. **Register:** Enter account information, accept the current agreement, and verify the emailed code. Google can create an account too, with agreement required for new users.
3. **Sign in:** The backend verifies credentials and returns access/refresh tokens. Protected requests send the access token.
4. **Take the assessment:** Load the current questions, answer them, complete the applicable follow-ups, and submit once by default.
5. **Review results:** Explore matching catalog programs and schools; filters narrow the displayed results, not the original answers.
6. **Save and compare:** Save schools/programs and compare up to three schools and their offerings.
7. **Return:** The dashboard shows saved/history information and suggested schools. Its responsive, fixed-size slideshow uses a 10-second timer with manual controls.
8. **Maintain profile:** Edit profile information and optionally save/remove a confirmed home pin. No background location tracking is required.

## How the assessment recommends options

The seeded questionnaire has **15 equal-vote career questions plus five unscored practical questions**. The live bank is editable, so the number of career questions is derived from active mappings rather than permanently fixed at 15.

Career answers vote toward Analytical, Creative, People-Oriented, or Practical. A leading profile determines the field follow-up; the default tie policy lets the student choose among tied leading profiles. An optional configured career-launch follow-up adds context without adding votes.

The backend matches the selected field to eligible active catalog programs with actual available-school offerings. Administrators can edit cluster rules, explicit program inclusions/exclusions, degree eligibility, school priority, labels, result display, and attempt policy. A preferred school cannot invent an offering or bypass a hard limit.

Tuition importance is not an exact peso budget. Travel minutes are not kilometres. Explicit tuition/distance limits exclude unknown values when those values are necessary to prove eligibility. Not every practical preference is a hard matching constraint.

Answers and the relevant rule/settings snapshot are saved. Previous answers are not silently rescored when an administrator edits the questionnaire. Current catalog activity/offerings and the student's current location can affect what is displayed when reopening a result; the entire catalog is not frozen forever inside an assessment snapshot.

This is **configurable rule-based guidance**, not AI prediction, a validated aptitude score, or a probability of success. ScrapeGraphAI is for catalog collection, not student scoring.

## What administrators control

Protected screens manage universities, programs, categories, school offerings and tuition, permitted media, assessment questions/routing/settings, source configuration, collection outcomes, feedback, and audit history. Categories are program category values, not a separate categories table or dedicated categories API.

The assessment preview uses server rules without saving a student's attempt. Configuration and question-bank version checks prevent a stale editor/attempt from silently using a changed configuration.

Authorization is enforced in the API as well as the UI. The present admin allowlist is not a general-purpose role-assignment or multi-admin management feature.

## How collection works

Configured official HTTPS pages are checked against allowed hosts, school ownership, robots rules, pacing, timeouts, and response-size limits. The collector discovers official degree links and supported structured/public data, validates the information, and records results and catalog changes.

- **Standard:** direct discovery and deterministic parsing.
- **AI:** direct discovery first, hosted ScrapeGraphAI extraction when needed.
- **Hybrid:** direct/standard extraction first, AI fallback when needed.

AI/Hybrid need a backend key and can consume credits. Provider output is not automatically independently verified page evidence; see the [collection guide](catalog-collection.md) and [operations](operations.md). Failed sources remain visible. A failed fetch does not mean existing offerings should be deleted or tuition invented.

Collection uses transaction/savepoint safeguards so failed source updates do not retain partial catalog changes. A long-running local server can run the scheduler. **The Vercel entry point does not start it, and saving a schedule does not provision cron.**

## Maps, privacy, and distance

A school's coordinates identify its location. A student's optional confirmed home pin is private account data. The distance service prefers that point, then a labeled city-center approximation if available, otherwise an unavailable distance.

The Haversine formula calculates straight-line kilometres rounded to one decimal. There is no billed route API converting those values into road distance or travel time. Home selection uses Leaflet/OSM tiles on demand; school maps use Google embeds/links. Viewing external maps/images shares normal request information with those providers.

## Security and maintenance boundaries

Implemented controls include bcrypt password hashes, JWT verification, stored refresh-token hashes, administrator checks, parameterized SQL, input checks, request limits, and security middleware. Browser tokens currently use local storage; rate limits are process-local. These controls are not a claim that a full security audit or distributed abuse protection is complete.

Health reports distinguish database/questionnaire failure from slow responses or external collection warnings. Existing records can remain available while scraping is degraded. Maintain backups and rehearse restoration; do not assume code history is a database backup.

Policy pages remain drafts pending a real public contact, retention/deletion arrangements, and minor-user safeguards. No automated deletion/retention service or self-service account deletion is implemented.

For practical instructions, continue to [operations](operations.md), [API reference](api-reference.md), and [database guide](database-guide.md).
