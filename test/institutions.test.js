import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';

process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable'; process.env.NODE_ENV = 'test'; process.env.EMAIL_ENABLED = 'true';
process.env.SMTP_HOST = 'mail.example.test'; process.env.SMTP_USER = 'mail@example.test'; process.env.SMTP_PASS = 'test';
const mail = mock.fn(async () => ({}));
mock.method((await import('nodemailer')).default, 'createTransport', () => ({ sendMail: mail }));
const { app } = await import('../src/app.js');
const { rawPool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const { validateApplication, validatePost, ownedInstitution } = await import('../src/services/institutions.js');
const { ACCOUNT_POLICY_VERSION } = await import('../src/services/account-policies.js');
const { ADMIN_EMAIL } = await import('../src/utils/admin-access.js');
const schoolId = '40000000-0000-4000-8000-000000000001', otherSchool = '40000000-0000-4000-8000-000000000002';
const postId = '50000000-0000-4000-8000-000000000001', programId = '30000000-0000-4000-8000-000000000001';
const user = { user_id: '10000000-0000-4000-8000-000000000001', email: 'staff@example.test', email_verified_at: new Date(), account_type: 'institution' };
const student = { ...user, account_type: 'student', email: 'student@example.test' };
const admin = { ...student, email: ADMIN_EMAIL };
const owner = { user_id: user.user_id, application_id: postId, school_id: schoolId, status: 'approved', is_active_available: true };
const application = { schoolId, representativeTitle: 'Admissions officer', contactPhone: '021234567', verificationUrl: 'https://school.example/staff', verificationNote: 'Contact the listed department to verify my authority.' };
const profile = { address: 'Campus address', city: 'Taguig', latitude: 14.5, longitude: 121, website: 'https://school.example', description: 'School profile', media: { logoUrl: '', campusPhotos: [] } };
const post = { title: 'Admissions update', body: 'Applications are open.', status: 'published', link: '', images: [] };
const program = { programId, name: 'BS Computer Science', description: 'Our offering', category: 'Computing', degreeLevel: 'Bachelor', requirements: '', careerPaths: [], interestTags: [], tuition: 10000, sourceUrl: 'https://school.example/program' };

async function serve(t) {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api`;
}
function database(t, identity = user, resolve = () => undefined) {
  const calls = [];
  async function query(sql, values = []) {
    calls.push({ sql, values });
    if (/FROM users WHERE user_id/.test(sql) && sql.includes('password_hash')) return { command: 'SELECT', rows: identity ? [identity] : [] };
    let rows = await resolve(sql, values);
    if (rows === undefined && sql.includes('FROM institution_applications ia') && sql.includes('WHERE ia.user_id')) rows = [owner];
    if (rows !== undefined) return Array.isArray(rows) ? { command: 'SELECT', rows } : rows;
    return /^SELECT/.test(sql.trim()) ? { command: 'SELECT', rows: [] } : { command: 'UPDATE', rowCount: 1, rows: [] };
  }
  t.mock.method(rawPool, 'query', query);
  t.mock.method(rawPool, 'connect', async () => ({ query, release() {} }));
  return calls;
}
async function request(t, identity, method, path, body) {
  return fetch(await serve(t) + path, { method, headers: { ...(identity ? { Authorization: `Bearer ${createAccessToken(identity)}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined || method === 'GET' ? {} : { body: JSON.stringify(body) }) });
}

test('registration accepts exactly one existing school or one new-school request, never both', () => {
  assert.equal(validateApplication(application).schoolId, schoolId);
  for (const invalid of [{ ...application, schoolId: null }, { ...application, schoolId: 'forged' }, { ...application, proposedSchool: profile }, { ...application, verificationUrl: 'javascript:alert(1)' }]) assert.throws(() => validateApplication(invalid));
  const proposed = { ...profile, name: 'New University', type: 'Private' };
  const result = validateApplication({ ...application, schoolId: null, proposedSchool: proposed });
  assert.equal(result.proposedSchool.status, 'Inactive'); assert.equal(result.schoolId, null);
});

test('institution registration enforces exact title, telephone, evidence and new-school description boundaries', () => {
  for (const [field, max] of [['representativeTitle', 100], ['contactPhone', 30], ['verificationNote', 1000]]) {
    assert.equal(validateApplication({ ...application, [field]: (field === 'contactPhone' ? '0' : 'x').repeat(max) })[field].length, max);
    assert.throws(() => validateApplication({ ...application, [field]: 'x'.repeat(max + 1) }));
  }
  const proposedSchool = { ...profile, name: 'New University', type: 'Private', description: 'x'.repeat(2000) };
  assert.equal(validateApplication({ ...application, schoolId: null, proposedSchool }).proposedSchool.description.length, 2000);
  assert.throws(() => validateApplication({ ...application, schoolId: null, proposedSchool: { ...proposedSchool, description: 'x'.repeat(2001) } }));
});

test('overlong institution registration fields are rejected before database writes or email', async t => {
  const calls = database(t), beforeMail = mail.mock.callCount();
  const valid = { firstName: 'School', middleName: '', lastName: 'Staff', email: 'staff@school.example', password: 'FixtureOnly123!', confirmPassword: 'FixtureOnly123!', acceptedPolicies: true, policyVersion: ACCOUNT_POLICY_VERSION, ...application };
  for (const change of [{ representativeTitle: 'x'.repeat(101) }, { contactPhone: 'x'.repeat(31) }, { verificationNote: 'x'.repeat(1001) }, { email: 'x'.repeat(180) + '@example.test' }, { firstName: 'x'.repeat(21) }, { password: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }]) {
    assert.equal((await request(t, null, 'POST', '/institutions/register', { ...valid, ...change })).status, 400);
  }
  assert.equal(calls.length, 0); assert.equal(mail.mock.callCount(), beforeMail);
});
test('posts reject invalid status, oversized bodies, executable links and unsupported photos', () => {
  assert.equal(validatePost(post).body, post.body);
  for (const bad of [null, { ...post, body: {} }, { ...post, status: 'approved' }, { ...post, body: 'x'.repeat(10001) }, { ...post, link: 'javascript:alert(1)' }, { ...post, images: Array(7).fill({ url: 'https://example.test/a.png' }) }, { ...post, images: [{ url: 'data:image/png;base64,test' }] }]) assert.throws(() => validatePost(bad));
});
test('institution schema preserves old accounts and enforces one-school ownership and like uniqueness', () => {
  const sql = readFileSync(new URL('../database/migrations/024_institution_portal.sql', import.meta.url), 'utf8');
  assert.match(sql, /DEFAULT 'student'/); assert.match(sql, /user_id uuid NOT NULL UNIQUE/);
  assert.match(sql, /CREATE UNIQUE INDEX institution_school_owner[\s\S]*status IN \('approved', 'suspended'\)/);
  assert.match(sql, /PRIMARY KEY \(post_id, user_id\)/); assert.match(sql, /ENABLE ROW LEVEL SECURITY/g);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|DROP TABLE/);
});

test('school claim migration reserves only approved applications without deleting suspended history', () => {
  const sql = readFileSync(new URL('../database/migrations/032_release_suspended_school_claims.sql', import.meta.url), 'utf8');
  assert.match(sql, /DROP INDEX institution_school_owner/);
  assert.match(sql, /CREATE UNIQUE INDEX institution_school_owner[\s\S]*WHERE status = 'approved'/);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|DROP TABLE|UPDATE institution_applications/);
});

test('registration chooser reserves approved schools only and prevents stale cached availability', async t => {
  const calls = database(t, null, sql => sql.startsWith('SELECT s.school_id AS id') ? [{ id: schoolId, claimed: false }] : undefined);
  const response = await request(t, null, 'GET', '/institutions/schools?search=School');
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).data[0].claimed, false);
  const query = calls.find(call => call.sql.startsWith('SELECT s.school_id AS id'));
  assert.match(query.sql, /ia.status = 'approved'/); assert.doesNotMatch(query.sql, /suspended/);
});

for (const reserved of [false, true]) test(`new school registration ${reserved ? 'rejects an approved owner' : 'accepts a released school as pending'}`, async t => {
  const calls = database(t, null, sql => {
    if (sql.startsWith('SELECT school_id FROM schools')) return [{ school_id: schoolId }];
    if (sql.startsWith('SELECT user_id FROM institution_applications')) return reserved ? [{ user_id: user.user_id }] : [];
  });
  const response = await request(t, null, 'POST', '/institutions/register', {
    firstName: 'New', lastName: 'Representative', middleName: '', email: 'replacement@school.example',
    password: 'FixtureOnly123!', confirmPassword: 'FixtureOnly123!', acceptedPolicies: true, policyVersion: ACCOUNT_POLICY_VERSION, ...application
  });
  assert.equal(response.status, reserved ? 409 : 201);
  const lock = calls.findIndex(call => call.sql.startsWith('SELECT school_id FROM schools'));
  assert.match(calls[lock].sql, /FOR UPDATE/);
  const check = calls.findIndex(call => call.sql.startsWith('SELECT user_id FROM institution_applications'));
  assert.ok(lock < check); assert.match(calls[check].sql, /status = 'approved'/); assert.doesNotMatch(calls[check].sql, /suspended/);
  assert.equal(calls.some(call => call.sql.includes('INSERT INTO institution_applications')), !reserved);
  assert.ok(!calls.some(call => call.sql.startsWith('UPDATE institution_applications') || call.sql.includes('INSERT INTO schools')));
  assert.equal(calls.at(-1).sql, reserved ? 'ROLLBACK' : 'COMMIT');
});

for (const decision of ['approve', 'resume']) test(`${decision} rejects a school already approved for a replacement account`, async t => {
  const calls = database(t, admin, sql => {
    if (sql.startsWith('SELECT * FROM institution_applications')) return [{ ...owner, status: decision === 'resume' ? 'suspended' : 'pending' }];
    if (sql.startsWith('SELECT user_id FROM users')) return [{ user_id: user.user_id }];
    if (sql.startsWith('SELECT application_id FROM institution_applications')) return [{ application_id: otherSchool }];
  });
  const response = await request(t, admin, 'POST', `/admin/institutions/applications/${postId}/review`, { decision, verifiedAuthority: true, note: 'Verified representative' });
  assert.equal(response.status, 409); assert.match((await response.json()).error.message, /another approved institution account/);
  const lock = calls.findIndex(call => call.sql.startsWith('SELECT school_id FROM schools'));
  const check = calls.findIndex(call => call.sql.startsWith('SELECT application_id FROM institution_applications'));
  assert.ok(lock >= 0 && lock < check); assert.match(calls[lock].sql, /FOR UPDATE/);
  assert.match(calls[check].sql, /status = 'approved'/); assert.doesNotMatch(calls[check].sql, /suspended/);
  assert.ok(!calls.some(call => call.sql.startsWith('UPDATE institution_applications')));
  assert.equal(calls.at(-1).sql, 'ROLLBACK');
});

test('suspended representatives retain application status but cannot read replacement drafts or program editing data', async t => {
  const calls = database(t, user, sql => {
    if (sql.includes('FROM institution_applications ia') && sql.includes('WHERE ia.user_id')) return [{ ...owner, status: 'suspended' }];
    if (sql.includes('FROM schools WHERE school_id')) return [{ id: schoolId, name: 'Released school' }];
  });
  const response = await request(t, user, 'GET', '/institutions/me');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.application.status, 'suspended'); assert.equal(result.school.name, 'Released school'); assert.equal(result.canEdit, false);
  assert.deepEqual(result.posts, []); assert.deepEqual(result.programs, []);
  assert.ok(!calls.some(call => call.sql.includes('FROM school_posts') || call.sql.includes('FROM school_programs')));
});
test('anonymous users cannot enter institution, review or interaction endpoints', async t => {
  const calls = database(t);
  for (const [method, path] of [['GET', '/institutions/me'], ['PUT', '/institutions/profile'], ['POST', '/institutions/posts'], ['GET', '/admin/institutions/applications'], ['PUT', `/community/posts/${postId}/like`]]) assert.equal((await request(t, null, method, path, {})).status, 401);
  assert.equal(calls.length, 0);
});
test('student account cannot impersonate an institution or administrator through request fields', async t => {
  const calls = database(t, student);
  assert.equal((await request(t, student, 'PUT', '/institutions/profile', { ...profile, role: 'institution', schoolId })).status, 403);
  assert.equal((await request(t, student, 'GET', '/admin/institutions/applications')).status, 403);
  assert.ok(!calls.some(call => call.sql.startsWith('UPDATE')));
});

test('application review is admin-only and explicitly selects representative name parts/contact/evidence without credentials', async t => {
  const row = { id: postId, representativeName: 'Ana Maria Santos', firstName: 'Ana', middleName: 'Maria', lastName: 'Santos', title: 'Admissions officer', email: 'staff@example.test', phone: '02 1234 5678', emailVerified: true, verificationUrl: 'https://school.example/staff', evidence: 'Contact admissions', createdAt: '2026-10-20T00:00:00Z' };
  const calls = database(t, admin, sql => sql.includes('WHERE ia.status =') ? [row] : undefined);
  const response = await request(t, admin, 'GET', '/admin/institutions/applications?status=approved');
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await response.json()).data[0], row);
  const query = calls.find(call => call.sql.includes('WHERE ia.status ='));
  for (const field of ['u.first_name AS "firstName"', 'u.middle_name AS "middleName"', 'u.last_name AS "lastName"', 'ia.representative_title', 'ia.contact_phone', 'ia.verification_url', 'ia.verification_note', 'ia.created_at']) assert.ok(query.sql.includes(field), field);
  assert.ok(!query.sql.includes('password_hash') && !query.sql.includes('verification_code_hash') && !query.sql.includes('u.*'));
});
test('application search is status-scoped, parameterized and applied before the result limit', async t => {
  const calls = database(t, admin);
  assert.equal((await request(t, admin, 'GET', '/admin/institutions/applications?status=approved&search=STI%25_')).status, 200);
  const query = calls.find(call => call.sql.includes('WHERE ia.status ='));
  assert.deepEqual(query.values, ['approved', '%STI\\%\\_%', '%STI\\%\\_%', '%STI\\%\\_%', '%STI\\%\\_%']);
  for (const phrase of ['s.school_name ILIKE $2', "ia.proposed_school->>'name' ILIKE $3", 'u.full_name ILIKE $4', 'u.email ILIKE $5', 'ORDER BY ia.created_at, ia.application_id LIMIT 200']) assert.ok(query.sql.includes(phrase), phrase);
  assert.ok(query.sql.indexOf('ILIKE') < query.sql.indexOf('LIMIT 200'));
});
test('application search rejects repeated or oversized terms without reading private applications', async t => {
  const calls = database(t, admin);
  for (const query of ['search=' + 'x'.repeat(101), 'search=a&search=b']) {
    const response = await request(t, admin, 'GET', '/admin/institutions/applications?' + query);
    assert.equal(response.status, 400);
  }
  assert.equal(calls.filter(call => call.sql.includes('WHERE ia.status =')).length, 0);
});
for (const identity of [null, student, user]) test('application search never exposes contact details to non-admin accounts', async t => {
  const calls = database(t, identity);
  assert.equal((await request(t, identity, 'GET', '/admin/institutions/applications?search=staff')).status, identity ? 403 : 401);
  assert.ok(!calls.some(call => call.sql.includes('WHERE ia.status =')));
});
for (const status of ['pending', 'rejected', 'suspended']) test(`${status} institutions cannot edit or publish`, async t => {
  const calls = database(t, user, sql => sql.includes('FROM institution_applications ia') ? [{ ...owner, status }] : undefined);
  assert.equal((await request(t, user, 'PUT', '/institutions/profile', profile)).status, 403);
  assert.equal((await request(t, user, 'POST', '/institutions/posts', post)).status, 403);
  assert.ok(!calls.some(call => /^(UPDATE|INSERT INTO school_posts)/.test(call.sql)));
});
test('pending claim cannot read existing institution draft posts or internal program editor data', async t => {
  const calls = database(t, user, sql => sql.includes('FROM institution_applications ia') ? [{ ...owner, status: 'pending' }] : undefined);
  const response = await request(t, user, 'GET', '/institutions/me'); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.canEdit, false); assert.deepEqual(data.posts, []);
  assert.ok(!calls.some(call => call.sql.includes('FROM school_posts')));
});
test('profile updates always use the authenticated school, ignoring forged school IDs and protected fields', async t => {
  const calls = database(t);
  const response = await request(t, user, 'PUT', '/institutions/profile', { ...profile, schoolId: otherSchool, status: 'Active', name: 'Forged', googleRating: 5 });
  assert.equal(response.status, 200);
  const update = calls.find(call => call.sql.startsWith('UPDATE schools'));
  assert.equal(update.values.at(-1), schoolId); assert.ok(!update.values.includes(otherSchool));
  assert.doesNotMatch(update.sql, /school_name|google_rating|is_active_available/);
});
test('foreign uploaded image references cannot be attached to a school profile or post', async t => {
  const calls = database(t, user, sql => sql.includes('FROM school_media_assets') ? [] : undefined);
  const response = await request(t, user, 'POST', '/institutions/posts', { ...post, images: [{ url: `/api/school-media/${postId}` }] });
  assert.equal(response.status, 403); assert.ok(!calls.some(call => call.sql.includes('INSERT INTO school_posts')));
});
test('post edits are scoped to own school and cannot clear admin moderation', async t => {
  const calls = database(t, user, sql => sql.startsWith('UPDATE school_posts') ? { command: 'UPDATE', rowCount: 0, rows: [] } : undefined);
  assert.equal((await request(t, user, 'PUT', `/institutions/posts/${postId}`, { ...post, schoolId: otherSchool, hiddenByAdmin: false })).status, 404);
  const update = calls.find(call => call.sql.startsWith('UPDATE school_posts'));
  assert.deepEqual(update.values.slice(-2), [postId, schoolId]); assert.doesNotMatch(update.sql, /hidden_by_admin =/);
});

test('approved institutions publish immediately without any per-post admin approval', async t => {
  const calls = database(t);
  const response = await request(t, user, 'POST', '/institutions/posts', post);
  assert.equal(response.status, 201);
  const insert = calls.find(call => call.sql.includes('INSERT INTO school_posts'));
  assert.equal(insert.values.at(-1), 'published');
  assert.ok(!calls.some(call => call.sql.includes('UPDATE institution_applications')));
});

for (const identity of [null, user, student, { ...admin, email_verified_at: null }]) test('post deletion rejects ' + (identity ? identity.email_verified_at ? identity.account_type : 'unverified admin' : 'anonymous caller'), async t => {
  const calls = database(t, identity);
  const response = await request(t, identity, 'DELETE', `/admin/institutions/posts/${postId}`, { role: 'admin' });
  assert.equal(response.status, identity ? 403 : 401);
  assert.ok(!calls.some(call => call.sql.startsWith('UPDATE school_posts')));
});

test('verified admin deletes any school post transactionally with an audit record, not a physical purge', async t => {
  const calls = database(t, admin);
  const response = await request(t, admin, 'DELETE', `/admin/institutions/posts/${postId}`, { note: 'Inappropriate school announcement', schoolId: otherSchool });
  assert.equal(response.status, 204);
  const update = calls.find(call => call.sql.startsWith('UPDATE school_posts'));
  assert.match(update.sql, /status = 'deleted'/);
  assert.deepEqual(update.values, ['Inappropriate school announcement', postId]);
  assert.doesNotMatch(update.sql, /school_id =|DELETE FROM/);
  const audit = calls.find(call => call.sql.includes('INSERT INTO admin_audit_log'));
  assert.deepEqual(audit.values, [admin.user_id, 'admin_post_deleted', 'post', postId, 'Inappropriate school announcement']);
  assert.equal(calls.at(-1).sql, 'COMMIT');
});

test('missing or already deleted post returns 404 and rolls back without an audit entry', async t => {
  const calls = database(t, admin, sql => sql.startsWith('UPDATE school_posts') ? { command: 'UPDATE', rowCount: 0, rows: [] } : undefined);
  assert.equal((await request(t, admin, 'DELETE', `/admin/institutions/posts/${postId}`)).status, 404);
  assert.ok(!calls.some(call => call.sql.includes('INSERT INTO admin_audit_log')));
  assert.equal(calls.at(-1).sql, 'ROLLBACK');
});

test('admin post deletion validates the ID and deletion reason before mutation', async t => {
  const calls = database(t, admin);
  assert.equal((await request(t, admin, 'DELETE', '/admin/institutions/posts/not-a-uuid')).status, 400);
  assert.equal((await request(t, admin, 'DELETE', `/admin/institutions/posts/${postId}`, { note: 'x'.repeat(1001) })).status, 400);
  assert.ok(!calls.some(call => call.sql.startsWith('UPDATE school_posts')));
});

for (const type of ['posts', 'comments']) test(`admin ${type} moderation privately notifies the actual content owner in the same transaction`, async t => {
  const recipient = '10000000-0000-4000-8000-000000000009';
  const calls = database(t, admin, sql => sql.includes('AS owner_id') ? [{ owner_id: recipient, post_id: postId, title: 'A post', school_name: 'School', hidden_by_admin: false, moderation_note: '' }] : undefined);
  const response = await request(t, admin, 'PATCH', `/admin/institutions/${type}/${postId}/moderation`, { hidden: true, note: 'Please remove private student records.', recipientId: 'forged' });
  assert.equal(response.status, 200);
  const write = calls.find(call => call.sql.includes('INSERT INTO community_notifications'));
  assert.equal(write.values[0], recipient); assert.equal(write.values[1], admin.user_id);
  assert.equal(write.values[5], type === 'posts' ? 'post_hidden' : 'comment_hidden'); assert.equal(write.values[6], 'Please remove private student records.');
  assert.match(calls.find(call => call.sql.startsWith('UPDATE school_')).sql, /moderation_note =/);
  assert.equal(calls.at(-1).sql, 'COMMIT');
});

test('moderation rejects blank reasons and repeats of identical decisions do not duplicate notices', async t => {
  const calls = database(t, admin, sql => sql.includes('AS owner_id') ? [{ owner_id: 'owner', post_id: postId, hidden_by_admin: true, moderation_note: 'Same reason' }] : undefined);
  assert.equal((await request(t, admin, 'PATCH', `/admin/institutions/posts/${postId}/moderation`, { hidden: true, note: '   ' })).status, 400);
  assert.equal((await request(t, admin, 'PATCH', `/admin/institutions/posts/${postId}/moderation`, { hidden: true, note: 'Same reason' })).status, 200);
  assert.ok(!calls.some(call => call.sql.startsWith('UPDATE') || call.sql.includes('INSERT INTO community_notifications')));
});

test('suspension persists its private reason/outbox before attempting SMTP', async t => {
  const recipient = '10000000-0000-4000-8000-000000000009';
  const before = mail.mock.callCount();
  const calls = database(t, admin, sql => {
    if (sql.startsWith('SELECT * FROM institution_applications')) return [{ application_id: postId, school_id: schoolId, user_id: recipient, status: 'approved' }];
    if (sql.startsWith('SELECT school_name')) return [{ school_name: 'Fixture School' }];
    if (sql.includes('INSERT INTO community_notifications')) return { command: 'INSERT', rowCount: 1, rows: [{ id: '41' }] };
    if (sql.includes('FROM community_notifications n JOIN users')) return [{ id: '41', latest: '41', status: 'suspended', email: 'staff@example.test', name: 'Staff', school: 'School', reason: 'Authority could not be verified.' }];
  });
  mail.mock.mockImplementationOnce(async () => { assert.ok(calls.some(call => call.sql === 'COMMIT')); return { accepted: ['staff@example.test'] }; });
  const response = await request(t, admin, 'POST', `/admin/institutions/applications/${postId}/review`, { decision: 'suspend', note: 'Authority could not be verified.', email: 'forged@example.test' });
  assert.equal(response.status, 200); assert.equal((await response.json()).email.status, 'sent'); assert.equal(mail.mock.callCount(), before + 1);
  const outbox = calls.findIndex(call => call.sql.includes('INSERT INTO institution_notice_emails'));
  assert.ok(outbox > 0 && outbox < calls.findIndex(call => call.sql === 'COMMIT'));
});

for (const identity of [null, student, user]) test('suspension email retry is restricted to verified administrators', async t => {
  const calls = database(t, identity);
  assert.equal((await request(t, identity, 'POST', `/admin/institutions/applications/${postId}/suspension-email/retry`, {})).status, identity ? 403 : 401);
  assert.ok(!calls.some(call => call.sql.includes('institution_notice_emails')));
});
test('shared program metadata is untouched; only the owned offering is saved or removed', async t => {
  const calls = database(t, user, sql => sql.includes('SELECT program_id, managed_by_school_id') ? [{ program_id: programId, managed_by_school_id: otherSchool }] : undefined);
  assert.equal((await request(t, user, 'PUT', '/institutions/programs', { ...program, schools: [{ id: otherSchool, tuition: 0 }] })).status, 200);
  assert.ok(!calls.some(call => call.sql.startsWith('UPDATE programs')));
  const offering = calls.find(call => call.sql.includes('INSERT INTO school_programs')); assert.equal(offering.values[1], schoolId);
  assert.equal((await request(t, user, 'DELETE', `/institutions/programs/${programId}`)).status, 204);
  assert.deepEqual(calls.find(call => call.sql.startsWith('DELETE FROM school_programs')).values, [schoolId, programId]);
});
for (const identity of [user, { ...student, email_verified_at: null }]) test(`only verified students may start student comments (${identity.account_type}, ${identity.email_verified_at ? 'verified' : 'unverified'})`, async t => {
  database(t, identity);
  assert.equal((await request(t, identity, 'PUT', `/community/posts/${postId}/like`, {})).status, 403);
  assert.equal((await request(t, identity, 'POST', `/community/posts/${postId}/comments`, { body: 'Test' })).status, 403);
});
test('hidden, draft, or inactive-school posts cannot receive likes/comments', async t => {
  const calls = database(t, student);
  assert.equal((await request(t, student, 'POST', `/community/posts/${postId}/comments`, { body: 'Test' })).status, 404);
  assert.ok(!calls.some(call => call.sql.includes('INSERT INTO school_post_comments')));
});
test('likes are idempotent and comments always use the authenticated student identity', async t => {
  const calls = database(t, student, sql => sql.includes('SELECT p.post_id') ? [{ post_id: postId }] : undefined);
  for (let i = 0; i < 2; i++) assert.equal((await request(t, student, 'PUT', `/community/posts/${postId}/like`, { userId: user.user_id })).status, 200);
  const like = calls.find(call => call.sql.includes('INSERT INTO school_post_likes'));
  assert.match(like.sql, /ON CONFLICT DO NOTHING/); assert.equal(like.values[1], student.user_id);
  assert.equal((await request(t, student, 'POST', `/community/posts/${postId}/comments`, { body: 'My comment', userId: 'forged' })).status, 201);
  const comment = calls.find(call => call.sql.includes('INSERT INTO school_post_comments')); assert.deepEqual(comment.values, [postId, student.user_id, 'My comment']);
});
test('students can delete only their own comments', async t => {
  const calls = database(t, student, sql => sql.startsWith('UPDATE school_post_comments') ? { command: 'UPDATE', rowCount: 0, rows: [] } : undefined);
  assert.equal((await request(t, student, 'DELETE', `/community/comments/${postId}`)).status, 404);
  assert.deepEqual(calls.find(call => call.sql.startsWith('UPDATE school_post_comments')).values, [postId, student.user_id]);
});
test('institution cannot consume student assessment or change comparisons', async t => {
  database(t, user);
  assert.equal((await request(t, user, 'GET', '/assessments')).status, 403);
  assert.equal((await request(t, user, 'GET', '/comparison')).status, 403);
});
test('admin approval requires independent verification and a verified representative email', async t => {
  const calls = database(t, admin, sql => sql.includes('SELECT * FROM institution_applications') ? [{ ...owner, status: 'pending' }] : undefined);
  assert.equal((await request(t, admin, 'POST', `/admin/institutions/applications/${postId}/review`, { decision: 'approve', note: 'Reviewed', verifiedAuthority: false })).status, 400);
  assert.equal((await request(t, admin, 'POST', `/admin/institutions/applications/${postId}/review`, { decision: 'approve', note: 'Reviewed', verifiedAuthority: true })).status, 409);
  assert.ok(!calls.some(call => call.sql.startsWith('UPDATE institution_applications')));
});
test('new-school approval creates/activates exactly one school transactionally and pauses its scraping', async t => {
  const proposed = { ...profile, name: 'New University', type: 'Private' };
  const calls = database(t, admin, sql => {
    if (sql.includes('SELECT * FROM institution_applications')) return [{ ...owner, status: 'pending', school_id: null, proposed_school: proposed }];
    if (sql.includes('SELECT user_id FROM users')) return [{ user_id: user.user_id }];
  });
  assert.equal((await request(t, admin, 'POST', `/admin/institutions/applications/${postId}/review`, { decision: 'approve', note: 'Verified by official office', verifiedAuthority: true })).status, 200);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO schools')).length, 1);
  assert.ok(calls.some(call => call.sql.includes('UPDATE catalog_sources SET enabled = FALSE')));
  assert.equal(calls.at(-1).sql, 'COMMIT');
});
test('registering a missing school does not activate or insert a directory school', async t => {
  const calls = database(t, null);
  const response = await request(t, null, 'POST', '/institutions/register', { firstName: 'School', lastName: 'Staff', middleName: '', email: 'staff@school.example', password: 'private-test', confirmPassword: 'private-test', acceptedPolicies: true, policyVersion: ACCOUNT_POLICY_VERSION, ...application, schoolId: null, proposedSchool: { ...profile, name: 'New University', type: 'Private' } });
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  assert.ok(calls.some(call => call.sql.includes('INSERT INTO institution_applications')));
  assert.ok(!calls.some(call => /INSERT INTO (schools|available_schools)/.test(call.sql)));
  assert.match(calls.find(call => call.sql.includes('INSERT INTO users')).sql, /'institution'/);
});
test('owned-institution checks never accept an unverified or forged role', async () => {
  for (const identity of [student, { ...user, email_verified_at: null }]) await assert.rejects(ownedInstitution({ execute() { throw new Error('Must not query'); } }, identity), error => error.status === 403);
});

test('approved school can reply only to a visible root comment on its own published post', async t => {
  const calls = database(t, user, sql => {
    if (sql.includes('SELECT p.post_id')) return [{ post_id: postId, school_id: schoolId }];
    if (sql.startsWith('SELECT comment_id FROM school_post_comments')) return [{ comment_id: programId }];
  });
  const response = await request(t, user, 'POST', `/community/posts/${postId}/comments`, { body: 'Official school reply', parentCommentId: programId, schoolId: otherSchool, userId: 'forged' });
  assert.equal(response.status, 201);
  const insert = calls.find(call => call.sql.includes('INSERT INTO school_post_comments'));
  assert.deepEqual(insert.values, [postId, user.user_id, 'Official school reply', programId, schoolId]);
  const parent = calls.find(call => call.sql.startsWith('SELECT comment_id FROM school_post_comments'));
  assert.deepEqual(parent.values, [programId, postId]); assert.match(parent.sql, /parent_comment_id IS NULL/); assert.match(parent.sql, /hidden_by_admin = FALSE FOR UPDATE/);
});

test('school cannot reply on another school post even with a forged school ID', async t => {
  const calls = database(t, user, sql => sql.includes('SELECT p.post_id') ? [{ post_id: postId, school_id: otherSchool }] : undefined);
  assert.equal((await request(t, user, 'POST', `/community/posts/${postId}/comments`, { body: 'Not my school', parentCommentId: programId, schoolId: otherSchool })).status, 403);
  assert.ok(!calls.some(call => call.sql.includes('INSERT INTO school_post_comments')));
});

for (const status of ['pending', 'suspended', 'rejected']) test(status + ' institution cannot reply', async t => {
  const calls = database(t, user, sql => sql.includes('FROM institution_applications ia') ? [{ ...owner, status }] : undefined);
  assert.equal((await request(t, user, 'POST', `/community/posts/${postId}/comments`, { body: 'Reply', parentCommentId: programId })).status, 403);
  assert.ok(!calls.some(call => call.sql.includes('INSERT INTO school_post_comments')));
});

test('hidden, removed, nested, or foreign-post comment cannot receive a school reply', async t => {
  const calls = database(t, user, sql => sql.includes('SELECT p.post_id') ? [{ post_id: postId, school_id: schoolId }] : undefined);
  assert.equal((await request(t, user, 'POST', `/community/posts/${postId}/comments`, { body: 'Reply', parentCommentId: programId })).status, 404);
  assert.ok(!calls.some(call => call.sql.includes('INSERT INTO school_post_comments')));
});

test('students cannot impersonate an official school reply', async t => {
  const calls = database(t, student);
  assert.equal((await request(t, student, 'POST', `/community/posts/${postId}/comments`, { body: 'Fake official reply', parentCommentId: programId, authorType: 'institution' })).status, 403);
  assert.ok(!calls.some(call => call.sql.includes('INSERT INTO school_post_comments')));
});

test('community identity grants replies only for the authenticated school, while likes stay student-only', async t => {
  database(t, user);
  const own = await (await request(t, user, 'GET', `/community/me?schoolId=${schoolId}`)).json(); assert.equal(own.replySchoolId, schoolId);
  const other = await (await request(t, user, 'GET', `/community/me?schoolId=${otherSchool}`)).json(); assert.equal(other.replySchoolId, null);
  assert.equal((await request(t, user, 'DELETE', `/community/posts/${postId}/like`)).status, 403);
});

test('public school replies reveal the school name, not representative identity or email', async t => {
  const calls = database(t, null, sql => {
    if (sql.startsWith('SELECT post_id FROM school_post_comments')) return [{ post_id: postId }];
    if (sql.includes('SELECT p.post_id')) return [{ post_id: postId, school_id: schoolId }];
    if (sql.includes('FROM school_post_comments c LEFT JOIN schools')) return [{ id: programId, body: 'Thank you', author: 'Official School', authorType: 'institution', schoolId }];
  });
  const response = await request(t, null, 'GET', `/community/comments/${programId}/replies`); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.data[0].author, 'Official School'); assert.ok(!JSON.stringify(result).includes('staff@example'));
  const query = calls.find(call => call.sql.includes('FROM school_post_comments c LEFT JOIN schools'));
  assert.doesNotMatch(query.sql, /u.email|u.full_name/);
});

test('verified administrator may comment and reply, with server-owned attribution and transactional audit', async t => {
  const calls = database(t, admin, sql => {
    if (sql.includes('SELECT p.post_id')) return [{ post_id: postId, school_id: otherSchool }];
    if (sql.startsWith('SELECT comment_id FROM school_post_comments')) return [{ comment_id: programId }];
  });
  for (const parentCommentId of [undefined, programId]) {
    assert.equal((await request(t, admin, 'POST', `/community/posts/${postId}/comments`, { body: 'Administrator response', parentCommentId, userId: 'forged', authorType: 'institution', authorSchoolId: schoolId })).status, 201);
  }
  const inserts = calls.filter(call => call.sql.includes('INSERT INTO school_post_comments'));
  assert.equal(inserts.length, 2);
  for (const insert of inserts) { assert.match(insert.sql, /author_is_admin\) VALUES \(\$1, \$2, \$3, \$4, TRUE\)/); assert.equal(insert.values[1], admin.user_id); assert.ok(!insert.values.includes(schoolId)); }
  assert.equal(inserts[0].values[3], null); assert.equal(inserts[1].values[3], programId);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO admin_audit_log')).length, 2);
  assert.ok(!calls.some(call => call.sql.includes('WHERE ia.user_id')));
  assert.equal((await request(t, admin, 'PUT', `/community/posts/${postId}/like`, {})).status, 403);
  assert.equal((await request(t, admin, 'DELETE', `/community/posts/${postId}/like`)).status, 403);
  assert.equal((await request(t, admin, 'GET', `/community/me?schoolId=${schoolId}`)).status, 200);
});

test('unverified admin cannot comment or reply and a student cannot forge the admin flag', async t => {
  let calls = database(t, { ...admin, email_verified_at: null });
  assert.equal((await request(t, admin, 'POST', `/community/posts/${postId}/comments`, { body: 'No verified access' })).status, 403);
  assert.ok(!calls.some(call => call.sql.includes('INSERT INTO school_post_comments')));
  t.mock.restoreAll();
  calls = database(t, student, sql => sql.includes('SELECT p.post_id') ? [{ post_id: postId, school_id: schoolId }] : undefined);
  assert.equal((await request(t, student, 'POST', `/community/posts/${postId}/comments`, { body: 'Student only', author_is_admin: true, authorType: 'admin', role: 'admin' })).status, 201);
  const insert = calls.find(call => call.sql.includes('INSERT INTO school_post_comments'));
  assert.doesNotMatch(insert.sql, /author_is_admin/); assert.equal(insert.values.length, 3);
});

test('administrator cannot reply to a missing, hidden, deleted, nested or foreign-post comment', async t => {
  const calls = database(t, admin, sql => sql.includes('SELECT p.post_id') ? [{ post_id: postId, school_id: schoolId }] : undefined);
  assert.equal((await request(t, admin, 'POST', `/community/posts/${postId}/comments`, { body: 'Reply', parentCommentId: programId })).status, 404);
  assert.ok(!calls.some(call => call.sql.includes('INSERT INTO school_post_comments')));
});

test('administrator cannot comment on hidden or draft posts and can delete only their own comment', async t => {
  const calls = database(t, admin, sql => sql.startsWith('UPDATE school_post_comments') ? { command: 'UPDATE', rowCount: 0, rows: [] } : undefined);
  assert.equal((await request(t, admin, 'POST', `/community/posts/${postId}/comments`, { body: 'Hidden post' })).status, 404);
  assert.equal((await request(t, admin, 'DELETE', `/community/comments/${programId}`)).status, 404);
  assert.deepEqual(calls.find(call => call.sql.startsWith('UPDATE school_post_comments')).values, [programId, admin.user_id]);
});

test('admin comment migration retains old attribution and cannot mark a school reply as admin', () => {
  const sql = readFileSync(new URL('../database/migrations/026_admin_community_comments.sql', import.meta.url), 'utf8');
  assert.match(sql, /author_is_admin boolean NOT NULL DEFAULT FALSE/);
  assert.match(sql, /author_is_admin = TRUE AND author_school_id IS NULL/);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|UPDATE users|DROP TABLE|DROP COLUMN/);
});

test('reply migration preserves existing rows and constrains school replies to their parent post', () => {
  const sql = readFileSync(new URL('../database/migrations/025_school_comment_replies.sql', import.meta.url), 'utf8');
  assert.match(sql, /FOREIGN KEY \(parent_comment_id, post_id\)/); assert.match(sql, /REFERENCES school_post_comments\(comment_id, post_id\)/);
  assert.match(sql, /author_school_id IS NOT NULL/); assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|UPDATE users/);
});

for (const identity of [null, student, user]) test('moderation school selector rejects ' + (identity?.account_type ?? 'anonymous caller'), async t => {
  const calls = database(t, identity);
  for (const path of ['/admin/institutions/moderation/schools', `/admin/institutions/moderation?schoolId=${schoolId}`]) assert.equal((await request(t, identity, 'GET', path)).status, identity ? 403 : 401);
  assert.ok(!calls.some(call => call.sql.includes('FROM schools s') || call.sql.includes('FROM school_posts')));
});

test('school chooser defaults to activated registered institutions and includes empty schools with zero post counts', async t => {
  const calls = database(t, admin, sql => {
    if (sql.startsWith('SELECT COUNT(*)::int AS total FROM schools')) return [{ total: 1 }];
    if (sql.startsWith('SELECT s.school_id AS id')) return [{ id: schoolId, name: 'Registered School', active: true, postCount: 0 }];
  });
  const response = await request(t, admin, 'GET', '/admin/institutions/moderation/schools');
  assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.data[0].postCount, 0); assert.deepEqual(result.pagination, { page: 1, pageSize: 6, total: 1 });
  const select = calls.find(call => call.sql.startsWith('SELECT s.school_id AS id'));
  assert.match(select.sql, /owners.status IN \('approved', 'suspended'\)/);
  assert.match(select.sql, /iu.email_verified_at IS NOT NULL/); assert.match(select.sql, /av.is_active_available = TRUE/);
  assert.match(select.sql, /posts.status <> 'deleted'/); assert.deepEqual(select.values, [0]);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('school chooser search and pagination are bounded parameters, with inactive schools available for moderation', async t => {
  const calls = database(t, admin, sql => sql.startsWith('SELECT COUNT(*)::int AS total FROM schools') ? [{ total: 0 }] : undefined);
  assert.equal((await request(t, admin, 'GET', '/admin/institutions/moderation/schools?status=inactive&page=2&search=STI%25_')).status, 200);
  const select = calls.find(call => call.sql.startsWith('SELECT s.school_id AS id'));
  assert.match(select.sql, /AND NOT EXISTS/); assert.match(select.sql, /ILIKE \$1/);
  assert.deepEqual(select.values, ['%STI\\%\\_%', '%STI\\%\\_%', 6]);
});

test('selected-school moderation scopes every page, includes full post content, and exposes all pages without truncating the school', async t => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ id: 'post-' + i, schoolId, title: 'School post', status: 'draft', images: [] }));
  const calls = database(t, admin, sql => sql.includes('FROM school_posts p JOIN schools s') ? rows : undefined);
  const response = await request(t, admin, 'GET', `/admin/institutions/moderation?schoolId=${schoolId}&page=2`);
  assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.data.length, 20); assert.equal(result.hasMore, true); assert.equal(result.schoolId, schoolId);
  const select = calls.find(call => call.sql.includes('FROM school_posts p JOIN schools s'));
  assert.match(select.sql, /AND p.school_id = \$1/); assert.deepEqual(select.values, [schoolId, 20]);
  assert.match(select.sql, /p.images, p.link_url AS link/); assert.match(select.sql, /p.status <> 'deleted'/);
});

test('post search filters titles and bodies across pages while preserving school isolation and literal wildcards', async t => {
  const calls = database(t, admin);
  const result = await request(t, admin, 'GET', `/admin/institutions/moderation?schoolId=${schoolId}&page=2&search=admissions%25_`);
  assert.equal(result.status, 200);
  const select = calls.find(call => call.sql.includes('FROM school_posts p JOIN schools s'));
  assert.match(select.sql, /p.school_id = \$1/); assert.match(select.sql, /p.title ILIKE \$2 OR p.body ILIKE \$3/);
  assert.deepEqual(select.values, [schoolId, '%admissions\\%\\_%', '%admissions\\%\\_%', 20]);
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('invalid moderation filters fail before querying school or post data', async t => {
  const calls = database(t, admin);
  for (const path of ['/moderation/schools?status=unknown', '/moderation/schools?page=10001', '/moderation/schools?page=1.5', '/moderation/schools?search=' + 'x'.repeat(101), '/moderation/schools?search=a&search=b', '/moderation?schoolId=bad', '/moderation?schoolId=', '/moderation?page=-1', '/moderation?search=' + 'x'.repeat(101), '/moderation?search=a&search=b']) {
    assert.equal((await request(t, admin, 'GET', '/admin/institutions' + path)).status, 400, path);
  }
  assert.ok(!calls.some(call => call.sql.includes('FROM schools s') || call.sql.includes('FROM school_posts')));
});
