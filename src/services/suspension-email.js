import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { sendInstitutionSuspensionEmail } from './email.js';

export async function deliverSuspensionEmail(notificationId) {
  const lease = crypto.randomUUID();
  const [claim] = await pool.execute(`UPDATE institution_notice_emails SET state = 'sending', attempts = attempts + 1,
    lease_token = ?, lease_until = CURRENT_TIMESTAMP + INTERVAL '2 minutes', updated_at = CURRENT_TIMESTAMP
    WHERE notification_id = ? AND (state IN ('pending', 'failed') OR (state = 'sending' AND lease_until < CURRENT_TIMESTAMP))
    RETURNING notification_id`, [lease, notificationId]);
  if (!claim.affectedRows) return { status: 'unchanged' };
  try {
    const [rows] = await pool.execute(`SELECT n.reason, n.context_school AS school, n.recipient_id, u.email, u.full_name AS name,
      ia.status, n.notification_id::text AS id,
      (SELECT MAX(latest.notification_id)::text FROM community_notifications latest WHERE latest.application_id = n.application_id
        AND latest.kind = 'institution_suspended') AS latest
      FROM community_notifications n JOIN users u ON u.user_id = n.recipient_id
      JOIN institution_applications ia ON ia.application_id = n.application_id WHERE n.notification_id = ?`, [notificationId]);
    const notice = rows[0];
    if (!notice || notice.status !== 'suspended' || notice.id !== notice.latest) {
      await pool.execute("UPDATE institution_notice_emails SET state = 'cancelled', lease_token = NULL, lease_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND lease_token = ?", [notificationId, lease]);
      return { status: 'cancelled' };
    }
    await sendInstitutionSuspensionEmail({ to: notice.email, name: notice.name, school: notice.school, reason: notice.reason, noticeId: notice.id });
    await pool.execute("UPDATE institution_notice_emails SET state = 'sent', sent_at = CURRENT_TIMESTAMP, last_error_code = NULL, lease_token = NULL, lease_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND lease_token = ?", [notificationId, lease]);
    return { status: 'sent' };
  } catch {
    // Do not persist/log recipient addresses, reasons, credentials or SMTP response bodies.
    await pool.execute("UPDATE institution_notice_emails SET state = 'failed', last_error_code = 'DELIVERY_FAILED', lease_token = NULL, lease_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND lease_token = ?", [notificationId, lease]);
    return { status: 'failed' };
  }
}
