import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');

test('assessment admin exposes profiles, sections, follow-ups, career options, clusters, catalog links and display text', () => {
  const editor = source('admin/Pages/AssessmentSettingsEditor.jsx');
  for (const key of ['profiles', 'sections', 'routingQuestions', 'careerVehicle', 'clusters', 'includeProgramIds', 'excludeProgramIds', 'preferredSchoolIds', 'programPreviewCount', 'tuitionChoices', 'distanceChoices', 'copy']) assert.ok(editor.includes(key));
  assert.match(editor, /adminWrite\('\/assessment-settings', 'PUT'/); assert.match(editor, /version: resource\.data\.version/);
  assert.match(editor, /type="search" form=""/); assert.match(editor, /function CsvField/);
  assert.match(editor, /catalogKeywordMatches\(item, search, kind\)/);
  const manager = source('admin/Pages/AssessmentManagement.jsx');
  assert.match(manager, /requestDiscard\(\(\) => setTab\('questions'\)\)/);
  assert.match(manager, /adminWrite\('\/questions\/order'/);
});

test('outside clicks close admin navigation menus without collapsing editing disclosures', () => {
  const shell = source('admin/Components/AdminShell.jsx');
  assert.match(shell, /details\.aw-dropdown\[open\], details\.admin-sidebar-account\[open\]/);
  assert.doesNotMatch(shell, /querySelectorAll\("details\[open\]"\)/);
});

test('the student flow consumes configured content, an unscored career step and the full cluster directory', () => {
  const routing = source('components/AssessmentRoutingStep.jsx'), page = source('pages/AssessmentPage.jsx');
  assert.match(routing, /plan\.careerVehicle\?\.enabled/); assert.match(routing, /vehicle: choice\.id/);
  assert.match(routing, /question\?\.prompt/); assert.match(routing, /copy\.completeButton/);
  assert.match(page, /configuration\.clusters\.map/); assert.match(page, /display\.programPreviewCount \?\? 8/);
  assert.match(page, /display\.tuitionChoices/); assert.match(page, /display\.distanceChoices/);
  assert.match(page, /data\.attemptPolicy !== 'unlimited'/);
  assert.doesNotMatch(page, /STI College Global City|iACADEMY \(BGC\)|Partner Metro Manila Institutions/);
});
