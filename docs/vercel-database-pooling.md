# Database connections on Vercel

The Supabase session pooler rejected production requests with
`EMAXCONNSESSION` (15 reserved session connections). A five-connection pool in
each warm Vercel instance can exhaust that limit even with few visitors.

Production uses the same database through the shared **transaction pooler**
on port 6543. Copy its URL from Supabase's Connect dialog. Keep credentials in
Vercel's backend environment only. Set `DB_POOL_MAX=1` and
`DB_IDLE_TIMEOUT_MS=1000`. Code defaults to these values on Vercel and caps
oversized settings at two connections / one second idle time. The module-level
pool is registered with `attachDatabasePool` so Vercel can clean up idle sockets
before suspension; socket errors do not crash the process.

Queries use unnamed node-postgres statements, with no session state or named
prepared statements. Transactions still use one checked-out client through
BEGIN/COMMIT/ROLLBACK; the one-assessment account-row lock remains inside that
transaction.

Local `.env` files are not changed. Local persistent servers may continue using
session mode on port 5432 with their configured pool sizes. **Migrations must
continue using a direct/session connection** via `MIGRATION_DATABASE_URL`:
the migration runner uses a session advisory lock, incompatible with transaction
pooling. Do not run migrations automatically during this deployment.

References:
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool
