import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert } from "../utils/http-error.js";

export const savedRouter = Router();
savedRouter.use(requireAuth);

savedRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [[schools], [programs]] = await Promise.all([
      pool.execute(
        `SELECT s.school_id AS id, s.school_name AS name, s.city_district AS city,
          s.school_type AS "schoolType", s.tuition_range AS "tuitionRange", us.created_at AS "savedAt"
         FROM user_saved_schools us JOIN schools s ON s.school_id = us.school_id
         WHERE us.user_id = ? ORDER BY us.created_at DESC`,
        [req.user.user_id]
      ),
      pool.execute(
        `SELECT p.program_id AS id, p.program_name AS name, p.category,
          p.degree_level AS "degreeLevel", up.created_at AS "savedAt"
         FROM user_saved_programs up JOIN programs p ON p.program_id = up.program_id
         WHERE up.user_id = ? ORDER BY up.created_at DESC`,
        [req.user.user_id]
      )
    ]);
    res.json({ schools, programs });
  })
);

function saveRoute(type) {
  const isSchool = type === "school";
  const table = isSchool ? "user_saved_schools" : "user_saved_programs";
  const entityTable = isSchool ? "schools" : "programs";
  const column = isSchool ? "school_id" : "program_id";
  return asyncHandler(async (req, res) => {
    const [entities] = await pool.execute(`SELECT ${column} FROM ${entityTable} WHERE ${column} = ?`, [req.params.id]);
    assert(entities[0], 404, `${isSchool ? "School" : "Program"} not found.`);
    await pool.execute(`INSERT INTO ${table} (user_id, ${column}) VALUES (?, ?) ON CONFLICT DO NOTHING`, [req.user.user_id, req.params.id]);
    res.status(201).json({ message: `${isSchool ? "School" : "Program"} saved.` });
  });
}

function deleteRoute(type) {
  const isSchool = type === "school";
  const table = isSchool ? "user_saved_schools" : "user_saved_programs";
  const column = isSchool ? "school_id" : "program_id";
  return asyncHandler(async (req, res) => {
    await pool.execute(`DELETE FROM ${table} WHERE user_id = ? AND ${column} = ?`, [req.user.user_id, req.params.id]);
    res.status(204).end();
  });
}

savedRouter.post("/schools/:id", saveRoute("school"));
savedRouter.delete("/schools/:id", deleteRoute("school"));
savedRouter.post("/programs/:id", saveRoute("program"));
savedRouter.delete("/programs/:id", deleteRoute("program"));
