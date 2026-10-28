import { assert } from '../utils/http-error.js';
import { id, text, url, optionalSchoolCoordinates, validateSchool, validateProgram } from './admin-validation.js';
import { mediaUrl, validateSchoolMedia } from './school-media.js';
import { institutionRegistrationLimits as registrationLimits, MAX_INSTITUTION_REJECTIONS } from './institution-registration.js';
import { validateSchoolName, validatePhone } from '../utils/identity-validation.js';

export const institutionActiveSql = `EXISTS (SELECT 1 FROM institution_applications ia
  JOIN users iu ON iu.user_id = ia.user_id
  JOIN available_schools av ON av.school_id = ia.school_id
  WHERE ia.school_id = s.school_id AND ia.status = 'approved'
    AND iu.account_type = 'institution' AND iu.is_active = TRUE AND iu.email_verified_at IS NOT NULL AND av.is_active_available = TRUE)`;

export function httpsLink(value, required = false) {
  const result = url(value);
  assert(!required || result, 400, 'An official HTTPS link is required.');
  assert(!result || new URL(result).protocol === 'https:', 400, 'Links must use HTTPS.');
  return result;
}

export function validateApplication(body) {
  assert(body && typeof body === 'object' && !Array.isArray(body), 400, 'Provide institution registration details.');
  const schoolId = body.schoolId ? id(body.schoolId) : null;
  assert(Boolean(schoolId) !== Boolean(body.proposedSchool), 400, 'Select exactly one existing school OR request a new school.');
  if (!schoolId) validateSchoolName(body.proposedSchool?.name);
  validatePhone(body.contactPhone);
  assert(body.verificationUrl == null || typeof body.verificationUrl === 'string', 400, 'Verification link must be text.');
  const proposedSchool = schoolId ? null : validateSchool({ ...body.proposedSchool, description: text(body.proposedSchool?.description, 'School description', registrationLimits.description, false), status: 'Inactive', googleRating: null });
  if (proposedSchool) httpsLink(proposedSchool.website, true);
  return { schoolId, proposedSchool, representativeTitle: text(body.representativeTitle, 'Position / designation', registrationLimits.representativeTitle),
    contactPhone: text(body.contactPhone, 'Contact telephone', registrationLimits.contactPhone), verificationUrl: httpsLink(body.verificationUrl) ?? '',
    verificationNote: text(body.verificationNote, 'Authorization evidence / verification instructions', registrationLimits.verificationNote) };
}

export function validatePost(body) {
  assert(body && typeof body === 'object' && !Array.isArray(body), 400, 'Provide a post.');
  assert(typeof body.title === 'string' && typeof body.body === 'string', 400, 'Post title and content must be text.');
  assert(['draft', 'published'].includes(body.status), 400, 'Choose Draft or Published.');
  assert(Array.isArray(body.images) && body.images.length <= 6, 400, 'Use up to six photos.');
  const images = body.images.map(image => ({ url: mediaUrl(image?.url, 'Photo URL', true), caption: text(image?.caption, 'Photo caption', 200, false) }));
  assert(new Set(images.map(image => image.url)).size === images.length, 400, 'Remove duplicate post images.');
  return { title: text(body.title, 'Post title', 180), body: text(body.body, 'Post', 10000),
    link: httpsLink(body.link), images, status: body.status };
}

export function validateInstitutionProfile(body) {
  assert(body && typeof body === 'object' && !Array.isArray(body), 400, 'Provide school profile details.');
  // Name edits use the dedicated account-settings route. Type, activation, ratings and ownership stay admin-controlled.
  return { address: text(body.address, 'Address', 255), city: text(body.city, 'City', 100),
    ...optionalSchoolCoordinates(body),
    website: httpsLink(body.website, true), description: text(body.description, 'Description', 5000, false),
    tuitionRange: text(body.tuitionRange, 'General tuition information', 80, false) || 'Contact school',
    scholarshipInfo: text(body.scholarshipInfo, 'Scholarships', 5000, false), media: validateSchoolMedia(body.media) };
}

export function validateInstitutionProgram(body, schoolId) {
  assert(body && typeof body === 'object' && !Array.isArray(body), 400, 'Provide program details.');
  const item = validateProgram({ ...body, status: 'Active', schools: [{ id: schoolId, tuition: body.tuition }] });
  return { ...item, tuition: item.schools[0].tuition, sourceUrl: httpsLink(body.sourceUrl),
    isTopProgram: body.isTopProgram === true, programId: body.programId ? id(body.programId) : null };
}

export async function auditInstitution(connection, userId, action, entity, entityId, detail) {
  await connection.execute(`INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, detail)
    VALUES (?, ?, ?, ?, ?)`, [userId, action, entity, entityId, detail]);
}

export function institutionAttemptStatus(application) {
  const rejectionCount = application.rejection_count ?? 0;
  return { attemptNumber: application.attempt_number ?? 1, rejectionCount, maxRejections: MAX_INSTITUTION_REJECTIONS,
    canResubmit: application.status === 'rejected' && rejectionCount < MAX_INSTITUTION_REJECTIONS };
}

export function institutionRegistrationSnapshot(application, user, school = {}) {
  return { representativeName: user.full_name, firstName: user.first_name, middleName: user.middle_name,
    lastName: user.last_name, email: user.email, schoolId: application.school_id, proposedSchool: application.proposed_school,
    schoolName: school.name, schoolCity: school.city, schoolType: school.type, schoolAddress: school.address,
    title: application.representative_title, phone: application.contact_phone,
    verificationUrl: application.verification_url, evidence: application.verification_note };
}

export async function ownedInstitution(connection, user, { active = true, lock = false } = {}) {
  assert(user.account_type === 'institution' && user.email_verified_at, 403, 'A verified institution account is required.');
  const [rows] = await connection.execute(`SELECT ia.*, av.is_active_available FROM institution_applications ia
    LEFT JOIN available_schools av ON av.school_id = ia.school_id WHERE ia.user_id = ?${lock ? ' FOR UPDATE OF ia' : ''}`, [user.user_id]);
  assert(rows[0], 403, 'No institution application is linked to this account.');
  if (active) assert(rows[0].status === 'approved' && rows[0].is_active_available === true, 403,
    'Your institution must be approved and active before editing or posting.');
  return rows[0];
}

export async function assertOwnedMedia(connection, schoolId, values) {
  for (const value of values.filter(Boolean)) {
    if (!value.startsWith('/api/school-media/')) continue;
    const [assets] = await connection.execute('SELECT asset_id FROM school_media_assets WHERE asset_id = ? AND school_id = ?', [value.split('/').at(-1), schoolId]);
    assert(assets.length, 403, 'This uploaded image does not belong to your school.');
  }
}

export async function requirePublicPost(connection, postId, { lock = false } = {}) {
  const [rows] = await connection.execute(`SELECT p.post_id, p.school_id FROM school_posts p JOIN schools s ON s.school_id = p.school_id
    WHERE p.post_id = ? AND p.status = 'published' AND p.hidden_by_admin = FALSE AND ${institutionActiveSql}${lock ? ' FOR UPDATE OF p' : ''}`, [id(postId)]);
  assert(rows.length, 404, 'Post not available.');
  return rows[0];
}

// A removed/hidden student comment also removes its reply thread from public counts.
export const visibleSchoolCommentSql = `c.deleted = FALSE AND c.hidden_by_admin = FALSE AND
  (c.parent_comment_id IS NULL OR EXISTS (SELECT 1 FROM school_post_comments parent
    WHERE parent.comment_id = c.parent_comment_id AND parent.post_id = c.post_id
      AND parent.parent_comment_id IS NULL AND parent.deleted = FALSE AND parent.hidden_by_admin = FALSE))`;
