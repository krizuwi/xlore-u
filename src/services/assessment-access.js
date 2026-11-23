import { assert } from '../utils/http-error.js';

/**
 * Enforce the attempt policy before saving an assessment.
 * Locking the user row prevents two simultaneous submissions from both using
 * the same one allowed attempt.
 */
export async function assertFirstAssessment(connection, userId, policy = 'once') {
  const [users] = await connection.execute(
    'SELECT user_id FROM users WHERE user_id = ? FOR UPDATE',
    [userId]
  );

  assert(users[0], 401, 'The account is unavailable.');
  if (policy === 'unlimited') return;

  // Under the "once" policy, any saved result means this account has used its attempt.
  const [assessments] = await connection.execute(
    'SELECT assessment_id FROM assessments WHERE user_id = ? LIMIT 1',
    [userId]
  );
  assert(!assessments[0], 409,
    'You have already completed your assessment. Each account can complete the assessment only once. You can revisit your existing results.');
}
