import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { authenticateGoogleStudent } from '../src/lib/google-registration-flow.js';
import { ACCOUNT_POLICY_VERSION } from '../src/lib/account-policies.js';

test('Google authentication comes first, without borrowing email-form consent', async () => {
  const calls = [];
  const login = async (...args) => { calls.push(args); throw Object.assign(new Error('Acceptance required'), { details: { code: 'POLICY_ACCEPTANCE_REQUIRED' } }); };
  assert.deepEqual(await authenticateGoogleStudent('test-credential', login), { requiresAgreement: true });
  assert.deepEqual(calls, [['test-credential', false, {}]]);
});

test('only explicit checked agreement sends the current policy acceptance', async () => {
  const calls = []; const login = async (...args) => calls.push(args);
  for (const accepted of [false, 'true', 1]) await assert.rejects(authenticateGoogleStudent('test-credential', login, accepted), /Terms of Use/);
  assert.equal(calls.length, 0);
  assert.deepEqual(await authenticateGoogleStudent('test-credential', login, true), { requiresAgreement: false });
  assert.deepEqual(calls, [['test-credential', false, { acceptedPolicies: true, policyVersion: ACCOUNT_POLICY_VERSION }]]);
});

test('existing Google users sign in immediately; actual auth errors stay errors', async () => {
  assert.deepEqual(await authenticateGoogleStudent('test-credential', async () => {}), { requiresAgreement: false });
  for (const message of ['Account disabled', 'Google credential expired', 'Network error']) {
    await assert.rejects(authenticateGoogleStudent('test-credential', async () => { throw new Error(message); }), new RegExp(message));
  }
});

const result = await build({ stdin: { contents: `import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {GoogleAccountAgreementDialog} from './src/components/GoogleAccountAgreementDialog.jsx';
export function dialog(checked,busy=false){return renderToStaticMarkup(<MemoryRouter><GoogleAccountAgreementDialog open checked={checked} busy={busy} onChange={()=>{}} onConfirm={()=>{}} onCancel={()=>{}} /></MemoryRouter>);}`,
  resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);

test('agreement is an accessible modal with unchecked consent, policy links and guarded confirmation', () => {
  const markup = compiled.exports.dialog(false);
  assert.match(markup, /<dialog[^>]+aria-labelledby="google-agreement-title"/);
  assert.match(markup, /type="checkbox" required=""/);
  assert.doesNotMatch(markup, /checked=""/);
  assert.match(markup, /href="\/privacy"/);
  assert.match(markup, /href="\/terms"/);
  assert.match(markup, /disabled="">Agree and create account/);
  assert.doesNotMatch(compiled.exports.dialog(true), /disabled="">Agree and create account/);
  assert.match(compiled.exports.dialog(true, true), /disabled="">Creating account/);
});

test('both student entry pages use Google-first flow and cancellation clears the pending credential', () => {
  const source = readFileSync(new URL('../src/pages/AuthPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /<GoogleSignInButton[\s\S]*?busy=\{busy\}/);
  assert.doesNotMatch(source, /busy=\{busy \|\| step === 'register' && !form.acceptedPolicies\}[\s\S]*?onCredential/);
  assert.match(source, /const cancelGoogleAgreement = \(\) => \{\s*setPendingGoogleCredential\(''\);\s*setGoogleAcceptedPolicies\(false\)/);
  assert.match(source, /onConfirm=\{\(\) => signInWithGoogle\(pendingGoogleCredential, true\)\}/);
});
