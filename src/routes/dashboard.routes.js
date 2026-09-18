import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const [[savedSchools], [savedPrograms], [assessments], [latest]] = await Promise.all([
      pool.execute("SELECT COUNT(*) AS count FROM user_saved_schools WHERE user_id = ?", [userId]),
      pool.execute("SELECT COUNT(*) AS count FROM user_saved_programs WHERE user_id = ?", [userId]),
      pool.execute("SELECT COUNT(*) AS count FROM assessments WHERE user_id = ?", [userId]),
      pool.execute(
        `SELECT a.assessment_id AS "assessmentId", a.completed_at AS "completedAt",
          cp.primary_direction AS "primaryDirection"
         FROM assessments a JOIN career_profiles cp ON cp.assessment_id = a.assessment_id
         WHERE a.user_id = ? ORDER BY a.completed_at DESC LIMIT 1`,
        [userId]
      )
    ]);
    res.json({
      user: { id: userId, email: req.user.email, fullName: req.user.full_name },
      counts: {
        savedSchools: savedSchools[0].count,
        savedPrograms: savedPrograms[0].count,
        assessments: assessments[0].count
      },
      latestAssessment: latest[0] ?? null
    });
  })
);
