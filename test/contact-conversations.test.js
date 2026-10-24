import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable'; process.env.NODE_ENV = 'test'; process.env.EMAIL_ENABLED = 'false';
const { app } = await import('../src/app.js');
const { pool, rawPool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const { ADMIN_EMAIL } = await import('../src/utils/admin-access.js');
const { getContactConversation, listOwnContacts, replyToContact, replyCursor, validateContactReply } = await import('../src/services/contact-messages.js');
const account = type => ({ user_id: randomUUID(), email: 'person@example.test', full_name: 'Demo Student', account_type: type, email_verified_at: new Date() });
const admin = () => ({ ...account('student'), email: ADMIN_EMAIL });
const headers = user => ({ Authorization: 'Bearer ' + createAccessToken(user), 'Content-Type': 'application/json' });
const draft = () => ({ message: 'Thank you for helping.', requestId: randomUUID() });
function identity(t, user) { t.mock.method(pool, 'execute', async sql => { assert.match(sql, /FROM users/); return [[user]]; }); }
async function serverFor(t) {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api`;
}
test('reply validation bounds plain text and UUID retries, while cursors reject injection and unsafe integers', () => {
  const item = draft(); assert.deepEqual(validateContactReply({ ...item, message: '  Hello\nAdmin  ', authorType: 'admin' }), { ...item, message: 'Hello\nAdmin' });
  for (const message of ['', '   ', null, {}, 'a'.repeat(3001), 'Hi\u0000there']) assert.throws(() => validateContactReply({ ...item, message }));
  assert.equal(validateContactReply({ ...item, message: '😀' }).message, '😀');
  assert.equal(validateContactReply({ ...item, message: 'a'.repeat(3000) }).message.length, 3000);
  assert.throws(() => validateContactReply({ ...item, requestId: 'bad' }));
  for (const value of ['0', '-1', '1.5', '1 OR 1=1', '9223372036854775808', ['1']]) assert.throws(() => replyCursor(value));
  assert.equal(replyCursor('9223372036854775807'), '9223372036854775807'); assert.equal(replyCursor(undefined), null);
});
test('conversation schema preserves old requests/notices, locks notification shape and adds private reply deduplication', () => {
  const sql = readFileSync('database/migrations/031_contact_conversations.sql', 'utf8');
  for (const phrase of ['ENABLE ROW LEVEL SECURITY', 'UNIQUE (message_id, author_id, request_id)', 'REFERENCES contact_messages(message_id) ON DELETE CASCADE', 'REFERENCES contact_replies(reply_id) ON DELETE CASCADE', 'contact_reply_notice_once', 'contact_reply_id IS NOT NULL', 'contact_reply_id IS NULL', "kind = 'institution_suspended'", "kind IN ('comment', 'reply')"]) assert.ok(sql.includes(phrase), phrase);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|DROP TABLE|INSERT INTO|CREATE POLICY/);
});
test('anonymous and unverified accounts cannot read conversations or send replies', async t => {
  const base = await serverFor(t), user = { ...account('student'), email_verified_at: null }, id = randomUUID();
  identity(t, user);
  const db = t.mock.method(pool, 'query', async () => { throw new Error('Must not read messages'); });
  for (const path of ['/contact', `/contact/${id}`, `/admin/messages/${id}`]) {
    assert.equal((await fetch(base + path)).status, 401);
    assert.equal((await fetch(base + path, { headers: headers(user) })).status, 403);
  }
  for (const path of [`/contact/${id}/replies`, `/admin/messages/${id}/replies`]) assert.equal((await fetch(base + path, { method: 'POST', headers: headers(user), body: JSON.stringify(draft()) })).status, 403);
  assert.equal(db.mock.callCount(), 0);
});
test('student and institution identities cannot use admin conversation routes or impersonate the admin', async t => {
  const base = await serverFor(t);
  const connect = t.mock.method(rawPool, 'connect', async () => { throw new Error('No reply transaction allowed'); });
  for (const type of ['student', 'institution']) {
    const user = account(type); identity(t, user);
    const path = `/admin/messages/${randomUUID()}`;
    assert.equal((await fetch(base + path, { headers: headers(user) })).status, 403);
    assert.equal((await fetch(base + path + '/replies', { method: 'POST', headers: headers(user), body: JSON.stringify({ ...draft(), role: 'admin' }) })).status, 403);
  }
  assert.equal(connect.mock.callCount(), 0);
});
test('own conversation lists derive ownership from auth, not supplied account IDs', async t => {
  const base = await serverFor(t), user = account('institution'); identity(t, user);
  t.mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /WHERE sender_id = \?/); assert.equal(values[0], user.user_id);
    if (sql.includes('count(*)')) return [[{ total: 25 }]];
    assert.deepEqual(values.slice(-2), [20, 20]); assert.ok(!sql.includes('accountEmail'));
    return [[{ id: randomUUID(), preview: 'Help with my school', status: 'read' }]];
  });
  const response = await fetch(base + '/contact?page=2&senderId=forged', { headers: headers(user) });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json(); assert.equal(body.page, 2); assert.equal(body.total, 25);
});
test('another account cannot inspect a thread or its replies; authorization fails before reading replies', async () => {
  const calls = [], user = account('student'), messageId = randomUUID();
  const connection = { query: async (sql, values) => { calls.push(sql); assert.match(sql, /AND sender_id = \?/); assert.deepEqual(values, [messageId, user.user_id]); return [[]]; } };
  await assert.rejects(getContactConversation(connection, user, messageId), /Conversation not found/);
  assert.equal(calls.length, 1);
});
test('owner and admin reads paginate newest replies using string IDs without exposing author account details', async () => {
  for (const user of [account('student'), account('institution'), admin()]) {
    const messageId = randomUUID(); let call = 0;
    const connection = { query: async (sql, values) => {
      if (++call === 1) {
        if (user.email !== ADMIN_EMAIL) { assert.match(sql, /AND sender_id = \?/); assert.equal(values[1], user.user_id); }
        else { assert.ok(!sql.includes('AND sender_id')); assert.deepEqual(values, [messageId]); }
        return [[{ id: messageId, message: 'Original message' }]];
      }
      assert.match(sql, /reply_id < \? ORDER BY reply_id DESC LIMIT 31/); assert.deepEqual(values, [messageId, '100']);
      assert.ok(!sql.includes('author_id,') && !sql.includes('email'));
      return [Array.from({ length: 31 }, (_, index) => ({ id: String(99 - index), authorType: 'admin', message: 'Private reply' }))];
    } };
    const result = await getContactConversation(connection, user, messageId, '100');
    assert.equal(result.replies.length, 30); assert.equal(result.replies[0].id, '70'); assert.equal(result.replies[29].id, '99'); assert.equal(result.nextCursor, '70');
  }
});
test('admin reply notifies only the original account and stores a content-free audit entry', async () => {
  const user = admin(), messageId = randomUUID(), owner = randomUUID(), item = draft(), calls = [];
  const connection = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT')) { assert.match(sql, /FOR UPDATE/); return [[{ message_id: messageId, sender_id: owner }]]; }
      assert.deepEqual(values, [messageId, user.user_id, 'admin', item.requestId, item.message]); return [{ affectedRows: 1, rows: [{ id: '17' }] }];
    }, execute: async (sql, values) => { calls.push({ sql, values }); return [{ affectedRows: 1 }]; }
  };
  assert.deepEqual(await replyToContact(connection, user, messageId, item), { submitted: true, alreadySubmitted: false });
  const update = calls.find(call => call.sql.startsWith('UPDATE')); assert.equal(update.values[0], 'read');
  const notice = calls.find(call => call.sql.includes('INSERT INTO community_notifications'));
  assert.match(notice.sql, /SELECT sender_id/); assert.match(notice.sql, /ON CONFLICT DO NOTHING/); assert.equal(notice.values[2], messageId);
  for (const call of calls.filter(call => /community_notifications|admin_audit_log/.test(call.sql))) assert.ok(!call.values.includes(item.message));
});
test('student/institution replies are owner-scoped, reopen the thread and notify only participating verified administrators', async () => {
  for (const type of ['student', 'institution']) {
    const user = account(type), messageId = randomUUID(), item = draft(), calls = [];
    const connection = {
      query: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.startsWith('SELECT')) { assert.match(sql, /AND sender_id = \? FOR UPDATE/); assert.deepEqual(values, [messageId, user.user_id]); return [[{ message_id: messageId, sender_id: user.user_id }]]; }
        assert.equal(values[2], type); return [{ affectedRows: 1, rows: [{ id: '18' }] }];
      }, execute: async (sql, values) => { calls.push({ sql, values }); return [{ affectedRows: 1 }]; }
    };
    await replyToContact(connection, user, messageId, item);
    assert.equal(calls.find(call => call.sql.startsWith('UPDATE')).values[0], 'new');
    const notice = calls.find(call => call.sql.includes('INSERT INTO community_notifications'));
    for (const fragment of ["p.author_type = 'admin'", 'p.message_id = ?', 'u.is_active = TRUE', 'u.email_verified_at IS NOT NULL', 'lower(u.email) = ?', 'SELECT DISTINCT']) assert.ok(notice.sql.includes(fragment));
    assert.equal(notice.values.at(-1), ADMIN_EMAIL);
    assert.ok(!calls.some(call => call.sql.includes('admin_audit_log')));
  }
});
test('cross-account reply attempts and duplicate retries cannot update status, send notices or overwrite replies', async () => {
  const user = account('student'), id = randomUUID(), item = draft(); let writes = 0;
  await assert.rejects(replyToContact({ query: async () => [[]], execute: async () => { writes++; } }, user, id, item), /not found/);
  const connection = { query: async sql => sql.startsWith('SELECT') ? [[{ sender_id: user.user_id }]] : [{ affectedRows: 0 }], execute: async () => { writes++; } };
  assert.deepEqual(await replyToContact(connection, user, id, item), { submitted: true, alreadySubmitted: true });
  assert.equal(writes, 0);
});
test('admin reply route commits reply, status, notification and audit together; notification failure rolls everything back', async t => {
  const base = await serverFor(t), user = admin(); identity(t, user);
  const calls = []; let fail = false;
  t.mock.method(rawPool, 'connect', async () => ({ release() { calls.push('release'); }, async query(sql) {
    calls.push(sql);
    if (sql.includes('FOR UPDATE')) return { command: 'SELECT', rows: [{ sender_id: randomUUID() }] };
    if (sql.includes('INSERT INTO contact_replies')) return { command: 'INSERT', rowCount: 1, rows: [{ id: '24' }] };
    if (sql.includes('INSERT INTO community_notifications') && fail) { const error = new Error('Notification could not be saved'); error.status = 503; throw error; }
    return { command: sql.split(' ')[0], rowCount: 1, rows: [] };
  } }));
  const send = () => fetch(base + `/admin/messages/${randomUUID()}/replies`, { method: 'POST', headers: headers(user), body: JSON.stringify({ ...draft(), recipientId: randomUUID(), authorType: 'student' }) });
  assert.equal((await send()).status, 201);
  for (const pattern of ['INSERT INTO contact_replies', 'UPDATE contact_messages', 'INSERT INTO community_notifications', 'INSERT INTO admin_audit_log', 'COMMIT']) assert.ok(calls.some(sql => sql.includes(pattern)));
  assert.equal(calls.at(-1), 'release'); calls.length = 0; fail = true;
  assert.equal((await send()).status, 503); assert.ok(calls.includes('ROLLBACK')); assert.ok(!calls.includes('COMMIT'));
});
test('invalid replies fail before transactions and reply attempts are rate-limited by account', async t => {
  const base = await serverFor(t), user = account('student'); identity(t, user);
  const connect = t.mock.method(rawPool, 'connect', async () => ({ release() {}, async query(sql) {
    if (sql.includes('FOR UPDATE')) return { command: 'SELECT', rows: [{ sender_id: user.user_id }] };
    if (sql.includes('INSERT INTO contact_replies')) return { command: 'INSERT', rowCount: 1, rows: [{ id: '25' }] };
    return { command: sql.split(' ')[0], rowCount: 1, rows: [] };
  } }));
  const send = item => fetch(base + `/contact/${randomUUID()}/replies`, { method: 'POST', headers: headers(user), body: JSON.stringify(item) });
  assert.equal((await send({ ...draft(), message: ' ' })).status, 400); assert.equal(connect.mock.callCount(), 0);
  for (let index = 0; index < 29; index++) assert.equal((await send(draft())).status, 201);
  const response = await send(draft()); assert.equal(response.status, 429); assert.match((await response.json()).error.message, /wait/);
});
test('own-history invalid pagination does not query the database', async () => {
  let touched = false;
  await assert.rejects(listOwnContacts({ query: async () => { touched = true; } }, randomUUID(), '-1'));
  assert.equal(touched, false);
});
