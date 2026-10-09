import { pool } from "../db/pool.js";
import { assert } from "../utils/http-error.js";

export const FEEDBACK_SECTIONS = ['assessment', 'comparison', 'map', 'school'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateFeedback(body = {}) {
  assert(FEEDBACK_SECTIONS.includes(body.section), 400, "Choose a valid feedback section.");
  assert(Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5, 400, "Choose between 1 and 5 stars.");
  assert(body.comment === undefined || typeof body.comment === "string", 400, "Comment must be text.");
  const comment = (body.comment ?? "").trim();
  assert(comment.length <= 1000, 400, "Keep your comment within 1,000 characters.");
  assert(typeof body.releaseId === "string" && /^feedback-[a-f0-9]{32}$/.test(body.releaseId), 400, "A valid feedback release is required.");
  const schoolId = body.section === "school" ? body.schoolId : null;
  assert(body.section !== "school" || (typeof schoolId === "string" && uuid.test(schoolId)), 400, "Choose a valid school.");
  assert(body.section === "school" || body.schoolId == null, 400, "School feedback belongs in the school section.");
  return { section: body.section, rating: body.rating, comment, schoolId, releaseId: body.releaseId };
}

export function feedbackReportFilters(query = {}) {
  assert(!query.section || (typeof query.section === 'string' && FEEDBACK_SECTIONS.includes(query.section)), 400, "Invalid feedback section.");
  assert(!query.rating || (typeof query.rating === 'string' && /^[1-5]$/.test(query.rating)), 400, "Invalid star filter.");
  assert(!query.page || (typeof query.page === 'string' && /^[1-9][0-9]{0,5}$/.test(query.page)), 400, "Invalid feedback page.");
  assert(query.current === undefined || ['0', '1'].includes(query.current), 400, "Invalid release filter.");
  return { section: query.section || null, rating: query.rating ? Number(query.rating) : null, page: Number(query.page || 1), current: query.current === '1' };
}

export async function getFeedbackReport(query, releaseId) {
  const filters = feedbackReportFilters(query), values = [], clauses = [];
  if (filters.section) { clauses.push('f.section = ?'); values.push(filters.section); }
  if (filters.rating) { clauses.push('f.rating = ?'); values.push(filters.rating); }
  if (filters.current) { clauses.push('f.release_id = ?'); values.push(releaseId); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [totals] = await pool.query(`SELECT COUNT(*)::integer AS total, ROUND(AVG(f.rating), 2)::float AS average
    FROM user_feedback f ${where}`, values);
  const [distribution] = await pool.query(`SELECT f.rating, COUNT(*)::integer AS count FROM user_feedback f ${where}
    GROUP BY f.rating ORDER BY f.rating DESC`, values);
  const pageSize = 12, total = totals[0]?.total ?? 0;
  const page = Math.min(filters.page, Math.max(1, Math.ceil(total / pageSize)));
  const [data] = await pool.query(`SELECT f.feedback_id AS id, f.release_id AS "releaseId", f.section,
    f.school_id AS "schoolId", s.school_name AS "schoolName", f.rating, f.comment, f.created_at AS "createdAt",
    u.full_name AS "userName", u.email AS "userEmail" FROM user_feedback f
    JOIN users u ON u.user_id = f.user_id LEFT JOIN schools s ON s.school_id = f.school_id
    ${where} ORDER BY f.created_at DESC, f.feedback_id DESC LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]);
  return { data, summary: { total, average: totals[0]?.average ?? null, distribution }, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) }, releaseId };
}
