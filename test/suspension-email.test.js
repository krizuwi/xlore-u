import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable'; process.env.NODE_ENV = 'test'; process.env.EMAIL_ENABLED = 'true';
process.env.SMTP_HOST = 'mail.example.test'; process.env.SMTP_USER = 'mail@example.test'; process.env.SMTP_PASS = 'test';
const mail = mock.fn(async () => ({ accepted: ['staff@example.test'] }));
mock.method((await import('nodemailer')).default, 'createTransport', () => ({ sendMail: mail }));
const { rawPool } = await import('../src/db/pool.js');
const { deliverSuspensionEmail } = await import('../src/services/suspension-email.js');
const { createModerationNotice } = await import('../src/services/moderation-notices.js');
const notice = { id: '41', latest: '41', status: 'suspended', email: 'staff@example.test', name: '<Name>', school: '<School>', reason: '<script>reason</script>\nContact the office.' };
function database(t, item = notice, claim = 1) {
  const calls = [];
  t.mock.method(rawPool, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT')) return { command: 'SELECT', rows: item ? [item] : [] };
    return { command: 'UPDATE', rowCount: sql.includes('RETURNING notification_id') ? claim : 1, rows: [] };
  });
  return calls;
}
test('suspension email uses stored recipient/reason, escaped HTML and stable message ID', async t => {
  const calls = database(t), before = mail.mock.callCount();
  assert.deepEqual(await deliverSuspensionEmail('41'), { status: 'sent' });
  assert.equal(mail.mock.callCount(), before + 1);
  const message = mail.mock.calls.at(-1).arguments[0];
  assert.equal(message.to, notice.email); assert.equal(message.messageId, '<xloreu-suspension-41@xloreu.com>');
  assert.ok(message.text.includes(notice.reason)); assert.ok(message.html.includes('&lt;script&gt;reason&lt;/script&gt;'));
  assert.ok(!message.html.includes('<script>'));
  assert.match(calls[0].sql, /state IN \('pending', 'failed'\)/);
  assert.match(calls.at(-1).sql, /state = 'sent'.*lease_token = \$2/);
});
test('a sent or actively leased email is not sent again', async t => {
  const calls = database(t, notice, 0), before = mail.mock.callCount();
  assert.deepEqual(await deliverSuspensionEmail('41'), { status: 'unchanged' });
  assert.equal(calls.length, 1); assert.equal(mail.mock.callCount(), before);
});
for (const item of [null, { ...notice, status: 'approved' }, { ...notice, latest: '42' }]) test('restored or superseded suspension email is cancelled', async t => {
  const calls = database(t, item), before = mail.mock.callCount();
  assert.deepEqual(await deliverSuspensionEmail('41'), { status: 'cancelled' });
  assert.match(calls.at(-1).sql, /state = 'cancelled'/); assert.equal(mail.mock.callCount(), before);
});
test('SMTP rejection records a safe retryable failure without recipient or reason in error state', async t => {
  const calls = database(t); t.mock.method(console, 'error', () => {});
  mail.mock.mockImplementationOnce(async () => ({ accepted: [], rejected: ['staff@example.test'] }));
  assert.deepEqual(await deliverSuspensionEmail('41'), { status: 'failed' });
  const update = calls.at(-1);
  assert.match(update.sql, /state = 'failed'.*DELIVERY_FAILED/);
  assert.ok(!JSON.stringify(update).includes(notice.email) && !JSON.stringify(update).includes(notice.reason));
});
test('private notice suppresses self-notification and binds recipient from server data', async () => {
  const calls = [], connection = { execute: async (sql, values) => { calls.push({ sql, values }); return [{ rows: [{ id: '41' }] }]; } };
  const input = { recipientId: 'owner', actorId: 'admin', postId: 'post', commentId: 'comment', kind: 'comment_hidden', reason: 'Review the community rules', title: 'Post title', school: 'School' };
  assert.equal(await createModerationNotice(connection, input), '41');
  assert.deepEqual(calls[0].values, ['owner', 'admin', 'post', 'comment', null, 'comment_hidden', input.reason, 'Post title', 'School']);
  assert.equal(await createModerationNotice(connection, { ...input, recipientId: 'admin' }), null); assert.equal(calls.length, 1);
});
