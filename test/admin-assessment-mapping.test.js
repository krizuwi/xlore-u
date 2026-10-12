import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { liveRoutingBank } from './fixtures/live-routing-bank.js';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable'; process.env.EMAIL_ENABLED = 'false'; process.env.NODE_ENV = 'test';
const { app } = await import('../src/app.js');
const { pool, rawPool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const { validateQuestion } = await import('../src/services/admin-validation.js');
const admin = { user_id: '00000000-0000-4000-8000-000000000001', email: 'unicourse02@gmail.com', email_verified_at: new Date(), address: 'Makati' };
const headers = { Authorization: `Bearer ${createAccessToken(admin)}`, 'Content-Type': 'application/json' };
const answerList = bank => bank.map(question => ({ questionId: question.id, optionId: question.options[0].id }));

async function fixture(t) {
  let bank = liveRoutingBank(); const calls = [];
  t.mock.method(pool, 'execute', async sql => sql.includes('FROM users') ? [[admin]] : [[]]);
  t.mock.method(pool, 'query', async sql => { if (sql.includes('FROM assessment_settings')) return [[]]; assert.match(sql, /FROM assessment_questions/); return [bank]; });
  t.mock.method(rawPool, 'connect', async () => {
    let before;
    return { release() {}, query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql === 'BEGIN') before = structuredClone(bank);
      if (sql === 'ROLLBACK') bank = before;
      if (sql.startsWith('SELECT') && sql.includes('FROM assessment_questions')) return { command: 'SELECT', rows: bank.filter(q => q.status === 'Active') };
      if (sql.startsWith('UPDATE assessment_questions SET prompt')) {
        const [prompt, options, status, routing, id] = values;
        bank = bank.map(q => q.id === id ? { ...q, prompt, options: JSON.parse(options), status, routing: JSON.parse(routing), updatedAt: new Date('2026-10-13') } : q);
      }
      if (sql.startsWith('UPDATE assessment_questions SET status')) bank = bank.map(q => q.id === values[0] ? { ...q, status: 'Archived' } : q);
      if (sql.startsWith('INSERT INTO assessment_questions')) {
        const [id, prompt, options, status, routing] = values;
        bank.push({ id, prompt, options: JSON.parse(options), status, routing: JSON.parse(routing), updatedAt: new Date('2026-10-13') });
      }
      return { command: 'UPDATE', rowCount: 1, rows: [] };
    } };
  });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { base: `http://127.0.0.1:${server.address().port}/api`, calls, bank: () => bank };
}

test('macro validation strips obsolete technology scores and rejects all-identical vote mappings', () => {
  const question = liveRoutingBank()[0];
  const saved = validateQuestion({ ...question, options: question.options.map(o => ({ ...o, scores: { technology: 3 } })) });
  assert.deepEqual(saved.options, question.options);
  assert.throws(() => validateQuestion({ ...question, options: question.options.map(o => ({ ...o, macro: 'A' })) }), /mapped once each/);
  assert.throws(() => validateQuestion({ ...question, options: question.options.slice(1) }), /four answers/);
});

test('practical questions require no positive career weights and priority is an explicit boolean', () => {
  const question = liveRoutingBank()[15];
  const saved = validateQuestion(question);
  assert.ok(saved.options.every(o => !Object.hasOwn(o, 'scores') && !Object.hasOwn(o, 'macro')));
  assert.throws(() => validateQuestion({ ...question, options: question.options.map(o => ({ ...o, prioritize: 'yes' })) }), /whether each practical answer/);
  assert.throws(() => validateQuestion({ ...question, routing: { role: 'constraint', constraintKey: 'unknown' } }), /valid practical preference/);
});

test('admin PUT changes the live student calculation and preview uses exactly the same mapping', async t => {
  const f = await fixture(t);
  const before = await (await fetch(f.base + '/assessments/questions')).json();
  const edited = structuredClone(f.bank()[0]);
  edited.options[0].macro = 'B'; edited.options[1].macro = 'A';
  const save = await fetch(f.base + `/admin/questions/${edited.id}`, { method: 'PUT', headers, body: JSON.stringify({ ...edited, questionBankVersion: before.version }) });
  assert.equal(save.status, 200, JSON.stringify(await save.json()));
  const after = await (await fetch(f.base + '/assessments/questions')).json();
  assert.notEqual(after.version, before.version);
  assert.equal(after.workflow.coreVoteCount, 15);
  assert.ok(after.data.every(q => q.options.every(o => Object.keys(o).join(',') === 'id,label')));
  const body = { questionBankVersion: after.version, answers: answerList(f.bank()) };
  const preview = await fetch(f.base + '/admin/questions/preview-routing', { method: 'POST', headers, body: JSON.stringify(body) });
  const { plan } = await preview.json(); assert.equal(preview.status, 200);
  const student = await (await fetch(f.base + '/assessments/routing', { method: 'POST', headers, body: JSON.stringify(body) })).json();
  assert.deepEqual(student, plan); assert.deepEqual(plan.votes, { A: 14, B: 1, C: 0, D: 0 });
  const roadmap = await (await fetch(f.base + '/admin/questions/preview-routing', { method: 'POST', headers,
    body: JSON.stringify({ ...body, routingSelection: { profile: 'A', field: 'engineering' } }) })).json();
  assert.equal(roadmap.routing.umbrellaCluster, 'Engineering & Built Environment');
  assert.ok(f.calls.some(c => c.sql.includes('INSERT INTO admin_audit_log')));
  assert.ok(!f.calls.some(c => c.sql.includes('INSERT INTO assessments') || c.sql.includes('UPDATE career_profiles')));
  const stale = await fetch(f.base + '/assessments/routing', { method: 'POST', headers, body: JSON.stringify({ ...body, questionBankVersion: before.version }) });
  assert.equal(stale.status, 409);
  const staleEdit = await fetch(f.base + `/admin/questions/${edited.id}`, { method: 'PUT', headers,
    body: JSON.stringify({ ...edited, prompt: 'Stale question text', questionBankVersion: before.version }) });
  assert.equal(staleEdit.status, 409); assert.equal(f.bank()[0].prompt, edited.prompt);
});

test('invalid active changes roll back instead of disabling the assessment', async t => {
  const f = await fixture(t); const original = structuredClone(f.bank());
  const removeConstraint = await fetch(f.base + `/admin/questions/${f.bank()[15].id}`, { method: 'DELETE', headers });
  assert.equal(removeConstraint.status, 400); assert.deepEqual(f.bank(), original);
  const duplicateConstraint = await fetch(f.base + '/admin/questions', { method: 'POST', headers, body: JSON.stringify(f.bank()[15]) });
  assert.equal(duplicateConstraint.status, 400); assert.deepEqual(f.bank(), original);
  assert.equal(f.calls.at(-1).sql, 'ROLLBACK');
});

test('active additions and core archives update vote counts; drafts do not enter student questions', async t => {
  const f = await fixture(t); const original = f.bank()[0];
  const add = await fetch(f.base + '/admin/questions', { method: 'POST', headers, body: JSON.stringify({ ...original, prompt: 'Admin-added core question' }) });
  assert.equal(add.status, 201);
  let questions = await (await fetch(f.base + '/assessments/questions')).json(); assert.equal(questions.workflow.coreVoteCount, 16);
  const archive = await fetch(f.base + `/admin/questions/${original.id}`, { method: 'DELETE', headers }); assert.equal(archive.status, 200);
  questions = await (await fetch(f.base + '/assessments/questions')).json(); assert.equal(questions.workflow.coreVoteCount, 15);
  const draft = await fetch(f.base + '/admin/questions', { method: 'POST', headers, body: JSON.stringify({ ...original, status: 'Draft', prompt: 'Draft only' }) }); assert.equal(draft.status, 201);
  questions = await (await fetch(f.base + '/assessments/questions')).json(); assert.ok(!questions.data.some(q => q.prompt === 'Draft only'));
});

test('admin preview rejects anonymous or student callers and stores no attempt', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(f.base + '/admin/questions/preview-routing', { method: 'POST' })).status, 401);
  t.mock.method(pool, 'execute', async () => [[{ ...admin, email: 'student@example.test' }]]);
  assert.equal((await fetch(f.base + '/admin/questions/preview-routing', { method: 'POST', headers, body: '{}' })).status, 403);
  assert.equal(f.calls.length, 0);
});
