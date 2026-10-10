import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { pool, withTransaction } from "../src/db/pool.js";
import { assessmentResetTables, resetAssessmentResults } from "../src/services/assessment-reset.js";

// Read-only by default. Explicit --apply performs the one-off, requested all-user reset.
const apply = process.argv.includes("--apply");
try {
  if (!apply) {
    const counts = {};
    for (const table of assessmentResetTables) {
      const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM ${table}`);
      counts[table] = Number(rows[0].count);
    }
    console.log(JSON.stringify({ mode: "dry-run", counts, message: "No data changed. Use --apply only for an authorized all-user reset." }));
  } else {
    const directory = path.join(os.homedir(), ".codex", "private-backups", "xlore-u-assessments");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const backupPath = path.join(directory, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.json`);
    const result = await withTransaction(connection => resetAssessmentResults(connection, async backup => {
      const content = JSON.stringify(backup, null, 2);
      const file = await fs.open(backupPath, "wx", 0o600);
      try { await file.writeFile(content, "utf8"); await file.sync(); } finally { await file.close(); }
      const verified = await fs.readFile(backupPath, "utf8");
      const digest = value => createHash("sha256").update(value).digest("hex");
      if (digest(content) !== digest(verified)) throw new Error("Backup verification failed. No reset applied.");
      JSON.parse(verified);
    }));
    console.log(JSON.stringify({ mode: "applied", ...result, backupPath, message: "Assessment results reset. One-time assessment restriction remains enabled." }));
  }
} finally {
  await pool.end();
}
