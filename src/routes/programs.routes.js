import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert } from "../utils/http-error.js";
import { normalizeProgramData } from "../services/program-management.js";
import { programSearch } from "../utils/catalog-search.js";
import { getAssessmentSettings } from "../services/assessment-settings.js";
import { programMatchesCluster } from "../services/assessment-settings-validation.js";

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
      // Match the normalized labels returned by the filter list, even if legacy rows
      // contain different capitalization or extra whitespace.
      conditions.push("LOWER(REGEXP_REPLACE(BTRIM(p.category), '\\s+', ' ', 'g')) = LOWER(REGEXP_REPLACE(BTRIM(?), '\\s+', ' ', 'g'))");
      values.push(String(req.query.category));
    }
    if (req.query.degreeLevel) {
      conditions.push("p.degree_level = ?");
      values.push(String(req.query.degreeLevel));
    }
    const where = conditions.join(" AND ");
    const [{ settings }, [countRows], [rows]] = await Promise.all([
      getAssessmentSettings(),
      pool.execute(
        `SELECT COUNT(*) AS total, MAX(p.last_verified_at) AS "lastSyncAt"
         FROM programs p WHERE ${where}`,
        values
      ),
      pool.execute(
        `WITH page_programs AS (
           SELECT p.*, ROW_NUMBER() OVER (ORDER BY ${search.order || "p.program_name"}) AS result_order
           FROM programs p
           WHERE ${where}
           ORDER BY result_order
           LIMIT ${limit} OFFSET ${offset}
         ), school_offerings AS (
           SELECT sp.program_id,
             COUNT(DISTINCT s.school_id) AS school_count,
             JSONB_AGG(
               JSONB_BUILD_OBJECT(
                 'id', s.school_id,
                 'name', s.school_name,
                 'city', s.city_district,
                 'schoolType', s.school_type,
                 'tuitionPerSemester', sp.tuition_per_semester,
                 'isTopProgram', sp.is_top_program
               ) ORDER BY sp.is_top_program DESC, s.school_name
             ) AS schools
           FROM page_programs page
           JOIN school_programs sp ON sp.program_id = page.program_id
           JOIN schools s ON s.school_id = sp.school_id
           JOIN available_schools a ON a.school_id = s.school_id AND a.is_active_available = TRUE
           GROUP BY sp.program_id
         )
         SELECT p.program_id AS id, p.program_name AS name, p.description, p.category,
           p.degree_level AS "degreeLevel", p.requirements, p.career_paths AS "careerPaths",
           p.interest_tags AS "interestTags", p.source_url AS "sourceUrl",
           p.last_verified_at AS "lastVerifiedAt",
           COALESCE(offerings.school_count, 0) AS "schoolCount",
           COALESCE(offerings.schools, '[]'::jsonb) AS schools
         FROM page_programs p
         LEFT JOIN school_offerings offerings ON offerings.program_id = p.program_id
         ORDER BY p.result_order`,
        [...search.orderValues, ...values]
      )
    ]);
    for (const program of rows) {
      // Return the clusters computed from explicit IDs and keyword rules, not tags.
      const clusters = (settings?.clusters ?? []).filter(cluster => programMatchesCluster({ program_id: program.id, program_name: program.name }, cluster));
      program.clusterIds = clusters.map(cluster => cluster.id);
      program.clusterNames = clusters.map(cluster => cluster.name);
    }
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
    const [{ settings }, [programs], [schools]] = await Promise.all([
      getAssessmentSettings(),
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
    // The program detail uses the same rules shown in admin and institution editors.
    const clusters = (settings?.clusters ?? []).filter(cluster => programMatchesCluster({ program_id: programs[0].id, program_name: programs[0].name }, cluster));
    programs[0].clusterIds = clusters.map(cluster => cluster.id);
    programs[0].clusterNames = clusters.map(cluster => cluster.name);
    res.json({ ...programs[0], schools });
  })
);
