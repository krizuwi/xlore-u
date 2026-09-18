import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentQuestions,
  calculateProgramMatch,
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

test("program match scores reward high-ranked overlapping tags", () => {
  const closeMatch = calculateProgramMatch(["technology", "analytical"], ["technology", "analytical", "creative"]);
  const weakMatch = calculateProgramMatch(["social"], ["technology", "analytical", "creative"]);
  assert.ok(closeMatch > weakMatch);
  assert.ok(closeMatch <= 99);
});
