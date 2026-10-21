import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth } from './middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { assert } from '../utils/http-error.js';
import { requireEnrollmentStudent, validateEnrollment, ownEnrollment, ENROLLMENT_DECLARATION, ENROLLMENT_DECLARATION_VERSION } from '../services/student-enrollment.js';
import { resolveAddressArea } from '../services/proximity.js';

export const studentEnrollmentRouter = Router();
studentEnrollmentRouter.use(requireAuth, (req, res, next) => {
  try { requireEnrollmentStudent(req.user); res.set('Cache-Control', 'no-store'); next(); } catch (err) { next(err); }
}, rateLimit({ windowMs: 60000, limit: 60 }));

studentEnrollmentRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ enrollment: await ownEnrollment(req.user.user_id), suggestedCity: resolveAddressArea(req.user.address)?.name ?? '',
    declaration: { version: ENROLLMENT_DECLARATION_VERSION, text: ENROLLMENT_DECLARATION } });
}));
studentEnrollmentRouter.get('/schools', asyncHandler(async (req, res) => {
  assert(req.query.search === undefined || typeof req.query.search === 'string' && req.query.search.length <= 100, 400, 'Use up to 100 characters to search schools.');
  const literal = '%' + (req.query.search ?? '').trim().replace(/[\\%_]/g, '\\$&') + '%';
  const [data] = await pool.execute(`SELECT s.school_id AS id, s.school_name AS name, s.city_district AS city
    FROM schools s JOIN available_schools av ON av.school_id = s.school_id AND av.is_active_available = TRUE
    WHERE s.school_name ILIKE ? ESCAPE E'\\\\' OR s.city_district ILIKE ? ESCAPE E'\\\\'
    ORDER BY s.school_name, s.school_id LIMIT 30`, [literal, literal]);
  res.json({ data });
}));
studentEnrollmentRouter.put('/', rateLimit({ windowMs: 60000, limit: 10 }), asyncHandler(async (req, res) => {
  const item = validateEnrollment(req.body);
  const enrollment = await withTransaction(async connection => {
    // Lock the authenticated account first, serializing report/withdrawal with suspension.
    const [users] = await connection.execute("SELECT user_id FROM users WHERE user_id = ? AND is_active = TRUE AND account_type = 'student' FOR UPDATE", [req.user.user_id]);
    assert(users.length, 403, 'Your account is unavailable.');
    const [schools] = await connection.execute(`SELECT s.school_id FROM schools s JOIN available_schools av ON av.school_id = s.school_id
      WHERE s.school_id = ? AND av.is_active_available = TRUE FOR SHARE OF s, av`, [item.schoolId]);
    assert(schools.length, 400, 'Choose an available school from the search results.');
    await connection.execute(`INSERT INTO student_enrollments (user_id, school_id, city, used_xlore_u, helpful, declaration_version)
      VALUES (?, ?, ?, TRUE, TRUE, ?) ON CONFLICT (user_id) DO UPDATE SET school_id = EXCLUDED.school_id, city = EXCLUDED.city,
      used_xlore_u = TRUE, helpful = TRUE, declaration_version = EXCLUDED.declaration_version, reported_at = CURRENT_TIMESTAMP`,
    [req.user.user_id, item.schoolId, item.city, item.declarationVersion]);
    return ownEnrollment(req.user.user_id, connection);
  });
  res.json({ enrollment, message: 'Your enrollment report was saved for administrator review.' });
}));
studentEnrollmentRouter.delete('/', asyncHandler(async (req, res) => {
  await withTransaction(async connection => {
    const [users] = await connection.execute("SELECT user_id FROM users WHERE user_id = ? AND is_active = TRUE AND account_type = 'student' FOR UPDATE", [req.user.user_id]);
    assert(users.length, 403, 'Your account is unavailable.');
    await connection.execute('DELETE FROM student_enrollments WHERE user_id = ?', [req.user.user_id]);
  });
  res.json({ enrollment: null, message: 'Your enrollment report was withdrawn.' });
}));
