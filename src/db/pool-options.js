// One warm Vercel instance must not reserve a large share of Supabase's pool.
// Local/persistent servers retain their configured connection settings.
export function createPoolOptions(db, { serverless = false } = {}) {
  return {
    connectionString: db.connectionString,
    max: serverless ? Math.min(db.poolMax, 2) : db.poolMax,
    idleTimeoutMillis: serverless ? Math.min(db.idleTimeoutMs, 1000) : db.idleTimeoutMs,
    connectionTimeoutMillis: db.connectTimeoutMs,
    ...(serverless ? { maxLifetimeSeconds: 60, allowExitOnIdle: true } : {}),
    application_name: "xlore-u-api",
    ssl: db.sslMode === "disable" ? false
      : db.sslMode === "verify-full" ? { rejectUnauthorized: true, ca: db.sslCa }
      : { rejectUnauthorized: false }
  };
}

export function transactionPoolerUrl(connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname.endsWith(".pooler.supabase.com") ||
      !["5432", "6543"].includes(url.port || "5432")) {
    throw new Error("Expected an existing Supabase shared-pooler PostgreSQL URL. Copy the transaction pooler URL from Supabase Connect.");
  }
  // Preserve the existing provider host, database, credentials and SSL options.
  url.port = "6543";
  return url.toString();
}
