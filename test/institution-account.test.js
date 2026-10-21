import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable'; process.env.NODE_ENV = 'test';
const { app } = await import('../src/app.js');
const { rawPool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const { validateInstitutionName, validateInstitutionPassword } = await import('../src/services/institution-account.js');
const currentPassword = 'FixtureOldPassword123!', newPassword = 'FixtureNewPassword123!';
const currentHash = await bcrypt.hash(currentPassword, 4);
const schoolId = '40000000-0000-4000-8000-000000000001';
const user = { user_id: '10000000-0000-4000-8000-000000000001', email: 'staff@example.test', full_name: 'Fixture Representative', account_type: 'institution', email_verified_at: new Date(), password_hash: currentHash };
const passwordBody = { currentPassword, newPassword, confirmPassword: newPassword };

async function fixture(t, identity = user, options = {}) {
  const calls = [];
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    const select = rows => ({ command: 'SELECT', rows });
    if (sql.includes('FROM users WHERE user_id')) return select(identity ? [identity] : []);
    if (sql.includes('FROM institution_applications ia')) return select([{ user_id: user.user_id, school_id: schoolId, status: options.status ?? 'approved', is_active_available: options.active !== false, proposed_school: { name: 'Pending School' } }]);
    if (sql.startsWith('SELECT school_name, city_district')) return select([{ school_name: 'Fixture University', city_district: 'Taguig' }]);
    if (sql.includes('LOWER(school_name)')) return select(options.duplicate ? [{ school_id: 'other-school' }] : []);
    if (sql.startsWith('SELECT school_id AS id')) return select([{ id: schoolId, name: 'Fixture University' }]);
    return { command: 'UPDATE', rowCount: 1, rows: [] };
  };
  t.mock.method(rawPool, 'query', query);
  t.mock.method(rawPool, 'connect', async () => ({ query, release() {} }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (method, path = '/institutions/account', body) => fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
    headers: { ...(identity ? { Authorization: 'Bearer ' + createAccessToken(identity) } : {}), 'Content-Type': 'application/json' },
    ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}) });
  return { request, calls };
}
test('institution names normalize whitespace and enforce 190-character text boundaries', () => {
  assert.equal(validateInstitutionName('  Example   University '), 'Example University');
  assert.equal(validateInstitutionName('x'.repeat(190)).length, 190);
  for (const value of [null, {}, [], '', '   ', 'x'.repeat(191)]) assert.throws(() => validateInstitutionName(value));
});
test('institution password validates current, confirmation, changed value, 8–72 characters and UTF-8 byte limit', () => {
  assert.equal(validateInstitutionPassword(passwordBody).newPassword, newPassword);
  assert.equal(validateInstitutionPassword({ ...passwordBody, newPassword: 'é'.repeat(36), confirmPassword: 'é'.repeat(36) }).newPassword.length, 36);
  for (const change of [{ currentPassword: '' }, { currentPassword: {} }, { newPassword: 'short', confirmPassword: 'short' }, { confirmPassword: 'mismatch' }, { newPassword: currentPassword, confirmPassword: currentPassword }, { newPassword: 'x'.repeat(73), confirmPassword: 'x'.repeat(73) }, { newPassword: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }]) assert.throws(() => validateInstitutionPassword({ ...passwordBody, ...change }));
});
test('account routes reject visitors, students and unverified institutions before any mutations', async t => {
  for (const identity of [null, { ...user, account_type: 'student' }, { ...user, email_verified_at: null }]) {
    const f = await fixture(t, identity);
    for (const [method, path, body] of [['GET', '/institutions/account'], ['PATCH', '/institutions/account', { schoolName: 'Rename', expectedName: 'Fixture University' }], ['POST', '/institutions/account/password', passwordBody]]) {
      assert.equal((await f.request(method, path, body)).status, identity ? 403 : 401);
    }
    assert.ok(!f.calls.some(call => /^(UPDATE|INSERT)/.test(call.sql)));
  }
});
test('account settings expose only own school identity and never return password hash or evidence', async t => {
  const f = await fixture(t);
  const response = await f.request('GET', '/institutions/account?schoolId=forged&userId=forged');
  const data = await response.json();
  assert.equal(data.canRename, true); assert.equal(data.school.id, schoolId); assert.equal(data.email, user.email);
  assert.ok(!JSON.stringify(data).includes(currentHash)); assert.ok(!('verificationNote' in data));
});
test('pending, suspended and inactive institutions cannot rename their assigned school', async t => {
  for (const options of [{ status: 'pending' }, { status: 'suspended' }, { active: false }]) {
    const f = await fixture(t, user, options);
    assert.equal((await (await f.request('GET')).json()).canRename, false);
    assert.equal((await f.request('PATCH', undefined, { schoolName: 'Rename', expectedName: 'Fixture University' })).status, 403);
    assert.ok(!f.calls.some(call => call.sql.startsWith('UPDATE schools')));
  }
});
test('rename scopes to authenticated owner, audits name change and leaves school ID/ownership/email unchanged', async t => {
  const f = await fixture(t);
  const response = await f.request('PATCH', undefined, { schoolName: 'Renamed Fixture University', expectedName: 'Fixture University', schoolId: 'forged', userId: 'forged', email: 'forged@example.test', role: 'admin' });
  assert.equal(response.status, 200);
  const update = f.calls.find(call => call.sql.startsWith('UPDATE schools'));
  assert.deepEqual(update.values, ['Renamed Fixture University', schoolId]);
  assert.ok(!f.calls.some(call => call.sql.startsWith('UPDATE users') || call.sql.startsWith('UPDATE institution_applications')));
  assert.ok(f.calls.some(call => call.sql.includes('INSERT INTO admin_audit_log') && call.values.includes('institution_renamed')));
});
test('stale names and same-city duplicates are rejected without overwriting anything', async t => {
  for (const [options, expectedName] of [[{}, 'Old name'], [{ duplicate: true }, 'Fixture University']]) {
    const f = await fixture(t, user, options);
    assert.equal((await f.request('PATCH', undefined, { schoolName: 'Duplicate', expectedName })).status, 409);
    assert.ok(!f.calls.some(call => call.sql.startsWith('UPDATE schools')));
  }
});
test('wrong current password, confirmation and byte-limit errors cannot update credentials', async t => {
  const f = await fixture(t);
  for (const change of [{ currentPassword: 'WrongPassword123!' }, { confirmPassword: 'mismatch' }, { newPassword: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }]) assert.equal((await f.request('POST', '/institutions/account/password', { ...passwordBody, ...change })).status, 400);
  assert.ok(!f.calls.some(call => call.sql.startsWith('UPDATE')));
});
test('password update hashes safely, clears reset codes, revokes only own refresh sessions and logs no secrets', async t => {
  const f = await fixture(t, user, { status: 'pending' });
  const response = await f.request('POST', '/institutions/account/password', { ...passwordBody, userId: 'forged' });
  assert.equal(response.status, 200); const data = await response.json(); assert.equal(data.signInAgain, true);
  assert.ok(!JSON.stringify(data).includes(newPassword));
  const update = f.calls.find(call => call.sql.startsWith('UPDATE users'));
  assert.equal(await bcrypt.compare(newPassword, update.values[0]), true); assert.notEqual(update.values[0], newPassword);
  assert.equal(update.values[1], user.user_id); assert.ok(update.sql.includes('password_reset_code_hash = NULL'));
  assert.deepEqual(f.calls.find(call => call.sql.startsWith('UPDATE user_sessions')).values, [user.user_id]);
  const audit = f.calls.find(call => call.sql.includes('INSERT INTO admin_audit_log'));
  assert.ok(!JSON.stringify(audit).includes(currentPassword) && !JSON.stringify(audit).includes(newPassword));
});
test('generic student profile endpoint cannot bypass institution settings validation', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('PATCH', '/auth/me', { newPassword: 'x'.repeat(100), currentPassword })).status, 403);
  assert.ok(!f.calls.some(call => call.sql.startsWith('UPDATE')));
});
