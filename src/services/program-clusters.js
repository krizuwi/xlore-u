import { assert } from '../utils/http-error.js';
import { getAssessmentSettings } from './assessment-settings.js';
import { programMatchesCluster, validateAssessmentSettings } from './assessment-settings-validation.js';

/** Save the cluster choices made while an admin or institution edits a program. */
export async function saveProgramClusterAssignments(connection, programId, programName, selectedClusterIds) {
  // Program saving and assessment matching must see one consistent settings row.
  await connection.query('LOCK TABLE assessment_questions IN SHARE MODE');
  await connection.query('LOCK TABLE assessment_settings IN EXCLUSIVE MODE');
  const { settings } = await getAssessmentSettings(connection, true);

  if (!settings) {
    assert(selectedClusterIds.length === 0, 503, 'Assessment clusters are not installed yet.');
    return [];
  }

  // Reject stale IDs if an administrator changed the cluster list while the
  // program editor was open.
  const validIds = new Set(settings.clusters.map(cluster => cluster.id));
  assert(selectedClusterIds.every(clusterId => validIds.has(clusterId)), 409,
    'Assessment clusters changed. Reload the program editor and try again.');

  const selected = new Set(selectedClusterIds);
  const updated = structuredClone(settings);

  // Explicit includes make the program appear in selected clusters. If it used
  // to match a cluster by keyword but is now deselected, add an exclusion so the
  // keyword rule does not add it back.
  updated.clusters = updated.clusters.map(cluster => {
    const matchedBefore = programMatchesCluster({ program_id: programId, program_name: programName }, cluster);
    const includeProgramIds = cluster.includeProgramIds.filter(id => id !== programId);
    const excludeProgramIds = cluster.excludeProgramIds.filter(id => id !== programId);
    if (selected.has(cluster.id)) includeProgramIds.push(programId);
    else if (matchedBefore) excludeProgramIds.push(programId);
    return { ...cluster, includeProgramIds, excludeProgramIds };
  });

  // Revalidate the complete rules object before saving it.
  const validated = validateAssessmentSettings(updated);
  const [result] = await connection.execute(
    'UPDATE assessment_settings SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = TRUE',
    [JSON.stringify(validated)]
  );
  assert(result.affectedRows === 1, 503, 'Assessment settings are not installed yet.');

  return validated.clusters.filter(cluster => selected.has(cluster.id)).map(({ id, name }) => ({ id, name }));
}
