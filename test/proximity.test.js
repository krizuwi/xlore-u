import test from "node:test";
import assert from "node:assert/strict";
import { addSchoolDistances, orderSchoolsByAddress, resolveAddressArea } from "../src/services/proximity.js";

test("a saved address resolves to its Metro Manila area without an external geocoder", () => {
  assert.equal(resolveAddressArea("32nd Street, BGC, Taguig City")?.name, "Taguig");
  assert.equal(resolveAddressArea("Diliman, Quezon City")?.name, "Quezon City");
  assert.equal(resolveAddressArea("Metro Manila")?.name, undefined);
});

test("suggested schools are ordered by approximate distance from the saved address area", () => {
  const result = orderSchoolsByAddress([
    { id: "manila", name: "Manila School", latitude: 14.5995, longitude: 120.9842, matchScore: 95 },
    { id: "taguig", name: "Taguig School", latitude: 14.5176, longitude: 121.0509, matchScore: 70 }
  ], "BGC, Taguig City");

  assert.equal(result.locationBasis.area, "Taguig");
  assert.equal(result.schools[0].id, "taguig");
  assert.equal(result.schools[0].distanceKm, 0);
});

test("school relevance remains the fallback when the address area is unknown", () => {
  const result = orderSchoolsByAddress([
    { id: "one", name: "One", matchScore: 70 },
    { id: "two", name: "Two", matchScore: 90 }
  ], "Unknown location");

  assert.equal(result.locationBasis, null);
  assert.equal(result.schools[0].id, "two");
});

test("distance enrichment preserves comparison order and accepts numeric database strings", () => {
  const schools = [
    { id: "far", name: "Far", latitude: "14.5995", longitude: "120.9842" },
    { id: "near", name: "Near", latitude: 14.5176, longitude: 121.0509 }
  ];
  const result = addSchoolDistances(schools, "Taguig");
  assert.deepEqual(result.schools.map(s => s.id), ["far", "near"]);
  assert.ok(result.schools[0].distanceKm > 0);
  assert.equal(result.schools[1].distanceKm, 0);
  assert.equal(result.schools[0].distanceArea, "Taguig");
  assert.equal(schools[0].distanceKm, undefined);
});

test("missing or invalid school coordinates never become an invented zero-coordinate distance", () => {
  for (const [latitude, longitude] of [[null, null], ["", " "], [undefined, 121], [91, 121], [14, 181], ["bad", 121], [false, 121]]) {
    assert.equal(addSchoolDistances([{ latitude, longitude }], "Manila").schools[0].distanceKm, null);
  }
  assert.ok(addSchoolDistances([{ latitude: 0, longitude: 0 }], "Manila").schools[0].distanceKm > 0);
});

test("unknown address returns unavailable distances without losing schools", () => {
  const result = addSchoolDistances([{ id: "one", latitude: 14, longitude: 121 }], "Unknown location");
  assert.equal(result.locationBasis, null);
  assert.equal(result.schools[0].distanceKm, null);
  assert.equal(result.schools[0].distanceArea, null);
});
