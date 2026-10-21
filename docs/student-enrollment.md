# Student enrollment and account access

Implemented 22 October 2026. Apply **029_student_enrollment.sql** before deploying the matching API. No data backfill, public migration or production suspension is performed by tests.

## Storage and identity

`student_enrollments` has one current row per student (`user_id` primary key), a catalog school FK, student-confirmed home city, literal-true usage/helpfulness declarations, server declaration version and server report time. Upsert changes the current record; own withdrawal deletes it. The declaration is `enrollment-helpful-v1` and is separate from account-policy acceptance. School enrollment is a student statement, not an institution verification or proof of causal impact.

`student_account_actions` records admin actor, target, new access state, private reason, decision time and retryable email state/attempt/lease. Both new tables have RLS enabled without browser-facing policies. The API uses existing authenticated server-side database access. The migration also adds `users.auth_version` (default zero). Access JWTs carry `av`; middleware compares it to the current account version. Suspend and restore increment it; old access tokens cannot become valid on restoration. Missing old-token versions are treated as zero for rollout compatibility.

## Endpoints

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /api/enrollment` | Verified active student, not admin | Own current report, optional city suggestion and server declaration |
| `GET /api/enrollment/schools?search=` | Same | Search active available catalog schools by name/acronym/city; bounded 100-character, 12-keyword search, maximum 30 results; exact/name matches ranked first |
| `PUT /api/enrollment` | Same | Select `schoolId`, `city`, literal `usedXloreU: true`, `helpful: true`, current `declarationVersion`; server owns user ID/time |
| `DELETE /api/enrollment` | Same | Withdraw only the authenticated student's report |
| `GET /api/admin/students` | Verified admin | Private paginated student report, summary and top-ten school/city charts |
| `PATCH /api/admin/students/:id/access` | Verified admin | Boolean `active`, boolean `expectedActive`, required bounded reason; suspend or restore student only |
| `POST /api/admin/students/:id/suspension-email/retry` | Verified admin | Retry the latest outstanding suspension email, deriving recipient/reason from stored data |

Private responses use `Cache-Control: no-store`. Enrollment/action changes are transactional. Report/withdrawal locks the authenticated active student row, serializing with suspension, then validates school availability under lock. Body-supplied user/actor IDs, recipient email and assessment flags are not trusted. Admin/self/institution targets cannot be suspended through this API. Suspended users are blocked by existing active-account auth checks; refresh sessions are revoked only for the target.

The school chooser normalizes case, common accents and punctuation, expands known school acronyms, and matches all keyword groups against the same school name/city, regardless of query order. It never uses program offerings to select an institution. Full-name acronym alternatives are anchored to the beginning of a school name (so UP does not match PUP). Exact names sort before name-only matches, then combined name/city matches; stable name/ID ordering follows. SQL values remain parameterized, punctuation-only searches return no matches, repeated query parameters are rejected, and availability filtering/ranking happen before the 30-row limit.

## Reporting

`search` is at most 100 characters and searches student name/email, reported city (or profile-address fallback) and school name using parameterized, escaped literal ILIKE. `status` is empty/active/suspended, `enrollment` empty/reported/unreported, `assessment` empty/completed/not_completed, and `page` a positive integer. Repeated/array query parameters are rejected. Fixed page size 20. Filters apply before LIMIT/OFFSET and all aggregate queries use the same conditions.

Admin and institution accounts are excluded. Assessment usage is based on an actual `assessments.completed_at IS NOT NULL` record, not a submitted assertion. City charts use confirmed report cities and combine case variants. Table rows without a report may show a clearly labeled profile-address estimate from the existing Metro Manila resolver, otherwise unknown; raw street addresses/home coordinates are stripped from responses. Charts count each current report once, include suspended accounts unless filtered out, and show top ten categories with full filtered totals. A missing report is not proof of non-enrollment.

## Email and rollout

The suspension decision/outbox row commits before email is attempted. A two-minute lease prevents concurrent attempts; current account/latest-action checks suppress restored/superseded notices. Stable message IDs reduce duplicate-delivery risk but do not guarantee exactly-once SMTP or inbox delivery. Errors store only `DELIVERY_FAILED`, not recipient/provider response text. Pending/failed/stale leased notices can be retried by an administrator. Suspensions are successful even if SMTP fails; UI must show email status honestly. Restores require reauthentication, do not resurrect sessions and do not send an unrequested restore email.

Deploy reviewed migration 029 first, backend second, frontend last. Tests use disposable identities and an isolated schema with rollback; set `ENROLLMENT_POSTGRES_TEST=true` only for the dedicated integration test. Public data and real accounts are not modified by it. Existing privacy/contact/retention safeguards still require owner review; this feature is not a legal-compliance certification.
