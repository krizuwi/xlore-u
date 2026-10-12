import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/admin/Pages/AdminUtilityPages.jsx', import.meta.url), 'utf8');
const login = source.slice(source.indexOf('export function AdminLoginPage'), source.indexOf('export function AdminSettingsPage'));

test('admin sign-in starts with a blank, required, editable email instead of exposing a preset account', () => {
  assert.match(login, /const \[email, setEmail\] = useState\(""\)/);
  const input = login.match(/<input id="au-admin-email"[\s\S]*?\/>/)[0];
  assert.match(input, /value=\{email\}/); assert.match(input, /onChange=/); assert.match(input, /required/);
  assert.match(input, /disabled=\{busy\}/); assert.doesNotMatch(input, /readOnly|unicourse02|placeholder=/);
  assert.match(login, /loginAdmin\(email\.trim\(\), password\)/);
});
test('Google and password admin sign-in still check the authorized account independently of the typed email', () => {
  assert.match(login, /account.role !== "admin" \|\| account.email.toLowerCase\(\) !== authorizedAdminEmail/);
  assert.match(login, /loginWithGoogle\(credential, true\)/);
  assert.match(login, /await logout\(\)/);
});
test('password recovery carries only the email typed by the administrator, never the preset address', () => {
  assert.match(login, /step: "forgot", email: email\.trim\(\), from: "\/admin"/);
  assert.doesNotMatch(login, /email: authorizedAdminEmail/);
});
