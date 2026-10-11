import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable';
process.env.EMAIL_ENABLED = 'false';
process.env.NODE_ENV = 'test';
const { app } = await import('../src/app.js');
const { pool, rawPool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const { completeRouting } = await import('../src/services/assessment-routing.js');
const user = { user_id: '00000000-0000-4000-8000-000000000011', email: 'student@example.test', address: 'Makati' };
const question = { id: 'q1', prompt: 'Unchanged wording', status: 'Active', updatedAt: new Date('2026-10-01'),
  options: [{ id: 'a', label: 'A', scores: { technology: 3 } }, { id: 'b', label: 'B', scores: { business: 3 } }] };
async function serverFor(t) {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api/assessments`;
}
const headers = () => ({ Authorization: `Bearer ${createAccessToken(user)}`, 'Content-Type': 'application/json' });
test('public questions expose availability, never private point weights', async t => {
  const base = await serverFor(t);
  t.mock.method(pool, 'query', async () => [[question]]);
  const response = await fetch(base + '/questions'); const body = await response.json();
  assert.equal(body.availability.available, true);
  assert.deepEqual(body.data[0].options, [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]);
});
test('constant live key returns a clear 503 before a transaction or attempt write', async t => {
  const base = await serverFor(t);
  t.mock.method(pool, 'execute', async () => [[user]]);
  t.mock.method(pool, 'query', async () => [[{ ...question, options: question.options.map(option => ({ ...option, scores: { technology: 3 } })) }]]);
  const connect = t.mock.method(rawPool, 'connect', async () => { throw new Error('No transaction should begin'); });
  const response = await fetch(base, { method: 'POST', headers: headers(), body: JSON.stringify({ answers: [{ questionId: 'q1', optionId: 'a' }] }) });
  assert.equal(response.status, 503); assert.match((await response.json()).error.message, /one-time assessment has not been used/);
  assert.equal(connect.mock.callCount(), 0);
});
test('valid submission stores versioned answer and match snapshots with active offering eligibility', async t => {
  const base = await serverFor(t); const calls = [];
  t.mock.method(pool, 'execute', async sql => sql.includes('FROM users') ? [[user]] : [[]]);
  t.mock.method(pool, 'query', async sql => {
    if (sql.includes('FROM assessment_questions')) return [[question]];
    assert.match(sql, /is_active_available = TRUE/); assert.match(sql, /degree_level IN/);
    return [[{ program_id: 'p1', program_name: 'Computing', degree_level: 'Bachelor', interest_tags: ['technology'] },
      { program_id: 'p2', program_name: 'Business', degree_level: 'Bachelor', interest_tags: ['business'] }]];
  });
  t.mock.method(rawPool, 'connect', async () => ({ query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('FROM assessment_questions')) return { command: 'SELECT', rows: [question] };
    if (sql.includes('FROM users')) return { command: 'SELECT', rows: [user] };
    if (sql.includes('FROM assessments')) return { command: 'SELECT', rows: [] };
    return { command: 'INSERT', rows: [], rowCount: 1 };
  }, release() {} }));
  const response = await fetch(base, { method: 'POST', headers: headers(), body: JSON.stringify({ answers: [{ questionId: 'q1', optionId: 'a' }] }) });
  const body = await response.json(); assert.equal(response.status, 201, JSON.stringify(body));
  assert.deepEqual(body.recommendedPrograms.map(item => item.id), ['p1']);
  assert.equal(body.recommendedPrograms[0].matchScore, 100);
  assert.equal(body.profile.metrics.algorithmVersion, 'interest-alignment-v2');
  const stored = JSON.parse(calls.find(call => call.sql.includes('INSERT INTO career_profiles')).values[5]);
  assert.equal(stored.metrics.programMatches.p1.alignment, 1); assert.equal(stored.rawScores.technology, 3);
  const responseSnapshot = JSON.parse(calls.find(call => call.sql.includes('INSERT INTO assessment_responses')).values[3]);
  assert.equal(responseSnapshot.prompt, question.prompt); assert.deepEqual(responseSnapshot.option.scores, { technology: 3 });
  assert.equal(calls.at(-1).sql, 'COMMIT');
});
test('a question edit during submission rolls back without consuming an attempt', async t => {
  const base = await serverFor(t); const calls = [];
  t.mock.method(pool, 'execute', async () => [[user]]);
  t.mock.method(pool, 'query', async sql => sql.includes('FROM assessment_questions') ? [[question]] : [[]]);
  t.mock.method(rawPool, 'connect', async () => ({ query: async sql => {
    calls.push(sql);
    return sql.includes('FROM assessment_questions') ? { command: 'SELECT', rows: [{ ...question, updatedAt: new Date('2026-10-02') }] } : { rows: [] };
  }, release() {} }));
  const response = await fetch(base, { method: 'POST', headers: headers(), body: JSON.stringify({ answers: [{ questionId: 'q1', optionId: 'a' }] }) });
  assert.equal(response.status, 409); assert.equal(calls.at(-1), 'ROLLBACK');
  assert.ok(!calls.some(sql => sql.includes('INSERT INTO assessments')));
});
test('saved result reads its original scoring snapshot rather than rescoring edited questions', async t => {
  const base = await serverFor(t);
  const metrics = { algorithmVersion: 'original-version', programMatches: { p1: { status: 'scored', alignment: 0.7 } } };
  t.mock.method(pool, 'execute', async sql => {
    if (sql.includes('FROM users')) return [[user]];
    if (sql.includes('cp.score_breakdown')) return [[{ id: 'profile', scores: { rawScores: { technology: 7 }, metrics } }]];
    if (sql.includes('rank_position')) return [[{ id: 'p1', matchScore: 70 }]];
    return [[]];
  });
  const query = t.mock.method(pool, 'query', async () => { throw new Error('Old results must not load the current key'); });
  const response = await fetch(base + '/test/results', { headers: headers() }); const body = await response.json();
  assert.equal(response.status, 200); assert.deepEqual(body.profile.scores, { technology: 7 });
  assert.equal(body.recommendedPrograms[0].matchDetails.alignment, 0.7); assert.equal(query.mock.callCount(), 0);
});

const routingConfig = JSON.parse(readFileSync(new URL('../database/assessment-macro-routing-v1.json', import.meta.url), 'utf8'));
const routingBank = routingConfig.questions.map(question => ({ ...question, status: 'Active', updatedAt: new Date('2026-10-12'),
  options: question.options.map(option => ({ id: option.id, label: option.label, scores: { technology: 3 } })) }));
const routingAnswers = routingBank.map(question => ({ questionId: question.id, optionId: question.options[0].id }));
const bankVersion = routingBank.map(question => `${question.id}:${question.updatedAt.toISOString()}`).join('|');
const routingBody = { answers: routingAnswers, questionBankVersion: bankVersion, workflowVersion: 'macro-routing-v1',
  routingSelection: { profile: 'A', field: 'computing' }, schoolLimits: { maxTuition: 30000 } };

test('unchanged core becomes available through routing without activating the old or draft weights', async t => {
  const base = await serverFor(t);
  t.mock.method(pool, 'query', async () => [[...routingBank]]);
  const response = await fetch(base + '/questions'); const body = await response.json();
  assert.equal(body.availability.available, true); assert.equal(body.workflow.version, 'macro-routing-v1');
  assert.equal(body.data.length, 20); assert.equal(body.data[0].prompt, routingBank[0].prompt);
  assert.ok(!Object.hasOwn(body.data[0].options[0], 'scores'));
});
test('core routing preview is authenticated and read-only, with no assessment transaction', async t => {
  const base = await serverFor(t);
  t.mock.method(pool, 'query', async () => [[...routingBank]]);
  t.mock.method(pool, 'execute', async sql => sql.includes('FROM users') ? [[user]] : [[]]);
  const connect = t.mock.method(rawPool, 'connect', async () => { throw new Error('Preview must not write'); });
  assert.equal((await fetch(base + '/routing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(routingBody) })).status, 401);
  const response = await fetch(base + '/routing', { method: 'POST', headers: headers(), body: JSON.stringify(routingBody) });
  const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.primaryProfile, 'A');
  assert.equal(body.votes.A, 15); assert.equal(body.followUpCount, 1); assert.equal(connect.mock.callCount(), 0);
});
test('routing completion rejects skipped follow-ups, forged fields and unverifiable location before any write', async t => {
  const base = await serverFor(t);
  t.mock.method(pool, 'query', async () => [[...routingBank]]);
  t.mock.method(pool, 'execute', async () => [[{ ...user, address: 'unknown location' }]]);
  const connect = t.mock.method(rawPool, 'connect', async () => { throw new Error('Invalid request must not write'); });
  const variants = [{ ...routingBody, workflowVersion: undefined }, { ...routingBody, routingSelection: { profile: 'A', field: 'health' } },
    { ...routingBody, schoolLimits: { maxDistance: 10 } }, { ...routingBody, questionBankVersion: 'old' }];
  for (const body of variants) {
    const response = await fetch(base, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    assert.ok([400, 409].includes(response.status));
  }
  assert.equal(connect.mock.callCount(), 0);
});
test('completed routing saves one versioned roadmap and filters actual school offerings without percentages', async t => {
  const base = await serverFor(t); const calls = [];
  const programs = [{ program_id: '00000000-0000-4000-8000-000000000021', program_name: 'BS Information Technology', degree_level: 'Bachelor' },
    { program_id: '00000000-0000-4000-8000-000000000022', program_name: 'BS Civil Engineering', degree_level: 'Bachelor' }];
  t.mock.method(pool, 'query', async sql => sql.includes('FROM assessment_questions') ? [[...routingBank]] : [programs]);
  t.mock.method(pool, 'execute', async sql => sql.includes('FROM users') ? [[user]] : [[{ id: 'school', name: 'Known School', latitude: 14.55, longitude: 121.02,
    offerings: [{ program: 'BS Information Technology', tuition: 20000 }, { program: 'BS IT major in Track', tuition: 80000 }] },
  { id: 'unknown', name: 'Unknown Tuition', latitude: 14.55, longitude: 121.02, offerings: [{ program: 'BS IT', tuition: null }] }]]);
  t.mock.method(rawPool, 'connect', async () => ({ query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('FROM assessment_questions')) return { command: 'SELECT', rows: [...routingBank] };
    if (sql.includes('FROM users')) return { command: 'SELECT', rows: [user] };
    if (sql.includes('FROM assessments')) return { command: 'SELECT', rows: [] };
    return { command: 'INSERT', rows: [], rowCount: 1 };
  }, release() {} }));
  const response = await fetch(base, { method: 'POST', headers: headers(), body: JSON.stringify(routingBody) });
  const body = await response.json(); assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.profile.metrics.routing.umbrellaCluster, 'Technology & Computing');
  assert.equal(body.recommendedPrograms.length, 1); assert.equal(body.recommendedPrograms[0].matchScore, null);
  assert.equal(body.recommendedSchools.length, 1); assert.equal(body.recommendedSchools[0].matchScore, null);
  assert.deepEqual(body.recommendedSchools[0].matchedPrograms, ['BS Information Technology']);
  const stored = JSON.parse(calls.find(call => call.sql.includes('INSERT INTO career_profiles')).values[5]);
  assert.deepEqual(stored.rawScores, { A: 15, B: 0, C: 0, D: 0 });
  assert.equal(stored.metrics.routing.limits.maxTuition, 30000);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO assessments ')).length, 1);
  assert.match(calls.find(call => call.sql.includes('INSERT INTO recommended_programs')).sql, /UNNEST/);
  assert.equal(calls.at(-1).sql, 'COMMIT');
});
test('an existing assessment still blocks a routed submission and rolls back', async t => {
  const base = await serverFor(t); const calls = [];
  t.mock.method(pool, 'query', async sql => sql.includes('FROM assessment_questions') ? [[...routingBank]] : [[]]);
  t.mock.method(pool, 'execute', async () => [[user]]);
  t.mock.method(rawPool, 'connect', async () => ({ query: async sql => {
    calls.push(sql);
    if (sql.includes('FROM assessment_questions')) return { command: 'SELECT', rows: [...routingBank] };
    if (sql.includes('FROM users')) return { command: 'SELECT', rows: [user] };
    if (sql.includes('FROM assessments')) return { command: 'SELECT', rows: [{ assessment_id: 'already' }] };
    return { command: 'INSERT', rows: [], rowCount: 1 };
  }, release() {} }));
  const response = await fetch(base, { method: 'POST', headers: headers(), body: JSON.stringify(routingBody) });
  assert.equal(response.status, 409); assert.equal(calls.at(-1), 'ROLLBACK');
  assert.ok(!calls.some(sql => sql.includes('INSERT INTO assessments')));
});

test('saved routed results preserve the selected field and limits without loading a changed question bank', async t => {
  const base = await serverFor(t);
  const routing = completeRouting(routingAnswers, routingBank, routingBody.routingSelection, routingBody.schoolLimits).routing;
  t.mock.method(pool, 'query', async () => { throw new Error('Saved routing must not read or rescore current questions'); });
  t.mock.method(pool, 'execute', async sql => {
    if (sql.includes('FROM users')) return [[user]];
    if (sql.includes('cp.score_breakdown AS scores')) return [[{ id: 'profile', scores: { rawScores: routing.votes, metrics: { routing } } }]];
    if (sql.includes('rank_position AS')) return [[{ id: 'program', name: 'BS Information Technology', matchScore: 0 }]];
    return [[{ id: 'school', name: 'School', latitude: 14.55, longitude: 121.02, offerings: [{ program: 'BS Information Technology', tuition: 20000 }] }]];
  });
  const response = await fetch(base + '/saved/results', { headers: headers() }); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.profile.metrics.routing.field, 'computing');
  assert.equal(body.profile.metrics.routing.limits.maxTuition, 30000); assert.equal(body.recommendedSchools.length, 1);
  assert.equal(body.recommendedPrograms[0].matchScore, null);
});
test('dashboard featured school respects saved routing limits instead of suggesting a cheaper unrelated or unknown-fee school', async t => {
  const base = await serverFor(t);
  const routing = completeRouting(routingAnswers, routingBank, routingBody.routingSelection, routingBody.schoolLimits).routing;
  t.mock.method(pool, 'execute', async sql => {
    if (sql.includes('FROM users')) return [[user]];
    if (sql.includes('SELECT a.assessment_id AS id')) return [[{ id: 'assessment' }]];
    return [[{ assessmentId: 'assessment', id: 'school', name: 'Outside budget', latitude: 14.55, longitude: 121.02,
      scoreBreakdown: { rawScores: routing.votes, metrics: { routing } }, offerings: [{ program: 'BS Information Technology', tuition: 80000 }] }]];
  });
  const response = await fetch(base, { headers: headers() }); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.data[0].recommendedSchool, null);
});
