import crypto from "node:crypto";
import { Router } from "express";
import { pool, withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert } from "../utils/http-error.js";

export const comparisonRouter = Router();
comparisonRouter.use(requireAuth);

async function findOrCreateComparison(connection, userId) {
  const [sets] = await connection.execute(
    "SELECT comparison_id FROM comparison_sets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  if (sets[0]) return sets[0].comparison_id;
  const comparisonId = crypto.randomUUID();
  await connection.execute("INSERT INTO comparison_sets (comparison_id, user_id) VALUES (?, ?)", [comparisonId, userId]);
  return comparisonId;
}

comparisonRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT s.school_id AS id, s.school_name AS name, s.city_district AS city,
        s.school_type AS "schoolType", s.tuition_range AS "tuitionRange", s.accreditation,
        s.scholarship_info AS "scholarshipInfo", s.google_rating AS "googleRating",
        cs.position_index AS "positionIndex",
        STRING_AGG(DISTINCT p.program_name, '|||' ORDER BY p.program_name) AS "programNames"
       FROM comparison_sets c
       JOIN comparison_schools cs ON cs.comparison_id = c.comparison_id
       JOIN schools s ON s.school_id = cs.school_id
       LEFT JOIN school_programs sp ON sp.school_id = s.school_id
       LEFT JOIN programs p ON p.program_id = sp.program_id
       WHERE c.user_id = ? AND c.comparison_id = (
         SELECT comparison_id FROM comparison_sets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
       )
       GROUP BY s.school_id, cs.position_index ORDER BY cs.position_index`,
      [req.user.user_id, req.user.user_id]
    );

    let offerings = [];
    if (rows.length) {
      const schoolIds = rows.map((school) => school.id);
      const placeholders = schoolIds.map(() => "?").join(", ");
      [offerings] = await pool.execute(
        `SELECT sp.school_id AS "schoolId", p.program_id AS id, p.program_name AS name,
          p.description, p.category, p.degree_level AS "degreeLevel", p.requirements,
          p.career_paths AS "careerPaths", sp.tuition_per_semester AS "tuitionPerSemester",
          sp.is_top_program AS "isTopProgram"
         FROM school_programs sp
         JOIN programs p ON p.program_id = sp.program_id
         WHERE sp.school_id IN (${placeholders})
         ORDER BY p.program_name`,
        schoolIds
      );
    }

    const offeringsBySchool = new Map();
    for (const offering of offerings) {
      const current = offeringsBySchool.get(offering.schoolId) ?? [];
      const { schoolId: _schoolId, ...program } = offering;
      current.push(program);
      offeringsBySchool.set(offering.schoolId, current);
    }

    res.json({
      schools: rows.map(({ programNames, ...school }) => ({
        ...school,
        programs: programNames ? programNames.split("|||") : [],
        programOfferings: offeringsBySchool.get(school.id) ?? []
      })),
      maximum: 3
    });
  })
);

comparisonRouter.post(
  "/schools/:id",
  asyncHandler(async (req, res) => {
    await withTransaction(async (connection) => {
      const [schools] = await connection.execute("SELECT school_id FROM schools WHERE school_id = ?", [req.params.id]);
      assert(schools[0], 404, "School not found.");
      const comparisonId = await findOrCreateComparison(connection, req.user.user_id);
      const [current] = await connection.execute(
        "SELECT school_id, position_index FROM comparison_schools WHERE comparison_id = ? ORDER BY position_index FOR UPDATE",
        [comparisonId]
      );
      assert(!current.some((row) => row.school_id === req.params.id), 409, "School is already in the comparison.");
      assert(current.length < 3, 409, "A comparison can contain at most three schools.");
      const used = new Set(current.map((row) => row.position_index));
      const position = [1, 2, 3].find((candidate) => !used.has(candidate));
      await connection.execute(
        "INSERT INTO comparison_schools (comparison_school_id, comparison_id, school_id, position_index) VALUES (?, ?, ?, ?)",
        [crypto.randomUUID(), comparisonId, req.params.id, position]
      );
    });
    res.status(201).json({ message: "School added to comparison." });
  })
);

comparisonRouter.delete(
  "/schools/:id",
  asyncHandler(async (req, res) => {
    await pool.execute(
      `DELETE FROM comparison_schools cs USING comparison_sets c
       WHERE c.comparison_id = cs.comparison_id AND c.user_id = ? AND cs.school_id = ?`,
      [req.user.user_id, req.params.id]
    );
    res.status(204).end();
  })
);

comparisonRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    await pool.execute("DELETE FROM comparison_sets WHERE user_id = ?", [req.user.user_id]);
    res.status(204).end();
  })
);
