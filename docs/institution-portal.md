# Institution accounts and school community

Implemented on **20 October 2026**. This feature requires migrations `024_institution_portal.sql`, `025_school_comment_replies.sql`, `026_admin_community_comments.sql`, `027_community_notifications.sql`, and `028_private_moderation_notices.sql` and coordinated frontend/backend deployment. Writing this guide does not mean migrations have been applied to live tables or that the feature is deployed.

## Account and approval flow

1. A school representative uses `/institution/register`, not the student registration form.
2. They select exactly one existing school from a searchable list, OR choose “My school is not in the directory” and provide a new-school form.
3. They submit representative contact/designation, verification instructions, matching passwords, and current policy agreement. The official staff/contact HTTPS verification link is optional; any supplied link must be valid HTTPS.
4. Email verification establishes control of the contact email. It does **not** prove school authority.
5. Admin reviews the application at `/admin/institutions`, independently contacts a trusted school channel, supplies a reason, and confirms verified authority before approval.
6. Existing-school claims require approval too. New-school requests are stored as application JSON, not public school records, until approval creates/activates the school transactionally.
7. Verified institution users sign in at `/institution/login`; their `/institution` workspace displays pending/rejected/suspended status or approved editing tools.

One account has one current application. Only a rejected application can be corrected and resubmitted under the five-rejection policy below; approved/suspended owners cannot self-switch schools. One school has at most one **approved** institution account. Suspending that account releases the school for another registration; the suspended account and its application history remain stored. The replacement must verify its email and pass independent admin approval before editing or posting. A partial unique index plus transactional school locking prevents two approved accounts from owning the school. Admin can resume an old account after re-verification only if no other account is approved for that school. Suspended accounts cannot edit, publish or read the current owner's draft/editor data. This version does not include multiple staff accounts per school.

### Rejected email reuse and five-rejection limit (27 October 2026)

Apply **034_institution_resubmissions.sql** before deploying the matching API/frontend. A rejected institution may resubmit corrected representative/school/evidence details through `/institution/register` using the **same email and existing password**, or use **Correct and resubmit application** in its rejected workspace. The workspace action signs out and opens registration with the email prefilled. Password recovery remains available through Institution sign in. Registration never replaces an existing password or converts a student account.

The original submission is attempt 1. Each admin rejection adds one to `rejection_count`; after rejection 1–4 another submission is allowed, and rejection 5 permanently blocks further submissions for that email. Pending, approved, suspended and inactive accounts cannot reuse registration. Successful resubmission retains the same user/application IDs, advances `attempt_number`, returns the current application to pending, clears the current review and moves it to the end of the review queue. It may correct its previously rejected school selection but cannot claim an approved school. Rejections are not reset by resubmission, verification, password recovery or approval.

Ownership is checked by comparing the existing password under a user row lock. Fresh email verification is required on every resubmission; previous access tokens are invalidated by `auth_version` and refresh sessions are revoked. Names, acceptance metadata, evidence and the pending application update atomically with verification-code delivery; email failure rolls back the submission without consuming an attempt. The usual 10-registration-requests/hour/client limit remains separate from the per-email rejection cap.

Migration 034 stores each already-rejected application as rejection 1 with its existing reason, time, representative and school snapshot. The private, RLS-enabled `institution_application_rejections` table preserves each rejected attempt's submitted details and review reason; credentials and codes are excluded. Admin lists return `attemptNumber`, `rejectionCount` and `rejectionHistory`; the owner receives attempt/count/limit and `canResubmit` in its own workspace. History is read-only in the UI. Approved school content and existing account identities are preserved.

Admin approve/reject requests send `expectedAttempt`. Stale attempts return 409 even if a newer submission is pending. For compatibility an omitted value means attempt 1, so older clients cannot approve/reject a resubmitted attempt. Application row locking and unique `(application_id, attempt_number)` history entries prevent a repeated rejection from incrementing twice. Local fixtures/rollback tests do not apply this migration to production or email real recipients.

### Released school claims (25 October 2026)

Apply `032_release_suspended_school_claims.sql` before deploying the updated backend. It replaces the original `institution_school_owner` index with an approved-only unique index; it does not delete or rewrite accounts, applications, posts or other school data. Already suspended applications release their reservation under this index automatically. The registration chooser and registration conflict check count approved claims only; pending applications do not reserve a school. Registration locks the selected school while checking availability, and approval/resume locks it again before checking other approved applications. If a replacement is already approved, approval/resume returns 409 with an explanation. The admin moderation selector still includes suspended-school history. Apply the migration through the existing migration runner, not a build side effect. Local source changes and rollback-only tests are not a live rollout receipt.

Existing student accounts remain students. The caller cannot acquire institution/admin access by posting a `role`, `schoolId`, or `account_type` field to ordinary registration/profile APIs. An existing student email cannot be converted by institution registration; use a separate contact account. Institution login is email/password; Google remains a student/admin flow. Email recovery uses the existing recovery endpoints.

### Name and telephone validation

User-entered student and representative first/middle/last names, including legacy full-name registration input, are restricted to Unicode letters, combining accents and ordinary spaces. Optional middle names may be empty. Punctuation, digits, emoji and control characters are rejected with HTTP 400 before writes/email. Existing first/middle/last length limits remain. The same validation applies when editing student profiles.

Institution rename and proposed new-school names allow letters, accents, ASCII digits and spaces, with no punctuation/special characters. Selecting an existing school still uses its UUID without modifying existing catalog names. Telephone must be a digits-only string with maximum length 30; numbers, arrays and formatted strings containing `+`, spaces or dashes are rejected. Leading zeros are preserved. These are form/endpoint validations, not catalog-wide cleanup, a database constraint or a change to Google-imported profile names. Program names, descriptions, addresses, credentials and URLs retain their own existing validation rules. No migration is required.

### Optional campus coordinates and verification link (27 October 2026)

Apply `033_optional_school_coordinates.sql` before deploying this API. It permits unknown school coordinates as a pair of NULLs and adds a database constraint against incomplete pairs. Registration, admin approval/editing and institution profile editing accept both values blank, or both valid geographic numbers. The official school website remains required for new-school requests. Missing coordinates do not become `(0, 0)` or a calculated distance; map links search the school name/address until a pin is supplied.

After approval, representatives can add, update or clear the campus pin through **School page → Edit profile**. Registration and editing include Google Maps instructions: find the campus, right-click the exact spot on a computer, copy the coordinate pair, and enter latitude first and longitude second. On mobile, drop a pin by holding an unlabeled location and open its details.

Verified institution accounts can update or clear their own optional verification link in **Account settings**, including while pending or suspended. `GET /api/institutions/account` returns `verificationUrl` privately to its owner. `PATCH /api/institutions/account/verification` accepts `verificationUrl` and the previously loaded `expectedVerificationUrl`; stale changes return 409. Ownership is derived from the authenticated application, and changes are audited. This does not approve, reactivate or transfer a school; independent admin verification and email verification remain required. The existing non-null verification URL column stores an omitted link as an empty string.

## Editing boundaries

The verified-admin application list includes `schoolId`, `schoolName`, `schoolCity`, `schoolType` and `schoolAddress` from the selected existing school, including pending claims. These allow review to identify the campus directly. New-school requests keep their submitted details in `proposedSchool` until approval creates the school. These are current linked directory details, not a historical school-name snapshot; no additional migration is required.

Approved representatives of active schools can edit their own address/city/coordinates, official HTTPS website, description, general tuition information, scholarships, logo/credits, and campus photos. Their linked school's public name can be changed in institution account settings; school type, ratings, activation, and ownership remain admin-controlled. School IDs come from the authenticated application, not an editable request field. Name edits do not transfer a claim or replace the original verification evidence.

Institutions can link existing active catalog programs, set their own offering fee/source/highlight, and edit school-specific descriptions, requirements, and career paths. Shared catalog names/categories/degrees are not overwritten. A new school-owned program can be created; its global metadata can be edited only while it belongs to that school and is not offered by another school. Removing an offering deletes only the school's link, not another school's offering or the global program/history.

School-specific program detail overrides are displayed on the school detail page. General program directory metadata and recommendation classification remain global catalog data. A shared-title/classification correction still needs admin review; an offering description does not rewrite the assessment algorithm.

Approving/restoring institution access disables that school's current collection sources to prevent unattended overwrite or re-addition of manually maintained data. Admin must deliberately review before enabling collection again. Suspension does not automatically reactivate scraping.

Uploads reuse the PNG/JPEG/WebP validation and 4 MB limit. Uploaded media references are checked against the authenticated school before attachment. Uploads are public, persistent image assets; hiding a post does not revoke a copied or cached image URL.

## Posts, likes, and comments

- An institution can create/edit drafts or published posts with a title, plain-text content, one optional HTTPS link, and up to six uploaded photos/captions.
- The public feed contains only published, nondeleted, admin-visible posts belonging to an approved institution account whose user is active/email-verified and school is active.
- The school detail page shows **School posts** beside **Programs offered** only when `institutionActive` is true. Unclaimed/pending/rejected/suspended/inactive schools have no public community tab/feed.
- Anonymous users can read visible posts/comments/replies. Only verified non-admin students may like/unlike. Verified students and administrators may start root comments.
- Likes are idempotent per student/post. Comments are bounded plain text (2000 characters), show a first name rather than an email, and can be removed by their author. No public list of liker identities is provided.
- Approved active institutions can reply to visible student root comments only on their own published posts. Replies use the school name and an institution author type, never the representative's personal name/email. Students cannot create school replies; institutions cannot like or start root comments. Reply-to-reply nesting is not supported. Own replies may be removed by their author.
- Verified administrators may start root comments or reply beneath visible root comments on any public school post, including without owning that school. Their stored `author_is_admin` attribution is set only from the authenticated server-side admin check; request roles/flags are ignored. Public author text is the generic `Administrator` and `authorType=admin`, not a login email or personal name. Schools can reply to administrator roots on their own posts. Replies remain one level deep. Administrator writes are transactionally audited without duplicating comment text in the audit entry; their own comments/replies may be removed. Admin access does not bypass post/parent visibility, limits, or the existing moderation rules; admins cannot like posts.
- Public comment counts include visible student comments and school replies. Hiding/deleting a parent hides its reply thread from public reads/counts without purging records. Root comments and replies are separately paged, newest first. Admin counts include nondeleted hidden records, and review labels school replies explicitly.
- Admin can hide/restore posts and comments with an audit reason. Institution edits cannot clear an admin hide. Draft/hidden/inactive-school posts reject new interactions.
- There are no direct messages, student-authored school posts, or arbitrary HTML/script uploads in this version. “Post anything” is not permission to publish unlawful material, private records, or content without rights.

Institution post management currently shows the latest 100 nondeleted posts. The public feed pages 10 posts; comments page 20. Admin review lists up to 200 applications per status, and moderation pages 20 posts with up to 200 latest comments per selected post. These bounds should be expanded with pagination if institution volume requires it. Rejected applications remain an admin/support workflow, not silent deletion.

## New endpoints

All paths are under `/api`:

| Method | Path | Access / action |
| --- | --- | --- |
| GET | `/api/institutions/schools` | Public searchable existing-school chooser, at most 50 results |
| POST | `/api/institutions/register` | New contact account + pending claim/request + verification email |
| POST | `/api/auth/institution/login` | Verified institution password sign-in |
| GET | `/api/institutions/account` | Verified institution's own linked/proposed school name, private contact email/representative name, optional verificationUrl and canRename flag; no password hash or private verification instructions |
| PATCH | `/api/institutions/account/verification` | Own optional HTTPS link and expectedVerificationUrl; verified pending/suspended accounts included, stale edits rejected, audited, no approval or ownership changes |
| PATCH | `/api/institutions/account` | Approved active owner: `{ schoolName, expectedName }`; 1–190 chars, normalized whitespace, own school only, stale/same-city duplicate names return 409; audited, school ID/ownership unchanged |
| POST | `/api/institutions/account/password` | Verified institution (including pending/suspended): `{ currentPassword, newPassword, confirmPassword }`; current hash verified under row lock, matching different new password 8–72 chars and <=72 UTF-8 bytes, rate limited to 10 attempts/15 min; clears reset codes, revokes own refresh sessions, returns signInAgain |
| GET | `/api/institutions/me` | Own application/workspace; pending claims cannot read school's drafts |
| PUT | `/api/institutions/profile` | Approved institution: own profile/media metadata |
| POST | `/api/institutions/media/assets` | Approved institution: own public image upload |
| PUT | `/api/institutions/programs` | Approved institution: create/link/edit own offering |
| DELETE | `/api/institutions/programs/:id` | Remove own offering only |
| POST | `/api/institutions/posts` | Create draft/published school post; published posts are immediately public without per-post admin approval |
| PUT | `/api/institutions/posts/:id` | Edit own school post without un-hiding admin moderation |
| DELETE | `/api/institutions/posts/:id` | Soft-delete own school post |
| GET | `/api/community/schools/:id/posts` | Public active-school feed (`page`) |
| GET | `/api/community/posts/:id` | One currently visible published post (includes schoolId); exact-post notification links work independently of feed pagination |
| GET | `/api/community/posts/:id/comments` | Public visible-post root comments with `replyCount` (`page`) |
| GET | `/api/community/comments/:id/replies` | Public visible root's school replies (`page`); school-name attribution |
| GET | `/api/community/me` | Verified student's/institution's/admin's own interaction IDs for `schoolId`; `replySchoolId` only for the approved active owner of that school |
| PUT | `/api/community/posts/:id/like` | Verified student: idempotent like |
| DELETE | `/api/community/posts/:id/like` | Remove own like |
| POST | `/api/community/posts/:id/comments` | Verified student: root `{ body }`; approved owning institution: reply `{ body, parentCommentId }`; verified admin: either root or reply. Admin attribution is server-set, never a request role/flag |
| DELETE | `/api/community/comments/:id` | Remove own student/admin comment or school/admin reply |
| GET | `/api/notifications` | Verified account's own visible inbox: 20 rows, unreadCount, snapshot watermark and nextCursor; optional `before` bigint string for keyset pagination |
| PATCH | `/api/notifications/:id/read` | Mark only the authenticated recipient's notification read (204 or 404); body cannot select another user |
| PATCH | `/api/notifications/read-all` | `{ through: watermark }` marks own entries up to the displayed snapshot read, preserving later arrivals |
| POST | `/api/admin/institutions/applications/:id/suspension-email/retry` | Verified admin only; retry latest current suspension email from stored recipient/reason, not request overrides; 10 attempts/15 minutes per process |
| GET | `/api/admin/institutions/applications` | Admin queue (`status`) |
| POST | `/api/admin/institutions/applications/:id/review` | Admin approve/reject/suspend/resume |
| GET | `/api/admin/institutions/moderation/schools` | Admin institution-school selector: `search` (name/city, max 100 chars), `status=active` (default), `inactive`, or `all`, positive `page` up to 10000; six rows/page and total; no private representative contact data |
| GET | `/api/admin/institutions/moderation` | Admin post review (`page`, optional validated `schoolId`, optional text `search` up to 100 characters matching post title/body); filtering occurs before pagination and keeps school scope. Returns all nondeleted statuses with full text/images/link in 20-post pages, `hasMore`, and stable newest-first order; omitted schoolId retains the legacy all-school feed |
| GET | `/api/admin/institutions/posts/:id/comments` | Admin comment review |
| DELETE | `/api/admin/institutions/posts/:id` | Verified admin soft-deletes any school post; optional `{ note }` up to 1000 characters, default audit reason when omitted; returns 204 |
| PATCH | `/api/admin/institutions/posts/:id/moderation` | Admin `{ hidden, note }` |
| PATCH | `/api/admin/institutions/comments/:id/moderation` | Admin `{ hidden, note }` |

The application queue explicitly includes saved `representativeName`, `firstName`, `middleName`, `lastName`, contact email, designation, telephone, email-verification status, authority URL/note and createdAt. Frontend review labels these in a read-only Representative details section for all statuses; missing older name parts are not invented. This remains behind verified-admin authorization and no-store caching. It does not include password hashes, reset/verification codes or session tokens, and does not change public-school or institution-registration APIs. No migration is required for the added display fields.

`GET /api/admin/institutions/applications?status=approved&search=school` optionally searches existing school name, requested-school JSON name, representative full name, or contact email. Search is case-insensitive, trimmed, bounded to 100 characters and parameterized with literal `%`, `_` and backslash handling; repeated search parameters are rejected. Status still applies, and filtering precedes the 200-result oldest-first limit. No schema migration is required. Only verified administrators can search/read these private contact records.

Registration accepts the usual representative name/email/password/agreement fields plus `schoolId` OR `proposedSchool`, `representativeTitle`, `contactPhone`, `verificationUrl`, and `verificationNote`. Review accepts `decision`, required `note`, `verifiedAuthority: true` for approve/resume, and optional corrected `school` fields for a new-school request. These are not automatic verification signals.

Registration limits (`src/services/institution-registration.js`, mirrored by frontend controls): names 20 each; contact email 190; designation 100; telephone 30; verification note 1000; proposed-school name 190, city 100, address 255, description 2000, HTTPS URLs 2000. Passwords must match, have 8–72 characters and at most 72 UTF-8 bytes to avoid bcrypt truncation. Latitude/longitude retain geographic numeric bounds. Invalid submissions fail before database writes/email. These limits do not truncate existing applications or change the larger description allowance for an already approved school's profile editor. No schema migration is needed for the auth-layout/registration-limit update.

Institution **Account settings** is `/institution/settings`, accessible from the header, own-school owner bar, and application-status page. It uses the student profile's two-card layout, with independent name/password forms and unsaved-change protection. Contact email and registered representative are read-only; there is no home-address/pin editor or school-ownership selector. Pending/suspended/inactive institutions cannot rename schools but verified institution accounts can still secure their password. The generic `PATCH /api/auth/me` rejects institution callers so it cannot bypass the dedicated password controls. Password values/hashes are never returned or included in audit details. After success the frontend clears its credentials and returns to institution sign-in. Other refresh sessions are revoked; existing access JWTs may remain valid until their configured short expiry. This is not a claim of immediate global JWT invalidation. No additional migration beyond the existing institution schema is required for account settings.

Dedicated institution routes are process-limited (registration 10/hour, authenticated workspace 90/minute, uploads additionally 15/minute); community writes 30/minute. These are not distributed global abuse prevention or a complete trust-and-safety system.

Administrator post-deletion controls are shown only in the admin moderation panel, not the public school feed. The delete API remains verified-admin-only and audited; UI location is not an authorization boundary. Institutions retain their distinct ownership-scoped post management. Post search uses bounded parameterized ILIKE queries with literal wildcard escaping, so it does not search only the current client-side page or broaden a selected school's scope.

## Migration, policy, and verification

Migration 024 adds `users.account_type`, the application/post/like/comment tables with RLS, global program ownership metadata, and school-offering detail overrides. It does not backfill institution owners, activate schools, reset assessment attempts, or apply invented policy acceptance. School communities are closed until a real verified claim is approved.

Migration 025 adds nullable `parent_comment_id` and `author_school_id` to comments, a reply index, and constraints tying a reply to a parent on the same post. Existing comments remain student roots with NULL reply fields; no accounts or content are overwritten. API transaction locks follow institution application → post → student comment, with ownership and parent visibility checked before insertion. Keep existing RLS and server authorization; schema constraints alone do not confer publishing rights.

Migration 026 adds `author_is_admin NOT NULL DEFAULT FALSE` and expands the reply-identity check to permit admin roots/replies without school attribution. Existing comments retain their original role and content; no user roles are changed. The existing same-post foreign key and RLS remain in place. Apply 026 before releasing admin-comment API queries. Public reads use the stored attribution, so an administrator's historic comment remains labeled even if account details later change.

Migration 027 creates `community_notifications` with recipient/actor/post/comment foreign keys, sequence ID, event kind, created/read timestamps, per-like and per-comment deduplication, inbox index, and RLS. It does not backfill historic activity. Notifications are inserted in the same transaction as a successful new like/comment/reply. Likes/comments/replies notify the active owning school except the actor; replies also notify the student who authored the visible root. Administrators receive only replies in a root comment thread where they have a visible admin comment/reply, not unrelated activity elsewhere on that post. Both writes and reads enforce this association, including filtering historical global admin notices. No self-notifications. Repeated PUT/unlike/re-like creates at most one notice per liker/post/recipient. Read status survives sign-out.

Notification GET is authenticated, no-store and limited to 120 requests/minute per process. The server chooses the role/recipient, never query/body role claims. Ordinary activity reads re-check current post, school ownership/activity, comment/parent visibility and current likes. Removed likes, hidden/deleted threads and inactive communities are omitted, including from unread counts. Labels use first names, school names or generic Administrator; no private email or copied comment body is returned. UI polling is every 60 seconds while visible and closed, plus on open/focus, not WebSockets. No follow/new-post broadcasts or browser push alerts are implemented. Retention/purging still needs an owner-defined policy.

Migration 028 adds private decision kinds `post_hidden`, `post_restored`, `comment_hidden`, `comment_restored`, and `institution_suspended`, a required reason and title/school snapshots. Hide/restore notices go only to the actual post/comment author from locked server data; identical repeated state+reason is a no-op. They remain readable by that recipient even after content hiding/deletion or institution suspension, with generic Administrator attribution. They do not expose hidden comment bodies. Frontend opens a private reason dialog instead of a public-content URL and does not discard unsaved forms to read it. These notices are not retroactively backfilled.

Institution suspension writes the reason notice and `institution_notice_emails` outbox in the review transaction, then attempts SMTP only after commit. Application review responses include `email.status`; admin application reads include latest `suspensionEmail` `{id,state,attempts,sentAt}`. SMTP failure does not restore access or erase the reason. The queue displays delivery status and administrator retry. The outbox claims a two-minute lease, skips already sent/in-progress rows, and cancels attempts for restored/superseded suspensions. There is no background worker: pending/failed/interrupted work requires manual admin retry. `sent` records SMTP acceptance, not guaranteed inbox delivery. SMTP acceptance followed by a lost database acknowledgement can cause a duplicate on retry despite a stable Message-ID. Outbox errors store only a generic code; email HTML escapes all user-authored text. Ordinary activity/moderation notices are in-app only; only institution suspension sends this transactional email. Student account suspension is not introduced by this feature.

Terms/Privacy now describe institution evidence, public posts/comments/likes, moderation, and public image retention. New registrations use version `2026-10-20-v2`; existing account acceptance timestamps remain untouched. Owner review/contact/minor-user/retention arrangements are still required; this is not a legal certification.

Before release: review migration/backup target, apply pending 024–028 through the normal direct/session migration connection, and deploy both applications with matching policy versions. Migration 026 must precede the admin-comment API; 027 must precede notification/event API code; 028 must precede private moderation/suspension API code. Old and new registration versions can conflict during an uncoordinated partial rollout. Do not apply migrations automatically during a Vercel build.

Tests: `test/institutions.test.js` exercises validators, role/ownership boundaries, approval, shared-program safety, social writes, private moderation and commit-before-SMTP. `test/community-notifications.test.js` covers inbox scopes, authorization, cursor validation and read ownership; `test/suspension-email.test.js` covers escaped mail, retries, leases and sanitized failures with mocked SMTP. The explicit `INSTITUTION_POSTGRES_TEST=true` test in `test/institution-postgres.test.js` creates a uniquely named isolated schema inside one transaction, exercises real HTTP/SQL flows including thread-associated admin alerts, private moderation after hiding/deletion/suspension, failed-email persistence and counts, and rolls everything back. It does not apply 024–028 to the live schema, send email, or run scraping. Normal tests skip that live-database check.

Local browser verification can use the separate in-memory development fixture; never publish fixture authentication/data to production. Remaining operational work includes real authority verification, contact arrangements, moderation staffing, backup/retention decisions, and scale/abuse review before public launch.
