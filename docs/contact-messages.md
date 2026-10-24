# Private Contact Admin inbox

Added locally on 24 October 2026; not deployed by this change.

## Storage and rollout

Apply migration `030_contact_messages.sql` with the existing migration runner before deploying this API and matching frontend. Confirm database target and backup arrangements first. It adds a private `contact_messages` table with account ownership, field/status checks, an inbox index, per-account request-ID uniqueness, and RLS enabled without public policies. Server queries use the existing privileged PostgreSQL connection and authorization middleware. No email/provider configuration is needed. Do not test against the live database.

The private conversation extension also requires **031_contact_conversations.sql**. It adds `contact_replies` (RLS, FK ownership, request-ID uniqueness, thread index), an owner activity index, and a contact-reply reference/kind in the existing notification table. The migration preserves original requests and notification read states and does not generate historical notifications. Apply it before deploying the updated API because notification reads now join the new table; then deploy the matching frontend. These source edits do not apply migrations or deploy automatically.

## API

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `POST /api/contact` | Active, verified student or institution; not admin | Save private support request |
| `GET /api/contact?page=1` | Active, verified student or institution | List only authenticated account's conversations, latest activity first, 20 per page |
| `GET /api/contact/:id?before=<reply ID>` | Original account owner | Original request plus latest/earlier replies |
| `POST /api/contact/:id/replies` | Original account owner | Reply and reopen conversation as New |
| `GET /api/admin/messages?search=&status=all&page=1` | Verified administrator | Search private inbox, 20 records per page |
| `GET /api/admin/messages/:id?before=<reply ID>` | Verified administrator | Read a support conversation |
| `POST /api/admin/messages/:id/replies` | Verified administrator | Reply, mark Read and notify the original account |
| `PATCH /api/admin/messages/:id` | Verified administrator | Set status; same-transaction audit |

POST JSON: `{ "name": "Demo Student", "email": "contact@example.test", "message": "Please help with my account.", "requestId": "<new UUID per draft>" }`.

Name is trimmed, 2–100 characters, Unicode letters/accents/spaces only. Email is trimmed/lowercased, syntactically checked, at most 190 characters, and **not independently verified**. Message is trimmed plain text, 10–3,000 characters, without unsupported control characters. The browser escapes rather than inserts HTML. Server-derived sender identity/type cannot be overridden by client fields.

Returns `{ "submitted": true, "alreadySubmitted": false }` (201), or `alreadySubmitted: true` (200) for a repeated account/request-ID pair. Retrying never overwrites the original. Keep the ID for unchanged retries; generate a new ID for an edited/new draft. The limiter permits five attempts per authenticated account per 15 minutes, including invalid attempts/retries. The default in-memory limiter is per process, **not a distributed Vercel quota**; add a shared store if needed.

Admin inbox GET: status `all`/`new`/`read`/`closed`, literal search up to 150 characters, integer page 1–999999. Search uses bound parameters and literal substring matching (`%` and `_` are not wildcards) on original message/account fields, not reply bodies. Response: `data`, `total`, `page`, `pageSize`. Records include submitted name/contact email/message, account type, status, timestamps and authenticated account name/email. Those account details are admin-only. Results are latest activity first.

PATCH JSON: `{ "status": "read" }` (`new`/`closed` also allowed). Invalid input returns 400, missing message 404, unauthorized access is rejected before any message query. Status changes are committed with a content-free audit entry. Authenticated responses use `Cache-Control: no-store`. No delete, publication or email is triggered.

## Private replies and notifications

Reply POST JSON: `{ "message": "Thanks for the update.", "requestId": "<new UUID per reply draft>" }`. Text is trimmed and 1–3,000 characters; non-text, empty and unsupported control characters are rejected. Server authorization derives author type and notification recipient, ignoring client sender/recipient/role fields. Owner endpoints lock the original request with `sender_id = authenticated user`; another account gets a generic 404 without reading replies. Admin endpoints also enforce `requireAdmin`. Invalid payloads do not start a transaction. Reply attempts are limited per account to 30 per 15 minutes using the existing process-local rate limiter, not a globally distributed quota.

The parent request is locked and reply, status, notification and admin audit (for an administrator reply) are committed together. Unique `(message_id, author_id, request_id)` prevents duplicate replies/notices on retry. Retrying never overwrites a reply. Closed conversations may be continued: account replies mark New; administrator replies mark Read. A failure to save the notification rolls back the reply as well. Original messages/replies are not edited or deleted through this feature.

Conversation GET returns `{ thread, replies, nextCursor }`; replies contain only string ID, generic author type, message, and timestamp—not author login emails or account IDs. Latest 30 replies are returned oldest-to-newest for display; `before` accepts a positive bigint string cursor to load preceding pages. The original request remains separate and is always returned. Owner list responses contain only their thread ID, original-message preview, status and timestamps.

Notifications use kind `contact_reply`, `contactId` and `contactAuthorType`. Admin replies notify the **original sender account**, not the contact email typed into the form. A follow-up from that account notifies only active, verified administrators who have already replied to that conversation, never unrelated students, schools or all users. Existing recipient scoping, unread counts, keyset pagination and read controls are retained. Notification visibility independently checks owner/participation. Previews include no support body, name or email. Admin-reply notifications link to `/contact?thread=<id>`; account follow-ups link to `/admin/messages?thread=<id>`. This is in-app polling/refresh, not email, browser push or websocket delivery.

## Privacy and verification

There is no public listing or cross-user access. Conversations remain until the associated account is deleted (cascade) or an operator applies an approved retention procedure; the inbox has no destructive delete control. Reply rows also reference their author account. Audit entries contain IDs/status/action only, not bodies or submitted contact details. Backups and server credentials must remain restricted. No automatic email replies, SMTP sending or public admin contact details are introduced.

`node --test test/contact-messages.test.js` uses mocked connections and local HTTP servers only. It covers bounds, authorization, both sender types, forged ownership, duplicate retries, private response shape, literal search/pagination, status/audit behavior and per-account rate limits. Run `npm test` and `npm run check` for regressions. Apply and smoke-test the migration on an approved database during rollout; it was not applied by this implementation.

`test/contact-conversations.test.js` and `test/community-notifications.test.js` additionally cover private owner reads/replies, admin replies, thread participation, transaction commit/rollback, deduplication, safe payloads, pagination, notification projection and rate limits. They use mocked databases, not live writes. Frontend tests render escaped messages/forms and verify deep links, safe institution sign-in return paths, draft protection wiring and notification labels.
