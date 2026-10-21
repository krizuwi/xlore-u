import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { sendStudentSuspensionEmail } from './email.js';

export async function deliverStudentSuspensionEmail(actionId) {
  const lease = crypto.randomUUID();
  const [claim] = await pool.execute(`UPDATE student_account_actions SET email_state = 'sending', email_attempts = email_attempts + 1,
    lease_token = ?, lease_until = CURRENT_TIMESTAMP + INTERVAL '2 minutes'
    WHERE action_id = ? AND active = FALSE AND (email_state IN ('pending', 'failed') OR (email_state = 'sending' AND lease_until < CURRENT_TIMESTAMP))`, [lease, actionId]);
  if (!claim.affectedRows) return { status: 'unchanged' };
  try {
    const [rows] = await pool.execute(`SELECT act.action_id::text AS id, act.reason, u.email, u.full_name AS name, u.is_active AS active,
      (SELECT MAX(latest.action_id)::text FROM student_account_actions latest WHERE latest.user_id = act.user_id) AS latest
      FROM student_account_actions act JOIN users u ON u.user_id = act.user_id WHERE act.action_id = ?`, [actionId]);
    const row = rows[0];
    if (!row || row.active || row.id !== row.latest) {
      await pool.execute("UPDATE student_account_actions SET email_state = 'cancelled', lease_token = NULL, lease_until = NULL WHERE action_id = ? AND lease_token = ?", [actionId, lease]);
      return { status: 'cancelled' };
    }
    await sendStudentSuspensionEmail({ to: row.email, name: row.name, reason: row.reason, actionId: row.id });
    await pool.execute("UPDATE student_account_actions SET email_state = 'sent', email_sent_at = CURRENT_TIMESTAMP, email_error_code = NULL, lease_token = NULL, lease_until = NULL WHERE action_id = ? AND lease_token = ?", [actionId, lease]);
    return { status: 'sent' };
  } catch {
    await pool.execute("UPDATE student_account_actions SET email_state = 'failed', email_error_code = 'DELIVERY_FAILED', lease_token = NULL, lease_until = NULL WHERE action_id = ? AND lease_token = ?", [actionId, lease]);
    return { status: 'failed' };
  }
}
