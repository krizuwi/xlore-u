// Offline review artifact only. There is intentionally no database client,
// activation flag, or import path for this unapproved proposal.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { auditScoringKey } from '../src/services/recommendation.js';
const [inventoryFile, outputFile] = process.argv.slice(2);
if (!inventoryFile || !outputFile) throw new Error('Provide the catalog inventory and output artifact paths.');
const inventory = JSON.parse(await fs.readFile(inventoryFile, 'utf8'));
const questions = inventory.questions.filter(question => question.status === 'Active').sort((a, b) => a.position_index - b.position_index);
if (questions.length !== 20 || questions.some((question, index) => !question.prompt.startsWith(`${index + 1}.`) || question.options.length !== 4)) {
  throw new Error('This proposal was reviewed against the existing 20 four-choice questions. A changed bank needs a new review.');
}
// Conservative hypotheses, NOT an approved test key. Broad or non-interest
// choices deliberately do not imply a different field through reverse scoring.
const mappings = {
  1: [{ analytical: 2, technology: 1 }, { creative: 3 }, { social: 2, communication: 1 }, {}],
  2: [{ analytical: 1, technology: 1, science: 1 }, { creative: 2, communication: 1 }, { social: 2, communication: 1 }, { technology: 1, business: 1 }],
  3: [{ analytical: 2, technology: 1 }, { creative: 2, communication: 1 }, { social: 2, communication: 1 }, { business: 1 }],
  5: [{ analytical: 3 }, { creative: 3 }, { social: 2, communication: 1 }, { business: 1 }],
  6: [{ technology: 1, analytical: 1, science: 1 }, { creative: 2, communication: 1 }, { social: 2, health: 1 }, { business: 3 }],
  7: [{ technology: 2, analytical: 1 }, { creative: 2, communication: 1 }, { social: 3 }, { business: 2 }],
  8: [{ technology: 1, analytical: 1, science: 1 }, { creative: 2, communication: 1 }, { social: 2, health: 1 }, { business: 3 }],
  9: [{ analytical: 3 }, { analytical: 2 }, { analytical: 1 }, {}],
  10: [{ analytical: 2, technology: 1 }, { creative: 3 }, { social: 2, communication: 1 }, { business: 2 }],
  15: [{ technology: 1, science: 1, analytical: 1 }, { creative: 3 }, { social: 2, communication: 1 }, {}]
};
const contextFields = { 4: 'learningActivity', 11: 'educationSetting', 12: 'assessmentFormat', 13: 'classEnvironment',
  14: 'programFlexibility', 16: 'tuitionImportance', 17: 'distanceImportance', 18: 'travelTimePreference',
  19: 'resourcePreference', 20: 'financialAssistancePreference' };
const notes = {
  1: 'Hands-on work is too broad to equate automatically with engineering or technology.',
  2: 'Several choices combine multiple subject fields. They cannot distinguish those fields independently.',
  3: 'Building, managing and operating tasks combine different constructs; low-confidence business mapping needs review.',
  5: 'Self-reported strengths are not aptitude test scores. Consider excluding this item from interest totals.',
  6: 'Health and education share one choice. This item alone cannot distinguish nursing from teaching.',
  7: 'Financial stability and leadership are not necessarily business interests; consider contextual treatment of choice D.',
  8: 'Broad choices merge distinct careers; recommendations must acknowledge this resolution limit.',
  9: 'Not enjoying numbers supplies no positive evidence for arts, business or any other career.',
  10: 'Group roles are preferences, not demonstrated abilities. Consider contextual treatment instead.',
  15: 'Choice D mixes entrepreneurship, vocational skills and sports; no single career tag is defensible.'
};
const draft = questions.map((question, index) => ({ id: question.question_id, number: index + 1, prompt: question.prompt,
  role: mappings[index + 1] ? 'proposed-interest-evidence' : 'context-only',
  contextField: contextFields[index + 1] ?? null,
  reviewNote: notes[index + 1] ?? 'Keep as a preference/context answer, not career-interest points.',
  options: question.options.map((option, optionIndex) => ({ id: option.id, label: option.label,
    proposedScores: mappings[index + 1]?.[optionIndex] ?? {}, contextValue: mappings[index + 1] ? null : option.label })) }));
const wording = draft.map(question => ({ id: question.id, prompt: question.prompt, options: question.options.map(({ id, label }) => ({ id, label })) }));
const audit = auditScoringKey(draft.map(question => ({ ...question, options: question.options.map(option => ({ ...option, scores: option.proposedScores })) })));
await fs.writeFile(outputFile, JSON.stringify({ status: 'DRAFT-REQUIRES-PSYCHOMETRICIAN-APPROVAL', activationAllowed: false,
  preparedAt: '2026-10-11', wordingSha256: createHash('sha256').update(JSON.stringify(wording)).digest('hex'),
  constraints: ['Question and option wording are copied verbatim, including existing typos.', 'No reliability, validity, accuracy or probability claims.',
    'Eight existing catalog tags are engineering metadata, not eight established psychometric scales.',
    'Zero scores express absence of positive interest evidence, not lack of ability.',
    'Budget importance is not a peso budget, and travel preference cannot be converted from straight-line distance into minutes.',
    'This file is not compatible with any live import path. Approval and context handling are required before activation.'],
  technicalAudit: audit, questions: draft }, null, 2));
console.log(JSON.stringify({ prepared: true, active: false, questions: draft.length, interestItems: Object.keys(mappings).length,
  contextItems: Object.keys(contextFields).length, technicalAudit: audit }));
// Human-readable companion; still only a proposal, never a database import.
const reviewLines = ['# Assessment scoring key: draft for psychometrician review', '',
  'Status: NOT APPROVED. NOT ACTIVE. Prepared 2026-10-11.', '',
  'Every prompt and option below is copied from the existing active database bank, including existing typos. Wording has not been changed.', '',
  'Numbers are engineering hypotheses (0–3), not validated points. Empty mappings mean no positive evidence for a career-interest tag; they do not mean low ability.', '',
  'The eight tags are the existing catalog vocabulary, not an established eight-scale psychological instrument. Please review constructs, mappings, overlap and coverage before approving any implementation.', '',
  'The proposal separates 10 possible interest items from 10 context-only items. This split also requires review. Self-reported strength and group-role items may need contextual treatment instead.', '',
  'Context-only preferences must not be converted into a fabricated peso budget, commute time, learning-style diagnosis or career aptitude score.', '',
  '## Coverage audit (technical, not validation)', '',
  '| Tag | Informative items | Minimum | Maximum |', '| --- | ---: | ---: | ---: |',
  ...Object.entries(audit.bounds).map(([tag, bound]) => `| ${tag} | ${bound.informativeItems} | ${bound.minimum} | ${bound.maximum} |`), '',
  'Normalization accounts for available point ranges, but cannot repair unequal construct coverage or establish reliability. Health has very little independent evidence in this proposal.', '',
  '## Answer mappings', ''];
for (const question of draft) {
  reviewLines.push(`### ${question.prompt}`, '', `Role: ${question.role}${question.contextField ? ` (${question.contextField})` : ''}.`, '',
    `Review note: ${question.reviewNote}`, '');
  for (const option of question.options) {
    const points = Object.entries(option.proposedScores).map(([tag, value]) => `${tag}: ${value}`).join(', ') || 'No interest points';
    reviewLines.push(`- ${option.label} → ${points}`);
  }
  reviewLines.push('');
}
reviewLines.push('## Approval checklist', '',
  '- Confirm exact current wording matches the questionnaire version intended for use.',
  '- Define each construct and approve, revise or reject every proposed option mapping.',
  '- Decide whether Q5, Q7, Q10 and other ambiguous choices should be context-only.',
  '- Review program-to-interest tags independently with academic/career advisers.',
  '- Define school preference handling only where actual school metadata supports it.',
  '- Pilot the scoring against expert-reviewed cases; examine reliability, recommendation agreement, subgroup behavior and user usefulness.',
  '- Specify what to show for mixed, weak or insufficient evidence, and what evidence supports any accuracy claim.',
  '- Record reviewer names, approval date, key version and approved interpretation. Review alone must not be called predictive validation.', '',
  'The current admin editor requires a positive point in every option; that rule and explicit context handling must be revised after approval before this proposal can be activated.', '');
await fs.writeFile(outputFile.replace(/\.json$/i, '.md'), reviewLines.join('\n'));
