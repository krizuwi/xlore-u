import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentProgramFilterOptions, filterAssessmentPrograms } from './assessmentProgramFilters.js';

const programs = [
  { id: 'it', name: 'BS Information Technology', category: 'Computing', degreeLevel: 'Bachelor' },
  { id: 'cs', name: 'Bachelor of Science in Computer Science', category: 'Computing', degreeLevel: 'Bachelor' },
  { id: 'diploma', name: 'Diploma in Information Technology', category: 'Computing', degreeLevel: 'Diploma' },
  { id: 'animation', name: 'Bachelor of Arts in Animation', category: 'Design', degreeLevel: 'Bachelor' },
  { id: 'missing', name: 'Literature' }
];
const ids = filters => filterAssessmentPrograms(programs, filters).map(program => program.id);

test('program filters preserve saved ranking, objects and the input array', () => {
  assert.deepEqual(ids({}), ['it', 'cs', 'diploma', 'animation', 'missing']);
  assert.equal(filterAssessmentPrograms(programs, {})[0], programs[0]);
  const before = structuredClone(programs);
  assert.deepEqual(ids({ sort: 'name' }), ['animation', 'cs', 'it', 'diploma', 'missing']);
  assert.deepEqual(programs, before);
});
test('program search supports abbreviations, partial keywords and multiple terms in any order', () => {
  for (const search of ['BSIT', 'bs it', 'information technology', 'IT']) assert.deepEqual(ids({ search }), ['it', 'diploma']);
  assert.deepEqual(ids({ search: 'BSCS' }), ['cs']);
  assert.deepEqual(ids({ search: 'animation bachelor' }), ['animation']);
  assert.deepEqual(ids({ search: 'comp sci' }), ['cs']);
  assert.deepEqual(ids({ search: '!!!' }), []);
});
test('category and degree filters combine with search and clear without broadening recommendations', () => {
  assert.deepEqual(ids({ search: 'IT', category: 'Computing', degreeLevel: 'Diploma' }), ['diploma']);
  assert.deepEqual(ids({ category: 'Design', degreeLevel: 'Diploma' }), []);
  assert.deepEqual(ids({ search: 'nursing' }), []);
  assert.deepEqual(ids({ category: 'Computing', degreeLevel: 'Bachelor' }), ['it', 'cs']);
});
test('filter choices are sorted, deduplicated and come only from available recommendations', () => {
  assert.deepEqual(assessmentProgramFilterOptions(programs), { categories: ['Computing', 'Design'], degreeLevels: ['Bachelor', 'Diploma'] });
  assert.deepEqual(assessmentProgramFilterOptions([]), { categories: [], degreeLevels: [] });
  assert.deepEqual(filterAssessmentPrograms([], { search: 'IT' }), []);
});
