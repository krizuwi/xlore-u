import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { validatePersonalName, validateSchoolName, validatePhone, identityInputProps, personalNameInput, schoolNameInput, phoneInput } from '../src/lib/identity-validation.js';
import { validateProfileDetails, validateRegistration } from '../src/lib/account-validation.js';
import { validateInstitutionRegistration } from '../src/lib/institution-registration.js';
import { institutionName } from '../src/lib/institution-account.js';

const invalidNames = ['Ana@', 'Anne-Marie', "O'Neil", 'Jr.', 'Ana1', 'Ana😀', 'Ana\n', 'Ana\tMaria', '\u0301Ana', 'Ana\u200b'];
const registration = { firstName: 'José', middleName: '', lastName: 'De la Peña', address: 'Taguig City', email: 'staff@example.test', password: 'FixtureOnly123!', confirmPassword: 'FixtureOnly123!', acceptedPolicies: true, schoolId: 'school', representativeTitle: 'Officer', contactPhone: '0281234567', verificationUrl: 'https://school.example/staff', verificationNote: 'Call our office' };

test('personal names support Unicode letters, accents, spaces and optional middle name', () => {
  for (const name of ['José', 'De la Peña', 'Jose\u0301', '李明', 'Ana Maria', '']) assert.doesNotThrow(() => validatePersonalName(name, 'Name'));
  for (const name of [...invalidNames, 123, {}, []]) assert.throws(() => validatePersonalName(name, 'Name'), /letters and spaces/);
  assert.doesNotThrow(() => validateRegistration(registration));
  assert.doesNotThrow(() => validateInstitutionRegistration(registration));
});

test('registration and profile submit checks reject bad values in every personal name field', () => {
  for (const field of ['firstName', 'middleName', 'lastName']) for (const value of invalidNames) {
    for (const check of [validateProfileDetails, validateRegistration, validateInstitutionRegistration]) assert.throws(() => check({ ...registration, [field]: value }), /special characters/);
  }
});

test('institution names permit numbers but reject symbols in requests and settings', () => {
  for (const name of ['University 2026', 'Peña Academy', ' School  2 ']) {
    assert.doesNotThrow(() => validateSchoolName(name));
    assert.doesNotThrow(() => institutionName(name));
  }
  const proposed = { name: 'School 2', city: 'Taguig', address: 'Campus', website: 'https://school.example', description: '' };
  for (const name of ['School@', 'School & Academy', 'School–Campus', 'School\n', '<School>']) {
    assert.throws(() => institutionName(name), /special characters/i);
    assert.throws(() => validateInstitutionRegistration(registration, { ...proposed, name }), /special characters/i);
  }
});

test('telephone is a digits-only string with leading zero preserved', () => {
  assert.doesNotThrow(() => validatePhone('0281234567'));
  assert.doesNotThrow(() => validatePhone('0'.repeat(30)));
  for (const phone of ['', '+63281234567', '02 81234567', '02-81234567', '(02)81234567', '1e10', '١٢٣', '123\n', 281234567]) {
    assert.throws(() => validatePhone(phone), /numbers only/);
    assert.throws(() => validateInstitutionRegistration({ ...registration, contactPhone: phone }));
  }
  assert.throws(() => validateInstitutionRegistration({ ...registration, contactPhone: '0'.repeat(31) }), /30/);
});

const result = await build({ entryPoints: [fileURLToPath(new URL('../src/components/AccountField.jsx', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external' });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
test('shared account fields carry accessible native validation without stripping pasted input', () => {
  for (const name of ['firstName', 'middleName', 'lastName', 'schoolName', 'proposedSchool.name']) {
    const html = renderToStaticMarkup(createElement(compiled.exports.AccountField, { name, label: name, value: 'Invalid@', onChange() {} }));
    assert.ok(html.includes('pattern=') && /special characters/i.test(html));
    assert.ok(html.includes('value="Invalid@"') && html.includes('aria-describedby='));
  }
  const phone = renderToStaticMarkup(createElement(compiled.exports.AccountField, { name: 'contactPhone', label: 'Telephone', value: '0281234567', type: 'tel', onChange() {} }));
  for (const marker of ['type="tel"', 'inputMode="numeric"', 'pattern="[0-9]+"', 'value="0281234567"', 'numbers only']) assert.ok(phone.includes(marker), marker);
  assert.deepEqual(identityInputProps('firstName', 'text'), personalNameInput);
  assert.deepEqual(identityInputProps('schoolName', 'text'), schoolNameInput);
  assert.deepEqual(identityInputProps('contactPhone', 'tel'), phoneInput);
  for (const name of ['email', 'password', 'address', 'schoolSearch', 'representativeTitle']) assert.deepEqual(identityInputProps(name, 'text'), {});
  const profile = readFileSync(new URL('../src/pages/ProfilePage.jsx', import.meta.url), 'utf8');
  assert.equal((profile.match(/\{\.\.\.personalNameInput\}/g) ?? []).length, 3);
});
