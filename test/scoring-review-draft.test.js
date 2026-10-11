import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { auditScoringKey } from '../src/services/recommendation.js';

const draft = JSON.parse(await fs.readFile(new URL('../database/assessment-scoring-draft-2026-10-11.json', import.meta.url), 'utf8'));
test('review proposal stays inactive and contains 20 complete verbatim-wording snapshots', () => {
  assert.equal(draft.activationAllowed, false);
  assert.equal(draft.status, 'DRAFT-REQUIRES-PSYCHOMETRICIAN-APPROVAL');
  assert.equal(draft.questions.length, 20);
  assert.equal(new Set(draft.questions.map(question => question.id)).size, 20);
  assert.ok(draft.questions.every(question => question.options.length === 4));
  const wording = draft.questions.map(question => ({ id: question.id, prompt: question.prompt,
    options: question.options.map(({ id, label }) => ({ id, label })) }));
  assert.equal(createHash('sha256').update(JSON.stringify(wording)).digest('hex'), draft.wordingSha256);
});
test('context-only answers cannot create career-interest points and the technical audit is reproducible', () => {
  const context = draft.questions.filter(question => question.role === 'context-only');
  assert.equal(context.length, 10);
  assert.ok(context.every(question => question.options.every(option => Object.keys(option.proposedScores).length === 0)));
  const audit = auditScoringKey(draft.questions.map(question => ({ ...question,
    options: question.options.map(option => ({ ...option, scores: option.proposedScores })) })));
  assert.deepEqual(audit, draft.technicalAudit);
  assert.equal(audit.informativeQuestionCount, 10);
});
