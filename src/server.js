import { app } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { startCatalogScheduler, stopCatalogScheduler } from "./services/catalog-scheduler.js";

const server = app.listen(config.port, () => {
  console.log(`Xlore U API is running at http://localhost:${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/api/health`);
  startCatalogScheduler();
});

async function shutdown(signal) {
  console.log(`\n${signal} received. Closing server...`);
  stopCatalogScheduler();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
