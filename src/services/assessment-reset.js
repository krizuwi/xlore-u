// Maintenance only: callers must wrap this in a transaction. Never called by a route or deployment.
export const assessmentResetTables = ["assessments", "assessment_responses", "career_profiles", "recommended_programs"];

export async function resetAssessmentResults(connection, saveBackup) {
  if (typeof saveBackup !== "function") throw new Error("A verified backup is required before reset.");
  await connection.query("SET LOCAL lock_timeout = '10s'");
  await connection.query(`LOCK TABLE ${assessmentResetTables.join(", ")} IN ACCESS EXCLUSIVE MODE`);
  const snapshot = {};
  for (const table of assessmentResetTables) {
    const [rows] = await connection.query(`SELECT * FROM ${table}`);
    snapshot[table] = rows;
  }
  const counts = Object.fromEntries(assessmentResetTables.map(table => [table, snapshot[table].length]));
  const affectedUsers = new Set(snapshot.assessments.map(assessment => assessment.user_id)).size;
  // Backup failure throws before any deletion; locks also prevent new submissions entering this snapshot.
  await saveBackup({ version: 1, project: "xlore-u", resetAt: new Date().toISOString(), counts, affectedUsers, tables: snapshot });
  const [deleted] = await connection.execute("DELETE FROM assessments");
  if (deleted.affectedRows !== counts.assessments) throw new Error("Reset count mismatch; rolling back.");
  for (const table of assessmentResetTables) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM ${table}`);
    if (Number(rows[0].count) !== 0) throw new Error(`Assessment reset incomplete for ${table}; rolling back.`);
  }
  return { cleared: counts, affectedUsers };
}
