import { app } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { startCatalogScheduler, stopCatalogScheduler } from "./services/catalog-scheduler.js";
import { googleTrustInfo } from "./services/google-auth.js";
import { isEmailDeliveryEnabled } from "./services/email.js";

const isVercel = Boolean(process.env.VERCEL);
let server;

if (!isVercel) {
  server = app.listen(config.port, () => {
    console.log(`Xlore U API is running at http://localhost:${config.port}`);
    console.log(`Health check: http://localhost:${config.port}/api/health`);
    console.log(`Google HTTPS: explicit trusted certificates; Node ${googleTrustInfo.nodeVersion}; system roots ${googleTrustInfo.systemRootCount}`);
    console.log(`Email delivery: ${isEmailDeliveryEnabled() ? "configured" : "not configured"}`);
    startCatalogScheduler();
  });
}

async function shutdown(signal) {
  if (!server) return;
  console.log(`\n${signal} received. Closing server...`);
  stopCatalogScheduler();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;
