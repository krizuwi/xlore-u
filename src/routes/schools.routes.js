import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert } from "../utils/http-error.js";

export const schoolsRouter = Router();

const sortSql = {
  name: "s.school_name ASC",
  rating: "s.google_rating DESC, s.school_name ASC",
  tuition_low: "minimum_tuition ASC, s.school_name ASC",
  tuition_high: "minimum_tuition DESC, s.school_name ASC"
};

schoolsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 12, 1), 50);
    const offset = (page - 1) * limit;
    const conditions = ["a.is_active_available = TRUE"];
    const values = [];

    if (req.query.search) {
      const search = `%${String(req.query.search).trim()}%`;
      conditions.push(`(s.school_name ILIKE ? OR s.city_district ILIKE ? OR EXISTS (
        SELECT 1 FROM school_programs spx JOIN programs px ON px.program_id = spx.program_id
        WHERE spx.school_id = s.school_id AND (px.program_name ILIKE ? OR px.category ILIKE ?)
      ))`);
      values.push(search, search, search, search);
    }
    if (req.query.city) {
      conditions.push("s.city_district = ?");
      values.push(String(req.query.city));
    }
    if (req.query.schoolType) {
      conditions.push("s.school_type = ?");
      values.push(String(req.query.schoolType));
    }
    if (req.query.strand) {
      conditions.push(`EXISTS (
        SELECT 1 FROM school_strands ss JOIN strands st ON st.strand_id = ss.strand_id
        WHERE ss.school_id = s.school_id AND st.strand_code = ?
      )`);
      values.push(String(req.query.strand).toUpperCase());
    }
    if (req.query.specialization) {
      const specialization = `%${String(req.query.specialization).trim()}%`;
      conditions.push(`EXISTS (
        SELECT 1 FROM school_programs spx JOIN programs px ON px.program_id = spx.program_id
        WHERE spx.school_id = s.school_id
          AND (px.category ILIKE ? OR px.program_name ILIKE ? OR px.interest_tags @> jsonb_build_array(?))
      )`);
      values.push(specialization, specialization, String(req.query.specialization).trim().toLowerCase());
    }
    if (req.query.minTuition) {
      conditions.push("EXISTS (SELECT 1 FROM school_programs spx WHERE spx.school_id = s.school_id AND spx.tuition_per_semester >= ?)");
      values.push(Number(req.query.minTuition));
    }
    if (req.query.maxTuition) {
      conditions.push("EXISTS (SELECT 1 FROM school_programs spx WHERE spx.school_id = s.school_id AND spx.tuition_per_semester <= ?)");
      values.push(Number(req.query.maxTuition));
    }

    const where = conditions.join(" AND ");
    const order = sortSql[req.query.sort] ?? sortSql.name;
    const [countRows] = await pool.execute(
      `SELECT COUNT(DISTINCT s.school_id) AS total
       FROM schools s JOIN available_schools a ON a.school_id = s.school_id WHERE ${where}`,
      values
    );
    const [rows] = await pool.execute(
      `SELECT s.school_id AS id, s.school_name AS name, s.address, s.city_district AS city,
        s.school_type AS "schoolType", s.tuition_range AS "tuitionRange", s.accreditation,
        s.scholarship_info AS "scholarshipInfo", s.latitude, s.longitude,
        s.google_rating AS "googleRating", s.official_website_url AS "officialWebsiteUrl",
        s.description, s.catalog_last_checked_at AS "catalogLastCheckedAt",
        MIN(sp.tuition_per_semester) AS minimum_tuition,
        STRING_AGG(DISTINCT p.program_name, '|||' ORDER BY p.program_name) AS "programNames"
       FROM schools s
       JOIN available_schools a ON a.school_id = s.school_id
       LEFT JOIN school_programs sp ON sp.school_id = s.school_id
       LEFT JOIN programs p ON p.program_id = sp.program_id
       WHERE ${where}
       GROUP BY s.school_id
       ORDER BY ${order}
       LIMIT ${limit} OFFSET ${offset}`,
      values
    );

    res.json({
      data: rows.map(({ programNames, minimum_tuition: minimumTuition, ...school }) => ({
        ...school,
        minimumTuition,
        programs: programNames ? programNames.split("|||") : []
      })),
      pagination: { page, limit, total: countRows[0].total, pages: Math.ceil(countRows[0].total / limit) }
    });
  })
);

schoolsRouter.get(
  "/meta/filters",
  asyncHandler(async (_req, res) => {
    const [[cities], [types], [strands], [categories]] = await Promise.all([
      pool.query("SELECT DISTINCT city_district AS value FROM schools ORDER BY value"),
      pool.query("SELECT DISTINCT school_type AS value FROM schools ORDER BY value"),
      pool.query("SELECT strand_code AS code, strand_name AS name FROM strands ORDER BY code"),
      pool.query("SELECT DISTINCT category AS value FROM programs ORDER BY value")
    ]);
    res.json({
      cities: cities.map((row) => row.value),
      schoolTypes: types.map((row) => row.value),
      strands,
      specializations: categories.map((row) => row.value)
    });
  })
);

schoolsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const [[schools], [programs], [strands]] = await Promise.all([
      pool.execute(
        `SELECT school_id AS id, school_name AS name, address, city_district AS city,
          school_type AS "schoolType", tuition_range AS "tuitionRange", accreditation,
          scholarship_info AS "scholarshipInfo", latitude, longitude, google_rating AS "googleRating",
          official_website_url AS "officialWebsiteUrl", description,
          catalog_last_checked_at AS "catalogLastCheckedAt",
          catalog_last_updated_at AS "catalogLastUpdatedAt"
         FROM schools WHERE school_id = ?`,
        [req.params.id]
      ),
      pool.execute(
        `SELECT p.program_id AS id, p.program_name AS name, p.description, p.category,
          p.degree_level AS "degreeLevel", p.requirements, p.career_paths AS "careerPaths",
          p.interest_tags AS "interestTags", sp.tuition_per_semester AS "tuitionPerSemester",
          sp.is_top_program AS "isTopProgram", sp.source_url AS "sourceUrl",
          sp.last_verified_at AS "lastVerifiedAt"
         FROM school_programs sp JOIN programs p ON p.program_id = sp.program_id
         WHERE sp.school_id = ? ORDER BY sp.is_top_program DESC, p.program_name`,
        [req.params.id]
      ),
      pool.execute(
        `SELECT st.strand_code AS code, st.strand_name AS name
         FROM school_strands ss JOIN strands st ON st.strand_id = ss.strand_id
         WHERE ss.school_id = ? ORDER BY st.strand_code`,
        [req.params.id]
      )
    ]);
    assert(schools[0], 404, "School not found.");
    res.json({ ...schools[0], programs, acceptedStrands: strands });
  })
);
