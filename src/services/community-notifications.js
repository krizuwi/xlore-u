import { ADMIN_EMAIL } from '../utils/admin-access.js';

// Called inside the interaction transaction: a failed comment/like never sends a notice.
export async function notifySchool(connection, post, actorId, kind, commentId = null) {
  await connection.execute(`INSERT INTO community_notifications (recipient_id, actor_id, post_id, comment_id, kind)
    SELECT ia.user_id, ?, ?, ?, ? FROM institution_applications ia
    JOIN users u ON u.user_id = ia.user_id
    JOIN available_schools av ON av.school_id = ia.school_id
    WHERE ia.school_id = ? AND ia.status = 'approved' AND av.is_active_available = TRUE
      AND u.is_active = TRUE AND u.email_verified_at IS NOT NULL AND u.account_type = 'institution'
      AND ia.user_id <> ? ON CONFLICT DO NOTHING`, [actorId, post.post_id, commentId, kind, post.school_id, actorId]);
  if (kind === 'reply' && commentId) await connection.execute(`INSERT INTO community_notifications (recipient_id, actor_id, post_id, comment_id, kind)
    SELECT u.user_id, ?, ?, c.comment_id, 'reply' FROM school_post_comments c JOIN users u ON LOWER(u.email) = ?
    WHERE c.comment_id = ? AND c.post_id = ? AND c.parent_comment_id IS NOT NULL
      AND u.is_active = TRUE AND u.email_verified_at IS NOT NULL AND u.user_id <> ?
      AND EXISTS (SELECT 1 FROM school_post_comments participation WHERE participation.user_id = u.user_id
        AND participation.author_is_admin = TRUE AND participation.post_id = c.post_id
        AND participation.deleted = FALSE AND participation.hidden_by_admin = FALSE
        AND (participation.comment_id = c.parent_comment_id OR participation.parent_comment_id = c.parent_comment_id))
    ON CONFLICT DO NOTHING`, [actorId, post.post_id, ADMIN_EMAIL, commentId, post.post_id, actorId]);
}

export async function notifyStudentReply(connection, post, actorId, commentId, parentId) {
  await connection.execute(`INSERT INTO community_notifications (recipient_id, actor_id, post_id, comment_id, kind)
    SELECT parent.user_id, ?, ?, ?, 'reply' FROM school_post_comments parent
    JOIN users u ON u.user_id = parent.user_id
    WHERE parent.comment_id = ? AND parent.post_id = ? AND parent.parent_comment_id IS NULL
      AND parent.author_is_admin = FALSE AND parent.deleted = FALSE AND parent.hidden_by_admin = FALSE
      AND u.account_type = 'student' AND u.is_active = TRUE AND u.email_verified_at IS NOT NULL
      AND parent.user_id <> ? ON CONFLICT DO NOTHING`, [actorId, post.post_id, commentId, parentId, post.post_id, actorId]);
}
