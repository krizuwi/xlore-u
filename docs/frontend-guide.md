# Frontend architecture and integration

Source reviewed **19 October 2026**. For startup commands, use the root [README](../README.md). For screen behavior, use the [user guide](user-guide.md).

## Request flow

```text
Page/component -> src/lib/api.js -> Express API -> PostgreSQL
                      ^                 |
                      +--- JSON --------+
```

The frontend is a React SPA. `src/main.jsx` starts the app/providers, `src/App.jsx` defines routes, and React Router changes the visible page. Vite builds browser assets; Vercel's rewrite returns `index.html` for page navigation.

The client never needs PostgreSQL credentials, SMTP credentials, JWT signing secrets, or the ScrapeGraph key. All `VITE_*` values are public build-time inputs.

## Routes

| Access | Paths |
| --- | --- |
| Public | `/`, `/schools`, `/schools/:id`, `/programs`, `/programs/:id`, `/map`, `/login`, `/register`, `/terms`, `/privacy` |
| Signed-in student/account | `/assessment`, `/assessment/:id/results`, `/saved`, `/comparison`, `/dashboard`, `/profile` |
| Admin sign-in | `/admin/login` |
| Authorized admin | `/admin`, `/admin/universities`, `/admin/programs`, `/admin/categories`, `/admin/assessment`, `/admin/settings`, `/admin/logs` |
| Authorized admin collection | `/admin/scraping/overview`, `/admin/scraping/automation`, `/admin/scraping/results`, `/admin/scraping/results/:runId`, `/admin/scraping/results/:runId/sources/:sourceId` |

`/compare-programs` redirects to the protected comparison section. `/admin/scraping` redirects to scraping overview. Unknown student/admin paths show a not-found view. UI guards improve navigation; the API must still enforce permissions independently.

## Where to make changes

| Location | Responsibility |
| --- | --- |
| `src/pages/` | Student screens, auth/profile, assessment/results, policies |
| `src/components/SchoolCard.jsx` | Shared school card |
| `src/components/SaveButton.jsx` | Consistent school/program save control |
| `src/components/SchoolLogo.jsx` | API-provided logo URL and initials fallback |
| `src/components/DashboardSchoolSlideshow.jsx` | Dashboard school slideshow |
| `src/lib/dashboard-slides.js` | Dashboard slide interval constant (10000 ms) |
| `src/components/SchoolHero.jsx` | Separate school-photo carousel (not the dashboard timer) |
| `src/components/HomeLocationPicker.jsx` | Optional on-demand Leaflet map/coordinates/location confirmation |
| `src/lib/assessmentProgramFilters.js`, `src/lib/assessmentSchoolFilters.js` | Separate result filter helpers |
| `src/context/` | Auth, polling/inactivity, feedback, unsaved-change coordination |
| `src/admin/` | Real admin screens, API integration, collection state/notifications |
| `src/index.css` and feature CSS files | Layout, themes, responsive/fixed carousel frames |
| `build/feedback-release.js` | Public release-manifest generation |

The shared logo component uses `logoUrl`; a UUID-named image in `public/` is not automatically attached. API-relative uploaded media URLs are resolved by `src/lib/school-media.js`.

## API client and sign-in

`src/lib/api.js` prefixes requests with `VITE_API_URL` (fallback `http://localhost:4001/api`). It adds `Authorization: Bearer <accessToken>` when available and parses the API's JSON error message/details. A 204 response has no JSON body.

Access and refresh tokens are currently stored under `xloreAccessToken` / `xloreRefreshToken` in local storage. A 401 can trigger one shared refresh request and one retry; concurrent page requests do not each start independent refreshes. Invalid refresh sessions clear stored tokens. This is not HttpOnly-cookie authentication; XSS prevention remains important.

Google Identity Services returns an ID-token credential that the backend verifies. `VITE_GOOGLE_CLIENT_ID` must match backend `GOOGLE_CLIENT_ID`. For a new Google account, the temporary credential stays in component memory while agreement is requested. Adding a custom domain also requires authorizing its exact JavaScript origin in the existing Google Web OAuth client.

## State, refreshing, and forms

This is component/context state plus HTTP polling, not a Supabase Realtime/WebSocket architecture. Read-only resources can refresh every 15 seconds with visibility/activity/editing guards. Drafts do not auto-refresh away; filters/selections are preserved. See [engagement](engagement.md) for timing/guards.

Unsaved-change handling protects active forms/assessment edits. Completed result browsing should not be marked as an unfinished assessment. Avoid adding global dirty state based only on the presence of saved answers.

The collection provider coordinates in-progress admin work and truthful completed/partial/failed notifications. It does not turn a serverless request into a durable job queue.

## Display behavior worth preserving

- Shared school-card action area uses flex layout and `margin-top: auto`, not arbitrary title truncation, to align actions in equal-height grid rows.
- Dashboard frames are responsive fixed heights (560 px desktop, 620 px tablet, 680 px small screens). Long content/credits have bounded scroll areas so transitions do not move the page.
- Dashboard playback is 10 seconds; school-photo playback is a separate component/timer. Preserve pause/play, keyboard access, hidden-tab pause, and reduced-motion behavior.
- Results program filters narrow the saved recommendations, not the whole program catalog. They do not submit or rescore an assessment.
- User home coordinates are optional account data; display distance/basis metadata, not a public home-pin marker on shared cards.

## Environment and release checklist

1. Set the frontend API URL, Google client ID, and a real approved public support email in the correct Vercel project.
2. Keep backend CORS origins and Google authorized origins aligned with the actual frontend origin.
3. Run `npm test`, `npm run check`, and `npm run build` in this folder.
4. Review `git diff`, upload exclusions, target project, and unrelated local files.
5. Deploy only when requested. Confirm page deep links, API access, and expected asset URLs after publishing.

Do not upload `.env` files, downloaded environment exports, or local credentials. Files ignored by Git and files excluded from deployment are separate concerns; check both. Never use a public-source deployment flag as a troubleshooting shortcut.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| “Failed to fetch” | API availability, frontend API URL, CORS exact origin, network request details |
| Google `origin_mismatch` | Add the exact scheme/host/port to the existing client's JavaScript origins; no `/login` path |
| New frontend env value appears ignored | Restart local Vite or rebuild/redeploy the frontend |
| Missing logo | Inspect API `logoUrl`, resolved media URL, image response, and credit/rights; filename alone is insufficient |
| No result programs | Selected field, filters, active programs/offerings, saved attempt, admin rule configuration |
| Slideshow not rotating | Explicit pause, focused links, hidden tab, reduced-motion default, number of slides |
| Admin route rejected | Signed-in identity, active/verified account, server allowlist; hiding/showing a link cannot grant access |

Do not print tokens or full private environment files in troubleshooting screenshots. Normal tests do not prove a live user can complete Google authorization or that an external provider has credits.
