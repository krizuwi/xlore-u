import "dotenv/config";

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function asPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: asPositiveInteger(process.env.PORT, 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  db: {
    connectionString: required("DATABASE_URL"),
    sslMode: (process.env.DB_SSL ?? "require").toLowerCase(),
    sslCa: process.env.DB_SSL_CA?.replace(/\\n/g, "\n"),
    poolMax: asPositiveInteger(process.env.DB_POOL_MAX, 5),
    idleTimeoutMs: asPositiveInteger(process.env.DB_IDLE_TIMEOUT_MS, 30000),
    connectTimeoutMs: asPositiveInteger(process.env.DB_CONNECT_TIMEOUT_MS, 10000)
  },
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "development-access-secret-change-me"),
    refreshSecret: required("JWT_REFRESH_SECRET", "development-refresh-secret-change-me"),
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
    refreshDays: asPositiveInteger(process.env.REFRESH_TOKEN_DAYS, 7)
  },
  catalogUpdater: {
    enabled: (process.env.CATALOG_UPDATE_ENABLED ?? "true").toLowerCase() === "true",
    intervalHours: asPositiveInteger(process.env.CATALOG_UPDATE_INTERVAL_HOURS, 168),
    requestTimeoutMs: asPositiveInteger(process.env.CATALOG_REQUEST_TIMEOUT_MS, 15000),
    maxResponseBytes: asPositiveInteger(process.env.CATALOG_MAX_RESPONSE_BYTES, 5_000_000),
    minHostDelayMs: asPositiveInteger(process.env.CATALOG_MIN_HOST_DELAY_MS, 1500),
    maxSourcesPerRun: asPositiveInteger(process.env.CATALOG_MAX_SOURCES_PER_RUN, 20),
    userAgent:
      process.env.CATALOG_USER_AGENT ??
      "XloreUCatalogUpdater/1.0 (+https://localhost; educational catalog updater)"
  },
  returnVerificationCode:
    (process.env.RETURN_VERIFICATION_CODE ?? "true").toLowerCase() === "true"
};

if (!["disable", "require", "verify-full"].includes(config.db.sslMode)) {
  throw new Error("DB_SSL must be disable, require, or verify-full.");
}

if (config.db.sslMode === "verify-full" && !config.db.sslCa) {
  throw new Error("DB_SSL_CA is required when DB_SSL=verify-full.");
}

if (
  config.nodeEnv === "production" &&
  (config.jwt.accessSecret.includes("development") ||
    config.jwt.refreshSecret.includes("development"))
) {
  throw new Error("Production requires strong JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values.");
}
