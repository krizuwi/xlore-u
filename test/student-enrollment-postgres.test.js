import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';

// Explicit opt-in; every fixture, schema change and request mutation is rolled back.
test('student enrollment, analytics, suspension and token revocation run against isolated PostgreSQL',
  { skip: process.env.ENROLLMENT_POSTGRES_TEST !== 'true' }, async t => {
    process.env.EMAIL_ENABLED = 'false'; process.env.CATALOG_UPDATE_ENABLED = 'false';
    const { app } = await import('../src/app.js');
    const { rawPool } = await import('../src/db/pool.js');
    const { createAccessToken } = await import('../src/utils/security.js');
    const { ADMIN_EMAIL } = await import('../src/utils/admin-access.js');
    const { ENROLLMENT_DECLARATION_VERSION } = await import('../src/services/student-enrollment.js');
    const client = await rawPool.connect();
    const schema = 'enrollment_check_' + randomUUID().replaceAll('-', '');
    let begun = false, server, chain = Promise.resolve();
    try {
      await client.query('BEGIN'); begun = true;
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}", public`);
      for (const filename of ['001_initial_schema.sql', '002_seed_catalog.sql', '003_catalog_updater.sql', '009_auth_recovery_and_google.sql', '010_user_address.sql', '012_user_name_parts.sql', '013_admin_management.sql', '022_private_home_location.sql', '024_institution_portal.sql', '029_student_enrollment.sql']) {
        await client.query(readFileSync(new URL('../database/migrations/' + filename, import.meta.url), 'utf8'));
      }
      const student = { user_id: randomUUID(), email: 'student@example.test' }, other = { user_id: randomUUID(), email: 'other@example.test' };
      const unverified = { user_id: randomUUID(), email: 'unverified@example.test' }, institution = { user_id: randomUUID(), email: 'staff@example.test' }, admin = { user_id: randomUUID(), email: ADMIN_EMAIL };
      for (const identity of [student, other, unverified, institution, admin]) {
        await client.query(`INSERT INTO users (user_id, email, full_name, first_name, last_name, email_verified_at, account_type, address)
          VALUES ($1, $2, 'Fixture Student', 'Fixture', 'Student', $3, $4, 'Private street in Makati')`, [identity.user_id, identity.email, identity === unverified ? null : new Date(), identity === institution ? 'institution' : 'student']);
      }
      const schools = (await client.query('SELECT school_id FROM schools ORDER BY school_id LIMIT 2')).rows;
      assert.equal(schools.length, 2);
      const schoolA = schools[0].school_id, schoolB = schools[1].school_id;
      for (let index = 0; index < 19; index++) {
        const userId = randomUUID();
        await client.query(`INSERT INTO users (user_id, email, full_name, first_name, last_name, email_verified_at, account_type)
          VALUES ($1, $2, $3, 'Fixture', 'Student', CURRENT_TIMESTAMP, 'student')`, [userId, `fixture${index}@example.test`, index === 0 ? 'Literal100% Student' : 'Fixture Student']);
        await client.query(`INSERT INTO student_enrollments (user_id, school_id, city, used_xlore_u, helpful, declaration_version)
          VALUES ($1, $2, 'Taguig', TRUE, TRUE, $3)`, [userId, schoolA, ENROLLMENT_DECLARATION_VERSION]);
      }
      await client.query('INSERT INTO assessments (assessment_id, user_id, completed_at) VALUES ($1, $2, CURRENT_TIMESTAMP)', [randomUUID(), student.user_id]);
      await client.query('INSERT INTO assessments (assessment_id, user_id) VALUES ($1, $2)', [randomUUID(), other.user_id]);
      const sessions = [];
      for (const identity of [student, other]) {
        const session = randomUUID(); sessions.push(session);
        await client.query(`INSERT INTO user_sessions (session_id, user_id, refresh_token_hash, device_type, browser, ip_address, expires_at)
          VALUES ($1, $2, $3, 'test', 'fixture', '127.0.0.1', CURRENT_TIMESTAMP + INTERVAL '1 hour')`, [session, identity.user_id, randomUUID().replaceAll('-', '').repeat(2)]);
      }
      const query = (sql, values) => {
        const operation = () => {
          if (sql === 'BEGIN') return client.query('SAVEPOINT enrollment_route');
          if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT enrollment_route');
          if (sql === 'ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT enrollment_route');
          return client.query(sql, values);
        };
        const pending = chain.then(operation); chain = pending.catch(() => {}); return pending;
      };
      t.mock.method(rawPool, 'query', query);
      t.mock.method(rawPool, 'connect', async () => ({ query, release() {} }));
      server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
      const base = `http://127.0.0.1:${server.address().port}/api`;
      async function request(identity, method, path, body, expected = 200, token) {
        const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(identity ? { Authorization: 'Bearer ' + (token ?? createAccessToken(identity)) } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const result = await response.json();
        assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
        if (response.ok && ['/enrollment', '/admin/students'].includes(path.split('?')[0])) assert.equal(response.headers.get('cache-control'), 'no-store');
        return result;
      }
      const enrollment = { schoolId: schoolA, city: 'Makati', usedXloreU: true, helpful: true, declarationVersion: ENROLLMENT_DECLARATION_VERSION };
      await request(null, 'GET', '/admin/students', undefined, 401);
      await request(student, 'GET', '/admin/students', undefined, 403);
      for (const identity of [institution, unverified, admin]) await request(identity, 'PUT', '/enrollment', enrollment, 403);
      await request(student, 'PUT', '/enrollment', { ...enrollment, helpful: false }, 400);
      assert.ok((await request(student, 'GET', '/enrollment/schools?search=')).data.length);
      await request(student, 'GET', '/enrollment/schools?search=x&search=y', undefined, 400);
      const saved = await request(student, 'PUT', '/enrollment', { ...enrollment, userId: other.user_id, usedAssessment: false });
      assert.equal(saved.enrollment.schoolId, schoolA);
      assert.equal((await request(other, 'GET', '/enrollment')).enrollment, null);
      await request(student, 'PUT', '/enrollment', { ...enrollment, schoolId: schoolB });
      assert.equal((await client.query('SELECT COUNT(*)::integer AS count FROM student_enrollments WHERE user_id = $1', [student.user_id])).rows[0].count, 1);
      await request(other, 'PUT', '/enrollment', { ...enrollment, schoolId: schoolB, city: 'makati' });
      let report = await request(admin, 'GET', '/admin/students?page=2');
      assert.equal(report.summary.total, 22); assert.equal(report.summary.enrolled, 21); assert.equal(report.summary.assessed, 1);
      assert.equal(report.pagination.pages, 2); assert.equal(report.data.length, 2);
      assert.equal(report.charts.schools[0].count, 19); assert.equal(report.charts.cities.find(row => row.id === 'makati').count, 2);
      assert.ok(report.data.every(row => !('address' in row) && !('home_location' in row) && !('password_hash' in row)));
      assert.equal((await request(admin, 'GET', '/admin/students?search=100%25')).summary.total, 1);
      report = await request(admin, 'GET', '/admin/students?search=other%40example.test&assessment=not_completed');
      assert.equal(report.summary.total, 1); assert.equal(report.summary.assessed, 0); assert.equal(report.charts.schools[0].count, 1);
      const staleToken = createAccessToken(student);
      const decision = { active: false, expectedActive: true, reason: 'Fixture suspension reason' };
      await request(admin, 'PATCH', '/admin/students/' + admin.user_id + '/access', decision, 404);
      await request(admin, 'PATCH', '/admin/students/' + institution.user_id + '/access', decision, 404);
      await request(student, 'PATCH', '/admin/students/' + other.user_id + '/access', decision, 403);
      const suspension = await request(admin, 'PATCH', '/admin/students/' + student.user_id + '/access', decision);
      assert.equal(suspension.emailStatus, 'failed'); // SMTP disabled; persisted work can be retried safely.
      await request(admin, 'PATCH', '/admin/students/' + student.user_id + '/access', decision, 409);
      await request(student, 'GET', '/enrollment', undefined, 401, staleToken);
      const storedSessions = (await client.query('SELECT session_id, revoked_at FROM user_sessions WHERE session_id = ANY($1::uuid[])', [sessions])).rows;
      assert.ok(storedSessions.find(row => row.session_id === sessions[0]).revoked_at);
      assert.equal(storedSessions.find(row => row.session_id === sessions[1]).revoked_at, null);
      await request(admin, 'POST', '/admin/students/' + student.user_id + '/suspension-email/retry', {});
      const suspendedReport = await request(admin, 'GET', '/admin/students?status=suspended');
      assert.equal(suspendedReport.summary.total, 1); assert.equal(suspendedReport.data[0].lastAction.emailAttempts, 2);
      await request(admin, 'PATCH', '/admin/students/' + student.user_id + '/access', { active: true, expectedActive: false, reason: 'Fixture restored' });
      await request(student, 'GET', '/enrollment', undefined, 401, staleToken); // Old JWT cannot become valid again.
      const fresh = (await client.query('SELECT * FROM users WHERE user_id = $1', [student.user_id])).rows[0];
      assert.equal(fresh.auth_version, 2);
      await request(fresh, 'GET', '/enrollment');
      await request(fresh, 'DELETE', '/enrollment');
      assert.equal((await request(fresh, 'GET', '/enrollment')).enrollment, null);
      report = await request(admin, 'GET', '/admin/students'); assert.equal(report.summary.enrolled, 20);
      await request(admin, 'POST', '/admin/students/' + student.user_id + '/suspension-email/retry', {}, 404);
      const rls = (await client.query("SELECT relrowsecurity FROM pg_class WHERE oid = 'student_enrollments'::regclass")).rows[0]; assert.equal(rls.relrowsecurity, true);
      await chain;
    } finally {
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      t.mock.restoreAll();
      if (begun) await client.query('ROLLBACK');
      client.release(); await rawPool.end();
    }
  });
