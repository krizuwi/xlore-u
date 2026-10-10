import test from "node:test";
import assert from "node:assert/strict";
import { formatComparisonDistance } from "./comparison-distance.js";

const basis = { area: "Taguig", approximate: true };
test("comparison distance uses kilometres with one decimal and preserves zero", () => {
  assert.equal(formatComparisonDistance(8.2, basis), "≈ 8.2 km");
  assert.equal(formatComparisonDistance("3", basis), "≈ 3.0 km");
  assert.equal(formatComparisonDistance(0, basis), "≈ 0.0 km");
});
test("unknown comparison locations are never displayed as zero kilometres", () => {
  assert.equal(formatComparisonDistance(null, null), "Address needed");
  assert.equal(formatComparisonDistance(2, {}), "Address needed");
  for (const value of [null, undefined, "", " ", "bad", NaN, Infinity, -1, false]) {
    assert.equal(formatComparisonDistance(value, basis), "Distance unavailable");
  }
});
