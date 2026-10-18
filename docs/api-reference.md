# API reference

Reviewed against the mounted Express routers on **19 October 2026**. This is a human-readable reference, not a generated OpenAPI contract. See `src/app.js` and `src/routes/` for exact validation and response fields.

## Basics

- Local base: `http://localhost:4001/api`.
- Production base: `https://xlore-u-api.vercel.app/api`.
- JSON request bodies use `Content-Type: application/json`.
- Protected requests use `Authorization: Bearer <accessToken>`.
- Public means no account token is required; CORS/network controls still apply. CORS is not authorization.
- Lists commonly return `{ data, pagination }`, but not every route uses that shape. Do not assume one universal response envelope.
- Successful writes may return 200/201; 204 has no body.
- JSON body limit is 100 KB. The admin media-upload route accepts supported raw image bytes up to 4 MB instead.

Typical application error:

```json
{
  "error": {
    "message": "Readable explanation",
    "details": { "code": "OPTIONAL_MACHINE_CODE" }
  }
}
```

`details` is optional. Typical meanings: 400 invalid input; 401 missing/invalid session; 403 forbidden/unverified account; 404 missing resource; 409 conflict/stale version/attempt already used; 428 agreement needed for new Google account; 429 rate limit; 500 unexpected server error; 503 service/configuration unavailable. Middleware-generated errors may have a different body.

## Public and authentication endpoints

All paths below include `/api`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Bounded health report; no collection job |
| GET | `/api/health-check` | Same health handler |
| POST | `/api/auth/register` | Create unverified email account; agreement and SMTP required |
| POST | `/api/auth/verify-email` | Verify emailed code |
| POST | `/api/auth/resend-verification` | Replace/send verification code |
| POST | `/api/auth/forgot-password` | Request recovery email without revealing account existence in success text |
| POST | `/api/auth/reset-password` | Validate reset code, change password, revoke refresh sessions |
| POST | `/api/auth/login` | Email/password sign-in |
| POST | `/api/auth/admin/login` | Same flow with administrator check |
| POST | `/api/auth/google` | Verify Google credential; sign in or create account with agreement |
| POST | `/api/auth/admin/google` | Google flow with administrator restriction |
| POST | `/api/auth/refresh` | Exchange valid refresh token for access token |
| POST | `/api/auth/logout` | Revoke supplied refresh-token session; 204 |

Authentication endpoints are limited to 100 requests per 15-minute window by the configured process-local limiter. This is not a distributed global limit.

### Email registration

```json
{
  "firstName": "Sample",
  "middleName": "",
  "lastName": "Student",
  "address": "Taguig City",
  "email": "student@example.com",
  "password": "replace-with-a-private-password",
  "confirmPassword": "replace-with-a-private-password",
  "acceptedPolicies": true,
  "policyVersion": "2026-10-16-v1"
}
```

Names use the live name-validation rules (each input name part at most 20 characters, first/last required); address is 5–50 characters, registration email at most 40, password at least eight. These are registration/profile input limits, not permission to truncate old account records. Acceptance must be the boolean `true`, with the exact current version from `src/services/account-policies.js`. It must reflect the user's action; do not auto-check or fabricate agreement. The backend records its own timestamp.

Verification/resend/recovery use `email`; verify uses `code`; reset uses `email`, six-digit `code`, and `newPassword`. Verification/reset codes expire after 15 minutes. Sign-in uses `email`/`password` and returns `{ user, accessToken, refreshToken }`. Google accepts `credential`, plus agreement fields if creating a new account. Existing sign-ins do not require invented historical acceptance.

Refresh/logout bodies use `{ "refreshToken": "..." }`. Refresh currently returns a new access token, not automatic refresh-token rotation. Logout revokes the refresh session; already-issued access tokens remain subject to their own expiry/validation.

## Catalog and media

| Method | Path | Access / purpose |
| --- | --- | --- |
| GET | `/api/schools` | Public paginated directory |
| GET | `/api/schools/meta/filters` | Public cities/types/strands/specializations |
| GET | `/api/schools/:id` | Public school details and active program offerings |
| POST | `/api/schools/:id/visit` | Signed-in account: record/update visit |
| GET | `/api/programs` | Public paginated program directory |
| GET | `/api/programs/:id` | Public active program and offering schools |
| GET | `/api/programs/normalize` | Public normalized active-catalog representation |
| POST | `/api/programs/normalize` | Public normalization of a supplied object/array; not an admin catalog-save endpoint |
| GET | `/api/school-media/:id` | Public uploaded image bytes, not JSON |
| GET | `/api/catalog/status` | Public recorded collection/source summary |

School query names: `search`, `city`, `schoolType`, `strand`, `specialization`, `minTuition`, `maxTuition`, `sort`, `page`, `limit`. Sorts include `name`, `rating`, `tuition_low`, `tuition_high`, and search relevance. Default page size is 12, maximum 50.

Program query names: `search`, `category`, `degreeLevel`, `page`, `limit`. Default page size is 20, maximum 50. Categories are program values, not a standalone `/api/categories` endpoint.

The public school's independent tuition/program search predicates are not a promise that every supplied filter describes the same offering. Assessment school eligibility separately checks relevant offerings. General school tuition text and per-program semester fees are different data fields; do not compare unlike periods as though equivalent.

## Signed-in account endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/auth/me` | Own account, including valid private home coordinates |
| PATCH | `/api/auth/me` | Own name/address/password/optional home-pin update; profile email is not editable |
| GET | `/api/assessments/questions` | Public active bank, combined version, workflow, availability, attempt policy |
| POST | `/api/assessments/routing` | Read-only follow-up plan; authenticated and version-checked |
| POST | `/api/assessments` | Final attempt save and recommendations |
| GET | `/api/assessments` | Own assessment history |
| GET | `/api/assessments/:id/results` | Own saved result; ownership checked |
| GET | `/api/saved` | Own saved schools/programs |
| POST | `/api/saved/schools/:id` | Save school; repeated save is nonduplicating |
| DELETE | `/api/saved/schools/:id` | Remove own saved school |
| POST | `/api/saved/programs/:id` | Save program |
| DELETE | `/api/saved/programs/:id` | Remove own saved program |
| GET | `/api/comparison` | Own latest comparison, maximum three |
| PUT | `/api/comparison/schools` | Replace selection using `{ "schoolIds": ["..."] }` (one to three) |
| POST | `/api/comparison/schools/:id` | Add school; duplicates/full comparison return 409 |
| DELETE | `/api/comparison/schools/:id` | Remove own comparison school |
| DELETE | `/api/comparison` | Clear own comparison |
| GET | `/api/dashboard` | Own summary, history, and school suggestions |
| GET | `/api/feedback/status` | Verified student: current release and submitted sections |
| POST | `/api/feedback` | Verified student: save one response per user/release/section |

### Assessment request sequence

1. Read `/api/assessments/questions`. Check `availability.available`; retain the returned `version` and `workflow.version`.
2. Build one `{ questionId, optionId }` answer for every current question using actual returned IDs. Do not use the obsolete five-question example or assume option position is the scoring authority.
3. POST `{ answers, questionBankVersion }` to `/api/assessments/routing`. Use the returned leading profiles/branches and configured career-launch options to collect the follow-up.
4. Submit the selected values. This schematic is **not** a complete runnable answer set:

```json
{
  "questionBankVersion": "exact-version-returned-by-questions",
  "workflowVersion": "macro-routing-v1",
  "answers": [{ "questionId": "actual-question-id", "optionId": "actual-option-id" }],
  "routingSelection": {
    "profile": "A",
    "field": "actual-branch-option-id",
    "vehicle": "actual-career-option-id-if-enabled"
  }
}
```

Use returned workflow/version values, not hard-coded assumptions. The profile must be eligible for the result; the field is the selected option ID, not a guessed cluster title. The vehicle is required only when configured/enabled. The server rejects missing/forged choices, stale configuration, or a used one-time attempt. Optional `schoolLimits` accepts `maxTuition` (0–1000000) and `maxDistance` (0–1000 km); blank/null means no hard limit, zero is an actual zero limit. Missing location cannot satisfy an explicit kilometre limit.

A successful final response includes `assessmentId`, `profile`, `recommendedPrograms`, `recommendedSchools`, `locationBasis`, and `schoolMatchSummary`. Current routed matches are not percentage predictions. Read-only routing preview does not consume an attempt; final submission does.

### Optional home pin and feedback

PATCH own profile with `homeLocation: { latitude, longitude, confirmed: true }` and the intended current address. Latitude is -90..90 and longitude -180..180; `homeLocation: null` removes the point. Address changes invalidate a mismatched saved point. Do not send someone else's home coordinates or publish them in examples.

Feedback body: `releaseId` from status, `section` (`assessment`, `comparison`, `map`, `school`), integer `rating` (1–5), optional `comment` (up to 1000 characters), and `schoolId` only/required for the school section. Duplicate submissions do not overwrite the prior response; a stale release returns 409. Admin accounts cannot submit student feedback.

## Administrator endpoints

Every endpoint below requires a valid access token **and** the server's authorized verified-admin check. The table is not authorization by itself.

The admin router also has a process-local 120-requests/minute limiter; upload and run routes have the additional limits shown below. Student feedback submission has a separate process-local 12-requests/minute limiter.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/schools` | Catalog editor data |
| POST | `/api/admin/schools` | Create school |
| PUT | `/api/admin/schools/:id` | Update school/media metadata |
| DELETE | `/api/admin/schools/:id` | Archive availability; preserve history |
| POST | `/api/admin/schools/:id/media/assets` | Upload raw PNG/JPEG/WebP bytes; up to 4 MB, 15/minute process-local limit |
| GET | `/api/admin/programs` | Program/editor data |
| POST | `/api/admin/programs` | Create program and offerings |
| PUT | `/api/admin/programs/:id` | Update program and offerings |
| PATCH | `/api/admin/programs/:id/category` | Update category assignment |
| DELETE | `/api/admin/programs/:id` | Archive program |
| GET | `/api/admin/questions` | Question bank, drafts, mapping/routing audits |
| POST | `/api/admin/questions` | Create question |
| PUT | `/api/admin/questions/:id` | Update question |
| PUT | `/api/admin/questions/order` | Reorder questions |
| DELETE | `/api/admin/questions/:id` | Archive question subject to live-bank validation |
| POST | `/api/admin/questions/preview-routing` | Version-checked rule preview; no student attempt |
| GET | `/api/admin/assessment-settings` | Settings/version/defaults/catalog pickers |
| PUT | `/api/admin/assessment-settings` | Validate and save `{ version, settings }` transactionally |
| GET | `/api/admin/settings` | Workspace/collection preferences |
| PATCH | `/api/admin/settings` | Update supported preferences |
| GET | `/api/admin/scraping` | Sources, recent runs, settings, key-presence capability |
| GET | `/api/admin/scraping/runs` | Finished run history, filters, pagination, summary |
| GET | `/api/admin/scraping/runs/:id` | Run, source snapshots, changes; optional school scope |
| POST | `/api/admin/scraping/sources` | Create/enable official school sources using `{ schoolId, programUrl }` |
| PATCH | `/api/admin/scraping/sources/:id` | Enable/disable using boolean `{ enabled }` |
| POST | `/api/admin/scraping/run` | Start intended university-specific collection using `{ schoolId }`; 3/minute process-local limit |
| GET | `/api/admin/logs` | Administrator/catalog activity |
| GET | `/api/admin/growth` | Collection activity history |
| GET | `/api/admin/feedback` | Student feedback report and filters |

Run history query: positive `page`, `status=all|success|issues`, optional `search` up to 100 characters, optional `schoolId`; fixed page size 15. Run detail accepts optional `schoolId`. Feedback report accepts `section`, `rating`, `page`, and `current=0|1`.

School/program/question editors have structured payload validation beyond this overview. Follow the frontend editor and server validators rather than inventing partial PUT bodies. Preview routing uses `answers`, `questionBankVersion`, and optional `routingSelection`.

Collection is a data-changing operation and may call a paid provider. A configured-key capability is not proof of provider validity. Uploading media returns an asset reference but does not attach it until the school record is saved. There is no separate mounted category-management or user-deletion API.

## Verification boundaries

Use [requests.http](../requests.http) for deliberate manual checks. Do not submit real registrations, reset passwords, consume assessments, start collection, or change admin settings as passive health tests. Anonymous 401/403 responses on protected routes are expected. The [health checker](health-checks.md) intentionally skips protected/write workflows, and its inventory is explicit rather than automatically exhaustive.
