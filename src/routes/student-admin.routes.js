import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { assert } from '../utils/http-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ADMIN_EMAIL } from '../utils/admin-access.js';
import { id } from '../services/admin-validation.js';
import { getStudentReport, validateStudentAccess } from '../services/student-enrollment.js';
import { deliverStudentSuspensionEmail } from '../services/student-suspension-email.js';
import { resetStudentAssessment } from '../services/student-assessment-reset.js';

export const studentAdminRouter = Router();
studentAdminRouter.use(requireAuth, requireAdmin, rateLimit({ windowMs: 60000, limit: 90 }), (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
studentAdminRouter.get('/', asyncHandler(async (req, res) => { res.json(await getStudentReport(req.query)); }));
studentAdminRouter.post('/:id/assessment/reset', rateLimit({ windowMs: 60000, limit: 15 }), asyncHandler(async (req, res) => {
  const result = await withTransaction(connection => resetStudentAssessment(connection, req.user, req.params.id, req.body));
  res.json(result);
}));
studentAdminRouter.patch('/:id/access', asyncHandler(async (req, res) => {
  const userId = id(req.params.id), item = validateStudentAccess(req.body);
  const actionId = await withTransaction(async connection => {
    const [students] = await connection.execute("SELECT user_id, email, account_type, is_active FROM users WHERE user_id = ? FOR UPDATE", [userId]);
    const student = students[0];
    assert(student && student.account_type === 'student' && student.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() && student.user_id !== req.user.user_id, 404, 'Student account not found.');
    assert(student.is_active === item.expectedActive, 409, 'Account status changed. Refresh the student list before saving.');
    await connection.execute('UPDATE users SET is_active = ?, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [item.active, userId]);
    if (!item.active) await connection.execute('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    await connection.execute("UPDATE student_account_actions SET email_state = 'cancelled', lease_token = NULL, lease_until = NULL WHERE user_id = ? AND email_state IN ('pending', 'failed')", [userId]);
    const [insert] = await connection.execute(`INSERT INTO student_account_actions (user_id, actor_id, active, reason, email_state)
      VALUES (?, ?, ?, ?, ?) RETURNING action_id::text AS id`, [userId, req.user.user_id, item.active, item.reason, item.active ? 'not_required' : 'pending']);
    await connection.execute(`INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, detail)
      VALUES (?, ?, 'user', ?, ?)`, [req.user.user_id, item.active ? 'student_restored' : 'student_suspended', userId, 'Student account access changed; private reason retained in student management.']);
    return insert.rows[0].id;
  });
  const email = item.active ? { status: 'not_required' } : await deliverStudentSuspensionEmail(actionId);
  res.json({ active: item.active, actionId, emailStatus: email.status, message: item.active ? 'Student account restored. The student must sign in again.' : 'Student account suspended. Existing sessions have been revoked.' });
}));
studentAdminRouter.post('/:id/suspension-email/retry', rateLimit({ windowMs: 60000, limit: 10 }), asyncHandler(async (req, res) => {
  const userId = id(req.params.id);
  const [rows] = await pool.execute(`SELECT act.action_id::text AS id FROM student_account_actions act JOIN users u ON u.user_id = act.user_id
    WHERE u.user_id = ? AND u.account_type = 'student' AND lower(u.email) <> ? AND u.is_active = FALSE AND act.active = FALSE
    AND act.action_id = (SELECT MAX(latest.action_id) FROM student_account_actions latest WHERE latest.user_id = u.user_id)`, [userId, ADMIN_EMAIL.toLowerCase()]);
  assert(rows.length, 404, 'No current student suspension notice is available.');
  const email = await deliverStudentSuspensionEmail(rows[0].id);
  res.json({ emailStatus: email.status, message: email.status === 'sent' ? 'The email provider accepted the suspension notice.' : 'Check the email delivery status after refreshing.' });
}));
