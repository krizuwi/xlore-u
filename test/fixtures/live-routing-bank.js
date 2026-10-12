import { readFileSync } from 'node:fs';
const original = JSON.parse(readFileSync(new URL('../../database/assessment-macro-routing-v1.json', import.meta.url), 'utf8'));
const keys = { 16: 'tuition', 17: 'distance', 18: 'travel', 19: 'facilities', 20: 'assistance' };
export function liveRoutingBank() {
  return original.questions.map(question => ({ ...question, position: question.number, status: 'Active', updatedAt: new Date('2026-10-12'),
    routing: question.role === 'macro-vote' ? { role: 'macro-vote' } : { role: 'constraint', constraintKey: keys[question.number] },
    options: question.options.map((option, index) => ({ id: option.id, label: option.label,
      ...(question.role === 'macro-vote' ? { macro: option.macro } : question.number <= 17 ? { prioritize: index >= 2 } : {}) })) }));
}

export function templateRoutingBank() {
  return liveRoutingBank().map(question => ({ ...question,
    routing: { ...question.routing, sectionId: question.number <= 5 ? 'academic' : question.number <= 10 ? 'career' : question.number <= 15 ? 'learning' : 'practical' },
    options: question.number === 9 ? question.options.map((option, index) => ({ ...option, macro: ['A', 'D', 'C', 'B'][index] })) : question.options }));
}
