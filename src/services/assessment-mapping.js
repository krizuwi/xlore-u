import { assert } from '../utils/http-error.js';

export const MACRO_PROFILES = { A: 'Analytical', B: 'Creative', C: 'People-Oriented', D: 'Practical' };
export const CONSTRAINT_KEYS = {
  tuition: { number: 16, label: 'Tuition importance' },
  distance: { number: 17, label: 'Distance importance' },
  travel: { number: 18, label: 'Travel-time preference' },
  facilities: { number: 19, label: 'Learning resources preference' },
  assistance: { number: 20, label: 'Financial assistance preference' }
};

// One explicit, live mapping per answer. No legacy interest weights are used.
export function normalizeQuestionRouting(routing, options) {
  assert(routing && typeof routing === 'object' && !Array.isArray(routing) &&
    ['macro-vote', 'constraint'].includes(routing.role), 400, 'Choose a valid assessment question role.');
  const section = routing.sectionId === undefined ? {} : { sectionId: routing.sectionId };
  assert(routing.sectionId === undefined || typeof routing.sectionId === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(routing.sectionId), 400, 'Choose a valid section ID.');
  if (routing.role === 'macro-vote') {
    assert(options.length === 4 && options.every(option => Object.hasOwn(MACRO_PROFILES, option.macro)) &&
      new Set(options.map(option => option.macro)).size === 4, 400,
    'A core interest question needs four answers, mapped once each to A, B, C and D. Each answer casts one vote.');
    return { routing: { role: 'macro-vote', ...section }, options: options.map(({ id, label, macro }) => ({ id, label, macro })) };
  }
  assert(Object.hasOwn(CONSTRAINT_KEYS, routing.constraintKey), 400, 'Choose a valid practical preference.');
  const prioritizable = ['tuition', 'distance'].includes(routing.constraintKey);
  assert(!prioritizable || options.every(option => typeof option.prioritize === 'boolean'), 400,
    'Specify whether each practical answer prioritizes tuition or distance.');
  return { routing: { role: 'constraint', constraintKey: routing.constraintKey, ...section },
    options: options.map(({ id, label, prioritize }) => ({ id, label, ...(prioritizable ? { prioritize } : {}) })) };
}
