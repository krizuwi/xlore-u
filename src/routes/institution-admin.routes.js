import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { assert } from '../utils/http-error.js';
import { id, text, validateSchool } from '../services/admin-validation.js';
import { auditInstitution, httpsLink, institutionActiveSql } from '../services/institutions.js';
import { createModerationNotice } from '../services/moderation-notices.js';
import { deliverSuspensionEmail } from '../services/suspension-email.js';

export const institutionAdminRouter = Router();
institutionAdminRouter.use(requireAuth, requireAdmin, rateLimit({ windowMs: 60000, limit: 120 }));
institutionAdminRouter.get('/applications', asyncHandler(async (req, res) => {
  const status = req.query.status ?? 'pending';
  assert(['pending', 'approved', 'rejected', 'suspended'].includes(status), 400, 'Invalid application status.');
  assert(req.query.search === undefined || typeof req.query.search === 'string', 400, 'Application search must be text.');
  const search = text(req.query.search, 'Application search', 100, false);
  const values = [status];
  let filter = '';
  if (search) {
    const pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
    filter = " AND (s.school_name ILIKE ? OR ia.proposed_school->>'name' ILIKE ? OR u.full_name ILIKE ? OR u.email ILIKE ?)";
    values.push(pattern, pattern, pattern, pattern);
  }
  const [data] = await pool.execute(`SELECT ia.application_id AS id, ia.status, ia.school_id AS "schoolId",
    s.school_name AS "schoolName", ia.proposed_school AS "proposedSchool", u.full_name AS "representativeName",
    u.first_name AS "firstName", u.middle_name AS "middleName", u.last_name AS "lastName", u.email,
    u.email_verified_at IS NOT NULL AS "emailVerified", ia.representative_title AS title, ia.contact_phone AS phone,
    ia.verification_url AS "verificationUrl", ia.verification_note AS evidence, ia.review_note AS "reviewNote", ia.created_at AS "createdAt",
    (SELECT json_build_object('id', n.notification_id::text, 'state', mail.state, 'attempts', mail.attempts, 'sentAt', mail.sent_at)
      FROM community_notifications n JOIN institution_notice_emails mail ON mail.notification_id = n.notification_id
      WHERE n.application_id = ia.application_id AND n.kind = 'institution_suspended' ORDER BY n.notification_id DESC LIMIT 1) AS "suspensionEmail"
    FROM institution_applications ia JOIN users u ON u.user_id = ia.user_id LEFT JOIN schools s ON s.school_id = ia.school_id
    WHERE ia.status = ?${filter} ORDER BY ia.created_at, ia.application_id LIMIT 200`, values);
  res.set('Cache-Control', 'no-store'); res.json({ data });
}));
institutionAdminRouter.post('/applications/:id/review', asyncHandler(async (req, res) => {
  const decision = req.body.decision, note = text(req.body.note, 'Review note', 2000);
  assert(['approve', 'reject', 'suspend', 'resume'].includes(decision), 400, 'Invalid review action.');
  let suspensionNoticeId = null;
  await withTransaction(async connection => {
    const [rows] = await connection.execute('SELECT * FROM institution_applications WHERE application_id = ? FOR UPDATE', [id(req.params.id)]);
    const application = rows[0]; assert(application, 404, 'Application not found.');
    const next = { approve: 'approved', reject: 'rejected', suspend: 'suspended', resume: 'approved' }[decision];
    assert((['approve', 'reject'].includes(decision) && application.status === 'pending') || (decision === 'suspend' && application.status === 'approved') || (decision === 'resume' && application.status === 'suspended'), 409, 'Application state changed. Refresh before reviewing.');
    let schoolId = application.school_id;
    if (next === 'approved') {
      assert(req.body.verifiedAuthority === true, 400, 'Confirm that school representation was independently verified.');
      const [users] = await connection.execute("SELECT user_id FROM users WHERE user_id = ? AND account_type = 'institution' AND is_active = TRUE AND email_verified_at IS NOT NULL", [application.user_id]);
      assert(users.length, 409, 'The representative must verify their email before approval.');
      if (!schoolId) {
        const item = validateSchool({ ...(req.body.school ?? application.proposed_school), status: 'Active', googleRating: null });
        httpsLink(item.website, true);
        schoolId = crypto.randomUUID();
        await connection.execute(`INSERT INTO schools (school_id, school_name, school_type, city_district, address, latitude, longitude,
          official_website_url, tuition_range, accreditation, scholarship_info, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [schoolId, item.name, item.type, item.city, item.address, item.latitude, item.longitude,
          item.website, item.tuitionRange, item.accreditation, item.scholarshipInfo, item.description]);
      } else {
        // Lock the school as well: simultaneous approvals cannot claim one institution twice.
        await connection.execute('SELECT school_id FROM schools WHERE school_id = ? FOR UPDATE', [schoolId]);
        const [owners] = await connection.execute("SELECT application_id FROM institution_applications WHERE school_id = ? AND application_id <> ? AND status IN ('approved', 'suspended')", [schoolId, application.application_id]);
        assert(!owners.length, 409, 'This school already belongs to another institution account.');
      }
      await connection.execute(`INSERT INTO available_schools (available_id, school_id, available_since, is_active_available)
        VALUES (?, ?, CURRENT_DATE, TRUE) ON CONFLICT (school_id) DO UPDATE SET is_active_available = TRUE`, [crypto.randomUUID(), schoolId]);
      // Institution-maintained data must not be overwritten/re-added by unattended collection.
      await connection.execute('UPDATE catalog_sources SET enabled = FALSE, updated_at = CURRENT_TIMESTAMP WHERE school_id = ?', [schoolId]);
    }
    await connection.execute(`UPDATE institution_applications SET status = ?, school_id = ?, review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE application_id = ?`, [next, schoolId, note, req.user.user_id, application.application_id]);
    await auditInstitution(connection, req.user.user_id, `institution_${decision}`, 'institution', application.application_id, note);
    if (decision === 'suspend') {
      const [schools] = await connection.execute('SELECT school_name FROM schools WHERE school_id = ?', [schoolId]);
      suspensionNoticeId = await createModerationNotice(connection, { recipientId: application.user_id, actorId: req.user.user_id,
        applicationId: application.application_id, kind: 'institution_suspended', reason: note,
        title: 'Institution access suspended', school: schools[0]?.school_name ?? 'Your institution' });
      if (suspensionNoticeId) await connection.execute('INSERT INTO institution_notice_emails (notification_id) VALUES (?)', [suspensionNoticeId]);
    }
  });
  const email = suspensionNoticeId ? await deliverSuspensionEmail(suspensionNoticeId).catch(() => ({ status: 'failed' })) : null;
  res.json({ message: email?.status === 'failed' ? 'Institution access suspended. The notification was saved, but the email could not be sent. Retry delivery below.' : 'Institution review saved.', ...(email ? { email } : {}) });
}));
institutionAdminRouter.post('/applications/:id/suspension-email/retry', rateLimit({ windowMs: 15 * 60000, limit: 10 }), asyncHandler(async (req, res) => {
  const [notices] = await pool.execute(`SELECT n.notification_id::text AS id FROM community_notifications n
    JOIN institution_applications ia ON ia.application_id = n.application_id
    WHERE n.application_id = ? AND n.kind = 'institution_suspended' AND ia.status = 'suspended'
    ORDER BY n.notification_id DESC LIMIT 1`, [id(req.params.id)]);
  assert(notices.length, 404, 'No current suspension email is available.');
  const email = await deliverSuspensionEmail(notices[0].id);
  res.json({ email, message: email.status === 'failed' ? 'Email delivery failed. The suspension and in-app reason remain saved. Check email configuration before retrying.' : email.status === 'sent' ? 'Suspension email accepted for delivery.' : 'Email is already sent, being processed, or no longer applicable.' });
}));
institutionAdminRouter.get('/moderation/schools', asyncHandler(async (req, res) => {
  const page = Number(req.query.page ?? 1), status = req.query.status ?? 'active';
  assert(Number.isSafeInteger(page) && page > 0 && page <= 10000, 400, 'Invalid school list page.');
  assert(['active', 'inactive', 'all'].includes(status), 400, 'Choose activated, inactive, or all registered schools.');
  assert(req.query.search === undefined || typeof req.query.search === 'string', 400, 'School search must be text.');
  const search = text(req.query.search, 'School search', 100, false);
  const values = [], clauses = ["EXISTS (SELECT 1 FROM institution_applications owners WHERE owners.school_id = s.school_id AND owners.status IN ('approved', 'suspended'))"];
  if (status !== 'all') clauses.push(`${status === 'inactive' ? 'NOT ' : ''}${institutionActiveSql}`);
  if (search) { clauses.push('(s.school_name ILIKE ? OR s.city_district ILIKE ?)'); const pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%'; values.push(pattern, pattern); }
  const where = clauses.join(' AND ');
  const [[counts], [data]] = await Promise.all([
    pool.execute(`SELECT COUNT(*)::int AS total FROM schools s WHERE ${where}`, values),
    pool.execute(`SELECT s.school_id AS id, s.school_name AS name, s.school_type AS type, s.city_district AS city,
      s.logo_url AS "logoUrl", ${institutionActiveSql} AS active,
      (SELECT COUNT(*)::int FROM school_posts posts WHERE posts.school_id = s.school_id AND posts.status <> 'deleted') AS "postCount"
      FROM schools s WHERE ${where} ORDER BY s.school_name, s.school_id LIMIT 6 OFFSET ?`, [...values, (page - 1) * 6])
  ]);
  res.set('Cache-Control', 'no-store');
  res.json({ data, pagination: { page, pageSize: 6, total: counts[0].total } });
}));
institutionAdminRouter.get('/moderation', asyncHandler(async (req, res) => {
  const page = Number(req.query.page ?? 1);
  assert(Number.isSafeInteger(page) && page > 0 && page <= 10000, 400, 'Invalid moderation page.');
  const schoolId = req.query.schoolId === undefined ? null : id(req.query.schoolId);
  assert(req.query.search === undefined || typeof req.query.search === 'string', 400, 'Post search must be text.');
  const search = text(req.query.search, 'Post search', 100, false);
  const pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
  const [data] = await pool.execute(`SELECT p.post_id AS id, p.school_id AS "schoolId", s.school_name AS school,
    p.title, p.body, p.status, p.images, p.link_url AS link, p.hidden_by_admin AS hidden,
    (SELECT COUNT(*)::int FROM school_post_likes l WHERE l.post_id = p.post_id) AS "likeCount",
    (SELECT COUNT(*)::int FROM school_post_comments c WHERE c.post_id = p.post_id AND c.deleted = FALSE) AS "commentCount",
    p.moderation_note AS note, p.created_at AS "createdAt" FROM school_posts p JOIN schools s ON s.school_id = p.school_id
    WHERE p.status <> 'deleted'${schoolId ? ' AND p.school_id = ?' : ''}${search ? ' AND (p.title ILIKE ? OR p.body ILIKE ?)' : ''}
    ORDER BY p.created_at DESC, p.post_id DESC LIMIT 21 OFFSET ?`, [...(schoolId ? [schoolId] : []), ...(search ? [pattern, pattern] : []), (page - 1) * 20]);
  res.set('Cache-Control', 'no-store');
  res.json({ data: data.slice(0, 20), hasMore: data.length > 20, page, schoolId });
}));
institutionAdminRouter.get('/posts/:id/comments', asyncHandler(async (req, res) => {
  const [data] = await pool.execute(`SELECT c.comment_id AS id, c.body, c.hidden_by_admin AS hidden,
    c.parent_comment_id AS "parentCommentId", CASE WHEN c.author_is_admin THEN 'admin' WHEN c.author_school_id IS NULL THEN 'student' ELSE 'institution' END AS "authorType",
    CASE WHEN c.author_is_admin THEN 'Administrator' ELSE COALESCE(s.school_name, u.full_name) END AS author
    FROM school_post_comments c JOIN users u ON u.user_id = c.user_id LEFT JOIN schools s ON s.school_id = c.author_school_id WHERE c.post_id = ? AND c.deleted = FALSE
    ORDER BY c.created_at DESC LIMIT 200`, [id(req.params.id)]);
  res.json({ data });
}));
institutionAdminRouter.delete('/posts/:id', asyncHandler(async (req, res) => {
  const postId = id(req.params.id);
  const note = text(req.body?.note ?? 'Removed by administrator from the school post controls.', 'Deletion reason', 1000);
  await withTransaction(async connection => {
    // Visibility removal, not a physical purge: preserve moderation evidence and
    // related reactions/comments. Institutions cannot edit deleted posts back online.
    const [result] = await connection.execute(`UPDATE school_posts SET status = 'deleted', moderation_note = ?,
      updated_at = CURRENT_TIMESTAMP WHERE post_id = ? AND status <> 'deleted'`, [note, postId]);
    assert(result.affectedRows, 404, 'School post not found or already deleted.');
    await auditInstitution(connection, req.user.user_id, 'admin_post_deleted', 'post', postId, note);
  });
  res.status(204).end();
}));
for (const type of ['posts', 'comments']) {
  institutionAdminRouter.patch(`/${type}/:id/moderation`, asyncHandler(async (req, res) => {
    assert(typeof req.body.hidden === 'boolean', 400, 'Choose hidden or visible.');
    const note = text(req.body.note, 'Moderation reason', 1000);
    await withTransaction(async connection => {
      const targetId = id(req.params.id), post = type === 'posts';
      const table = post ? 'school_posts' : 'school_post_comments', column = post ? 'post_id' : 'comment_id';
      const [targets] = await connection.execute(post
        ? `SELECT p.post_id, p.author_id AS owner_id, p.hidden_by_admin, p.moderation_note, p.title, s.school_name
            FROM school_posts p JOIN schools s ON s.school_id = p.school_id WHERE p.post_id = ? AND p.status <> 'deleted' FOR UPDATE OF p`
        : `SELECT c.post_id, c.user_id AS owner_id, c.hidden_by_admin, c.moderation_note, p.title, s.school_name
            FROM school_post_comments c JOIN school_posts p ON p.post_id = c.post_id JOIN schools s ON s.school_id = p.school_id
            WHERE c.comment_id = ? AND c.deleted = FALSE AND p.status <> 'deleted' FOR UPDATE OF c`, [targetId]);
      assert(targets.length, 404, 'Content not found.');
      const target = targets[0];
      if (target.hidden_by_admin === req.body.hidden && target.moderation_note === note) return;
      await connection.execute(`UPDATE ${table} SET hidden_by_admin = ?, moderation_note = ? WHERE ${column} = ?`, [req.body.hidden, note, targetId]);
      await auditInstitution(connection, req.user.user_id, req.body.hidden ? 'content_hidden' : 'content_restored', type, req.params.id, note);
      await createModerationNotice(connection, { recipientId: target.owner_id, actorId: req.user.user_id,
        postId: target.post_id, commentId: post ? null : targetId,
        kind: (post ? 'post_' : 'comment_') + (req.body.hidden ? 'hidden' : 'restored'), reason: note,
        title: target.title, school: target.school_name });
    });
    res.json({ message: 'Moderation saved.' });
  }));
}
