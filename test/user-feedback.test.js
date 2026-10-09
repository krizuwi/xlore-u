import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";

process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable';
process.env.NODE_ENV = 'test';
process.env.EMAIL_ENABLED = 'false';
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const { validateFeedback, feedbackReportFilters } = await import('../src/services/user-feedback.js');
const { getFeedbackRelease, createFeedbackReleaseResolver } = await import('../src/services/feedback-release.js');
const student = { user_id: '00000000-0000-4000-8000-000000000099', email: 'feedback@example.test', full_name: 'Feedback Tester', email_verified_at: new Date() };
const admin = { ...student, email: 'unicourse02@gmail.com' };
const schoolId = '40000000-0000-4000-8000-000000000001';
const releaseId = await getFeedbackRelease();
const valid = { section: 'assessment', rating: 5, comment: 'Useful results', releaseId };
async function serverFor(t) {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api`;
}
const headers = { Authorization: `Bearer ${createAccessToken(student)}`, 'Content-Type': 'application/json' };
function identity(t, user = student) {
  t.mock.method(pool, 'execute', async sql => {
    if (sql.includes('FROM users')) return [[user]];
    if (sql.includes('FROM schools')) return [[{ school_id: schoolId }]];
    throw new Error(`Unexpected query: ${sql}`);
  });
}
test('feedback accepts only integer stars 1–5, valid sections, bounded plain-text comments, and school context', () => {
  for (const rating of [1, 2, 3, 4, 5]) assert.equal(validateFeedback({ ...valid, rating }).rating, rating);
  for (const rating of [0, 6, 2.5, '5', null, undefined]) assert.throws(() => validateFeedback({ ...valid, rating }), /1 and 5/);
  for (const section of ['program', 'admin', null]) assert.throws(() => validateFeedback({ ...valid, section }), /section/);
  assert.equal(validateFeedback({ ...valid, comment: '  hello\nworld  ' }).comment, 'hello\nworld');
  assert.equal(validateFeedback({ ...valid, comment: undefined }).comment, '');
  assert.equal(validateFeedback({ ...valid, comment: 'a'.repeat(1000) }).comment.length, 1000);
  for (const comment of ['a'.repeat(1001), {}, null]) assert.throws(() => validateFeedback({ ...valid, comment }));
  assert.throws(() => validateFeedback({ ...valid, section: 'school' }), /school/);
  assert.throws(() => validateFeedback({ ...valid, schoolId }), /school section/);
  assert.equal(validateFeedback({ ...valid, section: 'school', schoolId }).schoolId, schoolId);
  assert.throws(() => validateFeedback({ ...valid, releaseId: 'arbitrary-update' }), /release/);
});
test('feedback schema enforces per-account per-section per-release uniqueness, stars, foreign keys and RLS', () => {
  const sql = fs.readFileSync('database/migrations/016_user_feedback.sql', 'utf8');
  assert.match(sql, /UNIQUE \(user_id, release_id, section\)/);
  assert.match(sql, /CHECK \(rating BETWEEN 1 AND 5\)/);
  assert.match(sql, /REFERENCES users\(user_id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
});
test('anonymous feedback requests are rejected before touching the database', async t => {
  const base = await serverFor(t);
  const db = t.mock.method(pool, 'execute', async () => { throw new Error('Unexpected DB access'); });
  assert.equal((await fetch(base + '/feedback/status')).status, 401);
  assert.equal((await fetch(base + '/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) })).status, 401);
  assert.equal(db.mock.callCount(), 0);
});
test('students cannot read other users feedback or admin summaries', async t => {
  const base = await serverFor(t); identity(t);
  const db = t.mock.method(pool, 'query', async () => { throw new Error('Must not read feedback'); });
  assert.equal((await fetch(base + '/admin/feedback', { headers })).status, 403);
  assert.equal(db.mock.callCount(), 0);
});
test('unverified accounts and administrators cannot submit student feedback', async t => {
  const base = await serverFor(t);
  const db = t.mock.method(pool, 'query', async () => { throw new Error('Must not save feedback'); });
  identity(t, { ...student, email_verified_at: null });
  assert.equal((await fetch(base + '/feedback', { method: 'POST', headers, body: JSON.stringify(valid) })).status, 403);
  t.mock.method(pool, 'execute', async () => [[admin]]);
  assert.equal((await fetch(base + '/feedback', { method: 'POST', headers, body: JSON.stringify(valid) })).status, 403);
  assert.equal(db.mock.callCount(), 0);
});
test('status contains only the authenticated account current-cycle sections and never comments', async t => {
  const base = await serverFor(t); identity(t);
  t.mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /WHERE user_id = \? AND release_id = \?/);
    assert.deepEqual(values, [student.user_id, releaseId]);
    return [[{ section: 'map' }]];
  });
  const response = await fetch(base + '/feedback/status?userId=another-user', { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { releaseId, submittedSections: ['map'] });
});
test('concurrent submissions save once per section, keep the original, and ignore forged account fields', async t => {
  const base = await serverFor(t); identity(t);
  const saved = new Map();
  t.mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /ON CONFLICT \(user_id, release_id, section\) DO NOTHING/);
    assert.equal(values[0], student.user_id);
    const key = values.slice(0, 3).join(':');
    const exists = saved.has(key);
    if (!exists) saved.set(key, values);
    return [{ affectedRows: exists ? 0 : 1 }];
  });
  const responses = await Promise.all(Array.from({ length: 3 }, () => fetch(base + '/feedback', {
    method: 'POST', headers, body: JSON.stringify({ ...valid, userId: 'other-user', email: admin.email })
  })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 200, 201]);
  assert.equal(saved.size, 1);
  const changed = await fetch(base + '/feedback', { method: 'POST', headers, body: JSON.stringify({ ...valid, rating: 1, comment: 'overwrite' }) });
  assert.equal((await changed.json()).alreadySubmitted, true);
  assert.equal([...saved.values()][0][4], 5);
  const compare = await fetch(base + '/feedback', { method: 'POST', headers, body: JSON.stringify({ ...valid, section: 'comparison' }) });
  assert.equal(compare.status, 201); assert.equal(saved.size, 2);
});
test('an old or fabricated release is rejected without saving', async t => {
  const base = await serverFor(t); identity(t);
  const db = t.mock.method(pool, 'query', async () => { throw new Error('Unexpected save'); });
  assert.equal((await fetch(base + '/feedback', { method: 'POST', headers, body: JSON.stringify({ ...valid, releaseId: `feedback-${'0'.repeat(32)}` }) })).status, 409);
  assert.equal(db.mock.callCount(), 0);
});
test('school feedback records its context and shares one quota across schools', async t => {
  const base = await serverFor(t); identity(t);
  let original;
  t.mock.method(pool, 'query', async (_sql, values) => {
    const duplicate = Boolean(original);
    if (!duplicate) original = values;
    return [{ affectedRows: duplicate ? 0 : 1 }];
  });
  const first = await fetch(base + '/feedback', { method: 'POST', headers, body: JSON.stringify({ ...valid, section: 'school', schoolId }) });
  assert.equal(first.status, 201); assert.equal(original[3], schoolId);
  const second = await fetch(base + '/feedback', { method: 'POST', headers, body: JSON.stringify({ ...valid, section: 'school', schoolId: '40000000-0000-4000-8000-000000000002' }) });
  assert.equal(second.status, 200); assert.equal(original[3], schoolId);
});
test('feedback for a missing school is rejected without writing a record', async t => {
  const base = await serverFor(t);
  t.mock.method(pool, 'execute', async sql => sql.includes('FROM users') ? [[student]] : [[]]);
  const db = t.mock.method(pool, 'query', async () => { throw new Error('Must not save'); });
  const response = await fetch(base + '/feedback', { method: 'POST', headers, body: JSON.stringify({ ...valid, section: 'school', schoolId }) });
  assert.equal(response.status, 404); assert.equal(db.mock.callCount(), 0);
});
test('admin summaries return ratings, comments, school context, history and bounded pagination', async t => {
  const base = await serverFor(t); identity(t, admin);
  const calls = [];
  t.mock.method(pool, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('AVG(')) return [[{ total: 13, average: 4.2 }]];
    if (sql.includes('GROUP BY')) return [[{ rating: 5, count: 8 }, { rating: 3, count: 5 }]];
    return [[{ id: 'feedback-1', section: 'school', schoolName: 'Example School', rating: 5, comment: '<script>plain text</script>', userName: student.full_name, userEmail: student.email }]];
  });
  const response = await fetch(base + '/admin/feedback?section=school&rating=5&current=1&page=2', { headers });
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.data[0].comment, '<script>plain text</script>');
  assert.equal(body.summary.total, 13); assert.equal(body.pagination.page, 2);
  assert.deepEqual(calls.at(-1).values, ['school', 5, releaseId, 12, 12]);
});
test('report filters reject SQL-like, invalid and unbounded input', () => {
  for (const query of [{ section: 'school OR true' }, { rating: '5 OR 1=1' }, { rating: ['5'] }, { page: ['1'] }, { rating: '0' }, { page: '-1' }, { page: '1.5' }, { page: '999999999' }, { current: 'yes' }]) assert.throws(() => feedbackReportFilters(query));
  assert.equal(feedbackReportFilters({}).page, 1);
});

const manifest = release => new Response(JSON.stringify({ release }), { headers: { 'Content-Type': 'application/json' } });
test('frontend and backend redeployments independently open a new trusted feedback cycle', async () => {
  let time = 0, frontend = 'build-one', count = 0;
  const env = { VERCEL: '1', VERCEL_URL: 'backend-one.vercel.app', FRONTEND_URL: 'https://xlore-u-beta.vercel.app' };
  const fetcher = async url => { count++; assert.equal(String(url), 'https://xlore-u-beta.vercel.app/feedback-release.json'); return manifest(frontend); };
  const resolve = createFeedbackReleaseResolver({ env, fetcher, now: () => time });
  const first = await resolve(env.FRONTEND_URL);
  assert.equal(await resolve('https://attacker.example'), first);
  assert.equal(count, 1);
  time = 60_001; frontend = 'build-two';
  const second = await resolve(env.FRONTEND_URL); assert.notEqual(second, first);
  const redeployed = createFeedbackReleaseResolver({ env: { ...env, VERCEL_URL: 'backend-two.vercel.app' }, fetcher });
  assert.notEqual(await redeployed(env.FRONTEND_URL), second);
});
test('release manifest requests are shared in flight; transient failures keep the last known cycle', async () => {
  let time = 0, calls = 0, fail = false;
  const resolve = createFeedbackReleaseResolver({ env: { VERCEL: '1', VERCEL_URL: 'api', FRONTEND_URL: 'https://frontend.example' }, now: () => time,
    fetcher: async () => { calls++; if (fail) throw new Error('Offline'); return manifest('release-one'); } });
  const results = await Promise.all([resolve(), resolve(), resolve()]);
  assert.equal(calls, 1); assert.equal(new Set(results).size, 1);
  time = 60_001; fail = true; assert.equal(await resolve(), results[0]);
});
test('a missing or invalid release manifest fails safely, while legacy frontend deployments are supported', async () => {
  const env = { VERCEL: '1', VERCEL_URL: 'api', FRONTEND_URL: 'https://frontend.example' };
  for (const fetcher of [async () => { throw new Error('timeout'); }, async () => manifest('x'.repeat(600)), async () => manifest('invalid/release')])
    await assert.rejects(createFeedbackReleaseResolver({ env, fetcher })(), error => error.status === 503);
  assert.match(await createFeedbackReleaseResolver({ env, fetcher: async () => new Response('', { status: 404 }) })(), /^feedback-[a-f0-9]{32}$/);
});
test('local restarts do not reset feedback; an explicit local release change does', async () => {
  const env = { NODE_ENV: 'development', FEEDBACK_RELEASE: 'local-update-1' };
  const first = await createFeedbackReleaseResolver({ env })();
  assert.equal(await createFeedbackReleaseResolver({ env })(), first);
  assert.notEqual(await createFeedbackReleaseResolver({ env: { ...env, FEEDBACK_RELEASE: 'local-update-2' } })(), first);
});
test('an explicit feedback label never hides a new Vercel deployment identity', async () => {
  const env = { VERCEL: '1', VERCEL_URL: 'backend-one.vercel.app', FEEDBACK_RELEASE: 'fixed-label', FRONTEND_URL: 'https://frontend.example' };
  const fetcher = async () => manifest('frontend-build');
  const first = await createFeedbackReleaseResolver({ env, fetcher })();
  const next = await createFeedbackReleaseResolver({ env: { ...env, VERCEL_URL: 'backend-two.vercel.app' }, fetcher })();
  assert.notEqual(first, next);
});
