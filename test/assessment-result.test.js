import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectAssessmentResult } from "../src/lib/assessment-result.js";

test("dashboard selects only the newest completed result, independent of API order", () => {
  const recent = { id: "recent", completedAt: "2026-10-10T10:00:00Z" };
  const older = { id: "older", completedAt: "2026-10-09T10:00:00Z" };
  const original = [older, recent, { id: "draft", completedAt: null }];
  assert.equal(selectAssessmentResult(original), recent);
  assert.equal(selectAssessmentResult([...original].reverse()), recent);
  assert.equal(original[0], older);
});

test("reset or incomplete assessments show no result rather than a fabricated date", () => {
  assert.equal(selectAssessmentResult(), null);
  assert.equal(selectAssessmentResult([{ completedAt: null }, { completedAt: "invalid" }]), null);
});

test("one-time assessment UI uses singular result wording without latest or history claims", () => {
  const source = readFileSync(new URL("../src/pages/DashboardPage.jsx", import.meta.url), "utf8");
  assert.match(source, /Assessment result/);
  assert.match(source, /View assessment result/);
  assert.doesNotMatch(source, /Latest direction|latest assessment result|Assessment history|Your previous results|See past assessment results/i);
  assert.doesNotMatch(source, /assessments\.map/);
});
