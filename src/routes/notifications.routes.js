import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { requireAuth } from './middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { assert } from '../utils/http-error.js';
import { isAdminUser } from '../utils/admin-access.js';
import { institutionActiveSql, visibleSchoolCommentSql } from '../services/institutions.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth, rateLimit({ windowMs: 60000, limit: 120 }), (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    assert(req.user.email_verified_at && (isAdminUser(req.user) || ['student', 'institution'].includes(req.user.account_type)), 403, 'A verified account is required.');
    next();
  } catch (error) { next(error); }
});

// Public activity follows visibility; private decisions remain readable after hiding/suspension.
const visible = `FROM community_notifications n
  LEFT JOIN school_posts p ON p.post_id = n.post_id LEFT JOIN schools s ON s.school_id = p.school_id
  JOIN users actor ON actor.user_id = n.actor_id
  LEFT JOIN school_post_comments c ON c.comment_id = n.comment_id AND c.post_id = n.post_id
  LEFT JOIN schools author_school ON author_school.school_id = c.author_school_id
  WHERE n.recipient_id = ? AND (
    (n.kind IN ('post_hidden', 'post_restored', 'comment_hidden', 'comment_restored', 'institution_suspended') AND n.reason IS NOT NULL)
    OR (n.kind IN ('like', 'comment', 'reply') AND p.status = 'published' AND p.hidden_by_admin = FALSE AND ${institutionActiveSql}
    AND actor.is_active = TRUE AND actor.email_verified_at IS NOT NULL
    AND ((n.kind = 'like' AND EXISTS (SELECT 1 FROM school_post_likes l WHERE l.post_id = n.post_id AND l.user_id = n.actor_id))
      OR (n.kind <> 'like' AND ${visibleSchoolCommentSql}))
    AND ((? = 'institution' AND EXISTS (SELECT 1 FROM institution_applications own
      WHERE own.user_id = n.recipient_id AND own.school_id = p.school_id AND own.status = 'approved'))
      OR (? = 'student' AND n.kind = 'reply' AND EXISTS (SELECT 1 FROM school_post_comments root
        WHERE root.comment_id = c.parent_comment_id AND root.post_id = p.post_id AND root.user_id = n.recipient_id))
      OR (? = 'admin' AND n.kind = 'reply' AND EXISTS (SELECT 1 FROM school_post_comments participation
        WHERE participation.user_id = n.recipient_id AND participation.author_is_admin = TRUE AND participation.post_id = p.post_id
          AND participation.deleted = FALSE AND participation.hidden_by_admin = FALSE
          AND (participation.comment_id = c.parent_comment_id OR participation.parent_comment_id = c.parent_comment_id))))))`;

function sequence(value) {
  assert(typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n, 400, 'Invalid notification cursor.');
  return value;
}
notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const role = isAdminUser(req.user) ? 'admin' : req.user.account_type;
  const scope = [req.user.user_id, role, role, role];
  const before = req.query.before == null ? null : sequence(req.query.before);
  const [summary] = await pool.execute(`SELECT COUNT(*) FILTER (WHERE n.read_at IS NULL)::int AS "unreadCount",
    COALESCE(MAX(n.notification_id), 0)::text AS watermark ${visible}`, scope);
  const [rows] = await pool.execute(`SELECT n.notification_id::text AS id, n.kind, n.created_at AS "createdAt", n.read_at AS "readAt",
    p.post_id AS "postId", COALESCE(n.context_title, p.title) AS "postTitle", s.school_id AS "schoolId", COALESCE(n.context_school, s.school_name) AS "schoolName", n.reason,
    CASE WHEN n.reason IS NOT NULL OR c.author_is_admin THEN 'Administrator' WHEN c.author_school_id IS NOT NULL THEN author_school.school_name
      ELSE COALESCE(NULLIF(actor.first_name, ''), 'Student') END AS actor
    ${visible}${before ? ' AND n.notification_id < ?' : ''} ORDER BY n.notification_id DESC LIMIT 21`, [...scope, ...(before ? [before] : [])]);
  res.json({ data: rows.slice(0, 20), unreadCount: summary[0]?.unreadCount ?? 0,
    watermark: summary[0]?.watermark ?? '0', nextCursor: rows.length > 20 ? rows[19].id : null });
}));
notificationsRouter.patch('/read-all', asyncHandler(async (req, res) => {
  const through = sequence(req.body?.through);
  // A snapshot watermark leaves activity arriving after the displayed inbox unread.
  await pool.execute('UPDATE community_notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE recipient_id = ? AND notification_id <= ?', [req.user.user_id, through]);
  res.status(204).end();
}));
notificationsRouter.patch('/:id/read', asyncHandler(async (req, res) => {
  const [result] = await pool.execute('UPDATE community_notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE recipient_id = ? AND notification_id = ?', [req.user.user_id, sequence(req.params.id)]);
  assert(result.affectedRows, 404, 'Notification not found.');
  res.status(204).end();
}));
