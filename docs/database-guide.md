# Database guide

Migration 029 adds private `student_enrollments` (one current self-report per student), private `student_account_actions` (reasoned access decisions and email work), and `users.auth_version` for suspend/restore token invalidation. No declarations or enrollment records are backfilled. Apply before the matching API; see [enrollment storage and rollout](student-enrollment.md).

Source reviewed **19 October 2026**. PostgreSQL is hosted on Supabase. The API uses `pg` and a small adapter that converts `?` parameters to PostgreSQL `$1`, `$2`, etc.; that adapter does not make this a MySQL database.

Migration **033** makes `schools.latitude` and `schools.longitude` nullable together. The `school_coordinate_pair` check rejects partial pairs; unknown pins stay NULL, without inventing distances or `(0, 0)`. Existing coordinates are preserved. Apply before deploying optional campus-coordinate registration, approval and profile editing. An omitted optional institution verification link is stored as an empty string in the existing `verification_url` column.

## Main relationships

Migration **034** adds bounded `institution_applications.attempt_number` and `rejection_count` (maximum five), and private RLS-enabled `institution_application_rejections`. Each rejection history row references the same current application and records the rejected attempt number, submission/review times, reviewer, reason and an allowlisted registration snapshot. Unique `(application_id, attempt_number)` prevents duplicate rejection records. Existing rejected records are backfilled as rejection 1. Resubmission updates the current application without deleting the account or these history rows. See the [resubmission rules](institution-portal.md) before rollout.

Extension added 20 October 2026: migration 024 adds `institution_applications` (one user/application), `school_posts`, `school_post_likes`, and `school_post_comments`, all with RLS. It also adds `users.account_type` (old accounts default to student), `programs.managed_by_school_id`, and `school_programs.institution_details`. Migration **032** changes school ownership uniqueness from approved/suspended to **approved only**: suspended accounts release the school for a new verified application, while historical accounts/content remain stored. Approval or resume cannot create two approved owners. Apply 032 before the matching backend. See the [institution guide](institution-portal.md) for visibility/ownership and migration requirements. These source changes do not imply the live schema has already been migrated.

Migration 025 adds same-post parent references and official school attribution for replies in `school_post_comments`. Existing rows remain student root comments; hiding/deleting a parent hides its public thread without deleting reply records. Apply it before releasing reply-enabled API queries; it does not activate institutions or change existing account roles.

Migration 026 adds a false-by-default administrator-author flag and permits administrator roots/replies without school attribution. The server alone sets this flag after verified-admin authorization. Public reads show the generic Administrator label. Existing rows, account roles, same-post foreign keys and RLS are preserved; apply it before admin-comment API queries are deployed.

Migration 027 adds `community_notifications` with recipient/actor/post/comment references, event kind, created/read timestamps, deduplication and RLS. It stores no copied comment text or email. Apply before notification-enabled interaction/API code. New activity is inserted transactionally; old interactions are not backfilled. Visibility/read ownership are rechecked by Express, and no push/email delivery or automatic retention job is implied.

Migration 028 adds private reason/title/school snapshots and nullable post/application references for moderation and institution-suspension notices. Existing activity/read states are preserved; the comment-notice uniqueness index now applies only to ordinary comment/reply events so separate moderation decisions can be retained. Comment moderation also stores its latest reason. `institution_notice_emails` is an RLS-enabled transactional outbox with pending/sending/sent/failed/cancelled state, attempt count, a two-minute lease, SMTP-acceptance timestamp and a generic error code. It stores no recipient email or raw SMTP response. Apply 028 before the private-notice/suspension API code; do not run it as a build side effect.

```text
users
  +-- user_sessions
  +-- assessments -- assessment_responses
  |       +-- career_profiles -- recommended_programs -- programs
  +-- user_saved_schools ------------------------------- schools
  +-- user_saved_programs ------------------------------ programs
  +-- comparison_sets -- comparison_schools ------------- schools
  +-- user_school_visits ------------------------------- schools
  +-- user_feedback

schools -- school_programs -- programs -- program_aliases
   +-- available_schools
   +-- school_strands -- strands
   +-- school_media_assets
   +-- catalog_sources -- catalog_run_source_results -- catalog_update_runs
                              catalog_change_log links source/run changes

assessment_questions + assessment_settings    Live assessment configuration
admin_settings + admin_audit_log              Workspace preferences/activity
schema_migrations                            Applied migration filenames
```

The diagram is a simplified relationship map, not a complete column/constraint listing. Migration SQL is the schema authority.

## Table groups

| Tables | Stored information |
| --- | --- |
| `users` | Account identity, bcrypt password hash where present, verification/recovery fields, Google subject, address, optional home point, policy version/time, active state |
| `institution_applications`, `institution_application_rejections` | One current institution application per account, bounded attempt/rejection counts, and private snapshots/reasons for each rejected attempt |
| `user_sessions` | Hashed refresh tokens, expiry/revocation, device/browser/IP metadata |
| `schools`, `available_schools` | School details/coordinates/media metadata and public availability |
| `programs` | Program descriptions, category text, degree, requirements, career paths, tags, active/source metadata |
| `school_programs` | Many-to-many school/program offerings; known per-semester fee, top-program flag, verification/source details |
| `strands`, `school_strands` | Strand definitions and school associations |
| `program_aliases` | Known program names/aliases used in collection matching |
| `assessment_questions`, `assessment_settings` | Editable live questions/option mappings and versioned routing/result configuration |
| `assessments`, `assessment_responses` | Attempt ownership/completion and selected answers with relevant snapshots |
| `career_profiles`, `recommended_programs` | Saved result/routing metadata and linked program ordering |
| `comparison_sets`, `comparison_schools` | Own comparison and its one-to-three positions |
| `user_saved_schools`, `user_saved_programs` | Per-account saved links, nonduplicating composite keys |
| `user_school_visits` | Per-account school visits/counts/timestamps |
| `school_media_assets` | Persistent uploaded public image bytes/metadata; not temporary Vercel files |
| `catalog_sources` | Official URL/host, parser configuration, enabled state, schedule/status details |
| `catalog_update_runs`, `catalog_run_source_results` | Batch outcomes and per-source returned-record/error snapshots |
| `catalog_change_log`, `admin_audit_log` | Catalog field changes and admin activity |
| `admin_settings` | Workspace/collection preferences |
| `user_feedback` | Section ratings/comments, release identity, user and optional school association |
| `schema_migrations` | Full migration filenames and application timestamps |

There is no dedicated categories table; categories are program values. Installed Supabase packages do not mean application accounts use Supabase Auth.

## Important data rules

- IDs and foreign keys connect records; unique constraints prevent duplicate offerings, saves, responses, and comparison positions.
- Offering tuition may be `NULL` when unknown. The first schema made it nonnullable, but later migrations changed it. Do not derive the current schema from migration 001 alone.
- Recommendation rank capacity was expanded after the initial 20-rank restriction. Do not reintroduce the old limit from the first migration.
- JSONB holds structured arrays, settings, and assessment snapshots; it does not remove the need for application validation.
- The optional `users.home_location` stores coordinates with an address snapshot. Authentication responses expose valid coordinates only for the account owner. Shared recommendation responses expose a distance/basis instead.
- `policy_version` and `policy_accepted_at` are nullable together for existing accounts. New registrations record current acceptance; old users are not assigned fabricated consent.
- Admin archive operations preserve historical links rather than resetting student attempts. Do not interpret every database `ON DELETE CASCADE` capability as an implemented user-facing deletion workflow.
- Saved assessment answers/rules are not rescored by live admin edits. Reopened results still join current active catalog data and calculate distances using the user's current valid origin.
- Feedback is unique per user/release/section, so repeated submissions do not replace old ratings/comments.

## Migrations

The runner is `scripts/migrate.js`; SQL lives in [database/migrations](../database/migrations). Files are sorted and tracked by **full filename** in `schema_migrations`. Each pending file runs in a transaction. A session advisory lock prevents competing migration runners.

There are two existing `022` files with distinct full names:

- `022_catalog_source_name.sql` — source naming/backfill.
- `022_private_home_location.sql` — optional account home point.

Keep both names. Do not renumber already-applied migrations to make the numbering look prettier. `023_account_policy_acceptance.sql` adds account agreement records. New changes need new migrations, not edits that silently change already-applied history.

```powershell
npm run migrate:status
npm run migrate
```

Both commands connect to the configured database, take the migration advisory lock, and ensure the tracking table exists. `status` is not guaranteed write-free on a completely new database. `migrate` applies real changes; confirm the target and backup/restore plan first.

`MIGRATION_DATABASE_URL` overrides `DATABASE_URL` for the runner. Use a direct/session connection for migrations because the session lock is incompatible with transaction pooling. The Vercel runtime uses the transaction pooler and a small connection pool. See [pooling guidance](vercel-database-pooling.md).

## Access, backup, and sensitive data

Application tables use RLS without browser policies to avoid an unintended public Data API path. Express performs authentication, ownership, and admin checks through its server-side database connection. An owner connection can bypass RLS; RLS alone is not evidence of a least-privilege production runtime role. Use an appropriate runtime role and separate migration authority as operational hardening.

Keep database credentials, raw exports, verification/reset values, student answers, session metadata, home coordinates, and image/feedback records out of public documentation and Git. Deleting a local checkout does not delete hosted user data; Git history is not a database backup.

Before schema/data maintenance, establish backup coverage and rehearse restoration in an isolated database. This guide does not claim that a restore drill, automatic retention policy, or self-service deletion workflow already exists. Review provider backup capabilities and access permissions with the project owner.
