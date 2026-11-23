import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentTemplate, programMatchesCluster } from '../src/services/assessment-settings-validation.js';
import { saveProgramClusterAssignments } from '../src/services/program-clusters.js';

function mockConnection(settings) {
  let saved = structuredClone(settings);
  return {
    query: async sql => sql.startsWith('SELECT settings')
      ? [[{ settings: saved, updatedAt: new Date() }], []]
      : [[], []],
    execute: async (_sql, [value]) => {
      saved = JSON.parse(value);
      return [{ affectedRows: 1 }, []];
    },
    getSettings: () => saved
  };
}

test('saving a program cluster updates the same include and exclude rules used by assessment matching', async () => {
  const settings = structuredClone(assessmentTemplate);
  settings.clusters = settings.clusters.map(cluster => ({ ...cluster,
    includeKeywords: ['Information Technology'], excludeKeywords: [], includeProgramIds: [], excludeProgramIds: [] }));
  const connection = mockConnection(settings);
  const programId = '123e4567-e89b-42d3-a456-426614174000';
  const [selected] = settings.clusters;

  const saved = await saveProgramClusterAssignments(connection, programId, 'BS Information Technology', [selected.id]);
  const updated = connection.getSettings();

  assert.deepEqual(saved, [{ id: selected.id, name: selected.name }]);
  assert.ok(updated.clusters.find(cluster => cluster.id === selected.id).includeProgramIds.includes(programId));
  assert.ok(!updated.clusters.find(cluster => cluster.id === selected.id).excludeProgramIds.includes(programId));
  for (const cluster of updated.clusters.filter(cluster => cluster.id !== selected.id)) {
    assert.ok(cluster.excludeProgramIds.includes(programId));
    assert.equal(programMatchesCluster({ program_id: programId, program_name: 'BS Information Technology' }, cluster), false);
  }
  assert.equal(programMatchesCluster({ program_id: programId, program_name: 'BS Information Technology' }, updated.clusters.find(cluster => cluster.id === selected.id)), true);
});

test('program cluster assignments reject stale or unknown cluster IDs', async () => {
  const connection = mockConnection(assessmentTemplate);
  await assert.rejects(
    saveProgramClusterAssignments(connection, '123e4567-e89b-42d3-a456-426614174000', 'A program', ['missing-cluster']),
    /Assessment clusters changed/
  );
});
