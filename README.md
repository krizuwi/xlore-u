# Xlore U — Frontend

Xlore U helps students explore Metro Manila schools and college programs, complete an interest-based assessment, and save or compare their options.

This folder contains the real student website and protected administrator interface, not a sample admin dashboard. Documentation reviewed against the source on **19 October 2026**; live records and service health can change independently.

## Start here

- [About Us and private Contact Admin conversations](docs/about-and-contact.md) — footer links, student/institution form, admin replies, account notifications and private history; backend migrations 030–031 required before rollout.
- [Documentation index](docs/README.md)
- [Student and administrator guide](docs/user-guide.md)
- [Frontend architecture and integration](docs/frontend-guide.md)
- [Inactivity notices and background refresh](docs/engagement.md)
- [AdSense verification and controlled ad activation](docs/adsense.md) — publisher script and verification are configured; the manual homepage unit stays off by default. Google Auto ads is controlled separately in AdSense.

System architecture, API, database, and operations guides live in the **backend branch** of the same GitHub repository under `docs/`. They are not included by checking out only this branch.

## Technology

| Part | Technology |
| --- | --- |
| Screens and reusable components | React 19, JavaScript, JSX |
| Navigation | React Router 7 |
| Styling and layout | CSS |
| Development and production build | Vite 7 |
| Icons | Lucide React |
| Optional home-pin map | Leaflet 1.9.4 and OpenStreetMap tiles |
| Backend connection | Browser Fetch API, JSON, Bearer tokens |

JSX describes React elements; it is not a separate backend language. Exact dependency versions are recorded in `package-lock.json`.

## Main features

- Institution extension added 20 October 2026: separate sign-in/signup, one-school approval/new-school requests, approved-school profile/program/media/post workspace, institution name/password account settings, conditional School posts tab, student likes/comments, official school replies, administrator comments/replies, admin review/moderation by school, private moderation-reason notifications and suspension-email status/retry. Admin activity alerts are limited to participated comment threads. Requires backend migrations 024–028 and coordinated deployment; see [institution guide](docs/institutions.md).
- Public home page, school/program directories, detail pages, and school map.
- Email registration/verification, Google sign-in, password recovery, and profile editing.
- Required agreement for new accounts, with Terms and Privacy pages.
- Configurable rule-based assessment, saved results, and separate result filters for programs and schools.
- Saved schools/programs and comparison of up to three schools.
- Personalized dashboard, fixed-size responsive slideshow, 10-second slide timer, and playback controls.
- Optional confirmed home pin; estimates are straight-line distances, not road distances or commute times.
- Shared school logos and save buttons, responsive layouts, light/dark themes, and unsaved-change protection.
- Protected admin catalog, assessment, collection, health, feedback, settings, and activity screens.

## Run locally

Prerequisites: Git, npm, and a Node.js version supported by the installed Vite release. Check the installed Vite package's `engines.node`; the backend's broader `>=20` declaration is not the frontend requirement. Keep the team's local and deployment versions consistent.

Clone each branch into its own folder if you do not already have the project:

```powershell
git clone -b frontend https://github.com/krizuwi/xlore-u.git xlore-u-frontend
git clone -b backend https://github.com/krizuwi/xlore-u.git xlore-u-backend
```

Follow the backend README to configure PostgreSQL, private environment variables, and migrations first. Do not copy a teammate's private `.env` into Git.

Inside the frontend folder:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Set these public frontend values in `.env` as needed:

```dotenv
VITE_API_URL=http://localhost:4001/api
VITE_GOOGLE_CLIENT_ID=your-web-oauth-client-id
VITE_PUBLIC_SUPPORT_EMAIL=your-real-public-support-address
```

The last two values are placeholders, not working credentials or mailboxes. The public support address must be a real project-owner-approved contact, not an automatic administrator-email fallback. Restart Vite after changing environment values.

Open the URL printed by Vite, normally `http://127.0.0.1:5173`. Add that exact origin to the backend `FRONTEND_URL` allowlist. `localhost` and `127.0.0.1` are different origins. Google sign-in also needs the exact origin authorized in the existing Google Web OAuth client.

All `VITE_*` settings can appear in browser assets. Never put database passwords, JWT signing secrets, SMTP passwords, or `SGAI_API_KEY` here.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite development server |
| `npm test` | Run the automated Node test suite |
| `npm run check` | Run ESLint |
| `npm run build` | Build the site into `dist/` |
| `npm run preview` | Preview an existing build locally |

## Source map

```text
src/
  App.jsx             Public, protected student, and admin routes
  pages/              Student screens and account-policy pages
  components/         Cards, logos, save buttons, slideshow, home-pin picker
  context/            Authentication, engagement, feedback, unsaved changes
  lib/                API client, validation, result filters, media helpers
  admin/              Admin screens, catalog editors, assessment, scraping
  index.css           Shared styles and responsive layouts
build/                Feedback-release build plugin
public/               Public static assets
test/                 Regression tests (some tests also live under src/)
```

## Production and collaboration

The canonical website is [www.xloreu.com](https://www.xloreu.com); `xloreu.com` redirects to it. The frontend calls the separate Express API at `https://xlore-u-api.vercel.app/api`. Vercel hosts the applications; GoDaddy manages the custom domain/DNS.

Configure public `VITE_*` variables in the frontend Vercel project **before building**. Changes require a new frontend build/deployment. The SPA rewrite in `vercel.json` supports direct page links; `feedback-release.json` is served with no-store caching. Upload from the frontend folder and verify the correct Vercel project before publishing.

Work on branch `frontend`. Review changes before committing or integrating teammate work. Commit, push, and deployment are separate actions; none is implied by editing files.

```powershell
git status
git branch --show-current
git fetch origin
```

After reviewing and committing your intended changes, the push command is `git push origin frontend`. Do not force-push or discard local changes to synchronize branches.

## Important limits

- Assessment routing is not an AI prediction, psychometric diagnosis, or admission guarantee.
- Background refresh uses polling; it is not a Supabase Realtime subscription and does not replace an old application bundle after a deployment.
- Health reports can be degraded while student features remain available; external collection failures need separate review.
- Tokens currently use browser local storage. Treat XSS prevention as important; do not describe this as cookie-based authentication or complete security hardening.
- Policy pages remain drafts until the owner completes contact, retention/deletion, and minor-user review. No self-service account deletion is implemented.
- Some third-party maps, photos, Google sign-in, email, and AI collection depend on external availability/configuration.

Use the current guides above instead of older prototype descriptions or screenshots.
- Student enrollment self-reports from the dashboard and private admin student management, school/city charts, reasoned suspension/restore and suspension-email retry. Requires backend migration 029; see [enrollment guide](docs/student-enrollment.md).
