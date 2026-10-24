import { assert } from '../utils/http-error.js';
import { validatePersonalName } from '../utils/identity-validation.js';
import { id } from './admin-validation.js';
import { ADMIN_EMAIL, isAdminUser } from '../utils/admin-access.js';

export const CONTACT_STATUSES = ['new', 'read', 'closed'];
function bounded(value, label, min, max) {
  assert(typeof value === 'string', 400, `${label} must be text.`);
  const result = value.trim();
  // PostgreSQL length() counts code points, while JS/HTML maxLength count UTF-16
  // units. Check both so short emoji/astral text cannot fail a DB minimum later.
  assert(Array.from(result).length >= min && result.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result), 400, `${label} must be ${min}–${max} characters without control characters.`);
  return result;
}
export function validateContact(body) {
  assert(body && typeof body === 'object' && !Array.isArray(body), 400, 'Enter your contact details and message.');
  const name = bounded(body.name, 'Name', 2, 100);
  validatePersonalName(name, 'Name');
  const email = bounded(body.email, 'Email', 3, 190).toLowerCase();
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email), 400, 'Enter a valid email address.');
  return { name, email, message: bounded(body.message, 'Message', 10, 3000), requestId: id(body.requestId) };
}
export function contactFilters(query) {
  const status = query.status ?? 'all';
  assert(status === 'all' || CONTACT_STATUSES.includes(status), 400, 'Choose a valid message status.');
  const search = bounded(query.search ?? '', 'Search', 0, 150);
  const page = String(query.page ?? '1');
  assert(/^[1-9][0-9]{0,5}$/.test(page), 400, 'Choose a valid page.');
  return { status, search, page: Number(page), pageSize: 20 };
}
export function validateContactReply(body) {
  assert(body && typeof body === 'object' && !Array.isArray(body), 400, 'Enter your reply.');
  return { message: bounded(body.message, 'Reply', 1, 3000), requestId: id(body.requestId) };
}
export function replyCursor(value) {
  if (value == null) return null;
  assert(typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n, 400, 'Invalid reply cursor.');
  return value;
}
export async function listOwnContacts(connection, userId, page) {
  const filters = contactFilters({ page });
  const [counts] = await connection.query('SELECT count(*) AS total FROM contact_messages WHERE sender_id = ?', [userId]);
  const [data] = await connection.query(`SELECT message_id AS id, left(message, 160) AS preview, status,
    created_at AS "createdAt", updated_at AS "updatedAt"
    FROM contact_messages WHERE sender_id = ? ORDER BY updated_at DESC, message_id DESC LIMIT ? OFFSET ?`,
  [userId, filters.pageSize, (filters.page - 1) * filters.pageSize]);
  return { data, total: Number(counts[0].total), page: filters.page, pageSize: filters.pageSize };
}
export async function getContactConversation(connection, user, messageId, before = null) {
  id(messageId); replyCursor(before);
  const admin = isAdminUser(user);
  const [threads] = await connection.query(`SELECT message_id AS id, contact_name AS name, contact_email AS email, message,
    sender_type AS "senderType", status, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM contact_messages WHERE message_id = ?${admin ? '' : ' AND sender_id = ?'}`,
  [messageId, ...(admin ? [] : [user.user_id])]);
  assert(threads.length, 404, 'Conversation not found.');
  const [rows] = await connection.query(`SELECT reply_id::text AS id, author_type AS "authorType", body AS message, created_at AS "createdAt"
    FROM contact_replies WHERE message_id = ?${before ? ' AND reply_id < ?' : ''} ORDER BY reply_id DESC LIMIT 31`,
  [messageId, ...(before ? [before] : [])]);
  return { thread: threads[0], replies: rows.slice(0, 30).reverse(), nextCursor: rows.length > 30 ? rows[29].id : null };
}
// The caller uses one transaction for the reply, thread status, notification and audit.
export async function replyToContact(connection, user, messageId, item) {
  id(messageId);
  const admin = isAdminUser(user), authorType = admin ? 'admin' : user.account_type === 'institution' ? 'institution' : 'student';
  const [threads] = await connection.query(`SELECT message_id, sender_id FROM contact_messages
    WHERE message_id = ?${admin ? '' : ' AND sender_id = ?'} FOR UPDATE`, [messageId, ...(admin ? [] : [user.user_id])]);
  assert(threads.length, 404, 'Conversation not found.');
  const [saved] = await connection.query(`INSERT INTO contact_replies (message_id, author_id, author_type, request_id, body)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT (message_id, author_id, request_id) DO NOTHING RETURNING reply_id::text AS id`,
  [messageId, user.user_id, authorType, item.requestId, item.message]);
  if (!saved.affectedRows) return { submitted: true, alreadySubmitted: true };
  const replyId = saved.rows[0].id;
  await connection.execute(`UPDATE contact_messages SET status = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE message_id = ?`,
    [admin ? 'read' : 'new', user.user_id, messageId]);
  if (admin) {
    await connection.execute(`INSERT INTO community_notifications (recipient_id, actor_id, kind, contact_reply_id)
      SELECT sender_id, ?, 'contact_reply', ? FROM contact_messages WHERE message_id = ? AND sender_id <> ?
      ON CONFLICT DO NOTHING`, [user.user_id, replyId, messageId, user.user_id]);
    await connection.execute(`INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, detail)
      VALUES (?, 'reply', 'contact_message', ?, 'Administrator replied to a contact conversation.')`, [user.user_id, messageId]);
  } else {
    // Notify only administrators already participating in this support conversation.
    await connection.execute(`INSERT INTO community_notifications (recipient_id, actor_id, kind, contact_reply_id)
      SELECT DISTINCT p.author_id, ?, 'contact_reply', ? FROM contact_replies p JOIN users u ON u.user_id = p.author_id
      WHERE p.message_id = ? AND p.author_type = 'admin' AND p.author_id <> ?
        AND u.is_active = TRUE AND u.email_verified_at IS NOT NULL AND lower(u.email) = ?
      ON CONFLICT DO NOTHING`, [user.user_id, replyId, messageId, user.user_id, ADMIN_EMAIL]);
  }
  return { submitted: true, alreadySubmitted: false };
}
export async function saveContact(connection, user, item) {
  const [result] = await connection.query(`INSERT INTO contact_messages
    (sender_id, request_id, sender_type, contact_name, contact_email, message)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (sender_id, request_id) DO NOTHING RETURNING message_id`,
  [user.user_id, item.requestId, user.account_type === 'institution' ? 'institution' : 'student', item.name, item.email, item.message]);
  return { submitted: true, alreadySubmitted: result.affectedRows === 0 };
}
export async function listContacts(connection, filters) {
  const { status, search, page, pageSize } = filters;
  // strpos is literal, unlike LIKE: '%' and '_' do not broaden a search.
  const where = `WHERE (? = 'all' OR m.status = ?)
    AND (? = '' OR strpos(lower(concat_ws(' ', m.contact_name, m.contact_email, m.message, u.email, u.full_name)), lower(?)) > 0)`;
  const values = [status, status, search, search];
  const [counts] = await connection.query(`SELECT count(*) AS total FROM contact_messages m JOIN users u ON u.user_id = m.sender_id ${where}`, values);
  const [data] = await connection.query(`SELECT m.message_id AS id, m.contact_name AS name, m.contact_email AS email,
    m.message, m.sender_type AS "senderType", m.status, m.created_at AS "createdAt", m.updated_at AS "updatedAt",
    u.email AS "accountEmail", u.full_name AS "accountName"
    FROM contact_messages m JOIN users u ON u.user_id = m.sender_id ${where}
    ORDER BY m.updated_at DESC, m.message_id DESC LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]);
  return { data, total: Number(counts[0].total), page, pageSize };
}
export async function updateContact(connection, messageId, status, actorId) {
  id(messageId);
  assert(CONTACT_STATUSES.includes(status), 400, 'Choose new, read, or closed.');
  const [result] = await connection.query(`UPDATE contact_messages SET status = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
    WHERE message_id = ? RETURNING message_id`, [status, actorId, messageId]);
  assert(result.affectedRows, 404, 'Message not found.');
  // Never copy the message body or contact details into system logs.
  await connection.execute(`INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, detail)
    VALUES (?, 'update', 'contact_message', ?, ?)`, [actorId, messageId, `Contact message marked ${status}.`]);
  return { updated: true, status };
}
