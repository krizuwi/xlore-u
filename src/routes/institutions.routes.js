import crypto from 'node:crypto';
import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth } from './middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { assert } from '../utils/http-error.js';
import { validateNameParts } from '../utils/user-name.js';
import { createVerificationCode, sha256 } from '../utils/security.js';
import { isEmailDeliveryEnabled, sendVerificationEmail } from '../services/email.js';
import { requirePolicyAcceptance } from '../services/account-policies.js';
import { validateImageUpload } from '../services/media-upload.js';
import { id, text } from '../services/admin-validation.js';
import { institutionRegistrationLimits as registrationLimits } from '../services/institution-registration.js';
import { validateInstitutionName, validateInstitutionPassword } from '../services/institution-account.js';
import { validateApplication, validateInstitutionProfile, validateInstitutionProgram, validatePost,
  ownedInstitution, assertOwnedMedia, auditInstitution } from '../services/institutions.js';

export const institutionsRouter = Router();
institutionsRouter.get('/schools', asyncHandler(async (req, res) => {
  const search = text(req.query.search, 'Search', registrationLimits.search, false);
  const [data] = await pool.execute(`SELECT s.school_id AS id, s.school_name AS name, s.city_district AS city,
    EXISTS (SELECT 1 FROM institution_applications ia WHERE ia.school_id = s.school_id AND ia.status IN ('approved', 'suspended')) AS claimed
    FROM schools s WHERE s.school_name ILIKE ? OR s.city_district ILIKE ? ORDER BY s.school_name LIMIT 50`, [`%${search}%`, `%${search}%`]);
  res.json({ data });
}));
institutionsRouter.post('/register', rateLimit({ windowMs: 3600000, limit: 10 }), asyncHandler(async (req, res) => {
  const names = validateNameParts(req.body), email = text(req.body.email, 'Email', registrationLimits.email).toLowerCase();
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, 'Enter a valid institutional contact email.');
  const password = String(req.body.password ?? '');
  assert(password.length >= 8 && password.length <= registrationLimits.password && Buffer.byteLength(password, 'utf8') <= registrationLimits.password && password === req.body.confirmPassword, 400, 'Use matching passwords of 8–72 characters and no more than 72 UTF-8 bytes.');
  const policy = requirePolicyAcceptance(req.body), application = validateApplication(req.body);
  assert(isEmailDeliveryEnabled(), 503, 'Registration email is not configured.');
  const userId = crypto.randomUUID(), code = createVerificationCode(), hash = await bcrypt.hash(password, 12);
  await withTransaction(async connection => {
    const [existing] = await connection.execute('SELECT user_id FROM users WHERE email = ?', [email]);
    assert(!existing.length, 409, 'This email already has an account. Use a separate institution contact account.');
    if (application.schoolId) {
      const [schools] = await connection.execute('SELECT school_id FROM schools WHERE school_id = ?', [application.schoolId]);
      assert(schools.length, 400, 'Select one existing school from the directory.');
      const [owners] = await connection.execute("SELECT user_id FROM institution_applications WHERE school_id = ? AND status IN ('approved', 'suspended')", [application.schoolId]);
      assert(!owners.length, 409, 'This school already has an institution account. Contact the project administrator.');
    }
    await connection.execute(`INSERT INTO users (user_id, email, password_hash, full_name, first_name, middle_name, last_name,
      account_type, policy_version, policy_accepted_at, verification_code_hash, verification_expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'institution', ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
    [userId, email, hash, names.fullName, names.firstName, names.middleName, names.lastName, policy, sha256(code)]);
    await connection.execute(`INSERT INTO institution_applications (user_id, school_id, proposed_school, representative_title,
      contact_phone, verification_url, verification_note) VALUES (?, ?, ?::jsonb, ?, ?, ?, ?)`,
    [userId, application.schoolId, application.proposedSchool ? JSON.stringify(application.proposedSchool) : null,
      application.representativeTitle, application.contactPhone, application.verificationUrl, application.verificationNote]);
    await sendVerificationEmail({ to: email, name: names.fullName, code });
  });
  res.status(201).json({ message: 'Verify your contact email, then sign in to track admin approval. School access remains pending.' });
}));

institutionsRouter.use(requireAuth, rateLimit({ windowMs: 60000, limit: 90 }), (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
institutionsRouter.get('/account', asyncHandler(async (req, res) => {
  const owner = await ownedInstitution(pool, req.user, { active: false });
  const [schools] = owner.school_id ? await pool.execute('SELECT school_id AS id, school_name AS name FROM schools WHERE school_id = ?', [owner.school_id]) : [[]];
  res.json({ email: req.user.email, representativeName: req.user.full_name,
    school: schools[0] ?? null, proposedName: owner.proposed_school?.name ?? '',
    canRename: owner.status === 'approved' && owner.is_active_available === true });
}));
institutionsRouter.patch('/account', asyncHandler(async (req, res) => {
  const name = validateInstitutionName(req.body?.schoolName);
  assert(typeof req.body?.expectedName === 'string', 400, 'Reload account settings before changing the institution name.');
  await withTransaction(async connection => {
    const owner = await ownedInstitution(connection, req.user, { lock: true });
    const [schools] = await connection.execute('SELECT school_name, city_district FROM schools WHERE school_id = ? FOR UPDATE', [owner.school_id]);
    assert(schools.length, 404, 'Your institution was not found.');
    assert(schools[0].school_name === req.body.expectedName, 409, 'The institution name changed. Reload settings before saving.');
    const [duplicates] = await connection.execute('SELECT school_id FROM schools WHERE LOWER(school_name) = LOWER(?) AND LOWER(city_district) = LOWER(?) AND school_id <> ?', [name, schools[0].city_district, owner.school_id]);
    assert(!duplicates.length, 409, 'Another school with this name already exists in your city.');
    if (schools[0].school_name !== name) {
      await connection.execute('UPDATE schools SET school_name = ?, catalog_last_updated_at = CURRENT_TIMESTAMP WHERE school_id = ?', [name, owner.school_id]);
      await auditInstitution(connection, req.user.user_id, 'institution_renamed', 'school', owner.school_id,
        JSON.stringify({ previousName: schools[0].school_name, name }));
    }
  });
  res.json({ schoolName: name, message: 'Institution name updated.' });
}));
institutionsRouter.post('/account/password', rateLimit({ windowMs: 15 * 60000, limit: 10 }), asyncHandler(async (req, res) => {
  assert(req.user.account_type === 'institution' && req.user.email_verified_at, 403, 'A verified institution account is required.');
  const { currentPassword, newPassword } = validateInstitutionPassword(req.body);
  await withTransaction(async connection => {
    const [users] = await connection.execute("SELECT password_hash FROM users WHERE user_id = ? AND account_type = 'institution' AND is_active = TRUE AND email_verified_at IS NOT NULL FOR UPDATE", [req.user.user_id]);
    assert(users[0]?.password_hash && await bcrypt.compare(currentPassword, users[0].password_hash), 400, 'Current password is incorrect.');
    // Never record password values in the audit log or return the hash.
    await connection.execute('UPDATE users SET password_hash = ?, password_reset_code_hash = NULL, password_reset_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [await bcrypt.hash(newPassword, 12), req.user.user_id]);
    await connection.execute('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL', [req.user.user_id]);
    await auditInstitution(connection, req.user.user_id, 'institution_password_changed', 'user', req.user.user_id, 'Institution password changed and refresh sessions revoked.');
  });
  res.json({ signInAgain: true, message: 'Password updated. Sign in again with your new password.' });
}));
institutionsRouter.get('/me', asyncHandler(async (req, res) => {
  const application = await ownedInstitution(pool, req.user, { active: false });
  let school = null, programs = [], posts = [];
  if (application.school_id && ['approved', 'suspended'].includes(application.status)) {
    const [schools] = await pool.execute(`SELECT school_id AS id, school_name AS name, school_type AS type, address,
      city_district AS city, latitude, longitude, official_website_url AS website, description, tuition_range AS "tuitionRange",
      scholarship_info AS "scholarshipInfo", logo_url AS "logoUrl", logo_credit AS "logoCredit", campus_photos AS "campusPhotos"
      FROM schools WHERE school_id = ?`, [application.school_id]);
    school = schools[0];
    [programs] = await pool.execute(`SELECT p.program_id AS id, p.program_name AS name, p.description, p.category,
      p.degree_level AS "degreeLevel", p.requirements, p.career_paths AS "careerPaths", p.interest_tags AS "interestTags",
      p.managed_by_school_id AS "managedBySchoolId", (p.managed_by_school_id = sp.school_id AND NOT EXISTS
        (SELECT 1 FROM school_programs other WHERE other.program_id = p.program_id AND other.school_id <> sp.school_id)) AS "metadataEditable",
      sp.institution_details AS details, sp.source_url AS "sourceUrl",
      sp.tuition_per_semester AS tuition, sp.is_top_program AS "isTopProgram"
      FROM school_programs sp JOIN programs p ON p.program_id = sp.program_id WHERE sp.school_id = ? AND p.is_active = TRUE ORDER BY p.program_name`, [application.school_id]);
    [posts] = await pool.execute("SELECT post_id AS id, title, body, link_url AS link, images, status, hidden_by_admin AS \"hiddenByAdmin\", moderation_note AS \"moderationNote\", created_at AS \"createdAt\" FROM school_posts WHERE school_id = ? AND status <> 'deleted' ORDER BY created_at DESC LIMIT 100", [application.school_id]);
  }
  res.json({ application: { id: application.application_id, status: application.status, reviewNote: application.review_note,
    proposedSchool: application.proposed_school }, canEdit: application.status === 'approved' && application.is_active_available === true, school, programs, posts });
}));

institutionsRouter.put('/profile', asyncHandler(async (req, res) => {
  const item = validateInstitutionProfile(req.body);
  await withTransaction(async connection => {
    const owner = await ownedInstitution(connection, req.user, { lock: true });
    await assertOwnedMedia(connection, owner.school_id, [item.media.logoUrl, ...item.media.campusPhotos.map(photo => photo.url)]);
    await connection.execute(`UPDATE schools SET address = ?, city_district = ?, latitude = ?, longitude = ?, official_website_url = ?,
      description = ?, tuition_range = ?, scholarship_info = ?, logo_url = ?, logo_credit = ?::jsonb, campus_photos = ?::jsonb,
      catalog_last_updated_at = CURRENT_TIMESTAMP WHERE school_id = ?`, [item.address, item.city, item.latitude, item.longitude,
      item.website, item.description, item.tuitionRange, item.scholarshipInfo, item.media.logoUrl, JSON.stringify(item.media.logoCredit), JSON.stringify(item.media.campusPhotos), owner.school_id]);
    await auditInstitution(connection, req.user.user_id, 'institution_updated', 'school', owner.school_id, 'Institution updated its own school profile.');
  });
  res.json({ message: 'School profile saved.' });
}));

institutionsRouter.post('/media/assets', rateLimit({ windowMs: 60000, limit: 15 }), express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '4mb' }), asyncHandler(async (req, res) => {
  const contentType = validateImageUpload(req.body), asset = crypto.randomUUID();
  await withTransaction(async connection => {
    const owner = await ownedInstitution(connection, req.user, { lock: true });
    await connection.execute('INSERT INTO school_media_assets (asset_id, school_id, content_type, image_data) VALUES (?, ?, ?, ?)', [asset, owner.school_id, contentType, req.body]);
    await auditInstitution(connection, req.user.user_id, 'institution_uploaded', 'school', owner.school_id, 'Public school image uploaded.');
  });
  res.status(201).json({ url: `/api/school-media/${asset}` });
}));

institutionsRouter.put('/programs', asyncHandler(async (req, res) => {
  await withTransaction(async connection => {
    const owner = await ownedInstitution(connection, req.user, { lock: true });
    const item = validateInstitutionProgram(req.body, owner.school_id);
    let programId = item.programId;
    if (!programId) {
      const [existing] = await connection.execute('SELECT program_id FROM programs WHERE lower(program_name) = lower(?)', [item.name]);
      assert(!existing.length, 409, 'This program already exists. Select it from the catalog instead.');
      programId = crypto.randomUUID();
      await connection.execute(`INSERT INTO programs (program_id, program_name, description, category, degree_level, requirements, career_paths, interest_tags, is_active, managed_by_school_id)
        VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, TRUE, ?)`, [programId, item.name, item.description, item.category, item.degreeLevel,
        item.requirements, JSON.stringify(item.careerPaths), JSON.stringify(item.interestTags), owner.school_id]);
    } else {
      const [programs] = await connection.execute('SELECT program_id, managed_by_school_id FROM programs WHERE program_id = ? AND is_active = TRUE FOR UPDATE', [programId]);
      assert(programs.length, 404, 'Active catalog program not found.');
      if (programs[0].managed_by_school_id === owner.school_id) {
        const [shared] = await connection.execute('SELECT school_id FROM school_programs WHERE program_id = ? AND school_id <> ?', [programId, owner.school_id]);
        if (!shared.length) await connection.execute(`UPDATE programs SET program_name = ?, description = ?, category = ?, degree_level = ?,
          requirements = ?, career_paths = ?::jsonb, interest_tags = ?::jsonb WHERE program_id = ?`,
        [item.name, item.description, item.category, item.degreeLevel, item.requirements, JSON.stringify(item.careerPaths), JSON.stringify(item.interestTags), programId]);
      }
    }
    // Shared catalog metadata is never overwritten by another school's editor.
    const details = { description: item.description, requirements: item.requirements, careerPaths: item.careerPaths };
    await connection.execute(`INSERT INTO school_programs (school_program_id, school_id, program_id, tuition_per_semester, is_top_program, source_url, institution_details)
      VALUES (?, ?, ?, ?, ?, ?, ?::jsonb) ON CONFLICT (school_id, program_id) DO UPDATE SET
      tuition_per_semester = EXCLUDED.tuition_per_semester, is_top_program = EXCLUDED.is_top_program,
      source_url = EXCLUDED.source_url, institution_details = EXCLUDED.institution_details`,
    [crypto.randomUUID(), owner.school_id, programId, item.tuition, item.isTopProgram, item.sourceUrl, JSON.stringify(details)]);
    await auditInstitution(connection, req.user.user_id, 'institution_updated', 'program', programId, 'Institution saved its own school offering.');
  });
  res.json({ message: 'School program saved.' });
}));
institutionsRouter.delete('/programs/:id', asyncHandler(async (req, res) => {
  await withTransaction(async connection => {
    const owner = await ownedInstitution(connection, req.user, { lock: true });
    await connection.execute('DELETE FROM school_programs WHERE school_id = ? AND program_id = ?', [owner.school_id, id(req.params.id)]);
    await auditInstitution(connection, req.user.user_id, 'institution_removed', 'program', req.params.id, 'Institution removed its own offering only.');
  });
  res.status(204).end();
}));

async function savePost(req, res) {
  const item = validatePost(req.body), postId = req.params.id ? id(req.params.id) : crypto.randomUUID();
  await withTransaction(async connection => {
    const owner = await ownedInstitution(connection, req.user, { lock: true });
    await assertOwnedMedia(connection, owner.school_id, item.images.map(image => image.url));
    if (req.params.id) {
      const [result] = await connection.execute(`UPDATE school_posts SET title = ?, body = ?, link_url = ?, images = ?::jsonb,
        status = ?, updated_at = CURRENT_TIMESTAMP WHERE post_id = ? AND school_id = ? AND status <> 'deleted'`,
      [item.title, item.body, item.link, JSON.stringify(item.images), item.status, postId, owner.school_id]);
      assert(result.affectedRows, 404, 'Your school post was not found.');
    } else await connection.execute(`INSERT INTO school_posts (post_id, school_id, author_id, title, body, link_url, images, status)
      VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?)`, [postId, owner.school_id, req.user.user_id, item.title, item.body, item.link, JSON.stringify(item.images), item.status]);
    await auditInstitution(connection, req.user.user_id, 'institution_post_saved', 'post', postId, 'School post saved.');
  });
  res.status(req.params.id ? 200 : 201).json({ id: postId });
}
institutionsRouter.post('/posts', asyncHandler(savePost));
institutionsRouter.put('/posts/:id', asyncHandler(savePost));
institutionsRouter.delete('/posts/:id', asyncHandler(async (req, res) => {
  await withTransaction(async connection => {
    const owner = await ownedInstitution(connection, req.user, { lock: true });
    const [result] = await connection.execute("UPDATE school_posts SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE post_id = ? AND school_id = ?", [id(req.params.id), owner.school_id]);
    assert(result.affectedRows, 404, 'Your school post was not found.');
    await auditInstitution(connection, req.user.user_id, 'institution_post_deleted', 'post', req.params.id, 'School post removed from public view.');
  });
  res.status(204).end();
}));
