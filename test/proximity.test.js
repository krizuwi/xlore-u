import test from "node:test";
import assert from "node:assert/strict";
import { orderSchoolsByAddress, resolveAddressArea } from "../src/services/proximity.js";

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
