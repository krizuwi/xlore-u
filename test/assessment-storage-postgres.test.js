import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';

// Explicit opt-in integration check. All fixture writes stay in one transaction
// and are ALWAYS rolled back; no real student's attempt or result is modified.
test('real PostgreSQL saves and reads routed assessments with more than 20 programs',
  { skip: process.env.ASSESSMENT_STORAGE_POSTGRES_TEST !== 'true' }, async t => {
    const { app } = await import('../src/app.js');
    const { pool, rawPool } = await import('../src/db/pool.js');
    const { getQuestionBank } = await import('../src/services/question-bank.js');
    const { createAccessToken } = await import('../src/utils/security.js');
    const client = await rawPool.connect();
    const user = { user_id: randomUUID(), email: `storage-check-${randomUUID()}@example.test`,
      full_name: 'Rollback Storage Check', address: 'Makati', email_verified_at: new Date(), is_active: true };
    const placeholderSql = sql => { let index = 0; return sql.replace(/\?/g, () => `$${++index}`); };
    const normalize = result => [result.command === 'SELECT' ? result.rows : { affectedRows: result.rowCount, rows: result.rows }, undefined];
    let transactionStarted = false;
    let commitIntercepted = false;
    let server;
    let pendingQuery = Promise.resolve();
    // Results read three SQL queries concurrently. Serialize them on the one
    // rollback-only connection instead of using deprecated pg client queuing.
    const fixtureQuery = (sql, values = []) => {
      const result = pendingQuery.then(() => client.query(placeholderSql(sql), values));
      pendingQuery = result.catch(() => {});
      return result;
    };
    try {
      t.mock.method(pool, 'query', async (sql, values = []) => normalize(await fixtureQuery(sql, values)));
      t.mock.method(pool, 'execute', async (sql, values = []) => {
        // Auth runs before the fixture transaction; no persistent account is needed.
        if (sql.includes('FROM users')) return [[user], undefined];
        return normalize(await fixtureQuery(sql, values));
      });
      t.mock.method(rawPool, 'connect', async () => ({
        async query(sql, values) {
          if (sql === 'BEGIN') {
            transactionStarted = true;
            await client.query('BEGIN');
            await client.query(`INSERT INTO users (user_id,email,full_name,address,email_verified_at)
              VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)`, [user.user_id, user.email, user.full_name, user.address]);
            return { command: 'BEGIN', rows: [] };
          }
          if (sql === 'COMMIT') {
            commitIntercepted = true;
            // Keep the transaction open so the real saved-result queries see it,
            // but never persist a test user, assessment or recommendation.
            return { command: 'COMMIT', rows: [] };
          }
          return client.query(sql, values);
        },
        release() {}
      }));
      const bank = await getQuestionBank();
      const answers = bank.data.map(question => ({ questionId: question.id, optionId: question.options[0].id }));
      server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
      const base = `http://127.0.0.1:${server.address().port}/api/assessments`;
      const headers = { Authorization: `Bearer ${createAccessToken(user)}`, 'Content-Type': 'application/json' };
      const response = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ answers,
        questionBankVersion: bank.version, workflowVersion: 'macro-routing-v1',
        routingSelection: { profile: 'A', field: 'computing' }, schoolLimits: {} }) });
      const body = await response.json();
      assert.equal(response.status, 201, JSON.stringify(body));
      assert.ok(commitIntercepted);
      assert.ok(body.recommendedPrograms.length > 20, 'Regression fixture must exercise rank 21 and beyond');
      assert.ok(body.recommendedSchools.length > 0);
      const stored = await client.query(`SELECT COUNT(*)::integer AS count,MAX(rank_position) AS maximum
        FROM recommended_programs WHERE profile_id=$1`, [body.profile.id]);
      assert.equal(stored.rows[0].count, body.recommendedPrograms.length);
      assert.equal(stored.rows[0].maximum, body.recommendedPrograms.length);
      const saved = await fetch(`${base}/${body.assessmentId}/results`, { headers });
      const savedBody = await saved.json();
      assert.equal(saved.status, 200, JSON.stringify(savedBody));
      assert.equal(savedBody.recommendedPrograms.length, stored.rows[0].count);
      assert.equal(savedBody.profile.metrics.routing.field, 'computing');
      const repeat = await fetch(base, { method: 'POST', headers, body: '{}' });
      assert.equal(repeat.status, 400);
      await client.query('ROLLBACK'); transactionStarted = false;
      const cleanup = await client.query('SELECT COUNT(*)::integer AS count FROM users WHERE user_id=$1', [user.user_id]);
      assert.equal(cleanup.rows[0].count, 0, 'Rollback must remove the entire test fixture');
      t.diagnostic(`Real submission and saved-result retrieval passed with ${stored.rows[0].count} programs; all fixture writes rolled back.`);
    } finally {
      if (transactionStarted) await client.query('ROLLBACK');
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      t.mock.restoreAll();
      client.release(); await rawPool.end();
    }
  });
