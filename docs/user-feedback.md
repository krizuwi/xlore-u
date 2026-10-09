# User feedback

Verified student accounts can submit **one feedback per section per release**:
Assessment, Compare, Map, and School pages. All school details share the School
pages quota; the school that triggered the prompt is recorded with the feedback.
Stars must be integers from 1 to 5. Comments are optional, up to 1,000 characters.
These ratings measure the user's experience, not school quality or ranking.

The dialog opens after leaving a section through a page/menu link, browser Back,
or programmatic navigation. Navigating from the assessment to its results is not
an exit. Navigation is never blocked. Closing the browser/tab or navigating to an
external website cannot reliably show a custom dialog; no unload trapping is used.
"Not now" and Escape suppress that section for the current browser session.
Successfully submitted sections are tracked in PostgreSQL across devices/logins.
Submission is immutable and race-safe through a database unique constraint.

Admins can review stars, comments, author, section, school context, date, and update
identifier on their dashboard. Filter by section, stars, or current update; older
feedback remains visible by default. Summaries use only actual submitted ratings.
Only the existing verified administrator can access this report. RLS prevents
direct browser access, and comments are rendered as plain React text.

## Setup / deployment

Run `npm run migrate` using a direct/session `MIGRATION_DATABASE_URL` (or the local
session `DATABASE_URL`). Migration 016 adds the feedback table without changing
existing users or assessments. Do not run the migration runner through transaction
pooling, because it uses session advisory locks.

Deploy the backend and frontend only when requested. Each backend Vercel deployment
gets a distinct cycle from `VERCEL_DEPLOYMENT_ID` / `VERCEL_URL`. Each frontend build
generates a fresh `feedback-release.json`; the backend reads it only from an origin
already configured in `FRONTEND_URL`. Frontend and backend deployments independently
open a new cycle. The trusted manifest is cached for at most 60 seconds and checked
when users leave a feedback section. A redeployment never deletes old feedback.
Stale submissions receive 409, retain their draft, and refresh the release before retrying.

Keep production `FRONTEND_URL` set to the canonical HTTPS frontend origin. No API
keys are needed. Never accept a deployment ID or arbitrary manifest URL from users.
For local testing/persistent non-Vercel deployments, set `FEEDBACK_RELEASE` to a new
label for each intentional update, then restart the API. Ordinary development restarts
do not reset the quota. `FEEDBACK_RELEASE` also permits an intentional extra feedback
cycle without modifying history; Vercel deployment identity remains part of the cycle.
