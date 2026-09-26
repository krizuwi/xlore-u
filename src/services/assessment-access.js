import { assert } from "../utils/http-error.js";

// Lock the account row so concurrent submissions cannot both pass the first-attempt check.
export async function assertFirstAssessment(connection, userId) {
  const [users] = await connection.execute(
    "SELECT user_id FROM users WHERE user_id = ? FOR UPDATE",
    [userId]
  );
  assert(users[0], 401, "The account is unavailable.");
  const [assessments] = await connection.execute(
    "SELECT assessment_id FROM assessments WHERE user_id = ? LIMIT 1",
    [userId]
  );
  assert(!assessments[0], 409, "You have already completed your assessment. Retakes are unavailable right now.");
}
