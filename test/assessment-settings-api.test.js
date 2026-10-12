import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { assessmentTemplate } from '../src/services/assessment-settings-validation.js';
import { templateRoutingBank } from './fixtures/live-routing-bank.js';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test'; process.env.DB_SSL = 'disable'; process.env.EMAIL_ENABLED = 'false'; process.env.NODE_ENV = 'test';
const { app } = await import('../src/app.js');
const { pool, rawPool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const admin = { user_id: '00000000-0000-4000-8000-000000000001', email: 'unicourse02@gmail.com', email_verified_at: new Date(), address: 'Makati' };
const headers = { Authorization: `Bearer ${createAccessToken(admin)}`, 'Content-Type': 'application/json' };
async function fixture(t) {
  let bank = templateRoutingBank(), settings = structuredClone(assessmentTemplate); const calls = [];
  const query = (sql, values = []) => {
    if (sql.startsWith('SELECT') && sql.includes('FROM assessment_settings')) return { command: 'SELECT', rows: [{ settings }] };
    if (sql.startsWith('SELECT') && sql.includes('FROM assessment_questions')) return { command: 'SELECT', rows: [...bank].sort((a, b) => a.position - b.position) };
    if (sql.startsWith('SELECT') && sql.includes('FROM users')) return { command: 'SELECT', rows: [admin] };
    if (sql.startsWith('SELECT') && /FROM programs|FROM schools/.test(sql)) return { command: 'SELECT', rows: sql.includes('ANY(')
      ? (values[0] ?? []).filter(id => id === '00000000-0000-4000-8000-000000000021').map(id => ({ id, name: 'Fixture catalog item' }))
      : [{ id: '00000000-0000-4000-8000-000000000021', name: 'BS Information Technology', program_id: '00000000-0000-4000-8000-000000000021', program_name: 'BS Information Technology', degree_level: 'Bachelor' }] };
    return { command: 'UPDATE', rowCount: 1, rows: [] };
  };
  t.mock.method(pool, 'query', async (sql, values) => [query(sql, values).rows]);
  t.mock.method(pool, 'execute', async sql => sql.includes('FROM users') ? [[admin]] : [[]]);
  t.mock.method(rawPool, 'connect', async () => {
    let before;
    return { release() {}, query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql === 'BEGIN') before = { bank: structuredClone(bank), settings: structuredClone(settings) };
      if (sql === 'ROLLBACK') { bank = before.bank; settings = before.settings; }
      if (sql.startsWith('UPDATE assessment_settings')) settings = JSON.parse(values[0]);
      if (sql.startsWith('UPDATE assessment_questions SET position_index')) bank = bank.map(q => q.id === values[1] ? { ...q, position: values[0], updatedAt: new Date('2026-10-13') } : q);
      return query(sql, values);
    } };
  });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { base: `http://127.0.0.1:${server.address().port}/api`, calls, bank: () => bank, settings: () => settings };
}

test('admin settings edits affect the public flow and invalidate stale core/routing submissions', async t => {
  const f = await fixture(t);
  const before = await (await fetch(f.base + '/assessments/questions')).json();
  const current = await (await fetch(f.base + '/admin/assessment-settings', { headers })).json();
  current.settings.copy.coreTitle = 'Updated live assessment title'; current.settings.routingQuestions.A.prompt = 'Updated specialization question';
  current.settings.clusters[0].name = 'Edited Computing Cluster';
  const response = await fetch(f.base + '/admin/assessment-settings', { method: 'PUT', headers, body: JSON.stringify({ settings: current.settings, version: current.version }) });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  const after = await (await fetch(f.base + '/assessments/questions')).json();
  assert.notEqual(after.version, before.version); assert.equal(after.workflow.display.copy.coreTitle, current.settings.copy.coreTitle);
  assert.ok(after.data[0].sectionTitle); assert.ok(after.data.every(q => q.options.every(o => Object.keys(o).join(',') === 'id,label')));
  const answers = f.bank().map(q => ({ questionId: q.id, optionId: q.options[0].id }));
  const preview = await (await fetch(f.base + '/admin/questions/preview-routing', { method: 'POST', headers,
    body: JSON.stringify({ answers, questionBankVersion: after.version, routingSelection: { profile: 'A', field: 'a-computing', vehicle: 'corporate' } }) })).json();
  assert.equal(preview.plan.routingQuestions.A.prompt, current.settings.routingQuestions.A.prompt);
  assert.equal(preview.routing.umbrellaCluster, 'Edited Computing Cluster'); assert.equal(preview.routing.careerVehicle.id, 'corporate');
  const stale = await fetch(f.base + '/assessments/routing', { method: 'POST', headers, body: JSON.stringify({ answers, questionBankVersion: before.version }) }); assert.equal(stale.status, 409);
  assert.ok(!f.calls.some(c => /INSERT INTO assessments|DELETE FROM/.test(c.sql)));
});

test('stale settings, missing sections and nonexistent catalog associations are rejected atomically', async t => {
  const f = await fixture(t);
  const current = await (await fetch(f.base + '/admin/assessment-settings', { headers })).json();
  for (const [version, change] of [['stale', () => {}], [current.version, s => { s.sections = s.sections.slice(1); }],
    [current.version, s => { s.clusters[0].includeProgramIds = ['00000000-0000-4000-8000-000000000099']; }]]) {
    const settings = structuredClone(current.settings); change(settings);
    const response = await fetch(f.base + '/admin/assessment-settings', { method: 'PUT', headers, body: JSON.stringify({ settings, version }) });
    assert.ok([400, 409].includes(response.status)); assert.deepEqual(f.settings(), current.settings);
    assert.equal(f.calls.at(-1).sql, 'ROLLBACK');
  }
});

test('question and section order are configurable without changing labels or macro mappings', async t => {
  const f = await fixture(t); const original = structuredClone(f.bank());
  const bank = await (await fetch(f.base + '/admin/questions', { headers })).json(); const questionIds = bank.data.map(q => q.id);
  [questionIds[0], questionIds[1]] = [questionIds[1], questionIds[0]];
  const response = await fetch(f.base + '/admin/questions/order', { method: 'PUT', headers, body: JSON.stringify({ questionIds, version: bank.version }) }); assert.equal(response.status, 200);
  const next = await (await fetch(f.base + '/assessments/questions')).json(); assert.equal(next.data[0].id, questionIds[0]);
  for (const q of f.bank()) assert.deepEqual(q.options, original.find(o => o.id === q.id).options);
  const current = await (await fetch(f.base + '/admin/assessment-settings', { headers })).json();
  [current.settings.sections[0], current.settings.sections[1]] = [current.settings.sections[1], current.settings.sections[0]];
  assert.equal((await fetch(f.base + '/admin/assessment-settings', { method: 'PUT', headers, body: JSON.stringify({ settings: current.settings, version: current.version }) })).status, 200);
  const reordered = await (await fetch(f.base + '/assessments/questions')).json(); assert.equal(reordered.data[0].sectionTitle, current.settings.sections[0].title);
});

test('only an explicitly saved unlimited policy permits another attempt, without deleting old results', async t => {
  const f = await fixture(t);
  const current = await (await fetch(f.base + '/admin/assessment-settings', { headers })).json(); current.settings.policy.attempts = 'unlimited';
  assert.equal((await fetch(f.base + '/admin/assessment-settings', { method: 'PUT', headers, body: JSON.stringify({ settings: current.settings, version: current.version }) })).status, 200);
  const publicBank = await (await fetch(f.base + '/assessments/questions')).json(); assert.equal(publicBank.attemptPolicy, 'unlimited');
  t.mock.method(pool, 'execute', async sql => sql.includes('FROM users') ? [[admin]] : [[{ assessment_id: 'previous' }]]);
  const response = await fetch(f.base + '/assessments/routing', { method: 'POST', headers,
    body: JSON.stringify({ questionBankVersion: publicBank.version, answers: f.bank().map(q => ({ questionId: q.id, optionId: q.options[0].id })) }) });
  assert.equal(response.status, 200); assert.ok(!f.calls.some(c => /DELETE FROM/.test(c.sql)));
});

test('anonymous and student accounts cannot read or write assessment settings', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(f.base + '/admin/assessment-settings')).status, 401);
  t.mock.method(pool, 'execute', async () => [[{ ...admin, email: 'student@example.test' }]]);
  assert.equal((await fetch(f.base + '/admin/assessment-settings', { headers })).status, 403);
  assert.equal((await fetch(f.base + '/admin/assessment-settings', { method: 'PUT', headers, body: '{}' })).status, 403);
  assert.equal(f.calls.length, 0);
});

test('final student submission saves the exact configured result and both follow-ups without extra votes', async t => {
  const f = await fixture(t);
  const publicBank = await (await fetch(f.base + '/assessments/questions')).json();
  const response = await fetch(f.base + '/assessments', { method: 'POST', headers, body: JSON.stringify({
    questionBankVersion: publicBank.version, workflowVersion: 'macro-routing-v1',
    answers: f.bank().map(q => ({ questionId: q.id, optionId: q.options[0].id })),
    routingSelection: { profile: 'A', field: 'a-computing', vehicle: 'corporate' }
  }) });
  const data = await response.json(); assert.equal(response.status, 201, JSON.stringify(data));
  assert.equal(data.profile.metrics.routing.careerVehicle.id, 'corporate'); assert.equal(data.profile.metrics.routing.coreVoteCount, 15);
  assert.equal(data.profile.metrics.routing.display.clusters.length, 11); assert.equal(data.recommendedPrograms.length, 1);
  assert.equal(f.calls.at(-1).sql, 'COMMIT');
  assert.ok(f.calls.some(c => c.sql === 'LOCK TABLE assessment_settings IN SHARE MODE'));
  const stored = JSON.parse(f.calls.find(c => c.sql.includes('INSERT INTO career_profiles')).values[5]);
  assert.deepEqual(stored.rawScores, { A: 15, B: 0, C: 0, D: 0 }); assert.equal(stored.metrics.routing.display.copy.resultKicker, f.settings().copy.resultKicker);
});
