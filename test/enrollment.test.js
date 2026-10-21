import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { enrollmentPayload, studentAccessPayload, ENROLLMENT_DECLARATION, ENROLLMENT_DECLARATION_VERSION } from '../src/lib/enrollment.js';
const school = { id: '40000000-0000-4000-8000-000000000001', name: 'Fixture School', city: 'Taguig' };
const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('enrollment payload requires a selected school, city and explicit fresh declaration', () => {
  const body = enrollmentPayload(school, '  Las   Piñas ', true);
  assert.deepEqual(body, { schoolId: school.id, city: 'Las Piñas', usedXloreU: true, helpful: true, declarationVersion: ENROLLMENT_DECLARATION_VERSION });
  for (const args of [[null, 'Taguig', true], [{ id: 'forged' }, 'Taguig', true], [school, '', true], [school, 'x'.repeat(101), true], [school, '123 Street', true], [school, 'Taguig', false], [school, 'Taguig', 'true'], [school, 'Taguig', true, 'old']]) assert.throws(() => enrollmentPayload(...args));
  assert.ok(!('userId' in body) && !('usedAssessment' in body));
});
test('student access change requires a known status and bounded reason, with stale-state protection', () => {
  assert.deepEqual(studentAccessPayload({ id: 'one', active: true }, ' Reason '), { active: false, expectedActive: true, reason: 'Reason' });
  assert.equal(studentAccessPayload({ id: 'one', active: false }, 'Restore').active, true);
  for (const args of [[null, 'Reason'], [{ id: 'one' }, 'Reason'], [{ id: 'one', active: true }, ' '], [{ id: 'one', active: true }, 'x'.repeat(2001)]]) assert.throws(() => studentAccessPayload(...args));
});

const result = await build({ stdin: { contents: `export {EnrollmentFields} from './src/components/StudentEnrollment.jsx'; export {EnrollmentBarChart, StudentRecords} from './src/admin/Pages/StudentManagement.jsx';`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } });
const compiled = { exports: {} }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const render = (name, props) => renderToStaticMarkup(createElement(compiled.exports[name], props));

test('enrollment declaration is unchecked and required, explains private self-reporting and preserves optional participation', () => {
  const html = render('EnrollmentFields', { selected: school, city: 'Taguig', checked: false, onCity() {}, onChecked() {} });
  const checkbox = html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] ?? '';
  assert.match(checkbox, /name="usedXloreU"/); assert.match(checkbox, /required=""/); assert.doesNotMatch(checkbox, /checked=""/);
  assert.ok(html.includes(ENROLLMENT_DECLARATION)); assert.match(html, /optional report does not affect access/);
  assert.match(html, /not posted publicly or verified by the school/); assert.match(html, /not the school/);
  assert.match(html, /maxLength="100"/); assert.match(html, /class="checkbox-row enrollment-declaration"/);
  const unsafe = render('EnrollmentFields', { selected: { ...school, name: '<script>school</script>' }, city: '', checked: true, onCity() {}, onChecked() {} });
  assert.ok(unsafe.includes('&lt;script&gt;')); assert.ok(!unsafe.includes('<script>'));
});
test('statistics have accessible counts, labels, real empty states and no pretend school rankings', () => {
  const html = render('EnrollmentBarChart', { title: 'Most selected enrolled schools', rows: [{ id: 'one', label: '<School>', count: 24 }, { id: 'two', label: 'School B', count: 3 }], total: 27 });
  assert.match(html, /Top 10/); assert.match(html, /27 current student reports/); assert.match(html, /<progress value="24" max="24"/);
  assert.match(html, /aria-label="&lt;School&gt;: 24 students"/); assert.doesNotMatch(html, /<School>/);
  const empty = render('EnrollmentBarChart', { title: 'Cities' }); assert.match(empty, /No enrollment reports match/); assert.doesNotMatch(empty, /NaN|Infinity/);
});
test('private student table distinguishes no report from not enrolled, shows assessment and estimated city labels, and escapes reasons', () => {
  const rows = [{ id: 'one', name: 'Student', email: 'student@example.test', city: 'Makati', citySource: 'profile_estimate', usedAssessment: false, active: true, schoolId: null, verified: true }, { id: 'two', name: '<Student>', email: 'other@example.test', city: 'Taguig', citySource: 'enrollment_report', usedAssessment: true, active: false, schoolId: school.id, schoolName: school.name, reportedAt: '2026-10-22T00:00:00Z', lastAction: { reason: '<script>reason</script>', createdAt: '2026-10-22T00:00:00Z', emailStatus: 'failed' } }];
  const html = render('StudentRecords', { rows, onAccess() {}, onRetry() {}, busy: false });
  for (const marker of ['Not reported', 'Not completed', 'Completed', 'Estimated from profile address', 'Confirmed in enrollment report', 'Suspend account', 'Restore account', 'Retry suspension email', 'Enrolled · self-reported']) assert.ok(html.includes(marker), marker);
  assert.doesNotMatch(html, /Not enrolled|<script>/); assert.match(html, /&lt;script&gt;reason/);
});
test('dashboard/admin navigation and asynchronous search are wired without granting institutions student access', () => {
  assert.ok(source('pages/DashboardPage.jsx').includes('<StudentEnrollment />'));
  assert.ok(source('admin/Components/navbar/Navbar.jsx').includes("to: '/admin/students'"));
  assert.ok(source('admin/Dashboard/AdminOverviewPage.jsx').includes('path="students" element={<StudentManagement />}'));
  const ui = source('components/StudentEnrollment.jsx');
  for (const marker of ["user?.role === 'student'", "useState(false)", 'controller.abort()', 'results.key === search', 'No school is selected automatically', "method: 'DELETE'", 'Confirm withdrawal', 'key={user.id}', 'showModal()', 'requestDiscard(onClose']) assert.ok(ui.includes(marker), marker);
  const admin = source('admin/Pages/StudentManagement.jsx');
  for (const marker of ['state.key === path', 'controller.abort()', 'search.trim() !== appliedSearch', 'maxLength={100}', 'Confirm suspension', 'maxLength={2000}', 'scope="col"', 'across all matching records', 'studentAccessPayload(student, reason)']) assert.ok(admin.includes(marker), marker);
});
