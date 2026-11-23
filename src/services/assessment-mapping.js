import { assert } from '../utils/http-error.js';

// A macro-profile is a broad interest group. Every core question gives one vote
// to exactly one of these four groups.
export const MACRO_PROFILES = { A: 'Analytical', B: 'Creative', C: 'People-Oriented', D: 'Practical' };

// These IDs connect practical preference questions to the meaning of each
// answer. The number preserves compatibility with the original question bank.
export const CONSTRAINT_KEYS = {
  tuition: { number: 16, label: 'Tuition importance' },
  distance: { number: 17, label: 'Distance importance' },
  travel: { number: 18, label: 'Travel-time preference' },
  facilities: { number: 19, label: 'Learning resources preference' },
  assistance: { number: 20, label: 'Financial assistance preference' }
};

/**
 * Check and clean the routing settings for one assessment question.
 * The returned options contain only fields that the scoring flow uses.
 */
export function normalizeQuestionRouting(routing, options) {
  const hasValidRole = routing && typeof routing === 'object' && !Array.isArray(routing) &&
    ['macro-vote', 'constraint'].includes(routing.role);
  assert(hasValidRole, 400, 'Choose a valid assessment question role.');

  // Keep the section only when one was provided. Older questions may not have it.
  const section = routing.sectionId === undefined ? {} : { sectionId: routing.sectionId };
  const hasValidSection = routing.sectionId === undefined ||
    (typeof routing.sectionId === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(routing.sectionId));
  assert(hasValidSection, 400, 'Choose a valid section ID.');

  if (routing.role === 'macro-vote') {
    // A core question has four options so each profile receives one possible vote.
    const hasOneOptionForEachProfile = options.length === 4 &&
      options.every(option => Object.hasOwn(MACRO_PROFILES, option.macro)) &&
      new Set(options.map(option => option.macro)).size === 4;
    assert(hasOneOptionForEachProfile, 400,
      'A core interest question needs four answers, mapped once each to A, B, C and D. Each answer casts one vote.');

    return {
      routing: { role: 'macro-vote', ...section },
      options: options.map(({ id, label, macro }) => ({ id, label, macro }))
    };
  }

  // Constraint questions guide school filters and ordering; they do not add votes.
  assert(Object.hasOwn(CONSTRAINT_KEYS, routing.constraintKey), 400, 'Choose a valid practical preference.');
  const prioritizable = ['tuition', 'distance'].includes(routing.constraintKey);
  const hasPriorityForEveryAnswer = options.every(option => typeof option.prioritize === 'boolean');
  assert(!prioritizable || hasPriorityForEveryAnswer, 400,
    'Specify whether each practical answer prioritizes tuition or distance.');

  return {
    routing: { role: 'constraint', constraintKey: routing.constraintKey, ...section },
    options: options.map(({ id, label, prioritize }) => ({
      id,
      label,
      ...(prioritizable ? { prioritize } : {})
    }))
  };
}
