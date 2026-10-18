# Database guide

Source reviewed **19 October 2026**. PostgreSQL is hosted on Supabase. The API uses `pg` and a small adapter that converts `?` parameters to PostgreSQL `$1`, `$2`, etc.; that adapter does not make this a MySQL database.

## Main relationships

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
