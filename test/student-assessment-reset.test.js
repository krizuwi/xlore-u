import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const result = await build({ stdin: { contents: `import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {StudentRecords,StudentAssessmentResetDialog} from './src/admin/Pages/StudentManagement.jsx'; export function render(name,props){return renderToStaticMarkup(createElement(name==='records'?StudentRecords:StudentAssessmentResetDialog,props));}`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } });
const compiled = { exports: {} };new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const student = { id: 'student', name: '<Student>', email: 'student@example.test', assessmentCount: 1, latestAssessmentId: 'attempt', usedAssessment: true, active: true };

test('student records expose a scoped reset button only enabled for a known attempt', () => {
  const html = compiled.exports.render('records', { rows: [student] });
  assert.match(html, /aria-label="Reset assessment for &lt;Student&gt;"/);
  assert.doesNotMatch(html, /disabled=""[^>]*aria-label="Reset assessment/);
  for (const props of [{ rows: [{ ...student, assessmentCount: 0, latestAssessmentId: null }] }, { rows: [student], busy: true }]) assert.match(compiled.exports.render('records', props), /disabled=""[^>]*aria-label="Reset assessment/);
});

test('reset modal requires an unchecked confirmation, bounded reason and explains targeted deletion', () => {
  const html = compiled.exports.render('dialog', { student });
  assert.match(html, /<dialog[^>]*aria-labelledby="assessment-reset-title"/);
  assert.match(html, /name="assessmentResetReason" required="" maxLength="1000"/);
  assert.match(html, /<input[^>]*required=""[^>]*name="confirmAssessmentReset"/);
  assert.doesNotMatch(html, /checked=""|<Student>/);
  assert.match(html, /disabled="">Confirm assessment reset/);
  assert.match(html, /this student only/);
  assert.match(html, /cannot be undone from the admin panel/);
  assert.match(html, /account access remain unchanged/);
});

test('submission scopes endpoint and stale-result guard to the selected student, then refreshes records', () => {
  const source = readFileSync(new URL('../src/admin/Pages/StudentManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /encodeURIComponent\(student.id\) \+ '\/assessment\/reset'/);
  assert.match(source, /expectedAssessmentId: student.latestAssessmentId/);
  assert.match(source, /if \(busy \|\| !confirmed \|\| !reason.trim\(\)\) return/);
  assert.match(source, /setResetStudent\(null\); setMessage\(result.message\); resource.refresh\(\)/);
});
