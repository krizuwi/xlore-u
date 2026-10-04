import { pool } from "../db/pool.js";

export async function getQuestionBank({ includeDrafts = false } = {}) {
  const [rows] = await pool.query(
    `SELECT question_id AS id, prompt, options, status, position_index AS position,
      updated_at AS "updatedAt" FROM assessment_questions ORDER BY position_index, question_id`
  );
  const version = rows.map((row) => `${row.id}:${new Date(row.updatedAt).toISOString()}`).join("|");
  return { data: includeDrafts ? rows : rows.filter((row) => row.status === "Active"), version };
}
