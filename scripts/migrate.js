import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import "dotenv/config";

const migrationsDirectory = path.resolve("database/migrations");

async function listMigrationFiles() {
  return (await fs.readdir(migrationsDirectory))
    .filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right));
}

function databaseConfig() {
  const connectionString =
    process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL in .env before running migrations.");
  }
  const sslMode = (process.env.DB_SSL || "require").toLowerCase();
  if (!["disable", "require", "verify-full"].includes(sslMode)) {
    throw new Error("DB_SSL must be disable, require, or verify-full.");
  }
  const sslCa = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");
  if (sslMode === "verify-full" && !sslCa) {
    throw new Error("DB_SSL_CA is required when DB_SSL=verify-full.");
  }
  return {
    connectionString,
    ssl:
      sslMode === "disable"
        ? false
        : sslMode === "verify-full"
          ? { rejectUnauthorized: true, ca: sslCa }
          : { rejectUnauthorized: false }
  };
}

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name varchar(255) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function migrationStatus(client) {
  await ensureTrackingTable(client);
  const appliedResult = await client.query(
    "SELECT migration_name FROM schema_migrations ORDER BY migration_name"
  );
  const applied = new Set(appliedResult.rows.map((row) => row.migration_name));
  return (await listMigrationFiles()).map((name) => ({ name, applied: applied.has(name) }));
}

async function main() {
  const client = new pg.Client(databaseConfig());
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('xlore_u_schema_migrations'))");
    const status = await migrationStatus(client);
    if (process.argv[2] === "status") {
      status.forEach((item) => console.log(`${item.applied ? "applied" : "pending"}  ${item.name}`));
      return;
    }

    const pending = status.filter((item) => !item.applied);
    for (const migration of pending) {
      console.log(`Applying ${migration.name}`);
      const sql = await fs.readFile(path.join(migrationsDirectory, migration.name), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
          [migration.name]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${migration.name} failed: ${error.message}`, {
          cause: error
        });
      }
    }
    console.log(pending.length ? `Applied ${pending.length} migration(s).` : "Database is already up to date.");
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext('xlore_u_schema_migrations'))");
    } catch {}
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
