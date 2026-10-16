import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { requirePolicyAcceptance, ACCOUNT_POLICY_VERSION } from '../src/services/account-policies.js';

process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable';
process.env.NODE_ENV = 'test';
process.env.EMAIL_ENABLED = 'true';
process.env.SMTP_HOST = 'mail.example.test';
process.env.SMTP_USER = 'mail@example.test';
process.env.SMTP_PASS = 'test-only';
process.env.EMAIL_FROM = 'mail@example.test';
process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
const nodemailer = (await import('nodemailer')).default;
const sendMail = mock.fn(async () => ({ messageId: 'test-only-no-message-sent' }));
mock.method(nodemailer, 'createTransport', () => ({ sendMail }));
const { app } = await import('../src/app.js');
const { pool, rawPool } = await import('../src/db/pool.js');
const { googleClient } = await import('../src/services/google-auth.js');
const agreement = { acceptedPolicies: true, policyVersion: ACCOUNT_POLICY_VERSION };
const registration = { firstName: 'Ana', middleName: '', lastName: 'Santos', address: 'Taguig City',
  email: 'student@example.test', password: 'test-password', confirmPassword: 'test-password' };

async function serve(t) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api/auth`;
}

test('policy acceptance must be literal true and use the current published version', () => {
  for (const acceptedPolicies of [undefined, null, false, 'true', 'on', 1, [], {}]) {
    assert.throws(() => requirePolicyAcceptance({ ...agreement, acceptedPolicies }), error => error.status === 400);
  }
  assert.throws(() => requirePolicyAcceptance({ ...agreement, policyVersion: 'old' }), error => error.status === 409);
  assert.equal(requirePolicyAcceptance(agreement), ACCOUNT_POLICY_VERSION);
});

for (const [label, acceptance, status] of [['missing', {}, 400], ['unchecked', { ...agreement, acceptedPolicies: false }, 400], ['stale', { ...agreement, policyVersion: 'old' }, 409]]) {
  test(`email registration rejects ${label} acceptance before database writes or email delivery`, async t => {
    const db = t.mock.method(pool, 'execute', async () => { throw new Error('Unexpected SQL'); });
    const before = sendMail.mock.callCount();
    const response = await fetch(await serve(t) + '/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...registration, ...acceptance }) });
    assert.equal(response.status, status);
    assert.equal(db.mock.callCount(), 0);
    assert.equal(sendMail.mock.callCount(), before);
  });
}

test('email registration saves the accepted version with a server timestamp, never a client-provided time', async t => {
  let inserted = false;
  t.mock.method(pool, 'execute', async (sql, values) => {
    if (sql.startsWith('SELECT')) return [[]];
    assert.match(sql, /INSERT INTO users/);
    assert.match(sql, /policy_version, policy_accepted_at/);
    assert.match(sql, /\?, CURRENT_TIMESTAMP\)/);
    assert.equal(values.at(-1), ACCOUNT_POLICY_VERSION);
    assert.ok(!values.includes('1900-01-01'));
    inserted = true;
    return [{ affectedRows: 1 }];
  });
  const before = sendMail.mock.callCount();
  const response = await fetch(await serve(t) + '/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...registration, ...agreement, policyAcceptedAt: '1900-01-01' }) });
  assert.equal(response.status, 201);
  assert.ok(inserted);
  assert.equal(sendMail.mock.callCount(), before + 1);
});

for (const [label, existing, acceptance, status] of [
  ['new account without acceptance', false, {}, 428],
  ['new account with stale acceptance', false, { ...agreement, policyVersion: 'old' }, 409],
  ['new account with affirmative acceptance', false, agreement, 200],
  ['existing account without a new checkbox', true, {}, 200]
]) {
  test(`Google sign-in: ${label}`, async t => {
    t.mock.method(googleClient, 'verifyIdToken', async () => ({ getPayload: () => ({ sub: 'google-test', email: 'student@gmail.com', email_verified: true, given_name: 'Ana', family_name: 'Santos' }) }));
    const calls = [];
    t.mock.method(rawPool, 'connect', async () => ({ query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('SELECT * FROM users')) return { command: 'SELECT', rows: existing ? [{ user_id: '00000000-0000-4000-8000-000000000099', email: 'student@gmail.com', full_name: 'Ana Santos', is_active: true, email_verified_at: new Date() }] : [] };
      return { command: 'INSERT', rowCount: 1, rows: [] };
    }, release() {} }));
    const response = await fetch(await serve(t) + '/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: 'test-only', ...acceptance }) });
    assert.equal(response.status, status);
    const insert = calls.find(call => /INSERT INTO users/.test(call.sql));
    if (status !== 200) {
      assert.equal(calls.at(-1).sql, 'ROLLBACK');
      assert.ok(!insert && !calls.some(call => /INSERT INTO user_sessions/.test(call.sql)));
      if (status === 428) assert.equal((await response.json()).error.details.code, 'POLICY_ACCEPTANCE_REQUIRED');
    } else if (existing) {
      assert.ok(!insert);
      assert.ok(!calls.some(call => /UPDATE users.*policy_version/s.test(call.sql)));
    } else {
      assert.match(insert.sql, /policy_version, policy_accepted_at/);
      assert.match(insert.sql, /\$8, CURRENT_TIMESTAMP\)/);
      assert.equal(insert.values.at(-1), ACCOUNT_POLICY_VERSION);
      assert.equal(calls.at(-1).sql, 'COMMIT');
    }
  });
}

test('acceptance schema preserves existing accounts and does not backfill consent', () => {
  const sql = readFileSync(new URL('../database/migrations/023_account_policy_acceptance.sql', import.meta.url), 'utf8');
  assert.match(sql, /ADD COLUMN policy_accepted_at timestamptz/);
  assert.match(sql, /users_policy_acceptance_pair/);
  assert.doesNotMatch(sql, /UPDATE users|DELETE FROM|NOT NULL DEFAULT|DROP TABLE/);
});
