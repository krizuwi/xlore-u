import { assert } from '../utils/http-error.js';
import { id } from './admin-validation.js';
import { ADMIN_EMAIL, isAdminUser } from '../utils/admin-access.js';
import { createModerationNotice } from './moderation-notices.js';

export function validateStudentAssessmentReset(body) {
  assert(body?.confirmed === true, 400, 'Confirm deletion of this student assessment answers and results.');
  assert(typeof body.reason === 'string' && body.reason.trim().length > 0 && body.reason.length <= 1000,
    400, 'Enter an administrator reason, up to 1,000 characters.');
  return { reason: body.reason.trim(), expectedAssessmentId: id(body.expectedAssessmentId) };
}

// The caller wraps deletion, audit, notice, and email queueing in one transaction.
export async function resetStudentAssessment(connection, actor, userId, body) {
  assert(isAdminUser(actor), 403, 'Administrator access is required.');
  userId = id(userId);
  const item = validateStudentAssessmentReset(body);
  // Assessment submission takes the same user-row lock. Concurrent resets or
  // submissions cannot silently remove a result created after confirmation.
  const [users] = await connection.execute('SELECT user_id, email, account_type, email_verified_at FROM users WHERE user_id = ? FOR UPDATE', [userId]);
  const student = users[0];
  assert(student && student.account_type === 'student' && student.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() && userId !== actor.user_id,
    404, 'Student account not found.');
  const [attempts] = await connection.execute('SELECT assessment_id FROM assessments WHERE user_id = ? ORDER BY created_at DESC, assessment_id DESC', [userId]);
  assert(attempts.length > 0, 409, 'This student has no assessment to reset. Refresh the student records.');
  assert(attempts[0].assessment_id === item.expectedAssessmentId, 409, 'The student assessment changed. Refresh and review it before resetting.');
  const [deleted] = await connection.execute('DELETE FROM assessments WHERE user_id = ?', [userId]);
  assert(deleted.affectedRows === attempts.length, 409, 'Assessment reset conflict. No changes were saved.');
  await connection.execute(`INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, detail)
    VALUES (?, 'assessment_reset', 'user', ?, ?)`,
  [actor.user_id, userId, JSON.stringify({ reason: item.reason, clearedAttempts: deleted.affectedRows })]);
  const noticeId = await createModerationNotice(connection, {
    recipientId: userId, actorId: actor.user_id, kind: 'assessment_reset', reason: item.reason,
    title: 'Assessment', school: null
  });
  await connection.execute('INSERT INTO assessment_reset_notice_emails (notification_id) VALUES (?)', [noticeId]);
  return { noticeId, clearedAttempts: deleted.affectedRows, message: 'Student assessment reset. The student can take the assessment again.' };
}
