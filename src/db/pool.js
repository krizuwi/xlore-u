import pg from "pg";
import { config } from "../config.js";

const { Pool, types } = pg;

types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);

export const rawPool = new Pool({
  connectionString: config.db.connectionString,
  max: config.db.poolMax,
  idleTimeoutMillis: config.db.idleTimeoutMs,
  connectionTimeoutMillis: config.db.connectTimeoutMs,
  application_name: "xlore-u-api",
  ssl:
    config.db.sslMode === "disable"
      ? false
      : config.db.sslMode === "verify-full"
        ? { rejectUnauthorized: true, ca: config.db.sslCa }
        : { rejectUnauthorized: false }
});

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
