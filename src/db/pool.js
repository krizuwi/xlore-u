import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { config } from "../config.js";
import { createPoolOptions } from "./pool-options.js";

const { Pool, types } = pg;

types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);

export const rawPool = new Pool(createPoolOptions(config.db, { serverless: Boolean(process.env.VERCEL) }));
if (process.env.VERCEL) {
  attachDatabasePool(rawPool);
  const target = new URL(config.db.connectionString);
  // Safe operational metadata for checking a deployment; never log the URL.
  console.info("Database pool initialized", {
    mode: target.hostname.endsWith(".pooler.supabase.com") && target.port === "6543" ? "transaction" : "other",
    max: rawPool.options.max, idleTimeoutMillis: rawPool.options.idleTimeoutMillis
  });
}
// Idle socket errors must not crash the entire Express process. pg removes the
// failed client; the next query obtains a fresh connection. Do not log secrets.
rawPool.on("error", error => console.error("Idle database connection failed", { code: error.code ?? "UNKNOWN" }));

function postgresPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function adapter(executor) {
  const normalize = (result) => [
    result.command === "SELECT"
      ? result.rows
      : { affectedRows: result.rowCount, rows: result.rows },
    undefined
  ];
  return {
    async execute(sql, values = []) {
      const result = await executor.query(postgresPlaceholders(sql), values);
      return normalize(result);
    },
    async query(sql, values = []) {
      const result = await executor.query(postgresPlaceholders(sql), values);
      return normalize(result);
    }
  };
}

export const pool = {
  ...adapter(rawPool),
  end: () => rawPool.end()
};

export async function withTransaction(work) {
  const connection = await rawPool.connect();
  try {
    await connection.query("BEGIN");
    const result = await work(adapter(connection));
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}
