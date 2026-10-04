import crypto from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool, withTransaction } from "../db/pool.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert } from "../utils/http-error.js";
import { id, text, number, validateSchool, validateProgram, validateQuestion } from "../services/admin-validation.js";
import { getQuestionBank } from "../services/question-bank.js";
import { getAdminSettings } from "../services/admin-settings.js";
import { runCatalogUpdate } from "../services/catalog-updater.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin, rateLimit({ windowMs: 60_000, limit: 120 }));
async function audit(connection, user, action, entity, entityId, detail) {
  await connection.execute("INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, detail) VALUES (?, ?, ?, ?, ?)", [user.user_id, action, entity, entityId, detail]);
}
adminRouter.get("/schools", asyncHandler(async (_req, res) => {
  const [data] = await pool.query(`SELECT s.school_id AS id, s.school_name AS name, s.school_type AS type,
    s.city_district AS city, s.address, s.latitude, s.longitude, s.official_website_url AS website,
    s.tuition_range AS "tuitionRange", s.accreditation, s.scholarship_info AS "scholarshipInfo", s.description,
    s.google_rating AS "googleRating", CASE WHEN a.is_active_available THEN 'Active' ELSE 'Inactive' END AS status,
    (SELECT COUNT(*) FROM school_programs sp JOIN programs p ON p.program_id = sp.program_id
      WHERE sp.school_id = s.school_id AND p.is_active) AS programs
    FROM schools s LEFT JOIN available_schools a ON a.school_id = s.school_id ORDER BY s.school_name`);
  res.json({ data });
}));
async function saveSchool(req, res) {
  const item = validateSchool(req.body), schoolId = req.params.id ? id(req.params.id) : crypto.randomUUID();
  await withTransaction(async connection => {
    const values = [item.name, item.type, item.city, item.address, item.latitude, item.longitude, item.website,
      item.tuitionRange, item.accreditation, item.scholarshipInfo, item.description, item.googleRating];
    if (req.params.id) {
      const [result] = await connection.execute(`UPDATE schools SET school_name = ?, school_type = ?, city_district = ?,
        address = ?, latitude = ?, longitude = ?, official_website_url = ?, tuition_range = ?, accreditation = ?,
        scholarship_info = ?, description = ?, google_rating = ?, catalog_last_updated_at = CURRENT_TIMESTAMP WHERE school_id = ?`, [...values, schoolId]);
      assert(result.affectedRows === 1, 404, "School not found.");
    } else {
      await connection.execute(`INSERT INTO schools (school_name, school_type, city_district, address, latitude, longitude,
        official_website_url, tuition_range, accreditation, scholarship_info, description, google_rating, school_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [...values, schoolId]);
    }
    await connection.execute(`INSERT INTO available_schools (available_id, school_id, available_since, is_active_available)
      VALUES (?, ?, CURRENT_DATE, ?) ON CONFLICT (school_id) DO UPDATE SET is_active_available = EXCLUDED.is_active_available`, [crypto.randomUUID(), schoolId, item.status === "Active"]);
    await audit(connection, req.user, req.params.id ? "updated" : "created", "school", schoolId, item.name);
  });
  res.status(req.params.id ? 200 : 201).json({ id: schoolId, message: "University saved." });
}
adminRouter.post("/schools", asyncHandler(saveSchool));
adminRouter.put("/schools/:id", asyncHandler(saveSchool));
adminRouter.delete("/schools/:id", asyncHandler(async (req, res) => {
  await withTransaction(async connection => {
    const [result] = await connection.execute("UPDATE available_schools SET is_active_available = FALSE WHERE school_id = ?", [id(req.params.id)]);
    assert(result.affectedRows === 1, 404, "School not found.");
    await audit(connection, req.user, "archived", "school", req.params.id, "University removed from the public directory.");
  });
  res.json({ message: "University archived. Existing history is preserved." });
}));
adminRouter.get("/programs", asyncHandler(async (_req, res) => {
  const [data] = await pool.query(`SELECT p.program_id AS id, p.program_name AS name, p.description, p.category,
    p.degree_level AS "degreeLevel", p.duration, p.requirements, p.career_paths AS "careerPaths", p.interest_tags AS "interestTags",
    CASE WHEN p.is_active THEN 'Active' ELSE 'Inactive' END AS status,
    COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('id', s.school_id, 'name', s.school_name, 'tuition', sp.tuition_per_semester)
      ORDER BY s.school_name) FILTER (WHERE s.school_id IS NOT NULL), '[]'::jsonb) AS schools
    FROM programs p LEFT JOIN school_programs sp ON sp.program_id = p.program_id
    LEFT JOIN schools s ON s.school_id = sp.school_id GROUP BY p.program_id ORDER BY p.program_name`);
  res.json({ data });
}));
async function saveProgram(req, res) {
  const item = validateProgram(req.body), programId = req.params.id ? id(req.params.id) : crypto.randomUUID();
  await withTransaction(async connection => {
    const values = [item.name, item.description, item.category, item.degreeLevel, item.duration, item.requirements,
      JSON.stringify(item.careerPaths), JSON.stringify(item.interestTags), item.status === "Active"];
    if (req.params.id) {
      const [result] = await connection.execute(`UPDATE programs SET program_name = ?, description = ?, category = ?, degree_level = ?,
        duration = ?, requirements = ?, career_paths = ?, interest_tags = ?, is_active = ? WHERE program_id = ?`, [...values, programId]);
      assert(result.affectedRows === 1, 404, "Program not found.");
    } else {
      await connection.execute(`INSERT INTO programs (program_name, description, category, degree_level, duration, requirements,
        career_paths, interest_tags, is_active, program_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [...values, programId]);
    }
    const [existing] = await connection.execute("SELECT school_id FROM school_programs WHERE program_id = ?", [programId]);
    for (const offering of existing) {
      if (!item.schools.some(s => s.id === offering.school_id)) await connection.execute("DELETE FROM school_programs WHERE program_id = ? AND school_id = ?", [programId, offering.school_id]);
    }
    for (const school of item.schools) {
      const [rows] = await connection.execute("SELECT school_id FROM schools WHERE school_id = ?", [school.id]);
      assert(rows.length, 400, "A selected university is unavailable.");
      await connection.execute(`INSERT INTO school_programs (school_program_id, school_id, program_id, tuition_per_semester)
        VALUES (?, ?, ?, ?) ON CONFLICT (school_id, program_id) DO UPDATE SET tuition_per_semester = EXCLUDED.tuition_per_semester`, [crypto.randomUUID(), school.id, programId, school.tuition]);
    }
    await audit(connection, req.user, req.params.id ? "updated" : "created", "program", programId, item.name);
  });
  res.status(req.params.id ? 200 : 201).json({ id: programId, message: "Program saved." });
}
adminRouter.post("/programs", asyncHandler(saveProgram));
adminRouter.put("/programs/:id", asyncHandler(saveProgram));
adminRouter.patch("/programs/:id/category", asyncHandler(async (req, res) => {
  const category = text(req.body.category, "Category", 100);
  await withTransaction(async connection => {
    const [result] = await connection.execute("UPDATE programs SET category = ? WHERE program_id = ?", [category, id(req.params.id)]);
    assert(result.affectedRows === 1, 404, "Program not found.");
    await audit(connection, req.user, "updated", "category", req.params.id, category);
  });
  res.json({ message: "Category saved for all schools offering this program." });
}));
adminRouter.delete("/programs/:id", asyncHandler(async (req, res) => {
  await withTransaction(async connection => {
    const [result] = await connection.execute("UPDATE programs SET is_active = FALSE WHERE program_id = ?", [id(req.params.id)]);
    assert(result.affectedRows === 1, 404, "Program not found.");
    await audit(connection, req.user, "archived", "program", req.params.id, "Program removed from the public directory.");
  });
  res.json({ message: "Program archived. Existing history is preserved." });
}));
adminRouter.get("/questions", asyncHandler(async (_req, res) => res.json(await getQuestionBank({ includeDrafts: true }))));
async function saveQuestion(req, res) {
  const item = validateQuestion(req.body), questionId = req.params.id ? text(req.params.id, "Question ID", 80) : crypto.randomUUID();
  await withTransaction(async connection => {
    await connection.query("LOCK TABLE assessment_questions IN EXCLUSIVE MODE");
    if (req.params.id) {
      const [result] = await connection.execute("UPDATE assessment_questions SET prompt = ?, options = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE question_id = ?", [item.prompt, JSON.stringify(item.options), item.status, questionId]);
      assert(result.affectedRows === 1, 404, "Question not found.");
    } else await connection.execute(`INSERT INTO assessment_questions (question_id, prompt, options, status, position_index)
      VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(position_index), 0) + 1 FROM assessment_questions))`, [questionId, item.prompt, JSON.stringify(item.options), item.status]);
    const [active] = await connection.query("SELECT COUNT(*) AS total FROM assessment_questions WHERE status = 'Active'");
    assert(active[0].total > 0, 400, "Keep at least one active assessment question.");
    await audit(connection, req.user, req.params.id ? "updated" : "created", "question", questionId, item.prompt);
  });
  res.status(req.params.id ? 200 : 201).json({ id: questionId, message: "Assessment question saved." });
}
adminRouter.post("/questions", asyncHandler(saveQuestion));
adminRouter.put("/questions/:id", asyncHandler(saveQuestion));
adminRouter.delete("/questions/:id", asyncHandler(async (req, res) => {
  await withTransaction(async connection => {
    await connection.query("LOCK TABLE assessment_questions IN EXCLUSIVE MODE");
    const [result] = await connection.execute("UPDATE assessment_questions SET status = 'Archived', updated_at = CURRENT_TIMESTAMP WHERE question_id = ?", [text(req.params.id, "Question ID", 80)]);
    assert(result.affectedRows === 1, 404, "Question not found.");
    const [active] = await connection.query("SELECT COUNT(*) AS total FROM assessment_questions WHERE status = 'Active'");
    assert(active[0].total > 0, 400, "Keep at least one active assessment question.");
    await audit(connection, req.user, "archived", "question", req.params.id, "Assessment question archived.");
  });
  res.json({ message: "Question archived. Previous results are preserved." });
}));
adminRouter.get("/settings", asyncHandler(async (_req, res) => res.json(await getAdminSettings())));
adminRouter.patch("/settings", asyncHandler(async (req, res) => {
  const next = {};
  if (req.body.workspaceName !== undefined) next.workspaceName = text(req.body.workspaceName, "Workspace name", 60);
  if (req.body.activityFilter !== undefined) {
    assert(["all", "success", "info", "error"].includes(req.body.activityFilter), 400, "Invalid activity filter.");
    next.activityFilter = req.body.activityFilter;
  }
  if (req.body.frequency !== undefined) {
    assert(["Daily", "Weekly", "Manual only"].includes(req.body.frequency), 400, "Invalid schedule.");
    next.frequency = req.body.frequency;
  }
  if (req.body.timeout !== undefined) next.timeout = number(req.body.timeout, "Request timeout", 5, 60);
  const saved = await withTransaction(async connection => {
    const current = await getAdminSettings(connection, true);
    const preferences = { ...current, ...next };
    await connection.execute("UPDATE admin_settings SET preferences = ?, updated_at = CURRENT_TIMESTAMP WHERE id = TRUE", [JSON.stringify(preferences)]);
    await audit(connection, req.user, "updated", "settings", null, "Workspace settings saved.");
    return preferences;
  });
  res.json(saved);
}));
adminRouter.get("/scraping", asyncHandler(async (_req, res) => {
  const [[sources], [runs], settings] = await Promise.all([
    pool.query(`SELECT cs.source_id AS id, cs.school_id AS "schoolId", s.school_name AS school, cs.source_type AS type,
      cs.source_url AS url, cs.enabled, cs.interval_hours AS "intervalHours", cs.last_status AS status,
      cs.last_error AS error, cs.last_checked_at AS "checkedAt" FROM catalog_sources cs
      JOIN schools s ON s.school_id = cs.school_id ORDER BY s.school_name, cs.source_type`),
    pool.query(`SELECT run_id AS id, trigger_type AS "triggerType", status, sources_checked AS "sourcesChecked",
      sources_succeeded AS "sourcesSucceeded", records_discovered AS records, records_changed AS changes,
      started_at AS "startedAt", finished_at AS "finishedAt", error_summary AS error
      FROM catalog_update_runs ORDER BY started_at DESC LIMIT 100`), getAdminSettings()
  ]);
  res.json({ sources, runs, settings });
}));
adminRouter.patch("/scraping/sources/:id", asyncHandler(async (req, res) => {
  assert(typeof req.body.enabled === "boolean", 400, "Enabled must be true or false.");
  await withTransaction(async connection => {
    const [result] = await connection.execute("UPDATE catalog_sources SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE source_id = ?", [req.body.enabled, id(req.params.id)]);
    assert(result.affectedRows === 1, 404, "Source not found.");
    await audit(connection, req.user, "updated", "source", req.params.id, req.body.enabled ? "Catalog source enabled." : "Catalog source disabled.");
  });
  res.json({ message: "Catalog source updated." });
}));
adminRouter.post("/scraping/run", rateLimit({ windowMs: 60_000, limit: 3 }), asyncHandler(async (req, res) => {
  const schoolId = id(req.body.schoolId);
  const [sources] = await pool.execute("SELECT source_id FROM catalog_sources WHERE school_id = ? AND enabled = TRUE", [schoolId]);
  assert(sources.length > 0, 400, "This university has no enabled catalog sources.");
  const result = await runCatalogUpdate({ triggerType: "manual", schoolId });
  if (!result.skipped) await audit(pool, req.user, "collected", "scraping", result.runId, `${result.checked} sources checked; ${result.changed} changes saved.`);
  res.json(result);
}));
adminRouter.get("/logs", asyncHandler(async (_req, res) => {
  const [data] = await pool.query(`SELECT id::text, 'info' AS severity, action || ' ' || entity_type AS title,
    detail, entity_type AS source, created_at AS "createdAt" FROM admin_audit_log
    UNION ALL SELECT run_id::text, CASE WHEN status IN ('failed','partial') THEN 'error' ELSE 'success' END,
    'Catalog update ' || status, COALESCE(error_summary, records_changed || ' records changed'), 'scraping', started_at
    FROM catalog_update_runs ORDER BY "createdAt" DESC LIMIT 200`);
  res.json({ data });
}));
adminRouter.get("/growth", asyncHandler(async (_req, res) => {
  const [data] = await pool.query(`SELECT date_trunc('day', started_at) AS date, SUM(records_discovered) AS discovered,
    SUM(records_changed) AS changed FROM catalog_update_runs WHERE started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND status <> 'running' GROUP BY 1 ORDER BY 1`);
  res.json({ data });
}));
