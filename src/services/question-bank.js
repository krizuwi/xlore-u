import { pool } from "../db/pool.js";
import { getAssessmentSettings } from './assessment-settings.js';

export async function getQuestionBank({ includeDrafts = false, connection = pool } = {}) {
  const [rows] = await connection.query(
    `SELECT question_id AS id, prompt, options, routing_config AS routing, status, position_index AS position,
      updated_at AS "updatedAt" FROM assessment_questions ORDER BY position_index, question_id`
  );
  const configured = await getAssessmentSettings(connection);
  const version = rows.map((row) => `${row.id}:${new Date(row.updatedAt).toISOString()}`).join("|") + (configured.version ? `|settings:${configured.version}` : '');
  const data = includeDrafts ? rows : rows.filter((row) => row.status === "Active");
  if (configured.settings) {
    const sectionOrder = id => { const index = configured.settings.sections.findIndex(section => section.id === id); return index < 0 ? Infinity : index; };
    data.sort((left, right) => sectionOrder(left.routing?.sectionId) - sectionOrder(right.routing?.sectionId) || left.position - right.position || left.id.localeCompare(right.id));
  }
  return { data, version, settings: configured.settings };
}
