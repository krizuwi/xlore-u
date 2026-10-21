import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

const result = await build({ entryPoints: [fileURLToPath(new URL('../src/components/StudentRegistrationFields.jsx', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' } });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const form = { firstName: 'Alex', middleName: '', lastName: 'Student', address: 'Taguig City', email: 'student@example.test', password: '', confirmPassword: '' };
const render = value => renderToStaticMarkup(createElement(compiled.exports.StudentRegistrationFields, { form: value, onChange() {} }));

test('student registration uses institution-style sections, shared fields and real character counts', () => {
  const html = render(form);
  assert.ok(html.includes('Personal details') && html.includes('Account details'));
  assert.equal((html.match(/class="institution-registration-section"/g) ?? []).length, 2);
  assert.ok(html.includes('4 / 20') && html.includes('11 / 50'));
  for (const max of [20, 40, 50]) assert.ok(html.includes(`maxLength="${max}"`));
  for (const name of Object.keys(form)) assert.ok(html.includes(`name="${name}"`));
  assert.ok(html.includes('Show password') && html.includes('Show re-enter password'));
  assert.equal((html.match(/type="password"/g) ?? []).length, 2);
  assert.match(html.match(/<input[^>]*name="middleName"[^>]*>/)?.[0] ?? '', /autoComplete="additional-name"/);
});

test('student registration retains escaped values, accessible labels and optional middle name', () => {
  const html = render({ ...form, firstName: '<script>alert(1)</script>' });
  assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>'));
  assert.ok(html.includes('aria-labelledby=') && html.includes('aria-describedby='));
  const middle = html.match(/<input[^>]*name="middleName"[^>]*>/)?.[0];
  assert.ok(middle && !middle.includes('required='));
});

test('top-aligned registration layout is shared without changing Google, verification or agreement handling', () => {
  const auth = readFileSync(new URL('../src/pages/AuthPage.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/institution/institution.css', import.meta.url), 'utf8');
  assert.ok(auth.includes("step === 'register' ? ' student-register-page' : ''"));
  assert.ok(auth.includes('<StudentRegistrationFields form={form} onChange={update} />'));
  assert.match(styles, /:is\(\.institution-register-page, \.student-register-page\) \.auth-layout[^}]*align-items: start/);
  assert.match(styles, /@media\(max-width: 1000px\)[\s\S]*student-register-page[\s\S]*position: static/);
  for (const part of ['<GoogleSignInButton', 'validateRegistration(form)', 'policyAcceptance(form.acceptedPolicies)', 'setStep("verify")', '/auth/verify-email', '/auth/resend-verification', "step === 'register' && <AccountAgreement"]) assert.ok(auth.includes(part));
  assert.ok(auth.includes('enabled={!user && step !== "login"}'));
});
