import test from 'node:test';
import assert from 'node:assert/strict';
import { optionalSchoolCoordinates, schoolMapQuery, hasSchoolCoordinates } from '../src/lib/school-location.js';
import { optionalVerificationLink } from '../src/lib/institution-registration.js';

test('missing campus coordinates stay unknown; partial, invalid and coerced boolean values are rejected', () => {
  for (const value of [{}, { latitude: null, longitude: null }, { latitude: '', longitude: '' }, { latitude: ' ', longitude: ' ' }]) {
    assert.deepEqual(optionalSchoolCoordinates(value), { latitude: null, longitude: null }); assert.equal(hasSchoolCoordinates(value), false);
  }
  assert.deepEqual(optionalSchoolCoordinates({ latitude: '14.5', longitude: '121' }), { latitude: 14.5, longitude: 121 });
  assert.deepEqual(optionalSchoolCoordinates({ latitude: 0, longitude: 0 }), { latitude: 0, longitude: 0 });
  for (const value of [{ latitude: 14.5 }, { longitude: 121 }, { latitude: 91, longitude: 121 }, { latitude: 14, longitude: -181 }, { latitude: false, longitude: [] }]) assert.throws(() => optionalSchoolCoordinates(value));
});

test('school maps use verified numeric coordinates or an address search, never null/null or invented zero coordinates', () => {
  const school = { name: 'Example School', address: 'Campus Road', city: 'Taguig', latitude: null, longitude: null };
  assert.equal(schoolMapQuery(school), 'Example School, Campus Road, Taguig');
  assert.equal(schoolMapQuery({ ...school, latitude: '14.5', longitude: '121' }), '14.5,121');
  assert.equal(schoolMapQuery({ ...school, latitude: '', longitude: '' }), 'Example School, Campus Road, Taguig');
});

test('optional verification link may be blank but supplied links must use HTTPS without credentials', () => {
  for (const value of ['', '  ', undefined]) assert.equal(optionalVerificationLink(value), '');
  assert.equal(optionalVerificationLink(' https://school.example/staff '), 'https://school.example/staff');
  for (const value of ['http://school.example', 'javascript:alert(1)', 'not a URL', 'https://user:password@school.example', {}, 'https://school.example/' + 'x'.repeat(2000)]) assert.throws(() => optionalVerificationLink(value));
});
