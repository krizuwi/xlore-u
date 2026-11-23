import { pool } from "../db/pool.js";
import { getAssessmentSettings } from './assessment-settings.js';

/** Load the question text, routing rules, and current display settings together. */
export async function getQuestionBank({ includeDrafts = false, connection = pool } = {}) {
  const [rows] = await connection.query(
    `SELECT question_id AS id, prompt, options, routing_config AS routing, status, position_index AS position,
      updated_at AS "updatedAt" FROM assessment_questions ORDER BY position_index, question_id`
  );

  // Settings are loaded with the question bank because they affect both routing
  // and the version used to detect stale assessment forms.
  const configured = await getAssessmentSettings(connection);
  const questionVersions = rows
    .map(row => `${row.id}:${new Date(row.updatedAt).toISOString()}`)
    .join('|');
  const settingsVersion = configured.version ? `|settings:${configured.version}` : '';
  const version = questionVersions + settingsVersion;

  // Student endpoints get active questions only. Admin screens can request drafts.
  const data = includeDrafts ? rows : rows.filter(row => row.status === 'Active');
  if (configured.settings) {
    const getSectionOrder = sectionId => {
      const index = configured.settings.sections.findIndex(section => section.id === sectionId);
      return index < 0 ? Infinity : index;
    };

    // Keep questions grouped by configured section, then by their saved order.
    data.sort((left, right) =>
      getSectionOrder(left.routing?.sectionId) - getSectionOrder(right.routing?.sectionId) ||
      left.position - right.position ||
      left.id.localeCompare(right.id)
    );
  }

  return { data, version, settings: configured.settings };
}
