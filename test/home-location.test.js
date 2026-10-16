import test from 'node:test';
import assert from 'node:assert/strict';
import { privateHomeLocation, updateHomeLocation } from '../src/services/home-location.js';
import { addSchoolDistances, haversineDistanceKm, orderAssessmentSchools, orderSchoolsByAddress } from '../src/services/proximity.js';

const point = { latitude: 14.61, longitude: 121.06 };
const user = { address: 'Taguig', home_location: { ...point, address: 'Taguig' } };
const schools = [
  { id: 'center', name: 'City center school', latitude: 14.5176, longitude: 121.0509, matchScore: 80 },
  { id: 'home', name: 'Home school', ...point, matchScore: 80 },
  { id: 'unknown', name: 'No coordinates', matchScore: 80 }
];

test('a confirmed home point takes precedence over city-center estimates everywhere proximity is ordered', () => {
  assert.deepEqual(privateHomeLocation(user), point);
  const result = addSchoolDistances(schools, user);
  assert.equal(result.schools[1].distanceKm, 0);
  assert.ok(result.schools[0].distanceKm > 10);
  assert.equal(result.schools[2].distanceKm, null);
  assert.equal(result.locationBasis.kind, 'home_pin');
  assert.equal(result.schools[0].distanceOrigin, 'home_pin');
  assert.equal(orderSchoolsByAddress(schools, user).schools[0].id, 'home');
  assert.equal(orderAssessmentSchools(schools, user).schools[0].id, 'home');
  assert.deepEqual(result.schools.map(s => s.id), schools.map(s => s.id));
  assert.equal(schools[0].distanceKm, undefined);
  assert.doesNotMatch(JSON.stringify(result.locationBasis), /latitude|longitude|14\.61|121\.06/);
});

test('a home pin works for unrecognized addresses without guessing a Metro Manila city', () => {
  const result = addSchoolDistances(schools, { address: 'My home address', home_location: { ...point, address: 'My home address' } });
  assert.equal(result.schools[1].distanceKm, 0);
  assert.equal(result.locationBasis.kind, 'home_pin');
});

test('changed addresses and invalid saved pins never silently reuse the previous home', () => {
  assert.equal(privateHomeLocation({ ...user, address: 'Pasig' }), null);
  assert.equal(updateHomeLocation({}, user, 'Pasig'), null);
  assert.equal(addSchoolDistances(schools, { ...user, address: 'Pasig' }).locationBasis.area, 'Pasig');
  for (const latitude of [null, '', false, 91, Infinity, 'bad']) {
    const invalid = { ...user, home_location: { ...user.home_location, latitude } };
    assert.equal(privateHomeLocation(invalid), null);
    assert.equal(addSchoolDistances(schools, invalid).locationBasis.kind, undefined);
  }
  assert.deepEqual(privateHomeLocation({ ...user, address: '  TAGUIG  ' }), point);
});

test('home-pin saves require explicit confirmation and complete valid coordinates; removal is supported', () => {
  assert.deepEqual(updateHomeLocation({ homeLocation: { ...point, confirmed: true } }, user, 'Pasig'), { ...point, address: 'Pasig' });
  assert.equal(updateHomeLocation({ homeLocation: null }, user, 'Taguig'), null);
  assert.deepEqual(updateHomeLocation({}, user, 'Taguig'), user.home_location);
  for (const homeLocation of [{ ...point }, { ...point, confirmed: false }, [], false,
    { latitude: '', longitude: 121, confirmed: true }, { latitude: 14, confirmed: true },
    { latitude: 90.1, longitude: 121, confirmed: true }, { latitude: 14, longitude: 181, confirmed: true }]) {
    assert.throws(() => updateHomeLocation({ homeLocation }, user, 'Taguig'), error => error.status === 400);
  }
  assert.equal(updateHomeLocation({ homeLocation: { latitude: 0, longitude: 0, confirmed: true } }, user, 'Taguig').latitude, 0);
});

test('straight-line calculation handles identical and antipodal points without NaN', () => {
  assert.equal(haversineDistanceKm(point, point), 0);
  assert.ok(Math.abs(haversineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 }) - 20015.0868) < 0.001);
});
