import { pool } from "../db/pool.js";
import { config } from "../config.js";

export async function getAdminSettings(connection = pool, lock = false) {
  const [rows] = await connection.query(`SELECT preferences FROM admin_settings WHERE id = TRUE${lock ? " FOR UPDATE" : ""}`);
  return {
    workspaceName: "Xlore U", activityFilter: "all",
    frequency: "Weekly", timeout: Math.round(config.catalogUpdater.requestTimeoutMs / 1000),
    ...rows[0]?.preferences
  };
}
