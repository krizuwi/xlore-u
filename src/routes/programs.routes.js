import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert } from "../utils/http-error.js";
import { normalizeProgramData } from "../services/program-management.js";
import { programSearch } from "../utils/catalog-search.js";

export const programsRouter = Router();

programsRouter.get(
  "/normalize",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT p.program_name AS "Program name", s.school_name AS "University",
        p.category AS "Category", NULL::text AS "Duration", NULL::text AS "Status"
       FROM programs p
       LEFT JOIN school_programs sp ON sp.program_id = p.program_id
       LEFT JOIN schools s ON s.school_id = sp.school_id
       WHERE p.is_active = TRUE ORDER BY p.program_name, s.school_name`
    );
    res.json(await normalizeProgramData(rows));
  })
);

programsRouter.post(
  "/normalize",
  asyncHandler(async (req, res) => {
    const data = req.body;
    const isRecord = (value) => value && typeof value === "object" && !Array.isArray(value);
    assert(
      (Array.isArray(data) && data.every(isRecord)) || isRecord(data),
      400,
      "Program data must be an object or an array of objects."
    );
    res.json(await normalizeProgramData(data));
  })
);

programsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
    const offset = (page - 1) * limit;
    const conditions = ["p.is_active = TRUE"];
    const values = [];
    const search = programSearch(req.query.search);
    if (search.condition) { conditions.push(search.condition); values.push(...search.values); }
    if (req.query.category) {
      conditions.push("p.category = ?");
      values.push(String(req.query.category));
    }
    if (req.query.degreeLevel) {
      conditions.push("p.degree_level = ?");
      values.push(String(req.query.degreeLevel));
    }
    const where = conditions.join(" AND ");
    const [countRows] = await pool.execute(`SELECT COUNT(*) AS total, MAX(p.last_verified_at) AS "lastSyncAt" FROM programs p WHERE ${where}`, values);
    const [rows] = await pool.execute(
      `SELECT p.program_id AS id, p.program_name AS name, p.description, p.category,
        p.degree_level AS "degreeLevel", p.requirements, p.career_paths AS "careerPaths",
        p.interest_tags AS "interestTags", p.source_url AS "sourceUrl",
        p.last_verified_at AS "lastVerifiedAt", COUNT(DISTINCT s.school_id) AS "schoolCount",
        COALESCE(
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'id', s.school_id,
              'name', s.school_name,
              'city', s.city_district,
              'schoolType', s.school_type,
              'tuitionPerSemester', sp.tuition_per_semester,
              'isTopProgram', sp.is_top_program
            ) ORDER BY sp.is_top_program DESC, s.school_name
          ) FILTER (WHERE s.school_id IS NOT NULL),
          '[]'::jsonb
        ) AS schools
       FROM programs p
       LEFT JOIN school_programs sp ON sp.program_id = p.program_id
       LEFT JOIN schools s ON s.school_id = sp.school_id AND EXISTS (
         SELECT 1 FROM available_schools a WHERE a.school_id = s.school_id AND a.is_active_available = TRUE)
       WHERE ${where} GROUP BY p.program_id ORDER BY ${search.order || "p.program_name"}
       LIMIT ${limit} OFFSET ${offset}`,
      [...values, ...search.orderValues]
    );
    res.json({
      data: rows,
      pagination: { page, limit, total: countRows[0].total, pages: Math.ceil(countRows[0].total / limit) },
      lastSyncAt: countRows[0].lastSyncAt
    });
  })
);

programsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const [[programs], [schools]] = await Promise.all([
      pool.execute(
        `SELECT program_id AS id, program_name AS name, description, category,
          degree_level AS "degreeLevel", requirements, career_paths AS "careerPaths",
          interest_tags AS "interestTags", source_url AS "sourceUrl",
          last_verified_at AS "lastVerifiedAt" FROM programs WHERE program_id = ? AND is_active = TRUE`,
        [req.params.id]
      ),
      pool.execute(
        `SELECT s.school_id AS id, s.school_name AS name, s.city_district AS city,
          s.school_type AS "schoolType", sp.tuition_per_semester AS "tuitionPerSemester",
          sp.is_top_program AS "isTopProgram", sp.source_url AS "sourceUrl",
          sp.last_verified_at AS "lastVerifiedAt"
         FROM school_programs sp JOIN schools s ON s.school_id = sp.school_id
         WHERE sp.program_id = ? AND EXISTS (SELECT 1 FROM available_schools a
           WHERE a.school_id = s.school_id AND a.is_active_available = TRUE)
         ORDER BY sp.is_top_program DESC, sp.tuition_per_semester`,
        [req.params.id]
      )
    ]);
    assert(programs[0], 404, "Program not found.");
    res.json({ ...programs[0], schools });
  })
);
