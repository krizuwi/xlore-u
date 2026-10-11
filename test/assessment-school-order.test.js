import test from 'node:test';
import assert from 'node:assert/strict';
import { orderAssessmentSchools } from '../src/services/proximity.js';
test('academic interest fit outranks distance and public star ratings', () => {
  const result = orderAssessmentSchools([
    { id: 'near', name: 'Near', matchScore: 20, latitude: 14.5547, longitude: 121.0244, googleRating: 5 },
    { id: 'fit', name: 'Fit', matchScore: 90, latitude: 14.676, longitude: 121.0437, googleRating: 1 }
  ], 'Makati');
  assert.deepEqual(result.schools.map(school => school.id), ['fit', 'near']);
});
test('equal fit uses known distance, then deterministic name, not a Google rating', () => {
  const result = orderAssessmentSchools([
    { id: 'b', name: 'B', matchScore: 80, googleRating: 5 },
    { id: 'a', name: 'A', matchScore: 80, googleRating: 1 },
    { id: 'known', name: 'Z', matchScore: 80, latitude: 14.5547, longitude: 121.0244 }
  ], 'Makati');
  assert.deepEqual(result.schools.map(school => school.id), ['known', 'a', 'b']);
});
