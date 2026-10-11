import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditRoutingBank, buildRoutingPlan, completeRouting, programBelongsToField, selectRoutedPrograms, matchRoutedSchools } from '../src/services/assessment-routing.js';
const config = JSON.parse(readFileSync(new URL('../database/assessment-macro-routing-v1.json', import.meta.url), 'utf8'));
const bank = config.questions.map(question => ({ ...question, options: question.options.map(option => ({ ...option, scores: { technology: 3 } })) }));
const answersFor = (choices = []) => bank.map((question, index) => ({ questionId: question.id, optionId: question.options[choices[index] ?? 0].id }));

test('all four macro-profiles use 15 equal votes regardless of obsolete technology weights', () => {
  ['A', 'B', 'C', 'D'].forEach((profile, index) => {
    const plan = buildRoutingPlan(answersFor(Array(20).fill(index)), bank);
    assert.equal(plan.primaryProfile, profile); assert.equal(plan.votes[profile], 15);
    assert.equal(Object.values(plan.votes).reduce((a, b) => a + b), 15); assert.equal(plan.followUpCount, 1);
  });
});
test('budget, distance, travel time, facilities and assistance do not cast career votes', () => {
  const a = buildRoutingPlan(answersFor(), bank);
  const choices = Array(15).fill(0).concat(Array(5).fill(3));
  const b = buildRoutingPlan(answersFor(choices), bank);
  assert.deepEqual(a.votes, b.votes); assert.notEqual(a.constraints[16].label, b.constraints[16].label);
});
test('ties require an explicit leading-profile signpost, then one unscored field choice', () => {
  const answers = answersFor([...Array(7).fill(0), ...Array(7).fill(1), 2]);
  const plan = buildRoutingPlan(answers, bank);
  assert.deepEqual(plan.leadingProfiles, ['A', 'B']); assert.equal(plan.primaryProfile, null); assert.equal(plan.followUpCount, 2);
  assert.throws(() => completeRouting(answers, bank, { profile: 'C', field: 'health' }), /leading macro-profiles/);
  const completed = completeRouting(answers, bank, { profile: 'B', field: 'design' });
  assert.equal(completed.routing.umbrellaCluster, 'Arts & Design'); assert.deepEqual(completed.routing.votes, plan.votes);
});
test('IDs preserve mapping when questions/options are reordered; wording changes require review', () => {
  const reordered = [...bank].reverse().map(question => ({ ...question, options: [...question.options].reverse() }));
  assert.deepEqual(buildRoutingPlan(answersFor(), reordered).votes, { A: 15, B: 0, C: 0, D: 0 });
  const changed = bank.map((q, index) => index ? q : { ...q, prompt: 'Edited question' });
  assert.equal(auditRoutingBank(changed).available, false); assert.equal(auditRoutingBank(changed).recognized, true);
  assert.throws(() => buildRoutingPlan(answersFor(), changed), /must be reviewed/);
});
test('missing, duplicate and forged answers and invalid follow-ups are rejected', () => {
  const answers = answersFor();
  assert.throws(() => buildRoutingPlan(answers.slice(1), bank), /every core question/);
  assert.throws(() => buildRoutingPlan([...answers.slice(1), answers[1]], bank), /every core question/);
  assert.throws(() => buildRoutingPlan(answers.map((a, i) => i ? a : { ...a, optionId: 'forged' }), bank), /invalid answer/);
  assert.throws(() => completeRouting(answers, bank), /targeted follow-up/);
  assert.throws(() => completeRouting(answers, bank, { profile: 'A', field: 'health' }), /valid field/);
});
test('actual limits are explicit, bounded, zero-safe and never inferred from importance or minutes', () => {
  const answers = answersFor(Array(15).fill(0).concat(Array(5).fill(3)));
  const selection = { profile: 'A', field: 'computing' };
  assert.deepEqual(completeRouting(answers, bank, selection).routing.limits, { maxTuition: null, maxDistance: null });
  assert.deepEqual(completeRouting(answers, bank, selection, { maxTuition: 0, maxDistance: '0' }).routing.limits, { maxTuition: 0, maxDistance: 0 });
  for (const invalid of [-1, 'abc', Infinity, true, {}, [], ' ']) assert.throws(() => completeRouting(answers, bank, selection, { maxTuition: invalid }), /non-negative number/);
});
test('field routing separates computing, engineering, maritime and teaching subjects', () => {
  assert.equal(programBelongsToField({ name: 'BS Information Technology' }, 'computing'), true);
  assert.equal(programBelongsToField({ name: 'BS Accounting Information System' }, 'computing'), false);
  assert.equal(programBelongsToField({ name: 'BS Civil Engineering' }, 'engineering'), true);
  assert.equal(programBelongsToField({ name: 'BS Marine Engineering' }, 'engineering'), false);
  assert.equal(programBelongsToField({ name: 'BS Marine Engineering' }, 'maritime'), true);
  assert.equal(programBelongsToField({ name: 'Bachelor of Secondary Education major in English' }, 'media'), false);
  assert.equal(programBelongsToField({ name: 'BS Electronics and Communication Engineering' }, 'media'), false);
});
test('routing retains all eligible field offerings but excludes postgraduate and archived programs', () => {
  const programs = Array.from({ length: 15 }, (_, index) => ({ program_id: String(index), program_name: `BS Information Technology major in Track ${index}`, degree_level: 'Bachelor' }));
  programs.push({ program_id: 'archived', program_name: 'BS Computer Science', degree_level: 'Bachelor', is_active: false });
  programs.push({ program_id: 'pg', program_name: 'Master in Computer Science', degree_level: 'Postgraduate' });
  const recommendations = selectRoutedPrograms(programs, { field: 'computing', umbrellaCluster: 'Technology & Computing' });
  assert.equal(recommendations.length, 15); assert.ok(recommendations.every(program => program.matchDetails.status === 'routed'));
});
const school = { id: 'school', name: 'Example', latitude: 14.55, longitude: 121.02,
  offerings: [{ program: 'BS Information Technology', tuition: 20000 }, { program: 'BS Computer Science', tuition: 80000 }] };
test('budget filters actual relevant offerings before aggregation and excludes unknown costs', () => {
  const routing = completeRouting(answersFor(), bank, { field: 'computing' }, { maxTuition: 30000 }).routing;
  const result = matchRoutedSchools([school, { ...school, id: 'unknown', offerings: [{ program: 'BS IT', tuition: null }] }], 'Makati', routing);
  assert.equal(result.schools.length, 1); assert.deepEqual(result.schools[0].matchedPrograms, ['BS Information Technology']);
  assert.equal(result.schools[0].minimumTuition, 20000); assert.equal(result.schools[0].matchScore, null);
  assert.equal(result.schoolMatchSummary.excludedSchools, 1);
});
test('distance limits exclude unknown coordinates and fail before completion for an unknown address', () => {
  const routing = completeRouting(answersFor(), bank, { field: 'computing' }, { maxDistance: 1000 }).routing;
  const result = matchRoutedSchools([school, { ...school, id: 'unknown', latitude: null }], 'Makati', routing);
  assert.equal(result.schools.length, 1);
  assert.throws(() => matchRoutedSchools([school], 'unrecognized place', routing), /recognizable Metro Manila/);
  assert.equal(matchRoutedSchools([school], 'unrecognized place', routing, { enforceLocation: false }).schools.length, 0);
});
test('no catalog match or no school within limits stays empty rather than ignoring constraints', () => {
  assert.deepEqual(selectRoutedPrograms([], { field: 'maritime' }), []);
  const routing = completeRouting(answersFor(), bank, { field: 'computing' }, { maxTuition: 1 }).routing;
  assert.equal(matchRoutedSchools([school], 'Makati', routing).schools.length, 0);
});
