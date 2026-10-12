import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentTemplate, validateAssessmentSettings, programMatchesCluster } from '../src/services/assessment-settings-validation.js';
import { buildRoutingPlan, completeRouting, matchRoutedSchools, selectRoutedPrograms } from '../src/services/assessment-routing.js';
import { templateRoutingBank } from './fixtures/live-routing-bank.js';
const settings = validateAssessmentSettings(assessmentTemplate);
const bank = templateRoutingBank();
const answers = (choices = []) => bank.map((q, i) => ({ questionId: q.id, optionId: q.options[choices[i] ?? 0].id }));
const programId = '00000000-0000-4000-8000-000000000021';
const schoolId = '00000000-0000-4000-8000-000000000031';

test('the supplied template includes four targeted banks, a universal question and every referenced cluster', () => {
  assert.equal(Object.keys(settings.routingQuestions).length, 4); assert.equal(settings.careerVehicle.options.length, 3);
  assert.equal(settings.clusters.length, 11); assert.equal(settings.policy.attempts, 'once');
  assert.equal(settings.policy.tieHandling, 'ask');
  for (const q of Object.values(settings.routingQuestions)) assert.ok(q.options.every(o => settings.clusters.some(c => c.id === o.clusterId)));
  assert.ok(settings.careerVehicle.options.every(o => o.preferredSchoolIds.length === 0));
});

test('all four profiles have a specialization and an unscored career-launch step; no step adds votes', () => {
  for (const [index, profile] of ['A', 'B', 'C', 'D'].entries()) {
    const response = bank.map(q => ({ questionId: q.id, optionId: (q.options.find(o => o.macro === profile) ?? q.options[index]).id }));
    const plan = buildRoutingPlan(response, bank, settings);
    assert.equal(plan.votes[profile], 15); assert.equal(plan.followUpCount, 2);
    for (const vehicle of settings.careerVehicle.options) {
      const route = completeRouting(response, bank, { profile, field: settings.routingQuestions[profile].options[0].id, vehicle: vehicle.id }, {}, settings);
      assert.deepEqual(route.routing.votes, plan.votes); assert.equal(route.routing.careerVehicle.id, vehicle.id);
    }
  }
});

test('ties require an explicit student choice by default; priority is only used when configured', () => {
  const macroChoices = [...Array(7).fill('A'), ...Array(7).fill('B'), 'C'];
  const response = bank.map((q, index) => ({ questionId: q.id, optionId: (q.options.find(o => o.macro === macroChoices[index]) ?? q.options[0]).id }));
  assert.equal(buildRoutingPlan(response, bank, settings).followUpCount, 3);
  assert.equal(buildRoutingPlan(response, bank, settings).primaryProfile, null);
  const changed = structuredClone(settings); changed.policy.tieHandling = 'priority'; changed.policy.tiePriority = ['B', 'A', 'C', 'D'];
  assert.equal(buildRoutingPlan(response, bank, changed).primaryProfile, 'B');
});

test('the latest complete answer list is counted once even after repeated previews or changed answers', () => {
  const original = answers(), changed = answers([1]);
  for (let i = 0; i < 3; i++) assert.equal(buildRoutingPlan(original, bank, settings).votes.A, 15);
  assert.deepEqual(buildRoutingPlan(changed, bank, settings).votes, { A: 14, B: 1, C: 0, D: 0 });
  assert.deepEqual(buildRoutingPlan(answers(Array(15).fill(0).concat(Array(5).fill(3))), bank, settings).votes, { A: 15, B: 0, C: 0, D: 0 });
});

test('missing or forged career-launch answers never produce a final result', () => {
  const selection = { profile: 'A', field: 'a-computing' };
  assert.throws(() => completeRouting(answers(), bank, selection, {}, settings), /career-launch/);
  assert.throws(() => completeRouting(answers(), bank, { ...selection, vehicle: 'forged' }, {}, settings), /career-launch/);
  const disabled = structuredClone(settings); disabled.careerVehicle.enabled = false;
  assert.equal(buildRoutingPlan(answers(), bank, disabled).followUpCount, 1);
  assert.equal(completeRouting(answers(), bank, selection, {}, disabled).routing.careerVehicle, undefined);
});

test('admin cluster and routing edits change actual program matching; a saved rule snapshot stays unchanged', () => {
  const selection = { profile: 'A', field: 'a-computing', vehicle: 'corporate' };
  const old = completeRouting(answers(), bank, selection, {}, settings).routing;
  const modified = structuredClone(settings);
  modified.profiles.A = 'Renamed analytical profile'; modified.routingQuestions.A.prompt = 'Edited specialization prompt';
  modified.routingQuestions.A.options[0].clusterId = 'business';
  const next = completeRouting(answers(), bank, selection, {}, modified).routing;
  assert.equal(next.umbrellaCluster, 'Business Administration & Entrepreneurship');
  assert.equal(next.macroProfile.name, modified.profiles.A);
  const programs = [{ program_id: programId, program_name: 'BS Information Technology', degree_level: 'Bachelor' },
    { program_id: '00000000-0000-4000-8000-000000000022', program_name: 'BS Accountancy', degree_level: 'Bachelor' }];
  assert.deepEqual(selectRoutedPrograms(programs, old).map(p => p.program_name), ['BS Information Technology']);
  assert.deepEqual(selectRoutedPrograms(programs, next).map(p => p.program_name), ['BS Accountancy']);
  assert.equal(old.display.profiles.A, settings.profiles.A);
});

test('explicit program associations override keywords, exclusions win, and keywords are literal whole-word matches', () => {
  const cluster = structuredClone(settings.clusters[0]);
  assert.equal(programMatchesCluster({ program_id: programId, program_name: 'BS Accounting Information System' }, cluster), false);
  cluster.includeProgramIds = [programId]; assert.equal(programMatchesCluster({ program_id: programId, program_name: 'Other Program' }, cluster), true);
  cluster.excludeProgramIds = [programId]; assert.equal(programMatchesCluster({ program_id: programId, program_name: 'BS IT' }, cluster), false);
  assert.equal(programMatchesCluster({ program_name: 'BS Hospitality' }, { ...cluster, includeKeywords: ['IT'], includeProgramIds: [], excludeProgramIds: [] }), false);
});

test('career-school priority never invents an offering or ignores budget/distance limits', () => {
  const config = structuredClone(settings); config.careerVehicle.options[0].preferredSchoolIds = [schoolId];
  const route = completeRouting(answers(), bank, { profile: 'A', field: 'a-computing', vehicle: 'corporate' }, { maxTuition: 30000 }, config).routing;
  const schools = [
    { id: 'other', name: 'A Other School', latitude: 14.55, longitude: 121.03, offerings: [{ program: 'BS IT', tuition: 10000 }] },
    { id: schoolId, name: 'Z Preferred School', latitude: 14.6, longitude: 121.04, offerings: [{ program: 'BS IT', tuition: 25000 }] },
    { id: 'expensive', name: 'Expensive', latitude: 14.55, longitude: 121.03, offerings: [{ program: 'BS IT', tuition: 70000 }] },
    { id: 'empty', name: 'No Offering', latitude: 14.55, longitude: 121.03, offerings: [] }
  ];
  const matched = matchRoutedSchools(schools, 'Makati', route);
  assert.deepEqual(matched.schools.map(s => s.id), [schoolId, 'other']);
});

test('invalid references, unsafe policies, invalid catalog IDs and unbounded display values are rejected', () => {
  for (const mutate of [c => { c.routingQuestions.A.options[0].clusterId = 'missing'; }, c => { c.policy.attempts = 'delete-history'; },
    c => { c.clusters[0].includeProgramIds = ['------------------------------------']; }, c => { c.display.programPreviewCount = 0; },
    c => { c.display.distanceChoices = [-1]; }, c => { c.policy.tiePriority = ['A', 'A', 'C', 'D']; }]) {
    const changed = structuredClone(settings); mutate(changed); assert.throws(() => validateAssessmentSettings(changed));
  }
});
