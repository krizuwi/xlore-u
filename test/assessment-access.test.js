import test from "node:test";
import assert from "node:assert/strict";
import { assertFirstAssessment } from "../src/services/assessment-access.js";

test("first assessment check locks the account before checking history", async () => {
  const queries = [];
  const connection = {
    async execute(sql, values) {
      queries.push({ sql, values });
      return [[queries.length === 1 ? { user_id: "student" } : undefined].filter(Boolean)];
    }
  };
  await assertFirstAssessment(connection, "student");
  assert.match(queries[0].sql, /FOR UPDATE/);
  assert.match(queries[1].sql, /FROM assessments/);
  assert.deepEqual(queries[0].values, ["student"]);
});

test("an existing assessment blocks another submission", async () => {
  let queryNumber = 0;
  const connection = {
    async execute() {
      queryNumber += 1;
      return [[queryNumber === 1 ? { user_id: "student" } : { assessment_id: "prior" }]];
    }
  };
  await assert.rejects(() => assertFirstAssessment(connection, "student"), (error) => {
    assert.equal(error.status, 409);
    assert.match(error.message, /Retakes are unavailable/);
    return true;
  });
});
