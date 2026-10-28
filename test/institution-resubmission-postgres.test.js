import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';

// All account/history fixtures and schema changes roll back; SMTP is always mocked.
test('institution resubmission backfill, five-rejection limit, verification and history work in PostgreSQL',
  { skip: process.env.INSTITUTION_POSTGRES_TEST !== 'true' }, async t => {
    Object.assign(process.env, { EMAIL_ENABLED: 'true', SMTP_HOST: 'mail.example.test', SMTP_USER: 'mail@example.test', SMTP_PASS: 'fixture', CATALOG_UPDATE_ENABLED: 'false' });
    let failMail = false;
    const messages = [];
    t.mock.method((await import('nodemailer')).default, 'createTransport', () => ({ sendMail: async message => {
      if (failMail) throw new Error('Fixture SMTP failure');
      messages.push(message); return { accepted: [message.to] };
    } }));
    const { app } = await import('../src/app.js');
    const { rawPool } = await import('../src/db/pool.js');
    const { createAccessToken } = await import('../src/utils/security.js');
    const { ADMIN_EMAIL } = await import('../src/utils/admin-access.js');
    const { ACCOUNT_POLICY_VERSION } = await import('../src/services/account-policies.js');
    const bcrypt = (await import('bcryptjs')).default;
    const client = await rawPool.connect(), schema = 'resubmission_check_' + randomUUID().replaceAll('-', '');
    let begun = false, server, chain = Promise.resolve();
    try {
      await client.query('BEGIN'); begun = true;
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}", public`);
      for (const name of ['001_initial_schema.sql', '002_seed_catalog.sql', '003_catalog_updater.sql', '009_auth_recovery_and_google.sql', '010_user_address.sql', '012_user_name_parts.sql', '013_admin_management.sql', '014_school_media.sql', '015_school_media_uploads.sql', '016_user_feedback.sql', '017_assessment_program_capacity.sql', '021_catalog_run_source_results.sql', '022_catalog_source_name.sql', '022_private_home_location.sql', '023_account_policy_acceptance.sql', '024_institution_portal.sql', '025_school_comment_replies.sql', '026_admin_community_comments.sql', '027_community_notifications.sql', '028_private_moderation_notices.sql', '029_student_enrollment.sql', '030_contact_messages.sql', '031_contact_conversations.sql', '032_release_suspended_school_claims.sql', '033_optional_school_coordinates.sql']) {
        await client.query(readFileSync(new URL('../database/migrations/' + name, import.meta.url), 'utf8'));
      }
      const admin = { user_id: randomUUID() }, staffId = randomUUID(), applicationId = randomUUID();
      const email = 'resubmit@example.test', password = 'ResubmissionFixture123!', hash = await bcrypt.hash(password, 4);
      await client.query(`INSERT INTO users (user_id, email, full_name, first_name, last_name, email_verified_at)
        VALUES ($1, $2, 'Fixture Admin', 'Fixture', 'Admin', CURRENT_TIMESTAMP)`, [admin.user_id, ADMIN_EMAIL]);
      await client.query(`INSERT INTO users (user_id, email, password_hash, full_name, first_name, last_name, account_type, email_verified_at)
        VALUES ($1, $2, $3, 'Original Representative', 'Original', 'Representative', 'institution', CURRENT_TIMESTAMP)`, [staffId, email, hash]);
      const proposed = { name: 'Resubmission University', city: 'Taguig', type: 'Private', address: 'Fixture campus', website: 'https://school.example', latitude: null, longitude: null };
      await client.query(`INSERT INTO institution_applications (application_id, user_id, proposed_school, representative_title, contact_phone,
        verification_url, verification_note, status, review_note, reviewed_by, reviewed_at)
        VALUES ($1, $2, $3, 'Original role', '001234', '', 'Contact the department', 'rejected', 'Original rejection', $4, CURRENT_TIMESTAMP)`,
      [applicationId, staffId, proposed, admin.user_id]);
      const approvalStaff = randomUUID(), approvalApplication = randomUUID(), approvalEmail = 'corrected@example.test';
      await client.query(`INSERT INTO users (user_id, email, password_hash, full_name, first_name, last_name, account_type, email_verified_at)
        VALUES ($1, $2, $3, 'Corrected Representative', 'Corrected', 'Representative', 'institution', CURRENT_TIMESTAMP)`, [approvalStaff, approvalEmail, hash]);
      await client.query(`INSERT INTO institution_applications (application_id, user_id, proposed_school, representative_title, contact_phone,
        verification_url, verification_note, status, review_note, reviewed_by, reviewed_at)
        VALUES ($1, $2, $3, 'Admissions', '001234', '', 'Contact the department', 'rejected', 'Correct the application', $4, CURRENT_TIMESTAMP)`,
      [approvalApplication, approvalStaff, { ...proposed, name: 'Corrected University' }, admin.user_id]);
      await client.query(readFileSync(new URL('../database/migrations/034_institution_resubmissions.sql', import.meta.url), 'utf8'));
      const backfill = (await client.query('SELECT attempt_number, review_note, registration_snapshot FROM institution_application_rejections WHERE application_id = $1', [applicationId])).rows;
      assert.equal(backfill.length, 1); assert.equal(backfill[0].attempt_number, 1); assert.equal(backfill[0].review_note, 'Original rejection');
      assert.equal(backfill[0].registration_snapshot.representativeName, 'Original Representative');
      assert.ok(!JSON.stringify(backfill).includes(hash));
      const query = (sql, values) => {
        const operation = async () => {
          if (sql === 'BEGIN') return client.query('SAVEPOINT resubmission_route');
          if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT resubmission_route');
          if (sql === 'ROLLBACK') { await client.query('ROLLBACK TO SAVEPOINT resubmission_route'); return client.query('RELEASE SAVEPOINT resubmission_route'); }
          return client.query(sql, values);
        };
        const pending = chain.then(operation); chain = pending.catch(() => {}); return pending;
      };
      t.mock.method(rawPool, 'query', query);
      t.mock.method(rawPool, 'connect', async () => ({ query, release() {} }));
      server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
      async function request(identity, method, path, body, expected = 200, token) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
          headers: { 'Content-Type': 'application/json', ...(identity || token ? { Authorization: `Bearer ${token ?? createAccessToken(identity)}` } : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const data = await response.json(); assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`); return data;
      }
      const body = { firstName: 'Updated', middleName: '', lastName: 'Representative', email: ' RESUBMIT@EXAMPLE.TEST ', password, confirmPassword: password,
        acceptedPolicies: true, policyVersion: ACCOUNT_POLICY_VERSION, schoolId: null, proposedSchool: proposed,
        representativeTitle: 'Admissions officer', contactPhone: '001234', verificationUrl: '', verificationNote: 'Call the official department' };
      const saved = async () => (await client.query('SELECT * FROM institution_applications WHERE application_id = $1', [applicationId])).rows[0];
      await request(null, 'POST', '/institutions/register', { ...body, password: 'WrongPassword123!', confirmPassword: 'WrongPassword123!' }, 401);
      const originalToken = createAccessToken({ user_id: staffId, email, auth_version: 0 });
      for (let attempt = 2; attempt <= 5; attempt++) {
        const result = await request(null, 'POST', '/institutions/register', body, 201);
        assert.equal(result.attemptNumber, attempt); assert.equal(result.rejectionCount, attempt - 1);
        assert.equal((await saved()).status, 'pending');
        const account = (await client.query('SELECT password_hash, email_verified_at, auth_version FROM users WHERE user_id = $1', [staffId])).rows[0];
        assert.equal(account.password_hash, hash); assert.equal(account.email_verified_at, null); assert.equal(account.auth_version, attempt - 1);
        if (attempt === 2) {
          await request(null, 'POST', '/institutions/register', body, 409);
          await request(null, 'GET', '/institutions/me', undefined, 401, originalToken);
          await request(admin, 'POST', `/admin/institutions/applications/${applicationId}/review`, { decision: 'approve', verifiedAuthority: true, note: 'Not verified yet', expectedAttempt: attempt }, 409);
        }
        const code = messages.at(-1).text.match(/code is (\d{6})/)[1];
        await request(null, 'POST', '/auth/verify-email', { email, code });
        const login = await request(null, 'POST', '/auth/institution/login', { email, password });
        const own = await request(null, 'GET', '/institutions/me', undefined, 200, login.accessToken);
        assert.equal(own.application.attemptNumber, attempt); assert.equal(own.canEdit, false);
        await request(admin, 'POST', `/admin/institutions/applications/${applicationId}/review`, { decision: 'reject', note: 'Stale review', expectedAttempt: attempt - 1 }, 409);
        await request(admin, 'POST', `/admin/institutions/applications/${applicationId}/review`, { decision: 'reject', note: `Rejection ${attempt}`, expectedAttempt: attempt });
        await request(admin, 'POST', `/admin/institutions/applications/${applicationId}/review`, { decision: 'reject', note: 'Duplicate review', expectedAttempt: attempt }, 409);
        const history = (await request(admin, 'GET', '/admin/institutions/applications?status=rejected')).data.find(row => row.id === applicationId);
        assert.equal(history.rejectionCount, attempt); assert.equal(history.rejectionHistory.length, attempt);
        assert.equal(history.rejectionHistory[0].reason, 'Original rejection');
        assert.equal(history.rejectionHistory.at(-1).registration.title, 'Admissions officer');
        if (attempt === 2) {
          failMail = true;
          await request(null, 'POST', '/institutions/register', body, 502);
          failMail = false;
          const rolledBack = await saved(); assert.equal(rolledBack.status, 'rejected'); assert.equal(rolledBack.attempt_number, 2); assert.equal(rolledBack.rejection_count, 2);
          assert.equal((await client.query('SELECT auth_version FROM users WHERE user_id = $1', [staffId])).rows[0].auth_version, 1);
        }
      }
      const sent = messages.length;
      const blocked = await request(null, 'POST', '/institutions/register', body, 403);
      assert.equal(blocked.error.details.code, 'INSTITUTION_REJECTION_LIMIT'); assert.equal(messages.length, sent);
      const last = await saved(); assert.equal(last.status, 'rejected'); assert.equal(last.rejection_count, 5); assert.equal(last.attempt_number, 5);
      assert.equal((await client.query('SELECT count(*)::int AS count FROM users WHERE email = $1', [email])).rows[0].count, 1);
      assert.equal((await client.query('SELECT count(*)::int AS count FROM institution_applications WHERE user_id = $1', [staffId])).rows[0].count, 1);
      assert.equal((await client.query("SELECT relrowsecurity FROM pg_class WHERE oid = 'institution_application_rejections'::regclass")).rows[0].relrowsecurity, true);
      const correctedBody = { ...body, email: approvalEmail, proposedSchool: { ...proposed, name: 'Corrected University' } };
      assert.equal((await request(null, 'POST', '/institutions/register', correctedBody, 201)).attemptNumber, 2);
      await request(null, 'POST', '/auth/verify-email', { email: approvalEmail, code: messages.at(-1).text.match(/code is (\d{6})/)[1] });
      await request(admin, 'POST', `/admin/institutions/applications/${approvalApplication}/review`, { decision: 'approve', verifiedAuthority: true, expectedAttempt: 2, note: 'Corrected authority independently verified' });
      const correctedLogin = await request(null, 'POST', '/auth/institution/login', { email: approvalEmail, password });
      const approved = await request(null, 'GET', '/institutions/me', undefined, 200, correctedLogin.accessToken);
      assert.equal(approved.canEdit, true); assert.equal(approved.application.rejectionCount, 1); assert.equal(approved.application.attemptNumber, 2);
      assert.equal((await request(null, 'GET', `/schools/${approved.school.id}`)).institutionActive, true);
      await request(null, 'POST', '/institutions/register', correctedBody, 409);
      await chain;
    } finally {
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      t.mock.restoreAll();
      if (begun) await client.query('ROLLBACK');
      client.release(); await rawPool.end();
    }
  });
