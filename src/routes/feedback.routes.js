import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../db/pool.js";
import { requireAuth } from "./middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert } from "../utils/http-error.js";
import { isAdminUser } from "../utils/admin-access.js";
import { getFeedbackRelease } from "../services/feedback-release.js";
import { validateFeedback } from "../services/user-feedback.js";

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth, (req, res, next) => {
  res.set("Cache-Control", "no-store");
  try {
    assert(req.user.email_verified_at && !isAdminUser(req.user), 403, "Feedback is available to verified student accounts.");
    next();
  } catch (error) { next(error); }
});
feedbackRouter.get("/status", asyncHandler(async (req, res) => {
  const releaseId = await getFeedbackRelease(req.get("origin"));
  const [rows] = await pool.query("SELECT section FROM user_feedback WHERE user_id = ? AND release_id = ?", [req.user.user_id, releaseId]);
  res.json({ releaseId, submittedSections: rows.map(row => row.section) });
}));
feedbackRouter.post("/", rateLimit({ windowMs: 60_000, limit: 12 }), asyncHandler(async (req, res) => {
  const item = validateFeedback(req.body);
  const releaseId = await getFeedbackRelease(req.get("origin"));
  assert(item.releaseId === releaseId, 409, "The site was updated. Please reopen feedback for the current version.");
  if (item.schoolId) {
    const [schools] = await pool.execute("SELECT school_id FROM schools WHERE school_id = ?", [item.schoolId]);
    assert(schools.length, 404, "School not found.");
  }
  // The unique constraint is the authority across devices and concurrent requests.
  // Repeated submissions never overwrite the user's previous stars/comment.
  const [result] = await pool.query(`INSERT INTO user_feedback (user_id, release_id, section, school_id, rating, comment)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, release_id, section) DO NOTHING RETURNING feedback_id`,
  [req.user.user_id, releaseId, item.section, item.schoolId, item.rating, item.comment]);
  const saved = result.affectedRows > 0;
  res.status(saved ? 201 : 200).json({ submitted: true, alreadySubmitted: !saved, releaseId, section: item.section });
}));
