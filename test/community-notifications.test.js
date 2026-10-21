import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable'; process.env.NODE_ENV = 'test';
const { app } = await import('../src/app.js');
const { rawPool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const { ADMIN_EMAIL } = await import('../src/utils/admin-access.js');
const { notifySchool, notifyStudentReply } = await import('../src/services/community-notifications.js');
const user = { user_id: '10000000-0000-4000-8000-000000000001', email: 'fixture@example.test', account_type: 'student', email_verified_at: new Date() };

async function fixture(t, identity = user, resolve = () => undefined) {
  const calls = [];
  t.mock.method(rawPool, 'query', async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.includes('FROM users WHERE user_id')) return { command: 'SELECT', rows: identity ? [identity] : [] };
    const result = resolve(sql, values);
    if (result) return result;
    if (sql.startsWith('SELECT')) return { command: 'SELECT', rows: sql.includes('AS watermark') ? [{ unreadCount: 3, watermark: '24' }] : [] };
    return { command: 'UPDATE', rowCount: 1 };
  });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (path, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}/api/notifications${path}`, { method,
    headers: { ...(identity ? { Authorization: 'Bearer ' + createAccessToken(identity) } : {}), 'Content-Type': 'application/json' },
    ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}) });
  return { request, calls };
}

test('notification routes reject anonymous and unverified accounts before inbox reads', async t => {
  for (const identity of [null, { ...user, email_verified_at: null }]) {
    const f = await fixture(t, identity);
    for (const [path, method] of [['', 'GET'], ['/read-all', 'PATCH'], ['/1/read', 'PATCH']]) assert.equal((await f.request(path, method, { through: '1' })).status, identity ? 403 : 401);
    assert.ok(!f.calls.some(call => call.sql.includes('community_notifications')));
  }
});
test('each role has a server-selected, recipient-scoped inbox with current visibility checks', async t => {
  for (const [identity, role] of [[user, 'student'], [{ ...user, account_type: 'institution' }, 'institution'], [{ ...user, email: ADMIN_EMAIL }, 'admin']]) {
    const f = await fixture(t, identity);
    assert.equal((await f.request('?recipientId=forged&role=admin')).status, 200);
    const query = f.calls.find(call => call.sql.includes('AS watermark'));
    assert.deepEqual(query.values, [user.user_id, role, role, role]);
    for (const check of ['n.recipient_id = $1', "p.status = 'published'", 'p.hidden_by_admin = FALSE', "ia.status = 'approved'", 'parent.deleted = FALSE', 'own.user_id = n.recipient_id', 'root.user_id = n.recipient_id', 'school_post_likes']) assert.ok(query.sql.includes(check), check);
  }
});
test('inbox uses bounded keyset pagination and string IDs without returning emails or comment text', async t => {
  const f = await fixture(t, user, sql => sql.includes('n.notification_id::text AS id') ? { command: 'SELECT', rows: Array.from({ length: 21 }, (_, index) => ({ id: String(23 - index), kind: 'reply', actor: 'Administrator' })) } : undefined);
  const result = await (await f.request('?before=24')).json();
  assert.equal(result.data.length, 20); assert.equal(result.nextCursor, '4'); assert.equal(result.watermark, '24');
  const query = f.calls.find(call => call.sql.includes('LIMIT 21'));
  assert.equal(query.values.at(-1), '24'); assert.ok(query.sql.includes('n.notification_id < $5'));
  assert.ok(!query.sql.includes('actor.email,') && !query.sql.includes('c.body'));
});
test('invalid cursors are rejected instead of entering SQL', async t => {
  const f = await fixture(t);
  for (const value of ['0', '-1', '1.5', 'x', '9223372036854775808', '1 OR 1=1']) {
    assert.equal((await f.request('?before=' + encodeURIComponent(value))).status, 400);
    assert.equal((await f.request('/read-all', 'PATCH', { through: value })).status, 400);
  }
  assert.ok(!f.calls.some(call => call.sql.includes('community_notifications')));
});
test('mark read cannot target someone else; mark all is bounded by the displayed snapshot', async t => {
  const f = await fixture(t, user, sql => sql.includes('notification_id = $2') ? { command: 'UPDATE', rowCount: 0 } : undefined);
  assert.equal((await f.request('/2/read', 'PATCH', { recipientId: 'forged' })).status, 404);
  assert.equal((await f.request('/read-all', 'PATCH', { through: '24', recipientId: 'forged' })).status, 204);
  const updates = f.calls.filter(call => call.sql.startsWith('UPDATE'));
  assert.deepEqual(updates.map(call => call.values), [[user.user_id, '2'], [user.user_id, '24']]);
  assert.ok(updates[1].sql.includes('notification_id <= $2'));
});
test('notification writers only select the active school owner, verified admin and root-comment student; suppress self/duplicates', async () => {
  const calls = [], connection = { execute: async (sql, values) => { calls.push({ sql, values }); return [{}]; } };
  const post = { post_id: 'post', school_id: 'school' };
  await notifySchool(connection, post, 'actor', 'comment', 'comment');
  await notifyStudentReply(connection, post, 'actor', 'reply', 'parent');
  assert.equal(calls.length, 2);
  for (const call of calls) { assert.ok(call.sql.includes('ON CONFLICT DO NOTHING')); assert.ok(call.sql.includes('<> ?')); }
  assert.ok(calls[0].sql.includes("ia.status = 'approved'")); assert.equal(calls[0].values[4], 'school');
  assert.ok(calls[1].sql.includes('parent.author_is_admin = FALSE'));
  calls.length = 0;
  await notifySchool(connection, post, 'actor', 'reply', 'reply');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].sql.includes('LOWER(u.email) = ?'));
  for (const phrase of ['participation.author_is_admin = TRUE', 'participation.comment_id = c.parent_comment_id', 'participation.parent_comment_id = c.parent_comment_id']) assert.ok(calls[1].sql.includes(phrase));
});

test('private moderation schema preserves existing records, keeps RLS and allows recurring decisions', () => {
  const sql = readFileSync(new URL('../database/migrations/028_private_moderation_notices.sql', import.meta.url), 'utf8');
  for (const phrase of ['institution_suspended', 'post_hidden', 'comment_hidden', 'reason IS NOT NULL', "WHERE kind IN ('comment', 'reply')", 'ENABLE ROW LEVEL SECURITY', 'lease_token', 'institution_notice_emails']) assert.ok(sql.includes(phrase), phrase);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|DROP TABLE|INSERT INTO/);
});
test('notification schema has RLS, ownership foreign keys and deduplication without backfilling historic activity', () => {
  const sql = readFileSync(new URL('../database/migrations/027_community_notifications.sql', import.meta.url), 'utf8');
  for (const phrase of ['ENABLE ROW LEVEL SECURITY', 'recipient_id <> actor_id', 'community_like_notice_once', 'community_comment_notice_once', 'REFERENCES users', 'REFERENCES school_posts', 'REFERENCES school_post_comments']) assert.ok(sql.includes(phrase));
  assert.ok(!sql.includes('INSERT INTO') && !sql.includes('DROP TABLE'));
});
