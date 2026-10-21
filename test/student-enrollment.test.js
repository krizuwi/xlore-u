import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable'; process.env.NODE_ENV = 'test'; process.env.EMAIL_ENABLED = 'true';
process.env.SMTP_HOST = 'mail.example.test'; process.env.SMTP_USER = 'mail@example.test'; process.env.SMTP_PASS = 'fixture';
const sendMail = mock.fn(async () => ({ accepted: ['student@example.test'] }));
mock.method((await import('nodemailer')).default, 'createTransport', () => ({ sendMail }));
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');
const { ADMIN_EMAIL } = await import('../src/utils/admin-access.js');
const { createAccessToken, createRefreshToken, verifyAccessToken } = await import('../src/utils/security.js');
const { validateEnrollment, validateStudentAccess, requireEnrollmentStudent, studentFilters, studentReportQuery, getStudentReport, ENROLLMENT_DECLARATION_VERSION } = await import('../src/services/student-enrollment.js');
const { deliverStudentSuspensionEmail } = await import('../src/services/student-suspension-email.js');
const { sendStudentSuspensionEmail } = await import('../src/services/email.js');
const student = { user_id: '10000000-0000-4000-8000-000000000001', email: 'student@example.test', full_name: 'Fixture Student', email_verified_at: new Date(), account_type: 'student', auth_version: 0 };
const schoolId = '40000000-0000-4000-8000-000000000001';
const valid = { schoolId, city: 'Taguig', usedXloreU: true, helpful: true, declarationVersion: ENROLLMENT_DECLARATION_VERSION };
const admin = { ...student, user_id: '10000000-0000-4000-8000-000000000009', email: ADMIN_EMAIL };
async function serve(t) {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api`;
}
function request(base, identity, method, path, body) {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(identity ? { Authorization: 'Bearer ' + createAccessToken(identity) } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test('enrollment requires a real school ID, city and explicit true declarations at the current version', () => {
  assert.deepEqual(validateEnrollment(valid), { schoolId, city: 'Taguig', declarationVersion: ENROLLMENT_DECLARATION_VERSION });
  for (const change of [{ schoolId: 'forged' }, { city: '' }, { city: 'x'.repeat(101) }, { city: {} }, { city: '123 Street' }, { helpful: 'true' }, { helpful: false }, { usedXloreU: 1 }, { usedXloreU: false }, { declarationVersion: 'old' }]) assert.throws(() => validateEnrollment({ ...valid, ...change }));
  assert.equal(validateEnrollment({ ...valid, city: '  Las   Piñas ' }).city, 'Las Piñas');
  for (const identity of [{ ...student, email_verified_at: null }, { ...student, account_type: 'institution' }, admin]) assert.throws(() => requireEnrollmentStudent(identity), /verified student/);
});
test('student report filters are bounded, reject forged types and use literal parameterized search', () => {
  for (const change of [{ search: ['one'] }, { search: 'x'.repeat(101) }, { page: '0' }, { page: '1;DROP' }, { page: ['1'] }, { status: 'disabled' }, { enrollment: 'yes' }, { assessment: 'used' }]) assert.throws(() => studentFilters(change));
  const query = studentReportQuery({ search: '100%_test\\', status: 'suspended', enrollment: 'reported', assessment: 'completed' });
  assert.ok(!query.from.includes('100%'));
  assert.equal(query.values[1], '%100\\%\\_test\\\\%');
  assert.match(query.from, /account_type = 'student'/); assert.match(query.from, /lower\(u.email\) <> \?/);
  assert.match(query.from, /u.is_active = FALSE/); assert.match(query.from, /e.user_id IS NOT NULL/); assert.match(query.completed, /completed_at IS NOT NULL/);
  assert.throws(() => validateStudentAccess({ active: false, expectedActive: true, reason: ' ' }));
  assert.throws(() => validateStudentAccess({ active: 'false', expectedActive: true, reason: 'Reason' }));
  assert.throws(() => validateStudentAccess({ active: true, expectedActive: true, reason: 'Reason' }));
});
test('visitors, institutions, students and unverified administrators cannot read student reports or change access', async t => {
  const base = await serve(t);
  const sql = t.mock.method(pool, 'execute', async () => { throw new Error('Unexpected database access'); });
  assert.equal((await request(base, null, 'GET', '/admin/students')).status, 401);
  assert.equal((await request(base, null, 'PUT', '/enrollment', valid)).status, 401);
  sql.mock.mockImplementation(async () => [[student]]);
  for (const path of ['/admin/students', '/admin/students/' + student.user_id + '/suspension-email/retry']) assert.equal((await request(base, student, path.endsWith('retry') ? 'POST' : 'GET', path)).status, 403);
  for (const identity of [{ ...student, account_type: 'institution' }, { ...student, email_verified_at: null }, admin]) {
    sql.mock.mockImplementation(async () => [[identity]]);
    assert.equal((await request(base, identity, 'GET', '/enrollment')).status, 403);
  }
});
test('own enrollment never uses a supplied user ID and invalid submissions make no writes', async t => {
  const base = await serve(t), calls = [];
  t.mock.method(pool, 'execute', async (sql, values) => {
    calls.push({ sql, values });
    assert.match(sql, /^SELECT/);
    return sql.includes('FROM users') ? [[student]] : [[{ schoolId, schoolName: 'School', city: 'Taguig' }]];
  });
  const response = await request(base, student, 'GET', '/enrollment?userId=forged');
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const ownQuery = calls.find(call => call.sql.includes('FROM student_enrollments'));
  assert.deepEqual(ownQuery.values, [student.user_id]);
  for (const change of [{ helpful: 'true' }, { usedXloreU: false }, { schoolId: 'fake' }]) assert.equal((await request(base, student, 'PUT', '/enrollment', { ...valid, ...change })).status, 400);
});
test('an old refresh token cannot revive a session after suspend/restore even if its row survived a race', async t => {
  const base = await serve(t);
  t.mock.method(pool, 'execute', async () => [[{ ...student, auth_version: 2 }]]);
  const session = '20000000-0000-4000-8000-000000000001';
  const oldToken = createRefreshToken(student, session);
  assert.equal((await request(base, null, 'POST', '/auth/refresh', { refreshToken: oldToken })).status, 401);
  const newToken = createRefreshToken({ ...student, auth_version: 2 }, session);
  const response = await request(base, null, 'POST', '/auth/refresh', { refreshToken: newToken });
  assert.equal(response.status, 200); assert.equal(verifyAccessToken((await response.json()).accessToken).av, 2);
});
test('admin report omits street addresses, private pins and secrets and charts use full filtered queries', async t => {
  const calls = [];
  t.mock.method(pool, 'execute', async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT COUNT')) return [[{ total: 21, enrolled: 21, assessed: 3, suspended: 1 }]];
    if (sql.includes('u.user_id AS id')) return [[{ id: student.user_id, name: 'Student', address: 'Private street, Makati', enrollmentCity: null }]];
    return [[{ id: schoolId, label: 'School', count: 21 }]];
  });
  const result = await getStudentReport({ search: 'School', page: '2' });
  assert.equal(result.pagination.pages, 2); assert.equal(result.data[0].city, 'Makati');
  assert.equal(result.data[0].citySource, 'profile_estimate'); assert.ok(!('address' in result.data[0]) && !('home_location' in result.data[0]));
  for (const query of calls.filter(call => call.sql.includes('GROUP BY'))) {
    assert.match(query.sql, /ILIKE \?/); assert.equal(query.values.length, 5); assert.doesNotMatch(query.sql, /OFFSET/);
  }
});
test('schema keeps one report per student, boolean evidence, private RLS and access-token revocation version', () => {
  const sql = readFileSync(new URL('../database/migrations/029_student_enrollment.sql', import.meta.url), 'utf8');
  assert.match(sql, /user_id uuid PRIMARY KEY/); assert.match(sql, /CHECK \(used_xlore_u = TRUE\)/); assert.match(sql, /CHECK \(helpful = TRUE\)/);
  assert.match(sql, /ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY/); assert.match(sql, /ADD COLUMN auth_version/);
  assert.doesNotMatch(sql, /UPDATE users|DELETE FROM|TRUNCATE|DROP TABLE/);
});
test('student suspension email uses escaped private reasons and a stable message ID', async () => {
  await sendStudentSuspensionEmail({ to: 'student@example.test', name: '<Student>', reason: '<script>unsafe</script>', actionId: '42' });
  const sent = sendMail.mock.calls.at(-1).arguments[0];
  assert.equal(sent.to, 'student@example.test'); assert.match(sent.html, /&lt;script&gt;/); assert.doesNotMatch(sent.html, /<script>/);
  assert.equal(sent.messageId, '<xloreu-student-suspension-42@xloreu.com>');
});
test('suspension email does not resend sent/leased notices and cancels restored or superseded notices', async t => {
  t.mock.method(pool, 'execute', async () => [{ affectedRows: 0 }]);
  assert.equal((await deliverStudentSuspensionEmail('42')).status, 'unchanged');
});
for (const state of [{ active: true, id: '42', latest: '42' }, { active: false, id: '42', latest: '43' }]) test('outdated student suspension email is cancelled', async t => {
  const calls = [], before = sendMail.mock.callCount();
  t.mock.method(pool, 'execute', async (sql, values) => { calls.push({ sql, values }); return sql.startsWith('SELECT') ? [[{ ...state, reason: 'Private', email: 'student@example.test' }]] : [{ affectedRows: 1 }]; });
  assert.equal((await deliverStudentSuspensionEmail('42')).status, 'cancelled');
  assert.equal(sendMail.mock.callCount(), before); assert.match(calls.at(-1).sql, /email_state = 'cancelled'/);
});
test('SMTP failure stays safely retryable without storing recipients or provider error bodies', async t => {
  const calls = [];
  t.mock.method(pool, 'execute', async (sql, values) => { calls.push({ sql, values }); return sql.startsWith('SELECT') ? [[{ active: false, id: '42', latest: '42', reason: 'Private', email: 'student@example.test', name: 'Student' }]] : [{ affectedRows: 1 }]; });
  sendMail.mock.mockImplementationOnce(async () => { throw new Error('private provider message'); });
  assert.equal((await deliverStudentSuspensionEmail('42')).status, 'failed');
  assert.match(calls.at(-1).sql, /DELIVERY_FAILED/); assert.ok(!JSON.stringify(calls.at(-1)).includes('student@example.test'));
});
