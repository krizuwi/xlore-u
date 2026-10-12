import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Explicit opt-in. Schema and question edits are always rolled back. No user
// account, saved assessment, recommendation or attempt record is touched.
test('real PostgreSQL migrates live mappings without changing validated text or saved results',
  { skip: process.env.ASSESSMENT_MAPPING_POSTGRES_TEST !== 'true' }, async t => {
    const { rawPool } = await import('../src/db/pool.js');
    const { buildRoutingPlan, auditRoutingBank } = await import('../src/services/assessment-routing.js');
    const client = await rawPool.connect();
    let started = false;
    try {
      const column = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assessment_questions' AND column_name = 'routing_config'");
      if (column.rowCount) { t.skip('Migration already applied; use live API regression checks.'); return; }
      const before = (await client.query('SELECT question_id AS id, prompt, options, status, position_index FROM assessment_questions ORDER BY question_id')).rows;
      const sql = readFileSync(new URL('../database/migrations/018_live_assessment_mapping.sql', import.meta.url), 'utf8');
      await client.query('BEGIN'); started = true;
      await client.query(sql);
      const migrated = (await client.query('SELECT question_id AS id, prompt, options, routing_config AS routing, legacy_scoring_backup AS backup, status, position_index FROM assessment_questions ORDER BY question_id')).rows;
      assert.deepEqual(migrated.map(q => ({ id: q.id, prompt: q.prompt, options: q.options.map(({ id, label }) => ({ id, label })), status: q.status, position_index: q.position_index })),
        before.map(q => ({ ...q, options: q.options.map(({ id, label }) => ({ id, label })) })));
      for (const q of migrated.filter(q => q.routing)) assert.deepEqual(q.backup.options, before.find(old => old.id === q.id).options);
      const bank = migrated.filter(q => q.status === 'Active');
      assert.equal(auditRoutingBank(bank).available, true);
      assert.ok(bank.every(q => q.options.every(o => !Object.hasOwn(o, 'scores'))));
      const coreQuestion = bank.find(q => q.routing.role === 'macro-vote');
      const edited = coreQuestion.options.map(o => ({ ...o, macro: o.macro === 'A' ? 'B' : o.macro === 'B' ? 'A' : o.macro }));
      await client.query('UPDATE assessment_questions SET options = $1::jsonb WHERE question_id = $2', [JSON.stringify(edited), coreQuestion.id]);
      const current = (await client.query("SELECT question_id AS id, prompt, options, routing_config AS routing FROM assessment_questions WHERE status = 'Active' ORDER BY position_index")).rows;
      const answers = current.map(q => ({ questionId: q.id, optionId: q.options[0].id }));
      assert.deepEqual(buildRoutingPlan(answers, current).votes, { A: 14, B: 1, C: 0, D: 0 });
      await client.query('ROLLBACK'); started = false;
      assert.deepEqual((await client.query('SELECT question_id AS id, prompt, options, status, position_index FROM assessment_questions ORDER BY question_id')).rows, before);
      // A previously edited seed is not silently assigned an invented mapping.
      await client.query('BEGIN'); started = true;
      await client.query('UPDATE assessment_questions SET prompt = $1 WHERE question_id = $2', ['Temporary changed wording', coreQuestion.id]);
      await assert.rejects(client.query(sql), /differs from the original reviewed seed/);
    } finally {
      if (started) await client.query('ROLLBACK');
      client.release(); await rawPool.end();
    }
  });
