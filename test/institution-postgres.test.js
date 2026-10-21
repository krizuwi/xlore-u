import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';

// Explicit opt-in. A unique isolated schema and ALL fixtures are rolled back.
// No public application table, real account, SMTP, scraper, or provider credit is used.
test('institution approval, school isolation and community run against real PostgreSQL in a rollback-only schema',
  { skip: process.env.INSTITUTION_POSTGRES_TEST !== 'true' }, async t => {
    process.env.EMAIL_ENABLED = 'false'; process.env.CATALOG_UPDATE_ENABLED = 'false';
    const { app } = await import('../src/app.js');
    const { rawPool } = await import('../src/db/pool.js');
    const { createAccessToken } = await import('../src/utils/security.js');
    const { ADMIN_EMAIL } = await import('../src/utils/admin-access.js');
    const bcrypt = (await import('bcryptjs')).default;
    const client = await rawPool.connect();
    const schema = 'institution_check_' + randomUUID().replaceAll('-', '');
    let begun = false, server, chain = Promise.resolve();
    try {
      await client.query('BEGIN'); begun = true;
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}", public`);
      // Include only schema prerequisites; do not run public-data maintenance or tracking scripts.
      for (const filename of ['001_initial_schema.sql', '002_seed_catalog.sql', '003_catalog_updater.sql', '009_auth_recovery_and_google.sql', '010_user_address.sql', '012_user_name_parts.sql', '013_admin_management.sql', '014_school_media.sql', '015_school_media_uploads.sql', '016_user_feedback.sql', '017_assessment_program_capacity.sql', '021_catalog_run_source_results.sql', '022_catalog_source_name.sql', '022_private_home_location.sql', '023_account_policy_acceptance.sql', '024_institution_portal.sql', '025_school_comment_replies.sql', '026_admin_community_comments.sql', '027_community_notifications.sql', '028_private_moderation_notices.sql', '029_student_enrollment.sql']) {
        await client.query(readFileSync(new URL(`../database/migrations/${filename}`, import.meta.url), 'utf8'));
      }
      const staff = { user_id: randomUUID() }, other = { user_id: randomUUID() }, admin = { user_id: randomUUID() }, student = { user_id: randomUUID() };
      for (const [identity, type, email] of [[staff, 'institution', 'staff@example.test'], [other, 'institution', 'other@example.test'], [admin, 'student', ADMIN_EMAIL], [student, 'student', 'student@example.test']]) {
        await client.query(`INSERT INTO users (user_id, email, full_name, first_name, last_name, email_verified_at, account_type)
          VALUES ($1, $2, 'Fixture Account', 'Fixture', 'Account', CURRENT_TIMESTAMP, $3)`, [identity.user_id, email, type]);
      }
      const applicationId = randomUUID(), proposed = { name: 'Rollback University', type: 'Private', city: 'Taguig', address: 'Fixture campus', latitude: 14.5, longitude: 121, website: 'https://school.example', description: 'Fixture school' };
      await client.query(`INSERT INTO institution_applications (application_id, user_id, proposed_school, representative_title, contact_phone, verification_url, verification_note)
        VALUES ($1, $2, $3, 'Admissions', '0000', 'https://school.example/staff', 'Fixture verification')`, [applicationId, staff.user_id, proposed]);
      const query = (sql, values) => {
        const operation = async () => {
          if (sql === 'BEGIN') return client.query('SAVEPOINT route_transaction');
          if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT route_transaction');
          if (sql === 'ROLLBACK') { await client.query('ROLLBACK TO SAVEPOINT route_transaction'); return client.query('RELEASE SAVEPOINT route_transaction'); }
          return client.query(sql, values);
        };
        const pending = chain.then(operation); chain = pending.catch(() => {}); return pending;
      };
      t.mock.method(rawPool, 'query', query);
      t.mock.method(rawPool, 'connect', async () => ({ query, release() {} }));
      server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
      const base = `http://127.0.0.1:${server.address().port}/api`;
      async function request(identity, method, path, body, expected = 200) {
        const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(identity ? { Authorization: `Bearer ${createAccessToken(identity)}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const data = response.status === 204 ? null : await response.json();
        assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`); return data;
      }
      await request(staff, 'PUT', '/institutions/profile', proposed, 400); // media missing, no mutation
      const pending = await request(staff, 'GET', '/institutions/me'); assert.deepEqual(pending.posts, []); assert.equal(pending.canEdit, false);
      const applicant = (await request(admin, 'GET', '/admin/institutions/applications?status=pending')).data.find(row => row.id === applicationId);
      assert.equal(applicant.firstName, 'Fixture'); assert.equal(applicant.lastName, 'Account');
      assert.equal(applicant.title, 'Admissions'); assert.equal(applicant.phone, '0000'); assert.equal(applicant.evidence, 'Fixture verification');
      assert.ok(applicant.createdAt && !('password_hash' in applicant) && !('verification_code_hash' in applicant));
      for (const search of ['rollback', 'Fixture Account', 'staff@example.test']) {
        assert.equal((await request(admin, 'GET', '/admin/institutions/applications?' + new URLSearchParams({ status: 'pending', search }))).data[0].id, applicationId);
      }
      assert.equal((await request(admin, 'GET', '/admin/institutions/applications?status=pending&search=%25')).data.length, 0); // literal percent, not wildcard
      assert.equal((await request(admin, 'GET', '/admin/institutions/applications?status=approved&search=Rollback')).data.length, 0);
      assert.equal((await request(staff, 'GET', '/institutions/account')).canRename, false);
      await request(staff, 'PATCH', '/institutions/account', { schoolName: 'Cannot rename pending school', expectedName: proposed.name }, 403);
      // Disposable credentials/sessions are confined to this rolled-back schema.
      const oldPassword = 'RollbackOldPassword123!', nextPassword = 'RollbackNewPassword123!';
      await client.query('UPDATE users SET password_hash = $1, password_reset_code_hash = $2, password_reset_expires_at = CURRENT_TIMESTAMP + INTERVAL \'15 minutes\' WHERE user_id = $3', [await bcrypt.hash(oldPassword, 4), 'a'.repeat(64), staff.user_id]);
      for (const identity of [staff, other]) await client.query(`INSERT INTO user_sessions (session_id, user_id, refresh_token_hash, device_type, browser, ip_address, expires_at)
        VALUES ($1, $2, $3, 'test', 'fixture', '127.0.0.1', CURRENT_TIMESTAMP + INTERVAL '1 hour')`, [randomUUID(), identity.user_id, randomUUID().replaceAll('-', '').repeat(2)]);
      await request(staff, 'POST', '/institutions/account/password', { currentPassword: 'WrongPassword123!', newPassword: nextPassword, confirmPassword: nextPassword }, 400);
      const changed = await request(staff, 'POST', '/institutions/account/password', { currentPassword: oldPassword, newPassword: nextPassword, confirmPassword: nextPassword });
      assert.equal(changed.signInAgain, true);
      const credential = (await client.query('SELECT password_hash, password_reset_code_hash FROM users WHERE user_id = $1', [staff.user_id])).rows[0];
      assert.equal(await bcrypt.compare(nextPassword, credential.password_hash), true); assert.equal(credential.password_reset_code_hash, null);
      assert.equal((await client.query('SELECT revoked_at IS NOT NULL AS revoked FROM user_sessions WHERE user_id = $1', [staff.user_id])).rows[0].revoked, true);
      assert.equal((await client.query('SELECT revoked_at IS NOT NULL AS revoked FROM user_sessions WHERE user_id = $1', [other.user_id])).rows[0].revoked, false);
      await request(admin, 'POST', `/admin/institutions/applications/${applicationId}/review`, { decision: 'approve', note: 'Independently verified fixture', verifiedAuthority: true });
      const workspace = await request(staff, 'GET', '/institutions/me'), schoolId = workspace.school.id;
      assert.equal((await request(admin, 'GET', '/admin/institutions/applications?status=approved&search=Rollback')).data[0].id, applicationId);
      assert.equal(workspace.canEdit, true);
      const settings = await request(staff, 'GET', '/institutions/account'); assert.equal(settings.canRename, true); assert.equal(settings.school.name, proposed.name);
      await request(student, 'PATCH', '/institutions/account', { schoolName: 'Forged student rename', expectedName: proposed.name }, 403);
      await request(staff, 'PATCH', '/institutions/account', { schoolName: 'Renamed Rollback University', expectedName: proposed.name, schoolId: randomUUID() });
      assert.equal((await request(null, 'GET', `/schools/${schoolId}`)).name, 'Renamed Rollback University');
      await request(staff, 'PATCH', '/institutions/account', { schoolName: 'Stale overwrite', expectedName: proposed.name }, 409);
      await request(staff, 'PATCH', '/institutions/account', { schoolName: proposed.name, expectedName: 'Renamed Rollback University' });
      assert.equal((await request(staff, 'GET', '/institutions/account')).school.id, schoolId);
      const selector = await request(admin, 'GET', '/admin/institutions/moderation/schools');
      assert.equal(selector.data.length, 1); assert.equal(selector.data[0].id, schoolId); assert.equal(selector.data[0].active, true); assert.equal(selector.data[0].postCount, 0);
      const otherSchoolId = (await client.query('SELECT school_id FROM schools WHERE school_id <> $1 LIMIT 1', [schoolId])).rows[0].school_id;
      await client.query("INSERT INTO school_posts (school_id, author_id, title, body, status) VALUES ($1, $2, 'Other school post', 'Must not leak into selected school moderation', 'draft')", [otherSchoolId, staff.user_id]);
      await request(staff, 'PUT', '/institutions/profile', { ...proposed, schoolId: randomUUID(), media: { logoUrl: '', campusPhotos: [] } });
      await request(staff, 'PUT', '/institutions/programs', { name: 'BS Fixture Computing', category: 'Computing', degreeLevel: 'Bachelor', description: 'Institution program', requirements: 'Apply', careerPaths: ['Developer'], interestTags: ['technology'], tuition: null, sourceUrl: 'https://school.example/program' });
      const programs = (await request(staff, 'GET', '/institutions/me')).programs; assert.equal(programs.length, 1); assert.equal(programs[0].tuition, null);
      const post = await request(staff, 'POST', '/institutions/posts', { title: 'Draft', body: 'A fixture post', images: [], status: 'draft' }, 201);
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data.length, 0);
      await request(student, 'PUT', `/community/posts/${post.id}/like`, {}, 404);
      await request(staff, 'PUT', `/institutions/posts/${post.id}`, { title: 'Published', body: '<script>plain text only</script>', images: [], status: 'published' });
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data[0].id, post.id); // immediate, no post review
      await request(other, 'PUT', `/institutions/posts/${post.id}`, { title: 'Attack', body: 'Not my school', images: [], status: 'published' }, 403);
      for (let i = 0; i < 2; i++) await request(student, 'PUT', `/community/posts/${post.id}/like`, {});
      const studentComment = await request(student, 'POST', `/community/posts/${post.id}/comments`, { body: 'Student comment', userId: staff.user_id }, 201);
      const feed = await request(null, 'GET', `/community/schools/${schoolId}/posts`); assert.equal(feed.data[0].likeCount, 1); assert.equal(feed.data[0].commentCount, 1);
      assert.equal((await request(null, 'GET', `/community/posts/${post.id}`)).schoolId, schoolId);
      const schoolNotices = await request(staff, 'GET', '/notifications');
      assert.equal(schoolNotices.unreadCount, 2); assert.equal(schoolNotices.data.length, 2); // duplicate PUT creates no duplicate notice
      assert.equal((await request(other, 'GET', '/notifications')).data.length, 0);
      assert.equal((await request(student, 'GET', '/notifications')).data.length, 0);
      assert.equal((await request(admin, 'GET', '/notifications')).unreadCount, 0); // no association with this thread
      await request(student, 'PATCH', `/notifications/${schoolNotices.data[0].id}/read`, {}, 404);
      await request(staff, 'PATCH', '/notifications/read-all', { through: schoolNotices.watermark }, 204);
      assert.equal((await request(staff, 'GET', '/notifications')).unreadCount, 0);
      const moderated = await request(admin, 'GET', `/admin/institutions/moderation?schoolId=${schoolId}`);
      assert.equal(moderated.data.length, 1); assert.equal(moderated.data[0].id, post.id); assert.equal(moderated.data[0].schoolId, schoolId);
      assert.equal((await request(admin, 'GET', '/admin/institutions/moderation')).data.length, 2);
      assert.equal((await request(admin, 'GET', `/admin/institutions/moderation?schoolId=${schoolId}&search=Published`)).data.length, 1);
      assert.equal((await request(admin, 'GET', `/admin/institutions/moderation?schoolId=${schoolId}&search=plain%20text`)).data[0].id, post.id);
      assert.equal((await request(admin, 'GET', `/admin/institutions/moderation?schoolId=${schoolId}&search=Other%20school`)).data.length, 0);
      assert.equal((await request(admin, 'GET', `/admin/institutions/moderation?schoolId=${schoolId}&search=%25`)).data.length, 0);
      const selectedSearch = await request(admin, 'GET', '/admin/institutions/moderation/schools?search=Rollback');
      assert.equal(selectedSearch.data[0].postCount, 1);
      assert.equal((await request(admin, 'GET', '/admin/institutions/moderation/schools?search=nonexistent')).data.length, 0);
      const comments = await request(null, 'GET', `/community/posts/${post.id}/comments`); assert.equal(comments.data[0].author, 'Fixture'); assert.ok(!JSON.stringify(comments).includes('example.test'));
      assert.equal((await request(staff, 'GET', `/community/me?schoolId=${schoolId}`)).replySchoolId, schoolId);
      await request(staff, 'PUT', `/community/posts/${post.id}/like`, {}, 403);
      await request(student, 'POST', `/community/posts/${post.id}/comments`, { body: 'Forged school reply', parentCommentId: studentComment.id }, 403);
      const reply = await request(staff, 'POST', `/community/posts/${post.id}/comments`, { body: 'Official school response', parentCommentId: studentComment.id }, 201);
      const studentNotices = await request(student, 'GET', '/notifications');
      assert.equal(studentNotices.unreadCount, 1); assert.equal(studentNotices.data[0].actor, 'Rollback University');
      assert.equal(studentNotices.data[0].kind, 'reply'); assert.ok(!JSON.stringify(studentNotices).includes('@'));
      assert.equal((await request(staff, 'GET', '/notifications')).unreadCount, 0); // no self-notification
      assert.equal((await request(admin, 'GET', '/notifications')).unreadCount, 0);
      const replies = await request(null, 'GET', `/community/comments/${studentComment.id}/replies`);
      assert.equal(replies.data[0].id, reply.id); assert.equal(replies.data[0].author, 'Rollback University'); assert.equal(replies.data[0].authorType, 'institution');
      assert.ok(!JSON.stringify(replies).includes('staff@example.test'));
      assert.equal((await request(null, 'GET', `/community/posts/${post.id}/comments`)).data[0].replyCount, 1);
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data[0].commentCount, 2);
      await request(staff, 'POST', `/community/posts/${post.id}/comments`, { body: 'Nested response', parentCommentId: reply.id }, 404);
      await request(admin, 'PATCH', `/admin/institutions/comments/${studentComment.id}/moderation`, { hidden: true, note: 'Parent comment fixture moderation' });
      const hiddenCommentNotice = await request(student, 'GET', '/notifications');
      assert.equal(hiddenCommentNotice.data.length, 1); assert.equal(hiddenCommentNotice.data[0].kind, 'comment_hidden');
      assert.equal(hiddenCommentNotice.data[0].reason, 'Parent comment fixture moderation');
      assert.equal(hiddenCommentNotice.data[0].actor, 'Administrator'); // hidden replies omitted, private decision retained
      assert.equal((await request(staff, 'GET', '/notifications')).data.length, 1); // like remains
      await request(null, 'GET', `/community/comments/${studentComment.id}/replies`, undefined, 404);
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data[0].commentCount, 0);
      await request(admin, 'PATCH', `/admin/institutions/comments/${studentComment.id}/moderation`, { hidden: false, note: 'Restore fixture comment thread' });
      await request(student, 'DELETE', `/community/comments/${reply.id}`, undefined, 404);
      await request(staff, 'DELETE', `/community/comments/${reply.id}`, undefined, 204);
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data[0].commentCount, 1);
      await request(staff, 'POST', `/community/posts/${post.id}/comments`, { body: 'Second official response', parentCommentId: studentComment.id }, 201);
      await request(student, 'DELETE', `/community/posts/${post.id}/like`, undefined, 204);
      assert.equal((await request(staff, 'GET', '/notifications')).data.filter(row => row.kind === 'like').length, 0);
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data[0].likeCount, 0);
      await request(student, 'PUT', `/community/posts/${post.id}/like`, {});
      assert.equal((await request(staff, 'GET', '/notifications')).data.filter(row => row.kind === 'like').length, 1); // re-like reuses the original read notice
      await request(student, 'DELETE', `/community/comments/${studentComment.id}`, undefined, 204);
      await request(null, 'GET', `/community/comments/${studentComment.id}/replies`, undefined, 404);
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data[0].commentCount, 0);
      const adminRoot = await request(admin, 'POST', `/community/posts/${post.id}/comments`, { body: 'Administrator announcement', authorType: 'student' }, 201);
      const adminReply = await request(admin, 'POST', `/community/posts/${post.id}/comments`, { body: 'Administrator follow-up', parentCommentId: adminRoot.id, authorSchoolId: otherSchoolId }, 201);
      await request(staff, 'POST', `/community/posts/${post.id}/comments`, { body: 'Our school received your note', parentCommentId: adminRoot.id }, 201);
      const associated = await request(admin, 'GET', '/notifications');
      assert.equal(associated.data.length, 1); assert.equal(associated.data[0].kind, 'reply');
      assert.equal(associated.data[0].actor, 'Rollback University');
      await client.query('SAVEPOINT unrelated_thread_check');
      const unrelated = await request(student, 'POST', `/community/posts/${post.id}/comments`, { body: 'Unrelated question on the same post' }, 201);
      await request(staff, 'POST', `/community/posts/${post.id}/comments`, { body: 'Reply outside the administrator thread', parentCommentId: unrelated.id }, 201);
      assert.equal((await request(admin, 'GET', '/notifications')).data.length, 1); // association is per root thread, not per post
      await client.query('ROLLBACK TO SAVEPOINT unrelated_thread_check');
      await client.query('RELEASE SAVEPOINT unrelated_thread_check');
      const adminComments = await request(null, 'GET', `/community/posts/${post.id}/comments`);
      assert.equal(adminComments.data[0].author, 'Administrator'); assert.equal(adminComments.data[0].authorType, 'admin'); assert.equal(adminComments.data[0].replyCount, 2);
      const mixedReplies = await request(null, 'GET', `/community/comments/${adminRoot.id}/replies`);
      assert.equal(mixedReplies.data.find(row => row.id === adminReply.id).authorType, 'admin');
      assert.equal(mixedReplies.data.find(row => row.id === adminReply.id).author, 'Administrator');
      assert.ok(!JSON.stringify([adminComments, mixedReplies]).includes(ADMIN_EMAIL));
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data[0].commentCount, 3);
      assert.ok((await request(admin, 'GET', `/community/me?schoolId=${schoolId}`)).ownCommentIds.includes(adminRoot.id));
      assert.ok((await request(admin, 'GET', `/admin/institutions/posts/${post.id}/comments`)).data.some(row => row.id === adminReply.id && row.authorType === 'admin'));
      await request(admin, 'PUT', `/community/posts/${post.id}/like`, {}, 403);
      await request(student, 'DELETE', `/community/comments/${adminReply.id}`, undefined, 404);
      await request(admin, 'POST', `/community/posts/${post.id}/comments`, { body: 'Nested admin reply', parentCommentId: adminReply.id }, 404);
      await request(admin, 'POST', `/community/posts/${post.id}/comments`, { body: 'Deleted thread reply', parentCommentId: studentComment.id }, 404);
      await request(admin, 'DELETE', `/community/comments/${adminReply.id}`, undefined, 204);
      await request(admin, 'DELETE', `/community/comments/${adminRoot.id}`, undefined, 204);
      await request(null, 'GET', `/community/comments/${adminRoot.id}/replies`, undefined, 404);
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data[0].commentCount, 0);
      const finalRoot = randomUUID();
      await client.query('INSERT INTO school_post_comments (comment_id, post_id, user_id, body) VALUES ($1, $2, $3, $4)', [finalRoot, post.id, student.user_id, 'A final student question']);
      await request(admin, 'POST', `/community/posts/${post.id}/comments`, { body: 'Administrator answer to the student', parentCommentId: finalRoot }, 201);
      const previousDecisions = await request(student, 'GET', '/notifications');
      await request(student, 'PATCH', '/notifications/read-all', { through: previousDecisions.watermark }, 204);
      await request(admin, 'POST', `/community/posts/${post.id}/comments`, { body: 'A further answer for the student', parentCommentId: finalRoot }, 201);
      const adminAnswerNotice = await request(student, 'GET', '/notifications');
      assert.equal(adminAnswerNotice.unreadCount, 1); assert.equal(adminAnswerNotice.data[0].actor, 'Administrator');
      await request(student, 'PATCH', `/notifications/${adminAnswerNotice.data[0].id}/read`, {}, 204);
      assert.equal((await request(student, 'GET', '/notifications')).unreadCount, 0); // persists across a new request
      await request(staff, 'PATCH', '/notifications/read-all', { through: schoolNotices.watermark }, 204);
      assert.equal((await request(staff, 'GET', '/notifications')).unreadCount, 2); // newer activity survives an older watermark
      await request(admin, 'PATCH', `/admin/institutions/posts/${post.id}/moderation`, { hidden: true, note: 'Fixture moderation' });
      const hiddenPostNotice = await request(staff, 'GET', '/notifications');
      assert.equal(hiddenPostNotice.data.length, 1); assert.equal(hiddenPostNotice.data[0].reason, 'Fixture moderation');
      assert.equal(hiddenPostNotice.data[0].kind, 'post_hidden');
      assert.equal((await request(other, 'GET', '/notifications')).data.length, 0); // private owner isolation
      assert.equal((await request(student, 'GET', '/notifications')).unreadCount, 0);
      assert.equal((await request(admin, 'GET', '/notifications')).data.length, 0);
      await request(null, 'GET', `/community/posts/${post.id}`, undefined, 404);
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data.length, 0);
      await request(student, 'POST', `/community/posts/${post.id}/comments`, { body: 'Hidden post' }, 404);
      await request(admin, 'POST', `/community/posts/${post.id}/comments`, { body: 'Hidden post admin comment' }, 404);
      await request(staff, 'PUT', `/institutions/posts/${post.id}`, { title: 'Still moderated', body: 'Edit must not unhide', images: [], status: 'published', hiddenByAdmin: false });
      assert.equal((await request(null, 'GET', `/community/schools/${schoolId}/posts`)).data.length, 0);
      await request(student, 'DELETE', `/admin/institutions/posts/${post.id}`, undefined, 403);
      await request(staff, 'DELETE', `/admin/institutions/posts/${post.id}`, undefined, 403);
      await request(admin, 'DELETE', `/admin/institutions/posts/${post.id}`, { note: 'Fixture admin deletion' }, 204);
      assert.equal((await client.query('SELECT status FROM school_posts WHERE post_id = $1', [post.id])).rows[0].status, 'deleted');
      assert.equal((await client.query("SELECT count(*)::int AS count FROM admin_audit_log WHERE action = 'admin_post_deleted' AND entity_id = $1 AND actor_id = $2", [post.id, admin.user_id])).rows[0].count, 1);
      assert.equal((await client.query('SELECT count(*)::int AS count FROM school_post_comments WHERE post_id = $1', [post.id])).rows[0].count, 9);
      assert.equal((await request(staff, 'GET', '/institutions/me')).posts.length, 0);
      await request(staff, 'PUT', `/institutions/posts/${post.id}`, { title: 'Try to republish', body: 'Deleted post', images: [], status: 'published' }, 404);
      await request(student, 'POST', `/community/posts/${post.id}/comments`, { body: 'Deleted post' }, 404);
      await request(null, 'GET', `/community/posts/${post.id}/comments`, undefined, 404);
      const suspension = await request(admin, 'POST', `/admin/institutions/applications/${applicationId}/review`, { decision: 'suspend', note: 'Fixture suspension' });
      assert.equal(suspension.email.status, 'failed'); // SMTP intentionally disabled; decision still committed
      const privateNotices = await request(staff, 'GET', '/notifications');
      assert.equal(privateNotices.data[0].kind, 'institution_suspended'); assert.equal(privateNotices.data[0].reason, 'Fixture suspension');
      assert.equal(privateNotices.data[0].postId, null); assert.equal(privateNotices.data.length, 2); // hidden/deleted post reason remains readable
      const suspendedApplication = (await request(admin, 'GET', '/admin/institutions/applications?status=suspended')).data.find(row => row.id === applicationId);
      assert.equal(suspendedApplication.suspensionEmail.state, 'failed'); assert.equal(suspendedApplication.suspensionEmail.attempts, 1);
      assert.equal((await request(admin, 'POST', `/admin/institutions/applications/${applicationId}/suspension-email/retry`, {})).email.status, 'failed');
      assert.equal((await request(student, 'GET', '/notifications')).data.filter(row => row.reason === 'Fixture suspension').length, 0);
      assert.equal((await request(admin, 'GET', '/admin/institutions/moderation/schools')).data.length, 0);
      const inactive = await request(admin, 'GET', '/admin/institutions/moderation/schools?status=all');
      assert.equal(inactive.data.length, 1); assert.equal(inactive.data[0].active, false); assert.equal(inactive.data[0].postCount, 0);
      assert.equal((await request(admin, 'GET', '/admin/institutions/moderation/schools?status=inactive')).data[0].id, schoolId);
      await request(null, 'GET', `/community/schools/${schoolId}/posts`, undefined, 404);
      assert.equal((await request(null, 'GET', `/schools/${schoolId}`)).institutionActive, false);
      await chain;
    } finally {
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      t.mock.restoreAll();
      if (begun) await client.query('ROLLBACK');
      client.release(); await rawPool.end();
    }
  });
