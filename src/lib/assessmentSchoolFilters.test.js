import test from "node:test";
import assert from "node:assert/strict";
import { filterAssessmentSchools } from "./assessmentSchoolFilters.js";

const schools = [
  { id: "a", name: "A School", schoolType: "Private", minimumTuition: "50000", distanceKm: 8 },
  { id: "b", name: "B School", schoolType: "Public", minimumTuition: "12000", distanceKm: 3 },
  { id: "c", name: "C School", schoolType: "Private", minimumTuition: null, distanceKm: null }
];

test("tuition and distance caps include only schools with known values inside the cap", () => {
  assert.deepEqual(filterAssessmentSchools(schools, { maxTuition: "30000", maxDistance: "5" }).map((school) => school.id), ["b"]);
});

test("school type and tuition sorting work together, with missing fees last", () => {
  assert.deepEqual(filterAssessmentSchools(schools, { schoolType: "Private", sort: "tuition_low" }).map((school) => school.id), ["a", "c"]);
});

test("the original order is unchanged until the user chooses a sort", () => {
  assert.deepEqual(filterAssessmentSchools(schools, {}).map((school) => school.id), ["a", "b", "c"]);
  assert.deepEqual(filterAssessmentSchools(schools, { sort: "nearest" }).map((school) => school.id), ["b", "a", "c"]);
});
