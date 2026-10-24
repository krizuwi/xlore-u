import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable';
process.env.NODE_ENV = 'test';
process.env.EMAIL_ENABLED = 'false';
const { app } = await import('../src/app.js');
const { pool, rawPool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const { ADMIN_EMAIL } = await import('../src/utils/admin-access.js');
const { contactFilters, listContacts, saveContact, updateContact, validateContact } = await import('../src/services/contact-messages.js');
const valid = { name: 'Demo Student', email: 'contact@example.test', message: 'Please help with my account.', requestId: randomUUID() };
function user(type = 'student') { return { user_id: randomUUID(), email: 'account@example.test', full_name: 'Demo Student', account_type: type, email_verified_at: new Date() }; }
function headers(account) { return { Authorization: `Bearer ${createAccessToken(account)}`, 'Content-Type': 'application/json' }; }
function identity(t, account) {
  t.mock.method(pool, 'execute', async sql => { assert.match(sql, /FROM users/); return [[account]]; });
}
async function serverFor(t) {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api`;
}
test('contact validation trims and bounds each field and rejects invalid types, punctuation in names, control characters, and emails', () => {
  assert.deepEqual(validateContact({ ...valid, name: '  José Student  ', email: ' CONTACT@EXAMPLE.TEST ' }), { ...valid, name: 'José Student', email: 'contact@example.test' });
  for (const body of [null, [], {}, { ...valid, name: 'a' }, { ...valid, name: 'A'.repeat(101) }, { ...valid, name: 'Demo <Student>' }, { ...valid, name: 123 }, { ...valid, email: 'not email' }, { ...valid, email: 'a'.repeat(180) + '@example.test' }, { ...valid, email: ['test@example.test'] }, { ...valid, message: 'short' }, { ...valid, message: 'a'.repeat(3001) }, { ...valid, message: 'Invalid\u0000message' }, { ...valid, requestId: 'not-uuid' }]) assert.throws(() => validateContact(body));
  assert.equal(validateContact({ ...valid, message: 'a'.repeat(3000) }).message.length, 3000);
  assert.equal(validateContact({ ...valid, message: 'Line one\nLine two' }).message, 'Line one\nLine two');
  assert.throws(() => validateContact({ ...valid, message: '😀'.repeat(5) }), /10–3000/);
  assert.throws(() => validateContact({ ...valid, name: '𝒜' }), /2–100/);
});
test('private message migration provides RLS, account ownership, valid statuses, bounds and retry uniqueness', () => {
  const sql = readFileSync('database/migrations/030_contact_messages.sql', 'utf8');
  for (const pattern of [/ENABLE ROW LEVEL SECURITY/, /REFERENCES users\(user_id\) ON DELETE CASCADE/, /UNIQUE \(sender_id, request_id\)/, /'new', 'read', 'closed'/, /BETWEEN 10 AND 3000/]) assert.match(sql, pattern);
  assert.doesNotMatch(sql, /CREATE POLICY|GRANT.*anon/i);
});
test('anonymous submissions and inbox reads are rejected before database access', async t => {
  const base = await serverFor(t);
  const db = t.mock.method(pool, 'execute', async () => { throw new Error('No DB access allowed'); });
  for (const [path, method] of [['/contact', 'POST'], ['/admin/messages', 'GET'], [`/admin/messages/${randomUUID()}`, 'PATCH']]) assert.equal((await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(valid) }) })).status, 401);
  assert.equal(db.mock.callCount(), 0);
});
test('student and institution messages use the authenticated identity, not client-supplied ownership; duplicate retries do not overwrite', async t => {
  const base = await serverFor(t);
  let account = user(), saved = new Map();
  t.mock.method(pool, 'execute', async () => [[account]]);
  t.mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /ON CONFLICT \(sender_id, request_id\) DO NOTHING/);
    assert.equal(values[0], account.user_id); assert.equal(values[2], account.account_type);
    const key = values.slice(0, 2).join(':'); const exists = saved.has(key);
    if (!exists) saved.set(key, values);
    return [{ affectedRows: exists ? 0 : 1 }];
  });
  for (const type of ['student', 'institution']) {
    account = user(type);
    const options = { method: 'POST', headers: headers(account), body: JSON.stringify({ ...valid, userId: randomUUID(), senderType: 'admin' }) };
    const first = await fetch(base + '/contact', options);
    assert.equal(first.status, 201); assert.equal(first.headers.get('cache-control'), 'no-store');
    const second = await fetch(base + '/contact', { ...options, body: JSON.stringify({ ...valid, message: 'Should not overwrite original' }) });
    assert.equal(second.status, 200); assert.equal((await second.json()).alreadySubmitted, true);
  }
  assert.equal(saved.size, 2); for (const values of saved.values()) assert.equal(values[5], valid.message);
});
test('unverified accounts and administrators cannot submit; non-admins cannot list or update private messages', async t => {
  const base = await serverFor(t);
  let account = user();
  t.mock.method(pool, 'execute', async () => [[account]]);
  const db = t.mock.method(pool, 'query', async () => { throw new Error('No message query allowed'); });
  for (const type of ['student', 'institution']) {
    account = user(type);
    assert.equal((await fetch(base + '/admin/messages?role=admin', { headers: headers(account) })).status, 403);
    assert.equal((await fetch(base + `/admin/messages/${randomUUID()}`, { method: 'PATCH', headers: headers(account), body: JSON.stringify({ status: 'closed' }) })).status, 403);
  }
  account = { ...user(), email_verified_at: null };
  assert.equal((await fetch(base + '/contact', { method: 'POST', headers: headers(account), body: JSON.stringify(valid) })).status, 403);
  account = { ...user(), email: ADMIN_EMAIL };
  assert.equal((await fetch(base + '/contact', { method: 'POST', headers: headers(account), body: JSON.stringify(valid) })).status, 403);
  assert.equal(db.mock.callCount(), 0);
});
test('message validation happens before saving and the per-account submission quota is enforced', async t => {
  const base = await serverFor(t), account = user(); identity(t, account);
  const db = t.mock.method(pool, 'query', async () => [{ affectedRows: 1 }]);
  const send = body => fetch(base + '/contact', { method: 'POST', headers: headers(account), body: JSON.stringify(body) });
  assert.equal((await send({ ...valid, message: 'short' })).status, 400);
  assert.equal(db.mock.callCount(), 0);
  for (let i = 0; i < 4; i++) assert.equal((await send({ ...valid, requestId: randomUUID() })).status, 201);
  const limited = await send(valid); assert.equal(limited.status, 429);
  assert.match((await limited.json()).error.message, /wait/);
});
test('admin search uses literal parameterized terms and bounded, validated pagination', async t => {
  assert.deepEqual(contactFilters({}), { search: '', status: 'all', page: 1, pageSize: 20 });
  for (const filters of [{ status: 'deleted' }, { search: ['a'] }, { search: 'a'.repeat(151) }, { page: '0' }, { page: '1.5' }, { page: '-1' }]) assert.throws(() => contactFilters(filters));
  const base = await serverFor(t), account = { ...user(), email: ADMIN_EMAIL }; identity(t, account);
  t.mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /strpos\(lower/); assert.equal(values[2], '%_'); assert.equal(values[3], '%_');
    assert.doesNotMatch(sql, /%_/);
    if (sql.includes('count(*)')) return [[{ total: 23 }]];
    assert.match(sql, /ORDER BY m.updated_at DESC, m.message_id DESC LIMIT \? OFFSET \?/);
    assert.deepEqual(values.slice(-2), [20, 20]); return [[{ id: randomUUID(), message: 'Private test message' }]];
  });
  const response = await fetch(base + '/admin/messages?search=%25_&status=new&page=2', { headers: headers(account) });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const report = await response.json(); assert.equal(report.total, 23); assert.equal(report.page, 2); assert.equal(report.data.length, 1);
});
test('admin status changes validate the record and write a content-free audit entry on the same connection', async () => {
  const messageId = randomUUID(), actorId = randomUUID(), calls = [];
  const connection = { query: async (sql, values) => { calls.push({ sql, values }); return [{ affectedRows: 1 }]; }, execute: async (sql, values) => { calls.push({ sql, values }); } };
  for (const status of ['new', 'read', 'closed']) assert.deepEqual(await updateContact(connection, messageId, status, actorId), { updated: true, status });
  assert.deepEqual(calls[0].values, ['new', actorId, messageId]); assert.deepEqual(calls[1].values, [actorId, messageId, 'Contact message marked new.']);
  assert.match(calls[1].sql, /admin_audit_log/);
  await assert.rejects(updateContact(connection, 'bad-id', 'closed', actorId));
  await assert.rejects(updateContact(connection, messageId, 'deleted', actorId));
  await assert.rejects(updateContact({ query: async () => [{ affectedRows: 0 }] }, messageId, 'closed', actorId), /not found/);
});
test('saving a message does not expose its content or account details in the response', async () => {
  const result = await saveContact({ query: async () => [{ affectedRows: 1 }] }, user(), validateContact(valid));
  assert.deepEqual(result, { submitted: true, alreadySubmitted: false });
  const report = await listContacts({ query: async sql => sql.includes('count(*)') ? [[{ total: 0 }]] : [[]] }, contactFilters({}));
  assert.deepEqual(report, { data: [], total: 0, page: 1, pageSize: 20 });
});
test('admin PATCH commits status and audit together, and missing messages roll back', async t => {
  const base = await serverFor(t), account = { ...user(), email: ADMIN_EMAIL }; identity(t, account);
  const calls = []; let exists = true;
  t.mock.method(rawPool, 'connect', async () => ({
    release() { calls.push('release'); },
    async query(sql, values) {
      calls.push(sql);
      if (sql.startsWith('UPDATE')) {
        assert.deepEqual(values.slice(0, 2), ['read', account.user_id]);
        return { command: 'UPDATE', rowCount: exists ? 1 : 0, rows: [] };
      }
      if (sql.startsWith('INSERT')) {
        assert.match(sql, /admin_audit_log/);
        assert.match(values[2], /^Contact message marked read\.$/);
        return { command: 'INSERT', rowCount: 1, rows: [] };
      }
      return { command: sql, rowCount: 0, rows: [] };
    }
  }));
  const send = () => fetch(base + `/admin/messages/${randomUUID()}`, { method: 'PATCH', headers: headers(account), body: JSON.stringify({ status: 'read' }) });
  const saved = await send(); assert.equal(saved.status, 200); assert.equal(saved.headers.get('cache-control'), 'no-store');
  assert.equal(calls[0], 'BEGIN'); assert.equal(calls[3], 'COMMIT'); assert.equal(calls[4], 'release');
  calls.length = 0; exists = false;
  assert.equal((await send()).status, 404);
  assert.equal(calls[2], 'ROLLBACK'); assert.equal(calls[3], 'release');
  assert.ok(!calls.some(sql => sql.startsWith('INSERT')));
});
