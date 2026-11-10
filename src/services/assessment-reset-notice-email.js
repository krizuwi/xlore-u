import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { sendAssessmentResetEmail } from './email.js';

export async function deliverAssessmentResetEmail(noticeId) {
  const lease = randomUUID();
  const [claim] = await pool.execute(`UPDATE assessment_reset_notice_emails
    SET state = 'sending', attempts = attempts + 1, lease_token = ?, lease_until = CURRENT_TIMESTAMP + INTERVAL '2 minutes'
    WHERE notification_id = ? AND (state IN ('pending', 'failed') OR (state = 'sending' AND lease_until < CURRENT_TIMESTAMP))`, [lease, noticeId]);
  if (!claim.affectedRows) return { status: 'unchanged' };
  try {
    const [[notice]] = await pool.execute(`SELECT n.reason, u.email, u.full_name AS name
      FROM community_notifications n JOIN users u ON u.user_id = n.recipient_id
      WHERE n.notification_id = ? AND n.kind = 'assessment_reset' AND u.account_type = 'student'`, [noticeId]);
    if (!notice) throw new Error('Assessment reset notice recipient unavailable.');
    await sendAssessmentResetEmail({ to: notice.email, name: notice.name, reason: notice.reason, noticeId });
    await pool.execute(`UPDATE assessment_reset_notice_emails SET state = 'sent', sent_at = CURRENT_TIMESTAMP,
      lease_token = NULL, lease_until = NULL WHERE notification_id = ? AND lease_token = ?`, [noticeId, lease]);
    return { status: 'sent' };
  } catch {
    await pool.execute(`UPDATE assessment_reset_notice_emails SET state = 'failed', lease_token = NULL, lease_until = NULL
      WHERE notification_id = ? AND lease_token = ?`, [noticeId, lease]);
    return { status: 'failed' };
  }
}
