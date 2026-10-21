import { pool } from '../db/pool.js';
import { assert } from '../utils/http-error.js';
import { id } from './admin-validation.js';
import { ADMIN_EMAIL, isAdminUser } from '../utils/admin-access.js';
import { resolveAddressArea } from './proximity.js';

export const ENROLLMENT_DECLARATION_VERSION = 'enrollment-helpful-v1';
export const ENROLLMENT_DECLARATION = 'I confirm that I am enrolled at this school, used Xlore U to help find it, and found Xlore U helpful.';

export function requireEnrollmentStudent(user) {
  assert(user?.account_type === 'student' && user.email_verified_at && !isAdminUser(user), 403, 'A verified student account is required.');
}

export function validateEnrollment(body) {
  assert(body && typeof body === 'object' && !Array.isArray(body), 400, 'Provide enrollment details.');
  const schoolId = id(body.schoolId);
  assert(typeof body.city === 'string' && body.city.length <= 100, 400, 'Enter your city or municipality, up to 100 characters.');
  const city = body.city.normalize('NFC').trim().replace(/ +/g, ' ');
  assert(city.length > 0 && /^(?:\p{L}\p{M}*|[ .'-])+(?![\s\S])/u.test(city) && /\p{L}/u.test(city), 400, 'Enter only your city or municipality name, not a street address.');
  assert(body.usedXloreU === true && body.helpful === true && body.declarationVersion === ENROLLMENT_DECLARATION_VERSION,
    400, 'Check the enrollment and helpfulness declaration before submitting.');
  return { schoolId, city, declarationVersion: ENROLLMENT_DECLARATION_VERSION };
}

export async function ownEnrollment(userId, connection = pool) {
  const [rows] = await connection.execute(`SELECT e.school_id AS "schoolId", s.school_name AS "schoolName", s.city_district AS "schoolCity",
    e.city, e.used_xlore_u AS "usedXloreU", e.helpful, e.declaration_version AS "declarationVersion", e.reported_at AS "reportedAt"
    FROM student_enrollments e JOIN schools s ON s.school_id = e.school_id WHERE e.user_id = ?`, [userId]);
  return rows[0] ?? null;
}

function queryString(value, label, max) {
  assert(value === undefined || typeof value === 'string' && value.length <= max, 400, `Invalid ${label}.`);
  return value?.trim() ?? '';
}
export function studentFilters(query = {}) {
  const search = queryString(query.search, 'student search', 100);
  const status = queryString(query.status, 'account filter', 20);
  const enrollment = queryString(query.enrollment, 'enrollment filter', 20);
  const assessment = queryString(query.assessment, 'assessment filter', 20);
  const page = query.page ?? '1';
  assert(['', 'active', 'suspended'].includes(status) && ['', 'reported', 'unreported'].includes(enrollment)
    && ['', 'completed', 'not_completed'].includes(assessment), 400, 'Invalid student filter.');
  assert(typeof page === 'string' && /^[1-9][0-9]{0,5}$/.test(page), 400, 'Invalid student page.');
  return { search, status, enrollment, assessment, page: Number(page) };
}

export function studentReportQuery(query) {
  const filters = studentFilters(query);
  const clauses = ["u.account_type = 'student'", 'lower(u.email) <> ?'];
  const values = [ADMIN_EMAIL.toLowerCase()];
  if (filters.search) {
    const literal = '%' + filters.search.replace(/[\\%_]/g, '\\$&') + '%';
    clauses.push("(u.full_name ILIKE ? ESCAPE E'\\\\' OR u.email ILIKE ? ESCAPE E'\\\\' OR COALESCE(e.city, u.address, '') ILIKE ? ESCAPE E'\\\\' OR s.school_name ILIKE ? ESCAPE E'\\\\')");
    values.push(literal, literal, literal, literal);
  }
  if (filters.status) clauses.push(`u.is_active = ${filters.status === 'active' ? 'TRUE' : 'FALSE'}`);
  if (filters.enrollment) clauses.push(`e.user_id IS ${filters.enrollment === 'reported' ? 'NOT ' : ''}NULL`);
  const completed = 'EXISTS (SELECT 1 FROM assessments a WHERE a.user_id = u.user_id AND a.completed_at IS NOT NULL)';
  if (filters.assessment) clauses.push((filters.assessment === 'completed' ? '' : 'NOT ') + completed);
  return { filters, values, completed, from: `FROM users u LEFT JOIN student_enrollments e ON e.user_id = u.user_id
    LEFT JOIN schools s ON s.school_id = e.school_id WHERE ${clauses.join(' AND ')}` };
}

export async function getStudentReport(query) {
  const { filters, values, completed, from } = studentReportQuery(query);
  const [totals] = await pool.execute(`SELECT COUNT(*)::integer AS total,
    COUNT(e.user_id)::integer AS enrolled,
    COUNT(*) FILTER (WHERE ${completed})::integer AS assessed,
    COUNT(*) FILTER (WHERE NOT u.is_active)::integer AS suspended ${from}`, values);
  const total = Number(totals[0]?.total ?? 0), pageSize = 20, pages = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(filters.page, pages);
  const [rows] = await pool.execute(`SELECT u.user_id AS id, u.full_name AS name, u.email, u.address,
    u.is_active AS active, u.email_verified_at IS NOT NULL AS verified, u.created_at AS "createdAt",
    ${completed} AS "usedAssessment", e.city AS "enrollmentCity", e.school_id AS "schoolId", s.school_name AS "schoolName",
    e.reported_at AS "reportedAt", e.used_xlore_u AS "usedXloreU", e.helpful,
    (SELECT jsonb_build_object('id', act.action_id::text, 'reason', act.reason, 'active', act.active,
      'createdAt', act.created_at, 'emailStatus', act.email_state, 'emailAttempts', act.email_attempts)
      FROM student_account_actions act WHERE act.user_id = u.user_id ORDER BY act.action_id DESC LIMIT 1) AS "lastAction"
    ${from} ORDER BY u.created_at DESC, u.user_id LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]);
  const [schools] = await pool.execute(`SELECT s.school_id AS id, s.school_name AS label, COUNT(*)::integer AS count
    ${from} AND e.user_id IS NOT NULL GROUP BY s.school_id, s.school_name ORDER BY count DESC, s.school_name LIMIT 10`, values);
  const [cities] = await pool.execute(`SELECT lower(e.city) AS id, MIN(e.city) AS label, COUNT(*)::integer AS count
    ${from} AND e.user_id IS NOT NULL GROUP BY lower(e.city) ORDER BY count DESC, lower(e.city) LIMIT 10`, values);
  return {
    data: rows.map(({ address, enrollmentCity, ...row }) => ({ ...row,
      city: enrollmentCity || resolveAddressArea(address)?.name || null,
      citySource: enrollmentCity ? 'enrollment_report' : resolveAddressArea(address) ? 'profile_estimate' : 'unknown' })),
    summary: totals[0] ?? { total: 0, enrolled: 0, assessed: 0, suspended: 0 },
    charts: { schools, cities }, pagination: { page, pageSize, total, pages }, filters,
    declaration: { version: ENROLLMENT_DECLARATION_VERSION, text: ENROLLMENT_DECLARATION }
  };
}

export function validateStudentAccess(body) {
  assert(body && typeof body.active === 'boolean' && typeof body.expectedActive === 'boolean', 400, 'Reload the student record before changing access.');
  assert(typeof body.reason === 'string' && body.reason.trim().length >= 1 && body.reason.length <= 2000, 400, 'Enter an administrator reason, up to 2,000 characters.');
  assert(body.active !== body.expectedActive, 400, 'Choose a different account status.');
  return { active: body.active, expectedActive: body.expectedActive, reason: body.reason.trim() };
}
