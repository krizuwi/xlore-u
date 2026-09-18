import { rawPool } from "../src/db/pool.js";

try {
  const result = await rawPool.query(
    `SELECT s.school_name AS school, cs.source_type AS type, cs.source_url AS url,
      cs.last_status AS status, cs.last_success_at AS "lastSuccess", cs.last_error AS error
     FROM catalog_sources cs JOIN schools s ON s.school_id = cs.school_id
     ORDER BY s.school_name, cs.source_type`
  );
  console.table(result.rows);
  const programs = await rawPool.query(
    `SELECT program_name AS program, category, source_url AS source
     FROM programs WHERE created_from_scrape = true
     ORDER BY last_verified_at DESC NULLS LAST, program_name LIMIT 30`
  );
  console.log("Recently discovered programs:");
  console.table(programs.rows);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await rawPool.end();
}
