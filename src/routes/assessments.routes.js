import crypto from "node:crypto";
import { Router } from "express";
import { pool, withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert } from "../utils/http-error.js";
import {
  assessmentQuestions,
  calculateProgramMatch,
  scoreAssessment
} from "../services/recommendation.js";

export const assessmentsRouter = Router();

assessmentsRouter.get("/questions", (_req, res) => {
  res.json({
    data: assessmentQuestions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map(({ id, label }) => ({ id, label }))
    }))
  });
});

assessmentsRouter.use(requireAuth);

assessmentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    assert(Array.isArray(req.body.answers), 400, "answers must be an array.");
    const result = scoreAssessment(req.body.answers);
    const assessmentId = crypto.randomUUID();
    const profileId = crypto.randomUUID();

    const [programs] = await pool.query(
      `SELECT program_id, program_name, category, degree_level, interest_tags
       FROM programs ORDER BY program_name`
    );
    const recommendations = programs
      .map((program) => ({
        ...program,
        matchScore: calculateProgramMatch(program.interest_tags ?? [], result.rankedTags)
      }))
      .sort((left, right) => right.matchScore - left.matchScore)
      .slice(0, 6);

    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO assessments (assessment_id, user_id, completed_at, percent_complete)
         VALUES (?, ?, CURRENT_TIMESTAMP, 100)`,
        [assessmentId, req.user.user_id]
      );
      for (const answer of result.answers) {
        await connection.execute(
          `INSERT INTO assessment_responses (response_id, assessment_id, question_id, answer_data)
           VALUES (?, ?, ?, ?)`,
          [crypto.randomUUID(), assessmentId, answer.questionId, JSON.stringify({ optionId: answer.optionId })]
        );
      }
      await connection.execute(
        `INSERT INTO career_profiles
          (profile_id, user_id, assessment_id, primary_direction, ranked_tags, score_breakdown)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          profileId,
          req.user.user_id,
          assessmentId,
          result.primaryDirection,
          JSON.stringify(result.rankedTags),
          JSON.stringify(result.scores)
        ]
      );
      for (let index = 0; index < recommendations.length; index += 1) {
        const recommendation = recommendations[index];
        await connection.execute(
          `INSERT INTO recommended_programs
            (recommendation_id, profile_id, program_id, rank_position, match_score)
           VALUES (?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), profileId, recommendation.program_id, index + 1, recommendation.matchScore]
        );
      }
    });

    const [recommendedSchools] = await pool.execute(
      `SELECT s.school_id AS id, s.school_name AS name, s.city_district AS city,
        s.school_type AS "schoolType", s.tuition_range AS "tuitionRange",
        s.latitude, s.longitude, MAX(rp.match_score) AS "matchScore",
        STRING_AGG(DISTINCT p.program_name, '|||') AS "matchedPrograms"
       FROM recommended_programs rp
       JOIN school_programs sp ON sp.program_id = rp.program_id
       JOIN schools s ON s.school_id = sp.school_id
       JOIN programs p ON p.program_id = rp.program_id
       WHERE rp.profile_id = ?
       GROUP BY s.school_id ORDER BY matchScore DESC, s.google_rating DESC LIMIT 6`,
      [profileId]
    );

    res.status(201).json({
      assessmentId,
      profile: {
        id: profileId,
        primaryDirection: result.primaryDirection,
        rankedTags: result.rankedTags,
        scores: result.scores
      },
      recommendedPrograms: recommendations.map((program) => ({
        id: program.program_id,
        name: program.program_name,
        category: program.category,
        degreeLevel: program.degree_level,
        matchScore: program.matchScore
      })),
      recommendedSchools: recommendedSchools.map(({ matchedPrograms, ...school }) => ({
        ...school,
        matchedPrograms: matchedPrograms.split("|||")
      }))
    });
  })
);

assessmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT a.assessment_id AS id, a.completed_at AS "completedAt",
        a.percent_complete AS "percentComplete", cp.primary_direction AS "primaryDirection"
       FROM assessments a LEFT JOIN career_profiles cp ON cp.assessment_id = a.assessment_id
       WHERE a.user_id = ? ORDER BY a.created_at DESC`,
      [req.user.user_id]
    );
    res.json({ data: rows });
  })
);

assessmentsRouter.get(
  "/:id/results",
  asyncHandler(async (req, res) => {
    const [[profiles], [programs], [schools]] = await Promise.all([
      pool.execute(
        `SELECT cp.profile_id AS id, cp.primary_direction AS "primaryDirection",
          cp.ranked_tags AS "rankedTags", cp.score_breakdown AS scores, a.completed_at AS "completedAt"
         FROM career_profiles cp JOIN assessments a ON a.assessment_id = cp.assessment_id
         WHERE cp.assessment_id = ? AND cp.user_id = ?`,
        [req.params.id, req.user.user_id]
      ),
      pool.execute(
        `SELECT p.program_id AS id, p.program_name AS name, p.category,
          p.degree_level AS "degreeLevel", rp.rank_position AS "rankPosition", rp.match_score AS "matchScore"
         FROM recommended_programs rp JOIN programs p ON p.program_id = rp.program_id
         JOIN career_profiles cp ON cp.profile_id = rp.profile_id
         WHERE cp.assessment_id = ? AND cp.user_id = ? ORDER BY rp.rank_position`,
        [req.params.id, req.user.user_id]
      ),
      pool.execute(
        `SELECT s.school_id AS id, s.school_name AS name, s.city_district AS city,
          s.tuition_range AS "tuitionRange", MAX(rp.match_score) AS "matchScore"
         FROM recommended_programs rp
         JOIN career_profiles cp ON cp.profile_id = rp.profile_id
         JOIN school_programs sp ON sp.program_id = rp.program_id
         JOIN schools s ON s.school_id = sp.school_id
         WHERE cp.assessment_id = ? AND cp.user_id = ?
         GROUP BY s.school_id ORDER BY matchScore DESC, s.google_rating DESC LIMIT 6`,
        [req.params.id, req.user.user_id]
      )
    ]);
    assert(profiles[0], 404, "Assessment result not found.");
    res.json({ profile: profiles[0], recommendedPrograms: programs, recommendedSchools: schools });
  })
);
