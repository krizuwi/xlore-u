import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { institutionName, institutionPassword } from '../src/lib/institution-account.js';
const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
const result = await build({ entryPoints: [fileURLToPath(new URL('../src/institution/InstitutionSettings.jsx', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } });
const module = { exports: {} }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { InstitutionAccountFields, InstitutionPasswordFields } = module.exports;
const password = { currentPassword: 'FixtureOld123!', newPassword: 'FixtureNew123!', confirmPassword: 'FixtureNew123!' };
test('institution name normalization and character boundaries match the API', () => {
  assert.equal(institutionName(' Fixture   University '), 'Fixture University');
  assert.equal(institutionName('x'.repeat(190)).length, 190);
  for (const value of ['', '   ', 'x'.repeat(191), {}]) assert.throws(() => institutionName(value));
});
test('password validation requires current password, confirmation, changed value and byte-safe boundaries', () => {
  assert.deepEqual(institutionPassword(password), password);
  for (const change of [{ currentPassword: '' }, { newPassword: 'short' }, { newPassword: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }, { confirmPassword: 'wrong' }, { newPassword: password.currentPassword, confirmPassword: password.currentPassword }]) assert.throws(() => institutionPassword({ ...password, ...change }));
  assert.equal(institutionPassword({ ...password, newPassword: 'x'.repeat(72), confirmPassword: 'x'.repeat(72) }).newPassword.length, 72);
});
test('institution fields show linked name and readonly contact/representative, not personal home location', () => {
  const account = { canRename: true, email: 'staff@example.test', representativeName: 'Fixture Representative' };
  const html = renderToStaticMarkup(createElement(InstitutionAccountFields, { account, name: '<script>school</script>', onChange() {} }));
  for (const label of ['Institution name', 'Institution contact email', 'Registered representative', 'maxLength="190"', 'readOnly=""']) assert.ok(html.includes(label), label);
  assert.ok(html.includes('&lt;script&gt;school&lt;/script&gt;')); assert.ok(!html.includes('Home address'));
  const locked = renderToStaticMarkup(createElement(InstitutionAccountFields, { account: { ...account, canRename: false }, name: 'School', onChange() {} }));
  assert.ok(locked.includes('disabled=""') && locked.includes('only after approval'));
});
test('password fields are masked, required, correctly autocompleted and do not trim passwords', () => {
  const html = renderToStaticMarkup(createElement(InstitutionPasswordFields, { value: { currentPassword: '', newPassword: '', confirmPassword: '' }, onChange() {} }));
  assert.equal((html.match(/type="password"/g) ?? []).length, 3);
  assert.equal((html.match(/required=""/g) ?? []).length, 3);
  assert.ok(html.includes('autoComplete="current-password"')); assert.ok(html.includes('autoComplete="new-password"')); assert.ok(html.includes('72 UTF-8 bytes'));
});
test('settings have role gating, protected separate forms, no ownership switch, and deliberate post-save sign-in', () => {
  const ui = source('institution/InstitutionSettings.jsx');
  for (const phrase of ["user.role !== 'institution'", 'user.emailVerified', 'key={user.id}', 'UnsavedForm', 'requestDiscard', 'expectedName: savedName', "'/institutions/account/password'", "navigate('/institution/login'", 'markClean(passwordRoot.current)', 'await logout()']) assert.ok(ui.includes(phrase), phrase);
  assert.ok(!ui.includes('HomeLocationPicker') && !ui.includes('schoolId:'));
  assert.ok(source('App.jsx').includes('path="institution/settings"'));
  assert.ok(source('components/Layout.jsx').includes('to="/institution/settings"'));
  assert.ok(source('pages/SchoolDetailPage.jsx').includes('to="/institution/settings"'));
  assert.ok(source('institution/InstitutionWorkspace.jsx').includes('to="/institution/settings"'));
});
