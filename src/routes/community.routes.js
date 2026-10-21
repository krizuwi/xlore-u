import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth } from './middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { assert } from '../utils/http-error.js';
import { isAdminUser } from '../utils/admin-access.js';
import { id, text } from '../services/admin-validation.js';
import { institutionActiveSql, requirePublicPost, ownedInstitution, visibleSchoolCommentSql } from '../services/institutions.js';
import { notifySchool, notifyStudentReply } from '../services/community-notifications.js';

export const communityRouter = Router();
function pageNumber(value) {
  const page = Number(value ?? 1);
  assert(Number.isSafeInteger(page) && page >= 1 && page <= 10000, 400, 'Invalid page.');
  return page;
}
function requireStudent(req, _res, next) {
  try { assert(req.user.account_type === 'student' && !isAdminUser(req.user), 403, 'Only verified students can like posts.'); next(); }
  catch (error) { next(error); }
}
communityRouter.get('/schools/:id/posts', asyncHandler(async (req, res) => {
  const schoolId = id(req.params.id), page = pageNumber(req.query.page);
  const [schools] = await pool.execute('SELECT s.school_id FROM schools s WHERE s.school_id = ? AND ' + institutionActiveSql, [schoolId]);
  assert(schools.length, 404, 'This school has no active institution community.');
  const [posts] = await pool.execute('SELECT p.post_id AS id, p.title, p.body, p.link_url AS link, p.images, ' +
    'p.created_at AS "createdAt", p.updated_at AS "updatedAt", ' +
    '(SELECT COUNT(*)::int FROM school_post_likes l WHERE l.post_id = p.post_id) AS "likeCount", ' +
    '(SELECT COUNT(*)::int FROM school_post_comments c WHERE c.post_id = p.post_id AND ' + visibleSchoolCommentSql + ') AS "commentCount" ' +
    "FROM school_posts p WHERE p.school_id = ? AND p.status = 'published' AND p.hidden_by_admin = FALSE " +
    'ORDER BY p.created_at DESC, p.post_id DESC LIMIT 11 OFFSET ?', [schoolId, (page - 1) * 10]);
  res.set('Cache-Control', 'no-store');
  res.json({ data: posts.slice(0, 10), page, hasMore: posts.length > 10 });
}));
communityRouter.get('/posts/:id', asyncHandler(async (req, res) => {
  const post = await requirePublicPost(pool, req.params.id);
  const [rows] = await pool.execute(`SELECT p.post_id AS id, p.school_id AS "schoolId", p.title, p.body, p.link_url AS link, p.images,
    p.created_at AS "createdAt", p.updated_at AS "updatedAt",
    (SELECT COUNT(*)::int FROM school_post_likes l WHERE l.post_id = p.post_id) AS "likeCount",
    (SELECT COUNT(*)::int FROM school_post_comments c WHERE c.post_id = p.post_id AND ${visibleSchoolCommentSql}) AS "commentCount"
    FROM school_posts p JOIN schools s ON s.school_id = p.school_id WHERE p.post_id = ? AND p.status = 'published'
      AND p.hidden_by_admin = FALSE AND ${institutionActiveSql}`, [post.post_id]);
  assert(rows.length, 404, 'Post not available.');
  res.set('Cache-Control', 'no-store'); res.json(rows[0]);
}));
communityRouter.get('/posts/:id/comments', asyncHandler(async (req, res) => {
  const postId = id(req.params.id), page = pageNumber(req.query.page);
  await requirePublicPost(pool, postId);
  const [comments] = await pool.execute(
    'SELECT c.comment_id AS id, c.body, CASE WHEN c.author_is_admin THEN \'Administrator\' ELSE COALESCE(NULLIF(u.first_name, \'\'), \'Student\') END AS author, ' +
    'CASE WHEN c.author_is_admin THEN \'admin\' ELSE \'student\' END AS "authorType", c.created_at AS "createdAt", ' +
    '(SELECT COUNT(*)::int FROM school_post_comments reply WHERE reply.parent_comment_id = c.comment_id AND reply.deleted = FALSE AND reply.hidden_by_admin = FALSE) AS "replyCount" ' +
    'FROM school_post_comments c JOIN users u ON u.user_id = c.user_id ' +
    'WHERE c.post_id = ? AND c.parent_comment_id IS NULL AND c.deleted = FALSE AND c.hidden_by_admin = FALSE ' +
    'ORDER BY c.created_at DESC, c.comment_id DESC LIMIT 21 OFFSET ?', [postId, (page - 1) * 20]);
  res.set('Cache-Control', 'no-store');
  res.json({ data: comments.slice(0, 20), page, hasMore: comments.length > 20 });
}));
communityRouter.get('/comments/:id/replies', asyncHandler(async (req, res) => {
  const parentId = id(req.params.id), page = pageNumber(req.query.page);
  const [parents] = await pool.execute('SELECT post_id FROM school_post_comments WHERE comment_id = ? AND parent_comment_id IS NULL AND deleted = FALSE AND hidden_by_admin = FALSE', [parentId]);
  assert(parents.length, 404, 'Comment not available.');
  await requirePublicPost(pool, parents[0].post_id);
  const [replies] = await pool.execute(
    'SELECT c.comment_id AS id, c.body, CASE WHEN c.author_is_admin THEN \'Administrator\' ELSE s.school_name END AS author, ' +
    'CASE WHEN c.author_is_admin THEN \'admin\' ELSE \'institution\' END AS "authorType", ' +
    'c.author_school_id AS "schoolId", c.parent_comment_id AS "parentCommentId", c.created_at AS "createdAt" ' +
    'FROM school_post_comments c LEFT JOIN schools s ON s.school_id = c.author_school_id ' +
    'WHERE c.parent_comment_id = ? AND c.post_id = ? AND c.deleted = FALSE AND c.hidden_by_admin = FALSE ' +
    'ORDER BY c.created_at DESC, c.comment_id DESC LIMIT 21 OFFSET ?', [parentId, parents[0].post_id, (page - 1) * 20]);
  res.set('Cache-Control', 'no-store');
  res.json({ data: replies.slice(0, 20), page, hasMore: replies.length > 20 });
}));
communityRouter.use(requireAuth, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    assert(req.user.email_verified_at && (isAdminUser(req.user) || ['student', 'institution'].includes(req.user.account_type)), 403, 'A verified student, institution, or administrator account is required.');
    next();
  } catch (error) { next(error); }
});
communityRouter.get('/me', asyncHandler(async (req, res) => {
  const schoolId = id(req.query.schoolId);
  let replySchoolId = null;
  if (req.user.account_type === 'institution' && !isAdminUser(req.user)) {
    const owner = await ownedInstitution(pool, req.user, { active: false });
    if (owner.status === 'approved' && owner.is_active_available === true && owner.school_id === schoolId) replySchoolId = owner.school_id;
  }
  const [[likes], [comments]] = await Promise.all([
    pool.execute('SELECT l.post_id AS id FROM school_post_likes l JOIN school_posts p ON p.post_id = l.post_id WHERE l.user_id = ? AND p.school_id = ?', [req.user.user_id, schoolId]),
    pool.execute('SELECT c.comment_id AS id FROM school_post_comments c JOIN school_posts p ON p.post_id = c.post_id WHERE c.user_id = ? AND p.school_id = ? AND c.deleted = FALSE', [req.user.user_id, schoolId])
  ]);
  res.json({ likedPostIds: likes.map(row => row.id), ownCommentIds: comments.map(row => row.id), replySchoolId });
}));
communityRouter.use(rateLimit({ windowMs: 60000, limit: 30 }));
communityRouter.put('/posts/:id/like', requireStudent, asyncHandler(async (req, res) => {
  await withTransaction(async connection => {
    const post = await requirePublicPost(connection, req.params.id, { lock: true });
    const [insert] = await connection.execute('INSERT INTO school_post_likes (post_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [req.params.id, req.user.user_id]);
    if (insert.affectedRows) await notifySchool(connection, post, req.user.user_id, 'like');
  });
  res.json({ liked: true });
}));
communityRouter.delete('/posts/:id/like', requireStudent, asyncHandler(async (req, res) => {
  await pool.execute('DELETE FROM school_post_likes WHERE post_id = ? AND user_id = ?', [id(req.params.id), req.user.user_id]);
  res.status(204).end();
}));
communityRouter.post('/posts/:id/comments', asyncHandler(async (req, res) => {
  assert(typeof req.body?.body === 'string', 400, 'Comment must be text.');
  const body = text(req.body.body, 'Comment', 2000);
  const parentId = req.body.parentCommentId == null ? null : id(req.body.parentCommentId);
  const admin = isAdminUser(req.user), institution = !admin && req.user.account_type === 'institution';
  assert(admin || (institution ? parentId : !parentId), 403, institution ? 'Schools can reply to comments on their own posts.' : 'Students can start comments; replies are reserved for schools and administrators.');
  let commentId;
  await withTransaction(async connection => {
    // Same lock order as institutional post editing: owner, then post, then parent.
    const owner = institution ? await ownedInstitution(connection, req.user, { lock: true }) : null;
    const post = await requirePublicPost(connection, req.params.id, { lock: true });
    if (institution) {
      assert(post.school_id === owner.school_id, 403, 'You can reply only on your own school posts.');
    }
    if (parentId) {
      const [parents] = await connection.execute('SELECT comment_id FROM school_post_comments WHERE comment_id = ? AND post_id = ? AND parent_comment_id IS NULL AND author_school_id IS NULL AND deleted = FALSE AND hidden_by_admin = FALSE FOR UPDATE', [parentId, req.params.id]);
      assert(parents.length, 404, 'Comment not available for a reply.');
    }
    if (admin) {
      const [insert] = await connection.execute('INSERT INTO school_post_comments (post_id, user_id, body, parent_comment_id, author_is_admin) VALUES (?, ?, ?, ?, TRUE) RETURNING comment_id AS id', [req.params.id, req.user.user_id, body, parentId]);
      commentId = insert.rows?.[0]?.id;
      await connection.execute('INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, detail) VALUES (?, ?, ?, ?, ?)', [req.user.user_id, 'admin_community_commented', 'post', req.params.id, parentId ? 'Administrator replied to a public comment.' : 'Administrator commented on a public school post.']);
    } else if (institution) {
      const [insert] = await connection.execute('INSERT INTO school_post_comments (post_id, user_id, body, parent_comment_id, author_school_id) VALUES (?, ?, ?, ?, ?) RETURNING comment_id AS id', [req.params.id, req.user.user_id, body, parentId, owner.school_id]);
      commentId = insert.rows?.[0]?.id;
    } else {
      const [insert] = await connection.execute('INSERT INTO school_post_comments (post_id, user_id, body) VALUES (?, ?, ?) RETURNING comment_id AS id', [req.params.id, req.user.user_id, body]);
      commentId = insert.rows?.[0]?.id;
    }
    if (commentId) {
      await notifySchool(connection, post, req.user.user_id, parentId ? 'reply' : 'comment', commentId);
      if (parentId) await notifyStudentReply(connection, post, req.user.user_id, commentId, parentId);
    }
  });
  res.status(201).json({ id: commentId, message: admin ? 'Administrator comment posted.' : institution ? 'School reply posted.' : 'Comment posted.' });
}));
communityRouter.delete('/comments/:id', asyncHandler(async (req, res) => {
  const [result] = await pool.execute('UPDATE school_post_comments SET deleted = TRUE WHERE comment_id = ? AND user_id = ?', [id(req.params.id), req.user.user_id]);
  assert(result.affectedRows, 404, 'Your comment was not found.');
  res.status(204).end();
}));
