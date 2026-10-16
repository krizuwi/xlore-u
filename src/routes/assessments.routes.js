import crypto from "node:crypto";
import { Router } from "express";
import { pool, withTransaction } from "../db/pool.js";
import { requireAuth } from "./middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assert } from "../utils/http-error.js";
import {
  auditScoringKey,
  explainProgramMatch,
  readScoreBreakdown,
  scoringUnavailableError,
  scoreAssessment
} from "../services/recommendation.js";
import { orderAssessmentSchools } from "../services/proximity.js";
import { assertFirstAssessment } from "../services/assessment-access.js";
import { getQuestionBank } from "../services/question-bank.js";
import { auditRoutingBank, buildRoutingPlan, completeRouting, matchRoutedSchools, routingVersion, selectRoutedPrograms } from "../services/assessment-routing.js";
import { assessmentDisplay } from '../services/assessment-settings-validation.js';

export const assessmentsRouter = Router();

assessmentsRouter.get("/questions", asyncHandler(async (_req, res) => {
  const bank = await getQuestionBank();
  const routing = auditRoutingBank(bank.data, bank.settings);
  res.json({
    version: bank.version,
    attemptPolicy: bank.settings?.policy.attempts ?? 'once',
    workflow: routing.available ? { version: routingVersion, method: "macro-profile-routing", coreVoteCount: routing.coreVoteCount, constraintCount: routing.constraintCount,
      ...(bank.settings ? { display: assessmentDisplay(bank.settings) } : {}) } : null,
    availability: { available: routing.recognized ? routing.available : auditScoringKey(bank.data).usable,
      message: routing.recognized ? routing.message : scoringUnavailableError().message },
    data: bank.data.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      ...(bank.settings ? { sectionTitle: bank.settings.sections.find(section => section.id === question.routing?.sectionId)?.title ?? '' } : {}),
      options: question.options.map(({ id, label }) => ({ id, label }))
    }))
  });
}));

assessmentsRouter.use(requireAuth);

// Preview is read-only: finishing the core does not consume the one-time attempt.
assessmentsRouter.post("/routing", asyncHandler(async (req, res) => {
  const bank = await getQuestionBank();
  assert(req.body.questionBankVersion === bank.version, 409, "The questionnaire changed. Refresh to use the current core questions.");
  const [previous] = await pool.execute("SELECT assessment_id FROM assessments WHERE user_id = ? LIMIT 1", [req.user.user_id]);
  assert(bank.settings?.policy.attempts === 'unlimited' || !previous[0], 409, "You have already completed your one-time assessment. Open your saved result.");
  res.json(buildRoutingPlan(req.body.answers, bank.data, bank.settings));
}));

assessmentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    assert(Array.isArray(req.body.answers), 400, "answers must be an array.");
    const bank = await getQuestionBank();
    assert(bank.data.length > 0, 503, "The assessment is unavailable right now.");
    assert(!req.body.questionBankVersion || req.body.questionBankVersion === bank.version,
      409, "The assessment questions changed. Refresh this page to start with the current questions.");
    const coreAudit = auditRoutingBank(bank.data, bank.settings);
    if (coreAudit.recognized) {
      assert(coreAudit.available, 503, coreAudit.message);
      assert(req.body.workflowVersion === routingVersion, 400, "Complete the targeted follow-up before submitting your assessment.");
    }
    assert(!req.body.workflowVersion || req.body.workflowVersion === routingVersion, 400, "Unsupported assessment workflow version.");
    const routed = req.body.workflowVersion === routingVersion
      ? completeRouting(req.body.answers, bank.data, req.body.routingSelection, req.body.schoolLimits, bank.settings) : null;
    if (routed) {
      assert(req.body.questionBankVersion === bank.version, 409, "The questionnaire changed. Refresh to use the current questions.");
      // Validate location BEFORE saving anything; failure must not consume an attempt.
      matchRoutedSchools([], req.user, routed.routing);
    }
    const result = routed ? { primaryDirection: routed.routing.umbrellaCluster, rankedTags: [], scores: routed.plan.votes,
      answers: routed.plan.answers, metrics: { algorithmVersion: routingVersion, routing: routed.routing,
        interpretation: routed.plan.interpretation } } : scoreAssessment(req.body.answers, bank.data);
    const assessmentId = crypto.randomUUID();
    const profileId = crypto.randomUUID();

    const [programs] = await pool.query(
      `SELECT program_id, program_name, category, degree_level, interest_tags
       FROM programs p WHERE p.is_active = TRUE
         AND p.degree_level IN ('Bachelor', 'Associate', 'Diploma', 'Certificate', 'Postgraduate')
         AND (p.degree_level <> 'Postgraduate' OR ?)
         AND EXISTS (SELECT 1 FROM school_programs sp JOIN available_schools a ON a.school_id = sp.school_id
           WHERE sp.program_id = p.program_id AND a.is_active_available = TRUE)
       ORDER BY program_name`,
      [Boolean(bank.settings?.matching.degreeLevels.includes('Postgraduate'))]
    );
    const recommendations = routed ? selectRoutedPrograms(programs, routed.routing) : programs
      .map((program) => ({
        ...program,
        matchDetails: explainProgramMatch(program.interest_tags ?? [], result.metrics.normalizedScores)
      }))
      .filter(program => program.matchDetails.status === "scored" && program.matchDetails.alignment > 0)
      .map(program => ({ ...program, matchScore: program.matchDetails.matchScore }))
      .sort((left, right) => right.matchDetails.alignment - left.matchDetails.alignment
        || left.program_name.localeCompare(right.program_name) || left.program_id.localeCompare(right.program_id))
      .slice(0, 6);

    const metrics = { ...result.metrics, questionBankVersion: bank.version,
      programMatches: Object.fromEntries(recommendations.map(program => [program.program_id, program.matchDetails])) };

    await withTransaction(async (connection) => {
      await connection.query("LOCK TABLE assessment_questions IN SHARE MODE");
      await connection.query('LOCK TABLE assessment_settings IN SHARE MODE');
      const currentBank = await getQuestionBank({ connection });
      assert(currentBank.version === bank.version, 409, "The assessment questions changed. Refresh this page to start with the current questions.");
      await assertFirstAssessment(connection, req.user.user_id, bank.settings?.policy.attempts);
      await connection.execute(
        `INSERT INTO assessments (assessment_id, user_id, completed_at, percent_complete)
         VALUES (?, ?, CURRENT_TIMESTAMP, 100)`,
        [assessmentId, req.user.user_id]
      );
      for (const answer of result.answers) {
        const questionSnapshot = bank.data.find(question => question.id === answer.questionId);
        const optionSnapshot = questionSnapshot.options.find(option => option.id === answer.optionId);
        await connection.execute(
          `INSERT INTO assessment_responses (response_id, assessment_id, question_id, answer_data)
           VALUES (?, ?, ?, ?)`,
          [crypto.randomUUID(), assessmentId, answer.questionId, JSON.stringify({ optionId: answer.optionId,
            ...(routed ? { macroVote: answer.macroVote, role: answer.role, routing: questionSnapshot.routing, workflowVersion: routingVersion } : {}),
            prompt: questionSnapshot.prompt,
            option: routed ? { id: optionSnapshot.id, label: optionSnapshot.label, macro: optionSnapshot.macro, prioritize: optionSnapshot.prioritize } : optionSnapshot })]
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
          JSON.stringify({ rawScores: result.scores, metrics })
        ]
      );
      if (routed && recommendations.length) {
        await connection.query(`INSERT INTO recommended_programs
          (recommendation_id, profile_id, program_id, rank_position, match_score)
          SELECT gen_random_uuid(), $1::uuid, item.program_id, item.rank_position, 0
          FROM UNNEST($2::uuid[], $3::integer[]) AS item(program_id, rank_position)`,
        [profileId, recommendations.map(program => program.program_id), recommendations.map((_program, index) => index + 1)]);
      }
      for (let index = 0; !routed && index < recommendations.length; index += 1) {
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
        s.latitude, s.longitude, s.google_rating AS "googleRating", s.logo_url AS "logoUrl",
        s.logo_credit AS "logoCredit", MAX(rp.match_score) AS "matchScore",
        MIN(sp.tuition_per_semester) AS "minimumTuition",
        STRING_AGG(DISTINCT p.program_name, '|||') AS "matchedPrograms",
        JSONB_AGG(jsonb_build_object('program', p.program_name, 'tuition', sp.tuition_per_semester)) AS offerings
       FROM recommended_programs rp
       JOIN school_programs sp ON sp.program_id = rp.program_id
       JOIN schools s ON s.school_id = sp.school_id
       JOIN programs p ON p.program_id = rp.program_id
       WHERE rp.profile_id = ? AND p.is_active = TRUE AND EXISTS (
         SELECT 1 FROM available_schools a WHERE a.school_id = s.school_id AND a.is_active_available = TRUE)
       GROUP BY s.school_id ORDER BY "matchScore" DESC, s.google_rating DESC`,
      [profileId]
    );
    const proximity = routed ? matchRoutedSchools(recommendedSchools, req.user, routed.routing) : orderAssessmentSchools(
      recommendedSchools.map(({ matchedPrograms, ...school }) => ({
        ...school,
        matchedPrograms: matchedPrograms ? matchedPrograms.split("|||") : []
      })),
      req.user,
      Number.POSITIVE_INFINITY
    );

    res.status(201).json({
      assessmentId,
      profile: {
        id: profileId,
        primaryDirection: result.primaryDirection,
        rankedTags: result.rankedTags,
        scores: result.scores,
        metrics
      },
      recommendedPrograms: recommendations.map((program) => ({
        id: program.program_id,
        name: program.program_name,
        category: program.category,
        degreeLevel: program.degree_level,
        matchScore: routed ? null : program.matchScore,
        matchDetails: program.matchDetails
      })),
      recommendedSchools: proximity.schools,
      locationBasis: proximity.locationBasis,
      schoolMatchSummary: proximity.schoolMatchSummary ?? null
    });
  })
);

assessmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [[rows], [schoolRows]] = await Promise.all([
      pool.execute(
        `SELECT a.assessment_id AS id, a.completed_at AS "completedAt",
          a.percent_complete AS "percentComplete", cp.primary_direction AS "primaryDirection"
         FROM assessments a
         LEFT JOIN career_profiles cp ON cp.assessment_id = a.assessment_id
         WHERE a.user_id = ? ORDER BY a.created_at DESC`,
        [req.user.user_id]
      ),
      pool.execute(
        `SELECT cp.assessment_id AS "assessmentId", s.school_id AS id, s.school_name AS name,
          s.latitude, s.longitude, s.google_rating AS "googleRating",
          cp.score_breakdown AS "scoreBreakdown", MIN(sp.tuition_per_semester) AS "minimumTuition",
          JSONB_AGG(jsonb_build_object('program', p.program_name, 'tuition', sp.tuition_per_semester)) AS offerings,
          MAX(rp.match_score) AS "matchScore"
         FROM career_profiles cp
         JOIN recommended_programs rp ON rp.profile_id = cp.profile_id
         JOIN school_programs sp ON sp.program_id = rp.program_id
         JOIN schools s ON s.school_id = sp.school_id
         JOIN programs p ON p.program_id = rp.program_id
         WHERE cp.user_id = ? AND p.is_active = TRUE AND EXISTS (
           SELECT 1 FROM available_schools a WHERE a.school_id = s.school_id AND a.is_active_available = TRUE)
         GROUP BY cp.assessment_id, cp.score_breakdown, s.school_id`,
        [req.user.user_id]
      )
    ]);
    const schoolsByAssessment = new Map();
    for (const school of schoolRows) {
      const current = schoolsByAssessment.get(school.assessmentId) ?? [];
      current.push(school);
      schoolsByAssessment.set(school.assessmentId, current);
    }
    res.json({
      data: rows.map((assessment) => {
        const candidates = schoolsByAssessment.get(assessment.id) ?? [];
        const savedRouting = readScoreBreakdown(candidates[0]?.scoreBreakdown).metrics?.routing;
        const nearest = (savedRouting ? matchRoutedSchools(candidates, req.user, savedRouting, { enforceLocation: false }) : orderAssessmentSchools(
          candidates,
          req.user,
          1
        )).schools[0];
        return {
        ...assessment,
          recommendedSchool: nearest ? {
            id: nearest.id,
            name: nearest.name,
            distanceKm: nearest.distanceKm,
            distanceArea: nearest.distanceArea
          } : null
        };
      })
    });
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
         WHERE cp.assessment_id = ? AND cp.user_id = ? AND p.is_active = TRUE ORDER BY rp.rank_position`,
        [req.params.id, req.user.user_id]
      ),
      pool.execute(
        `SELECT s.school_id AS id, s.school_name AS name, s.city_district AS city,
          s.school_type AS "schoolType", s.tuition_range AS "tuitionRange",
          s.google_rating AS "googleRating", s.latitude, s.longitude, s.logo_url AS "logoUrl", s.logo_credit AS "logoCredit",
          MIN(sp.tuition_per_semester) AS "minimumTuition",
          MAX(rp.match_score) AS "matchScore",
          STRING_AGG(DISTINCT p.program_name, '|||') AS "matchedPrograms",
          JSONB_AGG(jsonb_build_object('program', p.program_name, 'tuition', sp.tuition_per_semester)) AS offerings
         FROM recommended_programs rp
         JOIN career_profiles cp ON cp.profile_id = rp.profile_id
         JOIN school_programs sp ON sp.program_id = rp.program_id
         JOIN schools s ON s.school_id = sp.school_id
         JOIN programs p ON p.program_id = rp.program_id
         WHERE cp.assessment_id = ? AND cp.user_id = ? AND p.is_active = TRUE AND EXISTS (
           SELECT 1 FROM available_schools a WHERE a.school_id = s.school_id AND a.is_active_available = TRUE)
         GROUP BY s.school_id ORDER BY "matchScore" DESC, s.google_rating DESC`,
        [req.params.id, req.user.user_id]
      )
    ]);
    assert(profiles[0], 404, "Assessment result not found.");
    const breakdown = readScoreBreakdown(profiles[0].scores);
    const savedRouting = breakdown.metrics?.routing;
    const proximity = savedRouting ? matchRoutedSchools(schools, req.user, savedRouting, { enforceLocation: false }) : orderAssessmentSchools(
      schools.map(({ matchedPrograms, ...school }) => ({
        ...school,
        matchedPrograms: matchedPrograms ? matchedPrograms.split("|||") : []
      })),
      req.user,
      Number.POSITIVE_INFINITY
    );
    res.json({
      profile: { ...profiles[0], ...breakdown },
      recommendedPrograms: programs.map(program => ({ ...program, matchScore: savedRouting ? null : program.matchScore,
        matchDetails: breakdown.metrics?.programMatches?.[program.id] ?? null })),
      recommendedSchools: proximity.schools,
      locationBasis: proximity.locationBasis,
      schoolMatchSummary: proximity.schoolMatchSummary ?? null
    });
  })
);
