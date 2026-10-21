import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { validateNameParts } from '../src/utils/user-name.js';
import { validatePersonalName, validateSchoolName, validatePhone } from '../src/utils/identity-validation.js';
import { validateInstitutionName } from '../src/services/institution-account.js';
import { validateApplication } from '../src/services/institutions.js';

const names = { firstName: 'José', middleName: '', lastName: 'De la Peña' };
const application = { schoolId: '40000000-0000-4000-8000-000000000001', representativeTitle: 'Officer', contactPhone: '0281234567', verificationUrl: 'https://school.example/staff', verificationNote: 'Contact the office' };
const badNames = ['Ana@', 'Anne-Marie', "O'Neil", 'Jr.', 'Ana1', 'Ana😀', 'Ana\n', 'Ana\tMaria', '\u0301Ana', 'Ana\u200b'];

test('name fields and legacy fullName reject punctuation, numbers and control characters without stripping them', () => {
  for (const name of ['José', 'De la Peña', 'Jose\u0301', '李明', 'Ana Maria', '']) assert.doesNotThrow(() => validatePersonalName(name, 'Name'));
  assert.equal(validateNameParts(names).fullName, 'José De la Peña');
  for (const field of ['firstName', 'middleName', 'lastName']) for (const value of [...badNames, {}, ['Ana'], 123]) assert.throws(() => validateNameParts({ ...names, [field]: value }), /letters and spaces/);
  for (const value of badNames) assert.throws(() => validateNameParts({ fullName: value }), /letters and spaces/);
});

test('institution request and rename validate names without restricting existing school selections', () => {
  assert.equal(validateInstitutionName(' Peña Academy 2 '), 'Peña Academy 2');
  const proposedSchool = { name: 'Academy 2', type: 'Private', city: 'Taguig', address: 'Campus address', latitude: 14.5, longitude: 121, website: 'https://school.example' };
  assert.doesNotThrow(() => validateApplication(application));
  assert.equal(validateApplication({ ...application, schoolId: null, proposedSchool }).proposedSchool.name, 'Academy 2');
  for (const name of ['School@', 'School & Academy', 'School–Campus', 'School\n', '<School>']) {
    assert.throws(() => validateSchoolName(name), /special characters/i);
    assert.throws(() => validateInstitutionName(name), /special characters/i);
    assert.throws(() => validateApplication({ ...application, schoolId: null, proposedSchool: { ...proposedSchool, name } }), /special characters/i);
  }
});

test('phone rejects all non-digits and non-string values while preserving leading zeros and max length', () => {
  for (const value of ['', '+63281234567', '02 81234567', '02-81234567', '(02)81234567', '1e10', '١٢٣', '123\n', 281234567]) {
    assert.throws(() => validatePhone(value), /numbers only/);
    assert.throws(() => validateApplication({ ...application, contactPhone: value }), /numbers only/);
  }
  assert.equal(validateApplication(application).contactPhone, '0281234567');
  assert.equal(validateApplication({ ...application, contactPhone: '0'.repeat(30) }).contactPhone, '0'.repeat(30));
  assert.throws(() => validateApplication({ ...application, contactPhone: '0'.repeat(31) }), /30/);
});

process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable'; process.env.EMAIL_ENABLED = 'false'; process.env.NODE_ENV = 'test';
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const { ACCOUNT_POLICY_VERSION } = await import('../src/services/account-policies.js');
const registration = { ...names, ...application, address: 'Taguig City', email: 'staff@example.test', password: 'FixtureOnly123!', confirmPassword: 'FixtureOnly123!', acceptedPolicies: true, policyVersion: ACCOUNT_POLICY_VERSION };

test('student/institution registration cannot bypass names or phone checks through direct requests', async t => {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const sql = t.mock.method(pool, 'execute', async () => { throw new Error('Unexpected database access'); });
  async function post(path, changes, pattern) {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...registration, ...changes }) });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error.message, pattern);
  }
  for (const field of ['firstName', 'middleName', 'lastName']) for (const path of ['/auth/register', '/institutions/register']) await post(path, { [field]: 'Invalid@' }, /letters and spaces/);
  for (const contactPhone of ['+63281234567', '02 81234567', '028123abc']) await post('/institutions/register', { contactPhone }, /numbers only/);
  assert.equal(sql.mock.callCount(), 0);
});

test('student profile and institution rename reject direct requests without performing updates', async t => {
  const identity = { user_id: '10000000-0000-4000-8000-000000000001', email: 'student@example.test', full_name: 'Ana Santos', first_name: 'Ana', middle_name: '', last_name: 'Santos', email_verified_at: new Date(), is_active: true, account_type: 'student' };
  const sql = t.mock.method(pool, 'execute', async query => { assert.match(query, /^SELECT/); return [[identity]]; });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  for (const [path, body, message] of [['/auth/me', { ...names, firstName: 'Invalid@' }, /letters and spaces/], ['/institutions/account', { schoolName: 'Invalid@', expectedName: 'Old school' }, /special characters/i]]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createAccessToken(identity)}` }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error.message, message);
  }
  assert.equal(sql.mock.callCount(), 3); // Authentication/profile reads only; the mock rejects every write.
});
