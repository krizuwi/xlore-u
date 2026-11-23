import { createHash } from 'node:crypto';
import { pool } from '../db/pool.js';
import { validateAssessmentSettings } from './assessment-settings-validation.js';

/** Read the active routing/matching configuration and its change version. */
export async function getAssessmentSettings(connection = pool, lock = false) {
  const lockClause = lock ? ' FOR UPDATE' : '';
  const [rows] = await connection.query(
    `SELECT settings, updated_at AS "updatedAt"
     FROM assessment_settings
     WHERE id = TRUE${lockClause}`
  );

  // Empty fixtures / older custom banks retain the v1 workflow. Production v2
  // is installed explicitly by migration 019, never guessed from missing data.
  if (!rows[0]?.settings) return { settings: null, version: '' };

  // Validate stored JSON before using it, then hash it so forms can detect edits
  // made while a student or administrator has the questionnaire open.
  const settings = validateAssessmentSettings(rows[0].settings);
  const version = createHash('sha256')
    .update(JSON.stringify(settings))
    .digest('hex');

  return { settings, version };
}
