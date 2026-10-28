import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { canManageSchool } from '../src/lib/institution-owner.js';
import { institutionRegistrationLimits, validateInstitutionRegistration } from '../src/lib/institution-registration.js';

const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
async function component(file, name) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(`../src/institution/${file}`, import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } });
  const module = { exports: {} }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports); return module.exports[name];
}
const PostCard = await component('SchoolPosts.jsx', 'PostCard');
const SchoolRequestFields = await component('InstitutionAuthPage.jsx', 'SchoolRequestFields');
const InstitutionField = await component('InstitutionAuthPage.jsx', 'InstitutionField');
const InstitutionApplicationAttempts = await component('InstitutionApplicationAttempts.jsx', 'InstitutionApplicationAttempts');
const InstitutionRejectionHistory = await component('InstitutionApplicationAttempts.jsx', 'InstitutionRejectionHistory');
const AdminPostDeleteButton = await component('AdminPostDeleteButton.jsx', 'AdminPostDeleteButton');
const ModerationSchoolTable = await component('InstitutionPostModeration.jsx', 'ModerationSchoolTable');
const ModeratedPost = await component('InstitutionPostModeration.jsx', 'ModeratedPost');
const CommentMessage = await component('SchoolPostComments.jsx', 'CommentMessage');
const CommentThread = await component('SchoolPostComments.jsx', 'CommentThread');
const RepresentativeDetails = await component('RepresentativeDetails.jsx', 'RepresentativeDetails');
const SuspensionEmailStatus = await component('InstitutionAdminPage.jsx', 'SuspensionEmailStatus');
const ApplicationSearchFilters = await component('InstitutionAdminPage.jsx', 'ApplicationSearchFilters');
const { MemoryRouter } = createRequire(import.meta.url)('react-router-dom');
const renderPost = props => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(PostCard, props)));
const post = { id: 'fixture', title: '<script>title</script>', body: '<img src=x onerror=alert(1)>', createdAt: '2026-10-20T00:00:00Z', images: [], likeCount: 2, commentCount: 3 };

test('application search has accessible bounded input, status filter and clear control', () => {
  const html = renderToStaticMarkup(createElement(ApplicationSearchFilters, { status: 'approved', search: '<school>', onStatusChange() {}, onSearchChange() {} }));
  for (const phrase of ['Search applications', 'type="search"', 'maxLength="100"', 'Clear search', 'Search school, representative, or email...', 'for="institution-application-search"']) assert.ok(html.includes(phrase), phrase);
  assert.ok(html.includes('value="&lt;school&gt;"') && html.includes('value="approved" selected=""'));
  const empty = renderToStaticMarkup(createElement(ApplicationSearchFilters, { status: 'pending', search: '', onStatusChange() {}, onSearchChange() {} }));
  assert.ok(!empty.includes('Clear search'));
  const page = source('institution/InstitutionAdminPage.jsx');
  for (const phrase of ['new URLSearchParams({ status, search })', 'controller.abort()', 'clearTimeout(timer)', 'resource?.key === key', 'No matching applications in this status', 'Searching applications']) assert.ok(page.includes(phrase), phrase);
});

test('rejected accounts can resubmit below five rejections, while the fifth rejection removes the action', () => {
  for (let count = 1; count <= 5; count++) {
    const html = renderToStaticMarkup(createElement(InstitutionApplicationAttempts, { application: { status: 'rejected', attemptNumber: count, rejectionCount: count, maxRejections: 5, canResubmit: count < 5 }, onResubmit() {} }));
    assert.ok(html.includes(`${count} of 5 rejected`));
    assert.equal(html.includes('Correct and resubmit application'), count < 5);
    if (count < 5) assert.ok(html.includes('existing password') && html.includes('Verify your email again'));
    else assert.ok(html.includes('Further institution submissions using this email are blocked'));
  }
  const pending = renderToStaticMarkup(createElement(InstitutionApplicationAttempts, { application: { status: 'pending', attemptNumber: 2, rejectionCount: 1, canResubmit: false }, onResubmit() {} }));
  assert.ok(!pending.includes('Correct and resubmit application') && !pending.includes('blocked'));
});

test('admin rejection history preserves earlier reasons without executing submitted HTML', () => {
  const html = renderToStaticMarkup(createElement(InstitutionRejectionHistory, { application: { status: 'pending', attemptNumber: 2, rejectionCount: 1, rejectionHistory: [{ attemptNumber: 1, reason: '<script>reason</script>', rejectedAt: '2026-10-27T10:00:00Z', registration: { representativeName: 'Earlier Representative', proposedSchool: { name: 'Earlier School' } } }] } }));
  for (const phrase of ['Application attempt 2 of 5', 'Previous rejection history (1)', 'Earlier Representative', 'Earlier School', '&lt;script&gt;reason&lt;/script&gt;']) assert.ok(html.includes(phrase), phrase);
  assert.ok(!html.includes('<script>'));
  assert.ok(source('institution/InstitutionAdminPage.jsx').includes('expectedAttempt: application.attemptNumber ?? 1'));
  assert.ok(source('institution/InstitutionAuthPage.jsx').includes('existing account password'));
});

test('new-school approval explains disabled actions, email recovery and application refresh', async () => {
  const Review = await component('InstitutionAdminPage.jsx', 'ApplicationReview');
  const application = { id: 'new-school', status: 'pending', emailVerified: false, proposedSchool: { name: 'Requested University', type: 'Private', city: 'Taguig', address: 'Campus address', website: 'https://school.example', latitude: null, longitude: null } };
  const html = renderToStaticMarkup(createElement(Review, { application, save() {} }));
  for (const phrase of ['Complete these steps to enable approval', 'Representative must verify their contact email', 'Check the independent authority verification box', 'Enter a review reason', 'Institution sign in', 'Enter verification code', 'Resend code', 'Refresh applications']) assert.ok(html.includes(phrase), phrase);
  assert.match(html, /disabled=""[^>]*>Approve and activate/);
  const verified = renderToStaticMarkup(createElement(Review, { application: { ...application, emailVerified: true }, save() {} }));
  assert.ok(verified.includes('Complete: Representative contact email verified'));
  assert.ok(!verified.includes('The representative must open'));
  const filters = renderToStaticMarkup(createElement(ApplicationSearchFilters, { status: 'pending', search: '', onRefresh() {} }));
  assert.ok(filters.includes('Refresh applications'));
  assert.ok(source('institution/InstitutionAuthPage.jsx').includes("err.status === 403 && err.message === 'Verify your email before signing in.'"));
});

test('suspension email UI distinguishes acceptance from delivery failure and offers safe retry', () => {
  const render = state => renderToStaticMarkup(createElement(SuspensionEmailStatus, { application: { id: 'fixture', status: 'suspended', suspensionEmail: { state } }, save() {} }));
  assert.ok(render('sent').includes('accepted for delivery') && !render('sent').includes('Retry suspension email'));
  for (const state of ['pending', 'failed', 'sending']) assert.ok(render(state).includes('Retry suspension email'));
  assert.ok(render('failed').includes('has not been sent'));
  assert.equal(renderToStaticMarkup(createElement(SuspensionEmailStatus, { application: { status: 'approved', suspensionEmail: { state: 'failed' } } })), '');
});

test('school-post titles and bodies render as escaped text, not executable HTML', () => {
  const html = renderPost({ post, student: true, ownComments: [], action() {} });
  assert.ok(html.includes('&lt;script&gt;title&lt;/script&gt;')); assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;')); assert.ok(!html.includes('<script>title'));
});
test('only verified student UI enables likes and the pressed state reflects own reaction', () => {
  const disabled = renderPost({ post, student: false, ownComments: [], action() {} });
  assert.match(disabled, /aria-pressed="false" disabled/);
  const liked = renderPost({ post, student: true, liked: true, ownComments: [], action() {} });
  assert.match(liked, /aria-pressed="true"/); assert.ok(liked.includes('Liked'));
  assert.match(source('institution/SchoolPosts.jsx'), /user\?\.role === 'student' && user.emailVerified/);
});

test('school replies show official school attribution, escape text, and allow deleting only the viewer own reply', () => {
  const reply = { id: 'reply', author: '<script>School</script>', authorType: 'institution', body: '<img src=x onerror=alert(1)>', createdAt: post.createdAt };
  const html = renderToStaticMarkup(createElement(CommentMessage, { comment: reply, own: true, onDelete() {} }));
  assert.ok(html.includes('School reply') && html.includes('Delete my reply'));
  assert.ok(html.includes('&lt;script&gt;School&lt;/script&gt;')); assert.ok(!html.includes('<img src=x'));
  const other = renderToStaticMarkup(createElement(CommentMessage, { comment: reply, own: false }));
  assert.ok(!other.includes('Delete my reply'));
});

test('administrator comments and replies have separate attribution, own-delete controls and admin reply entry', () => {
  const adminComment = { id: 'admin-comment', author: 'Administrator', authorType: 'admin', body: '<script>unsafe</script>', createdAt: post.createdAt };
  const root = renderToStaticMarkup(createElement(CommentMessage, { comment: adminComment, own: true }));
  assert.ok(root.includes('is-admin-comment') && root.includes('Administrator') && root.includes('Delete my comment'));
  assert.ok(root.includes('&lt;script&gt;unsafe&lt;/script&gt;') && !root.includes('<script>'));
  const reply = renderToStaticMarkup(createElement(CommentMessage, { comment: { ...adminComment, parentCommentId: 'student-comment' }, own: true }));
  assert.ok(reply.includes('Delete my reply') && !reply.includes('School reply'));
  const entry = renderToStaticMarkup(createElement(CommentThread, { comment: adminComment, postId: post.id, canReply: true, replyRole: 'admin', action() {} }));
  assert.ok(entry.includes('Reply as administrator') && !entry.includes('Reply as school'));
  const feed = source('institution/SchoolPosts.jsx');
  assert.ok(feed.includes("user?.role === 'admin' && user.emailVerified"));
  assert.ok(feed.includes('(student || administrator) && <UnsavedForm'));
  assert.ok(feed.includes('administrator={administrator}'));
  assert.match(renderPost({ post, student: false, administrator: true, viewerRole: 'admin', action() {} }), /aria-pressed="false" disabled/);
});

test('reply composer entry is restricted to the approved owner and public comment forms keep first-name privacy', () => {
  const comment = { id: 'comment', author: 'Student', body: 'Question', createdAt: post.createdAt, replyCount: 2 };
  const render = canReply => renderToStaticMarkup(createElement(CommentThread, { comment, postId: post.id, canReply, action() {} }));
  assert.ok(render(true).includes('Reply as school')); assert.ok(!render(false).includes('Reply as school'));
  assert.ok(render(true).includes('Replies · 2'));
  const feed = source('institution/SchoolPosts.jsx');
  assert.ok(feed.includes('mine.replySchoolId === schoolId')); assert.ok(feed.includes('actionLock.current'));
  assert.ok(feed.includes("key={post.id + ':' + (user?.id ?? 'visitor')}"));
  assert.ok(source('institution/SchoolPostComments.jsx').includes('parentCommentId: comment.id'));
});
test('new-school form collects official identity, address, HTTPS website and bounded coordinates', () => {
  const value = { name: '', type: 'Private', city: '', address: '', latitude: '', longitude: '', website: '', description: '' };
  const html = renderToStaticMarkup(createElement(SchoolRequestFields, { value, onChange() {} }));
  for (const label of ['Official school name', 'Campus address', 'School type', 'Latitude', 'Longitude', 'Official HTTPS website']) assert.ok(html.includes(label));
  assert.match(html, /min="-90" max="90"/); assert.match(html, /min="-180" max="180"/);
});
test('school-post tab is gated by approved institution metadata, not merely an existing school', () => {
  const page = source('pages/SchoolDetailPage.jsx');
  assert.match(page, /school\.institutionActive && <nav/); assert.match(page, /school\.institutionActive && section === 'posts' \? <>/);
  assert.match(page, /<SchoolPosts key=\{school.id \+ ':' \+ \(focusedPostId/);
  assert.match(page, /institutionDetails/);
});
test('student and institution routes, sign-in links, and protected workspace redirect are distinct', () => {
  const app = source('App.jsx'), layout = source('components/Layout.jsx');
  for (const route of ['institution/login', 'institution/register', 'institution']) assert.ok(app.includes(`path="${route}"`));
  assert.ok(layout.includes("institutionAccess ? '/institution/login' : '/login'"));
  assert.ok(layout.includes("institutionAccess ? '/institution/register' : '/register'"));
  for (const page of ['pages/AuthPage.jsx', 'institution/InstitutionAuthPage.jsx']) {
    const content = source(page); assert.ok(content.includes('account-type-switch')); assert.ok(content.includes('>Student</Link>') && content.includes('>Institution</Link>'));
  }
  assert.match(source('components/ProtectedRoute.jsx'), /user\.role === 'institution'.*Navigate to="\/institution"/);
  assert.ok(source('context/AuthContext.jsx').includes('/auth/institution/login'));
});

test('institution registration has the student auth shell, separated sections, guarded agreement and no duplicate header sign-ins', () => {
  const auth = source('institution/InstitutionAuthPage.jsx'), layout = source('components/Layout.jsx');
  for (const phrase of ['auth-layout container', 'auth-aside', 'auth-card', 'Representative details', 'Account details', 'Choose one school', 'Verify your authority', 'validateInstitutionRegistration(form', 'policyAcceptance(agreed)', 'enabled={register && !user}']) assert.ok(auth.includes(phrase));
  assert.ok(!layout.includes('> Student sign in</button>'));
  assert.ok(!layout.includes("navigate('/institution/login')}>Institution sign in"));
  assert.ok(auth.includes('disabled={busy || Boolean(user)}'));
  assert.ok(auth.includes('setForm(current => ({ ...current, password: \'\', confirmPassword: \'\' }))'));
});

test('institution fields expose accessible live character counts, native limits and password reveal controls', () => {
  const html = renderToStaticMarkup(createElement(InstitutionField, { label: 'Position', value: 'Officer', limit: 100, required: true, onChange() {} }));
  assert.ok(html.includes('maxLength="100"') && html.includes('7 / 100'));
  assert.ok(html.includes('aria-describedby=') && html.includes('for='));
  const password = renderToStaticMarkup(createElement(InstitutionField, { label: 'Password', value: '', type: 'password', limit: 72, required: true, onChange() {} }));
  assert.ok(password.includes('Show password') && password.includes('type="password"'));
  const form = renderToStaticMarkup(createElement(SchoolRequestFields, { value: { name: '', city: '', address: '', type: 'Private', latitude: '', longitude: '', website: '', description: '' }, onChange() {} }));
  for (const max of [190, 100, 255, 2000]) assert.ok(form.includes(`maxLength="${max}"`));
});

test('institution limits follow the registration contract and reject overlong or mismatched registration values', () => {
  assert.deepEqual(institutionRegistrationLimits, { name: 20, email: 190, representativeTitle: 100, contactPhone: 30, verificationNote: 1000, schoolName: 190, city: 100, address: 255, url: 2000, description: 2000, password: 72, search: 100, code: 6 });
  const valid = { firstName: 'School', middleName: '', lastName: 'Staff', email: 'staff@school.example', password: 'FixtureOnly123!', confirmPassword: 'FixtureOnly123!', schoolId: 'school', representativeTitle: 'Officer', contactPhone: '63212345678', verificationUrl: 'https://school.example/staff', verificationNote: 'Contact our department.' };
  assert.doesNotThrow(() => validateInstitutionRegistration(valid));
  for (const [field, max] of [['firstName', 20], ['email', 190], ['representativeTitle', 100], ['contactPhone', 30], ['verificationNote', 1000], ['verificationUrl', 2000]]) {
    const atLimit = field === 'verificationUrl' ? 'https://school.example/' + 'x'.repeat(max - 'https://school.example/'.length) : (field === 'contactPhone' ? '0' : 'x').repeat(max);
    assert.doesNotThrow(() => validateInstitutionRegistration({ ...valid, [field]: atLimit }));
    assert.throws(() => validateInstitutionRegistration({ ...valid, [field]: 'x'.repeat(max + 1) }));
  }
  assert.throws(() => validateInstitutionRegistration({ ...valid, confirmPassword: 'Different' }));
  assert.throws(() => validateInstitutionRegistration({ ...valid, password: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }));
  const proposed = { name: 'New School', city: 'Taguig', address: 'Campus', website: 'https://school.example', description: 'x'.repeat(2000) };
  assert.doesNotThrow(() => validateInstitutionRegistration({ ...valid, schoolId: '' }, proposed));
  assert.doesNotThrow(() => validateInstitutionRegistration({ ...valid, verificationUrl: '', schoolId: '' }, { ...proposed, latitude: '', longitude: '' }));
  assert.throws(() => validateInstitutionRegistration({ ...valid, schoolId: '' }, { ...proposed, latitude: '14.5', longitude: '' }));
  assert.throws(() => validateInstitutionRegistration(valid, { ...proposed, description: 'x'.repeat(2001) }));
});

test('school registration labels coordinates optional and explains Google Maps latitude/longitude order', () => {
  const form = renderToStaticMarkup(createElement(SchoolRequestFields, { value: { name: '', city: '', address: '', type: 'Private', latitude: '', longitude: '', website: '', description: '' }, onChange() {} }));
  for (const coordinate of ['latitude', 'longitude']) {
    const input = form.match(new RegExp('<input[^>]*name="proposedSchool\\.' + coordinate + '"[^>]*>'))?.[0];
    assert.ok(input); assert.doesNotMatch(input, /required=""/);
  }
  assert.match(form, /first number is latitude; the second is longitude/);
  assert.match(form, /right-click the exact campus location/); assert.match(form, /touch and hold/);
  assert.match(form, /support.google.com\/maps\/answer\/18539/);
});
test('pending application screen has no edit forms and drafts/post photos remain guarded', () => {
  const workspace = source('institution/InstitutionWorkspace.jsx');
  assert.match(workspace, /data\?\.canEdit &&/); assert.ok(workspace.includes('Waiting for admin verification'));
  assert.match(workspace, /Navigate to=\{`\/schools\/\$\{data.school.id\}`\}/);
  assert.ok(!workspace.includes('<ProfileEditor') && !workspace.includes('<PostEditor'));
  assert.ok(source('institution/SchoolPageEditor.jsx').includes('requestDiscard(onClose, dialog.current)'));
  const editors = source('institution/InstitutionEditors.jsx');
  assert.match(editors, /value="draft">Draft — not public/); assert.ok(editors.includes('/institutions/media/assets'));
});

test('owner tools require a verified, approved, active institution matching both school and signed-in user', () => {
  const user = { id: 'owner', role: 'institution', emailVerified: true };
  const record = { userId: 'owner', data: { canEdit: true, application: { status: 'approved' }, school: { id: 'own-school' } } };
  assert.equal(canManageSchool(user, record, 'own-school'), true);
  assert.equal(canManageSchool(user, record, 'another-school'), false);
  assert.equal(canManageSchool({ ...user, id: 'other-owner' }, record, 'own-school'), false);
  assert.equal(canManageSchool({ ...user, role: 'student' }, record, 'own-school'), false);
  assert.equal(canManageSchool({ ...user, role: 'admin' }, record, 'own-school'), false);
  assert.equal(canManageSchool({ ...user, emailVerified: false }, record, 'own-school'), false);
  assert.equal(canManageSchool(null, record, 'own-school'), false);
  assert.equal(canManageSchool(user, null, 'own-school'), false);
  for (const status of ['pending', 'rejected', 'suspended']) assert.equal(canManageSchool(user, { ...record, data: { ...record.data, application: { status } } }, 'own-school'), false);
  assert.equal(canManageSchool(user, { ...record, data: { ...record.data, canEdit: false } }, 'own-school'), false);
});

test('school page owns contextual editors, private drafts, save refresh and visitor preview', () => {
  const page = source('pages/SchoolDetailPage.jsx');
  for (const label of ['Edit profile', 'Edit school logo', 'Edit school photos', 'Create post', 'Add program', 'Edit program', 'Edit post', 'View as visitor']) assert.ok(page.includes(label));
  assert.ok(page.includes('const managing = ownsSchool && !preview'));
  assert.ok(page.includes("post.status === 'draft' || post.hiddenByAdmin"));
  assert.ok(page.includes('renderOwnerActions={managing ? postActions : undefined}'));
  assert.ok(page.includes('managing && editor?.pageKey === currentPage.current'));
  assert.ok(page.includes("'/institutions' + path"));
  assert.ok(!page.includes('/admin/schools'));
  assert.ok(source('institution/SchoolPageEditor.jsx').includes('element.showModal()'));
});
test('admin review and moderation are present and require deliberate verification/reasons', () => {
  const admin = source('institution/InstitutionAdminPage.jsx');
  assert.ok(admin.includes('verifiedAuthority: verified')); assert.ok(admin.includes('!application.emailVerified'));
  const moderation = source('institution/InstitutionPostModeration.jsx');
  assert.ok(moderation.includes('Moderation reason')); assert.ok(moderation.includes('Hide comment'));
  assert.ok(source('admin/Components/navbar/Navbar.jsx').includes('/admin/institutions'));
});

test('representative review displays every saved contact/name/evidence field with labels and no password fields', () => {
  const application = { representativeName: 'Ana Maria Santos', firstName: 'Ana', middleName: 'Maria', lastName: 'Santos', title: 'Admissions officer', email: 'admissions@example.test', phone: '+63 2 8123 4567', emailVerified: true, verificationUrl: 'https://example.test/staff', evidence: 'Call the publicly listed admissions office.', createdAt: '2026-10-20T00:00:00Z', password: 'DO_NOT_DISPLAY_SECRET', password_hash: 'DO_NOT_DISPLAY_HASH', verification_code_hash: 'DO_NOT_DISPLAY_TOKEN' };
  const html = renderToStaticMarkup(createElement(RepresentativeDetails, { application }));
  for (const label of ['Representative details', 'Full name', 'First name', 'Middle name (optional)', 'Last name', 'Position / designation', 'Institution contact email', 'School contact telephone', 'Email verified', 'Submitted on', 'Authority verification', 'Official staff / authorization link', 'How admin can verify their authority', 'Ana Maria Santos', 'Call the publicly listed admissions office.', 'visible to administrators only']) assert.ok(html.includes(label), label);
  for (const secret of ['DO_NOT_DISPLAY_SECRET', 'DO_NOT_DISPLAY_HASH', 'DO_NOT_DISPLAY_TOKEN']) assert.ok(!html.includes(secret));
  assert.ok(source('institution/InstitutionAdminPage.jsx').includes('<RepresentativeDetails application={application} />'));
});

test('pending existing-school claims show the selected campus inside representative details', () => {
  const application = { status: 'pending', schoolId: '40000000-0000-4000-8000-000000000001', schoolName: 'STI College Global City', schoolCity: 'Taguig', schoolType: 'Private', schoolAddress: 'University Parkway', representativeName: 'Fixture Representative' };
  const html = renderToStaticMarkup(createElement(RepresentativeDetails, { application }));
  for (const phrase of ['Selected school', 'School name', 'STI College Global City', 'Existing school', 'Taguig', 'Private', 'University Parkway', 'View selected school', 'href="/schools/' + application.schoolId + '"']) assert.ok(html.includes(phrase), phrase);
  const newRequest = renderToStaticMarkup(createElement(RepresentativeDetails, { application: { status: 'pending', proposedSchool: { name: '<script>Requested School</script>', city: 'Manila', type: 'Public', address: 'New campus address' } } }));
  assert.ok(newRequest.includes('Requested new school') && newRequest.includes('New school request') && newRequest.includes('not in the directory yet'));
  assert.ok(newRequest.includes('&lt;script&gt;Requested School&lt;/script&gt;') && !newRequest.includes('<script>') && !newRequest.includes('View selected school'));
  const unavailable = renderToStaticMarkup(createElement(RepresentativeDetails, { application: { schoolId: 'javascript:alert(1)' } }));
  assert.ok(unavailable.includes('School record unavailable') && !unavailable.includes('href="/schools/'));
});

test('representative details safely escape submissions, reject unsafe evidence links and handle optional/legacy missing fields', () => {
  const html = renderToStaticMarkup(createElement(RepresentativeDetails, { application: { representativeName: '<script>name</script>', evidence: '<img src=x onerror=evil>', verificationUrl: 'javascript:alert(1)', emailVerified: false, createdAt: 'invalid' } }));
  assert.ok(html.includes('&lt;script&gt;name&lt;/script&gt;')); assert.ok(html.includes('&lt;img src=x onerror=evil&gt;'));
  assert.ok(!html.includes('<script>name') && !html.includes('href="javascript:'));
  assert.ok(html.includes('Not provided') && html.includes('Not available') && html.includes('Email not verified'));
  assert.ok(!html.includes('Invalid Date'));
});
test('public policy explains institution evidence, public student first names and image retention', () => {
  const policy = source('pages/AccountPolicyPage.jsx');
  for (const phrase of ['Institution registration:', 'school posts', 'Student comments display a first name', 'school replies display the school name', 'hiding a post does not revoke a copied image URL', 'does not include private messaging']) assert.ok(policy.includes(phrase));
  assert.ok(source('components/Seo.jsx').includes("'/institution/register'"));
});

test('delete-school-post control is restricted to the admin panel and verified administrators', () => {
  for (const user of [null, { role: 'student', emailVerified: true }, { role: 'institution', emailVerified: true }, { role: 'admin', emailVerified: false }]) {
    assert.equal(renderToStaticMarkup(createElement(AdminPostDeleteButton, { post, user, onDelete() {} })), '');
  }
  const html = renderToStaticMarkup(createElement(AdminPostDeleteButton, { post, user: { role: 'admin', emailVerified: true }, busy: true, onDelete() {} }));
  assert.ok(html.includes('Delete school post')); assert.ok(html.includes('disabled'));
  assert.ok(source('institution/AdminPostDeleteButton.jsx').includes('window.confirm'));
  assert.ok(source('institution/InstitutionPostModeration.jsx').includes('<AdminPostDeleteButton'));
  const publicFeed = source('institution/SchoolPosts.jsx');
  assert.ok(!publicFeed.includes('AdminPostDeleteButton') && !publicFeed.includes('/admin/institutions/posts/'));
  assert.ok(publicFeed.includes('ownerActions={renderOwnerActions?.(post)}'));
});

test('moderation school table shows searchable school identity, activation and zero/nonzero post counts', () => {
  const html = renderToStaticMarkup(createElement(ModerationSchoolTable, { schools: [
    { id: 'one', name: '<script>Demo School</script>', city: 'Taguig', type: 'Private', active: true, postCount: 0 },
    { id: 'two', name: 'Other School', city: 'Manila', type: 'Public', active: false, postCount: 25 }
  ], loading: false, onSelect() {} }));
  for (const label of ['Activated', 'Inactive', 'View posts', 'Taguig', 'Manila', '>0<', '>25<']) assert.ok(html.includes(label));
  assert.ok(html.includes('&lt;script&gt;Demo School&lt;/script&gt;'));
  assert.ok(!html.includes('<script>Demo School'));
});

test('moderation selects one school before loading its paginated posts and resets state between schools', () => {
  const sourceText = source('institution/InstitutionPostModeration.jsx');
  assert.ok(sourceText.includes('Select a school'));
  assert.ok(sourceText.includes("useState('active')"));
  assert.ok(sourceText.includes('/admin/institutions/moderation/schools?'));
  assert.ok(sourceText.includes('schoolId: school.id'));
  assert.ok(sourceText.includes('<SchoolModerationFeed key={school.id}'));
  assert.ok(sourceText.includes('Change school'));
  assert.ok(sourceText.includes('Previous posts') && sourceText.includes('Next posts'));
  assert.ok(sourceText.includes('resource?.page === page'));
});

test('selected-school post search is server-scoped, bounded, paginated and cleared without stale results', () => {
  const moderation = source('institution/InstitutionPostModeration.jsx');
  assert.ok(moderation.includes("placeholder=\"Search this school's posts...\""));
  assert.ok(moderation.includes('value.slice(0, 100)'));
  assert.ok(moderation.includes('schoolId: school.id, page: String(page), search'));
  assert.ok(moderation.includes('school.id, page, search, revision'));
  assert.ok(moderation.includes('resource.search === search'));
  assert.ok(moderation.includes("setSearch(''); setPage(1)"));
  assert.ok(moderation.includes('No posts match your search.'));
});

test('moderation renders draft status, complete post text, photos, links, and existing delete controls', () => {
  const html = renderToStaticMarkup(createElement(ModeratedPost, { post: { ...post, status: 'draft', hidden: true, images: [{ url: 'https://example.test/photo.png', caption: '<script>caption</script>' }], link: 'https://example.test/admissions' }, user: { role: 'admin', emailVerified: true }, save() {} }));
  for (const label of ['Draft — not public', 'Hidden by admin', 'Delete school post', 'Moderation reason', 'Review comments', 'https://example.test/photo.png', 'https://example.test/admissions']) assert.ok(html.includes(label));
  assert.ok(html.includes('&lt;script&gt;caption&lt;/script&gt;'));
  assert.ok(!html.includes('Review comments (latest 200)'));
});

test('publishing is immediate by default, with an explicit draft option and no post verification step', () => {
  const editors = source('institution/InstitutionEditors.jsx');
  assert.match(editors, /const blankPost = .*status: 'published'/);
  assert.ok(editors.includes('Publish now — no post approval required'));
  assert.ok(editors.includes("'Publish post' : 'Save draft'"));
  assert.ok(source('institution/InstitutionPostModeration.jsx').includes("'/posts/' + post.id, 'DELETE'"));
  assert.ok(source('institution/SchoolPosts.jsx').includes('without a separate post review'));
});
