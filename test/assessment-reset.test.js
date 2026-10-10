import test from "node:test";
import assert from "node:assert/strict";
import { resetAssessmentResults, assessmentResetTables } from "../src/services/assessment-reset.js";

function fixture({ backupFails = false, incomplete = false } = {}) {
  const queries = [];
  const snapshot = {
    assessments: [{ assessment_id: "one", user_id: "user" }, { assessment_id: "two", user_id: "user" }],
    assessment_responses: [{ assessment_id: "one", answer_data: { optionId: "a" } }],
    career_profiles: [{ profile_id: "profile", assessment_id: "one" }],
    recommended_programs: [{ profile_id: "profile" }]
  };
  let backup;
  const connection = {
    async query(sql) {
      queries.push(sql);
      if (sql.startsWith("SELECT * FROM")) return [snapshot[sql.split(" ").at(-1)]];
      if (sql.startsWith("SELECT COUNT")) return [[{ count: incomplete ? 1 : 0 }]];
      return [[]];
    },
    async execute(sql) {
      assert.ok(backup, "backup must be saved before deletion");
      queries.push(sql);
      return [{ affectedRows: 2 }];
    }
  };
  return { connection, queries, snapshot, saveBackup: async data => { if (backupFails) throw new Error("disk failure"); backup = data; }, getBackup: () => backup };
}

test("reset backs up all assessment tables before the single cascading delete", async () => {
  const f = fixture();
  const result = await resetAssessmentResults(f.connection, f.saveBackup);
  assert.equal(result.affectedUsers, 1);
  assert.deepEqual(f.getBackup().tables, f.snapshot);
  assert.deepEqual(Object.keys(result.cleared), assessmentResetTables);
  assert.deepEqual(f.queries.filter(sql => sql.startsWith("DELETE")), ["DELETE FROM assessments"]);
  assert.match(f.queries[1], /ACCESS EXCLUSIVE MODE/);
  assert.ok(!f.queries.some(sql => /users|schools|programs|feedback|saved|comparison/.test(sql.replace(/recommended_programs/g, ""))));
});

test("a missing or failed backup prevents all deletions", async () => {
  const f = fixture({ backupFails: true });
  await assert.rejects(resetAssessmentResults(f.connection, f.saveBackup), /disk failure/);
  await assert.rejects(resetAssessmentResults(f.connection), /backup is required/);
  assert.ok(!f.queries.some(sql => sql.startsWith("DELETE")));
});

test("incomplete cascade throws so the surrounding transaction rolls back", async () => {
  const f = fixture({ incomplete: true });
  await assert.rejects(resetAssessmentResults(f.connection, f.saveBackup), /rolling back/);
});
