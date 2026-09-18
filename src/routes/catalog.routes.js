import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/async-handler.js";

export const catalogRouter = Router();

catalogRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const [[runs], [sources]] = await Promise.all([
      pool.query(
        `SELECT run_id AS id, trigger_type AS "triggerType", status, sources_checked AS "sourcesChecked",
          sources_succeeded AS "sourcesSucceeded", records_discovered AS "recordsDiscovered",
          records_changed AS "recordsChanged", started_at AS "startedAt", finished_at AS "finishedAt"
         FROM catalog_update_runs WHERE sources_checked > 0 ORDER BY started_at DESC LIMIT 1`
      ),
      pool.query(
        `SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE enabled) AS enabled,
          COUNT(*) FILTER (WHERE last_status = 'failed') AS failed
         FROM catalog_sources`
      )
    ]);
    res.json({ lastRun: runs[0] ?? null, sources: sources[0] });
  })
);
