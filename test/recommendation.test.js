import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentQuestions,
  calculateProgramMatch,
  auditScoringKey,
  explainProgramMatch,
  readScoreBreakdown,
  scoreAssessment
} from "../src/services/recommendation.js";

test("a technology-focused response produces a technology direction", () => {
  const preferred = {
    interests: "technology",
    strength: "logic",
    environment: "lab",
    subject: "math",
    goal: "innovation"
  };
  const result = scoreAssessment(
    assessmentQuestions.map((question) => ({
      questionId: question.id,
      optionId: preferred[question.id]
    }))
  );
  assert.equal(result.primaryDirection, "Technology and Computing");
  assert.equal(result.rankedTags[0], "technology");
});

test("every question must have a valid response", () => {
  assert.throws(() => scoreAssessment([]), /valid answer is required/);
});

test("program match scores use normalized magnitudes, not tag rank or a 55-point floor", () => {
  const profile = { technology: 1, analytical: 0.8, social: 0 };
  const closeMatch = calculateProgramMatch(["technology", "analytical"], profile);
  const weakMatch = calculateProgramMatch(["social"], profile);
  assert.ok(closeMatch > weakMatch);
  assert.equal(closeMatch, 90);
  assert.equal(weakMatch, 0);
});

const question = (id, options) => ({ id, options: options.map((scores, index) => ({ id: String(index), scores })) });
const answer = (id, index = 0) => ({ questionId: id, optionId: String(index) });

test("an all-constant key cannot consume the student's one-time assessment", () => {
  const questions = Array.from({ length: 20 }, (_, index) => question(String(index), [{ technology: 3 }, { technology: 3 }]));
  assert.equal(auditScoringKey(questions).usable, false);
  assert.throws(() => scoreAssessment(questions.map(item => answer(item.id)), questions), error => error.status === 503);
});

test("normalization removes unequal exposure and constant baseline points", () => {
  const questions = [question('a', [{ technology: 2 }, { technology: 4 }]), question('b', [{ creative: 0 }, { creative: 2 }]),
    question('c', [{ technology: 0 }, { technology: 4 }])];
  const result = scoreAssessment([answer('a', 1), answer('b', 1), answer('c', 1)], questions);
  assert.deepEqual(result.metrics.normalizedScores, { technology: 1, creative: 1 });
  assert.equal(result.primaryDirection, 'Mixed interests');
  assert.equal(result.scores.technology, 8);
  assert.equal(result.scores.creative, 2);
});

test("missing or unknown program dimensions are not treated as measured interests", () => {
  assert.equal(explainProgramMatch(['health'], { technology: 1 }).status, 'unmeasured');
  assert.equal(explainProgramMatch(['bogus'], { technology: 1 }).status, 'unmapped');
  assert.equal(calculateProgramMatch([], { technology: 1 }), 0);
  assert.equal(calculateProgramMatch(['technology', 'technology'], { technology: 1 }), 100);
});

test("invalid weights and duplicate or foreign answers are rejected", () => {
  for (const scores of [{ bogus: 3 }, { technology: -1 }, { technology: 1.5 }, { technology: 6 }]) {
    assert.equal(auditScoringKey([question('a', [scores, {}])]).usable, false);
  }
  const questions = [question('a', [{ technology: 3 }, { business: 3 }]), question('b', [{ technology: 3 }, { business: 3 }])];
  assert.throws(() => scoreAssessment([answer('a'), answer('a')], questions), error => error.status === 400);
  assert.throws(() => scoreAssessment([answer('a'), answer('foreign')], questions), error => error.status === 400);
});

test("old profiles remain readable and new profiles retain their scoring snapshot", () => {
  assert.deepEqual(readScoreBreakdown('{"technology":60}'), { scores: { technology: 60 }, metrics: null });
  const stored = { rawScores: { technology: 4 }, metrics: { algorithmVersion: 'v2', normalizedScores: { technology: 1 } } };
  assert.deepEqual(readScoreBreakdown(stored), { scores: stored.rawScores, metrics: stored.metrics });
});
