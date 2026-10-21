export async function createModerationNotice(connection, { recipientId, actorId, postId = null, commentId = null, applicationId = null, kind, reason, title, school }) {
  if (recipientId === actorId) return null;
  const [result] = await connection.execute(`INSERT INTO community_notifications
    (recipient_id, actor_id, post_id, comment_id, application_id, kind, reason, context_title, context_school)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING notification_id::text AS id`,
  [recipientId, actorId, postId, commentId, applicationId, kind, reason, title, school]);
  return result.rows?.[0]?.id ?? null;
}
