import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { policyAcceptance, ACCOUNT_POLICY_VERSION, goBackFromPolicy } from '../src/lib/account-policies.js';
import { validateRegistration } from '../src/lib/account-validation.js';

const built = await build({ stdin: { contents: `import {renderToStaticMarkup} from 'react-dom/server';
  import {MemoryRouter} from 'react-router-dom';
  import {AccountAgreement} from './src/components/AccountAgreement.jsx';
  import {AccountPolicyPage} from './src/pages/AccountPolicyPage.jsx';
  export function checkbox(checked){return renderToStaticMarkup(<MemoryRouter><AccountAgreement checked={checked} onChange={()=>{}}/></MemoryRouter>)}
  export function page(kind){return renderToStaticMarkup(<MemoryRouter><AccountPolicyPage kind={kind}/></MemoryRouter>)}`,
  resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true, packages: 'external',
  platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'import.meta.env': '{}' }, write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);

test('agreement starts unchecked, is required, and opens both policy links without losing the form', () => {
  const html = compiled.exports.checkbox(false);
  assert.match(html, /name="acceptedPolicies"/);
  assert.match(html, /type="checkbox" required=""/);
  assert.doesNotMatch(html, /checked=""/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /href="\/privacy"/);
  assert.equal((html.match(/target="_blank"/g) ?? []).length, 2);
  assert.match(html, /acknowledge that I have read/);
  assert.match(html, /separate choice in Profile/);
  assert.match(compiled.exports.checkbox(true), /checked=""/);
});

test('acceptance cannot be forged by truthy strings and registration checks it as well as passwords', () => {
  for (const value of [undefined, false, null, 'true', 1]) assert.throws(() => policyAcceptance(value), /Terms of Use/);
  assert.deepEqual(policyAcceptance(true), { acceptedPolicies: true, policyVersion: ACCOUNT_POLICY_VERSION });
  assert.throws(() => validateRegistration({ password: 'test-password', confirmPassword: 'test-password' }), /Terms of Use/);
});

test('new Google accounts receive an explicit agreement step; existing login is not forced through registration', () => {
  const page = readFileSync(new URL('../src/pages/AuthPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /acceptedPolicies: false/);
  assert.match(page, /POLICY_ACCEPTANCE_REQUIRED/);
  assert.match(page, /setPendingGoogleCredential\(credential\)/);
  assert.match(page, /step === 'register' \|\| pendingGoogleCredential \? policyAcceptance/);
  assert.match(page, /Agree and create account/);
  assert.doesNotMatch(page, /localStorage.*credential|sessionStorage.*credential/);
  assert.match(page, /step === 'register' && <AccountAgreement/);
});

test('public policies describe actual optional location behavior and flag unfinished owner details without publishing the admin email', () => {
  const privacy = compiled.exports.page('privacy');
  const terms = compiled.exports.page('terms');
  assert.match(privacy, /Privacy Policy/);
  assert.match(terms, /Terms of Use/);
  for (const html of [privacy, terms]) {
    assert.match(html, new RegExp(ACCOUNT_POLICY_VERSION));
    assert.match(html, /Draft for project-owner review/);
    assert.match(html, /has not configured a public support\/privacy contact yet/);
    assert.doesNotMatch(html, /unicourse02@gmail\.com|support@xloreu\.com/);
  }
  assert.match(privacy, /not track your location continuously/);
  assert.match(privacy, /no automatic account-expiry or self-service deletion/);
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="terms" element=\{<AccountPolicyPage/);
  assert.match(app, /path="privacy" element=\{<AccountPolicyPage/);
});

test('policy return control is a Back button, not a registration redirect', () => {
  for (const kind of ['privacy', 'terms']) {
    const html = compiled.exports.page(kind);
    assert.match(html, /<p class="policy-return"><button class="secondary-btn" type="button">Back<\/button><\/p>/);
    assert.doesNotMatch(html, /Back to create account/);
  }
});

test('Back uses previous in-app page and safely handles direct or new-tab visits', () => {
  for (const index of [1, 2, 9]) {
    const calls = [];
    goBackFromPolicy((...args) => calls.push(args), index);
    assert.deepEqual(calls, [[-1]]);
  }
  for (const index of [0, undefined, null, -1, NaN, '2', 1.5]) {
    const calls = [];
    goBackFromPolicy((...args) => calls.push(args), index);
    assert.deepEqual(calls, [['/', { replace: true }]]);
  }
});
