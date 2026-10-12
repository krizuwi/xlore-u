import { createHash } from 'node:crypto';
import { pool } from '../db/pool.js';
import { validateAssessmentSettings } from './assessment-settings-validation.js';

export async function getAssessmentSettings(connection = pool, lock = false) {
  const [rows] = await connection.query(`SELECT settings, updated_at AS "updatedAt" FROM assessment_settings WHERE id = TRUE${lock ? ' FOR UPDATE' : ''}`);
  // Empty fixtures / older custom banks retain the v1 workflow. Production v2
  // is installed explicitly by migration 019, never guessed from missing data.
  if (!rows[0]?.settings) return { settings: null, version: '' };
  const settings = validateAssessmentSettings(rows[0].settings);
  return { settings, version: createHash('sha256').update(JSON.stringify(settings)).digest('hex') };
}
