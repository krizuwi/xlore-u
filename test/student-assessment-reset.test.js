import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable'; process.env.NODE_ENV = 'test'; process.env.EMAIL_ENABLED = 'false';
const { resetStudentAssessment, validateStudentAssessmentReset } = await import('../src/services/student-assessment-reset.js');
const { ADMIN_EMAIL } = await import('../src/utils/admin-access.js');
const { app } = await import('../src/app.js');
const { pool, rawPool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const studentId = '10000000-0000-4000-8000-000000000001';
const actor = { user_id: '10000000-0000-4000-8000-000000000009', email: ADMIN_EMAIL, email_verified_at: new Date(), account_type: 'student', auth_version: 0 };
const student = { ...actor, user_id: studentId, email: 'fixture@example.test' };
const latest = '20000000-0000-4000-8000-000000000002';
const body = { confirmed: true, expectedAssessmentId: latest, reason: 'Requested retake' };

function fixture({ target = student, latestId = latest, empty = false, auditFails = false } = {}) {
  const log = [];
  async function query(sql, values = []) {
    log.push({ sql, values });
    if (sql.startsWith('SELECT user_id')) return { command: 'SELECT', rows: target ? [target] : [] };
    if (sql.startsWith('SELECT assessment_id')) return { command: 'SELECT', rows: empty ? [] : [{ assessment_id: latestId }, { assessment_id: '20000000-0000-4000-8000-000000000001' }] };
    if (sql.startsWith('DELETE')) { assert.equal(values[0], studentId); assert.match(sql, /WHERE user_id =/); return { command: 'DELETE', rowCount: 2 }; }
    if (sql.startsWith('INSERT INTO admin_audit_log') && auditFails) throw new Error('Audit unavailable');
    return { command: sql.split(' ')[0], rowCount: 1, rows: [] };
  }
  return { log, raw: { query, release() {} }, connection: { async execute(sql, values) { const result = await query(sql, values); return [result.command === 'SELECT' ? result.rows : { affectedRows: result.rowCount }]; } } };
}

test('targeted reset locks one student, deletes only their attempts and audits without private answers', async () => {
  const f = fixture();
  assert.equal((await resetStudentAssessment(f.connection, actor, studentId, body)).clearedAttempts, 2);
  assert.match(f.log[0].sql, /WHERE user_id = \? FOR UPDATE/);
  assert.deepEqual(f.log.filter(x => x.sql.startsWith('DELETE')), [{ sql: 'DELETE FROM assessments WHERE user_id = ?', values: [studentId] }]);
  const audit = f.log.find(x => x.sql.startsWith('INSERT'));
  assert.deepEqual(audit.values, [actor.user_id, studentId, JSON.stringify({ reason: body.reason, clearedAttempts: 2 })]);
  assert.ok(!f.log.some(x => /DELETE FROM (users|schools|programs|student_enrollments)|UPDATE users/.test(x.sql)));
});

test('requires genuine confirmation, valid result ID and bounded reason', () => {
  for (const item of [{ ...body, confirmed: false }, { ...body, confirmed: 'true' }, { ...body, reason: ' ' }, { ...body, reason: 'a'.repeat(1001) }, { ...body, expectedAssessmentId: 'bad' }, null]) assert.throws(() => validateStudentAssessmentReset(item));
});

test('rejects non-admin actors, institutions, admin targets, missing students, stale or duplicate resets before deletion', async () => {
  for (const options of [{ target: { ...student, account_type: 'institution' } }, { target: actor }, { target: null }, { latestId: '20000000-0000-4000-8000-000000000003' }, { empty: true }]) {
    const f = fixture(options);
    await assert.rejects(resetStudentAssessment(f.connection, actor, studentId, body));
    assert.equal(f.log.filter(x => x.sql.startsWith('DELETE')).length, 0);
  }
  const f = fixture();
  await assert.rejects(resetStudentAssessment(f.connection, student, studentId, body), { status: 403 });
  assert.equal(f.log.length, 0);
});

test('HTTP reset is administrator-only and commits deletion and audit together; audit failure rolls back', async t => {
  let authenticated = actor;
  const authMock = mock.method(pool, 'execute', async () => [[authenticated]]);
  t.after(() => authMock.mock.restore());
  let f = fixture();
  const connectMock = mock.method(rawPool, 'connect', async () => f.raw);
  t.after(() => connectMock.mock.restore());
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const url = `http://127.0.0.1:${server.address().port}/api/admin/students/${studentId}/assessment/reset`;
  const request = token => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  assert.equal((await request()).status, 401);
  authenticated = student;
  assert.equal((await request(createAccessToken(student))).status, 403);
  authenticated = { ...student, account_type: 'institution' };
  assert.equal((await request(createAccessToken(authenticated))).status, 403);
  assert.equal(connectMock.mock.callCount(), 0);
  authenticated = actor;
  const success = await request(createAccessToken(actor)); assert.equal(success.status, 200);
  assert.equal((await success.json()).clearedAttempts, 2);
  assert.equal(f.log.at(-1).sql, 'COMMIT');
  f = fixture({ auditFails: true });
  assert.equal((await request(createAccessToken(actor))).status, 500);
  assert.equal(f.log.at(-1).sql, 'ROLLBACK');
  assert.ok(!f.log.some(x => x.sql === 'COMMIT'));
});
