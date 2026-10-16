import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validHomePoint, homeLocationPayload, distanceOriginLabel, distanceLocationNote } from '../src/lib/home-location.js';

test('home-point validation never converts blank or invalid coordinates into zero', () => {
  for (const latitude of [undefined, null, '', ' ', 'bad', false, NaN, Infinity, 91]) {
    assert.equal(validHomePoint({ latitude, longitude: 121 }), null);
  }
  assert.deepEqual(validHomePoint({ latitude: '14.61', longitude: '121.06' }), { latitude: 14.61, longitude: 121.06 });
  assert.deepEqual(validHomePoint({ latitude: 0, longitude: 0 }), { latitude: 0, longitude: 0 });
  assert.equal(validHomePoint({ latitude: 14, longitude: 181 }), null);
});

test('home-point saves require confirmation and allow explicit removal', () => {
  assert.equal(homeLocationPayload(null), null);
  const point = { latitude: 14.61, longitude: 121.06 };
  assert.throws(() => homeLocationPayload(point), /Confirm/);
  assert.throws(() => homeLocationPayload({ latitude: '', longitude: '', confirmed: true }), /valid/);
  assert.deepEqual(homeLocationPayload({ ...point, confirmed: true }), { ...point, confirmed: true });
});

test('cards and result notes distinguish home pins from city-center fallback without claiming road distances', () => {
  assert.equal(distanceOriginLabel({ distanceOrigin: 'home_pin' }), 'your saved home pin');
  assert.equal(distanceOriginLabel({ distanceArea: 'Taguig' }), 'Taguig center (city estimate)');
  assert.match(distanceLocationNote({ kind: 'home_pin' }), /saved home pin, not driving or commute distances/);
  assert.doesNotMatch(distanceLocationNote({ kind: 'home_pin' }), /center of/);
  assert.match(distanceLocationNote({ area: 'Taguig' }), /center of Taguig/);
});

test('pin selection is optional, explicitly confirmed, private and does not geocode typed addresses', () => {
  const picker = readFileSync(new URL('../src/components/HomeLocationPicker.jsx', import.meta.url), 'utf8');
  assert.match(picker, /Home location <small>\(optional\)/);
  assert.match(picker, /name="homeLocationConfirmed"/);
  assert.match(picker, /getCurrentPosition/);
  assert.doesNotMatch(picker, /watchPosition|nominatim|fetch\(|apiKey/i);
  assert.match(picker, /onClick=\{locate\}/);
  assert.match(picker, /required=\{Boolean\(value\)\}/);
  assert.match(picker, /your typed address is not sent/);
  assert.match(picker, /www.openstreetmap.org\/copyright/);
  const profile = readFileSync(new URL('../src/pages/ProfilePage.jsx', import.meta.url), 'utf8');
  assert.match(profile, /homeLocation: homeLocationPayload\(form.homeLocation\)/);
  assert.match(profile, /event.target.name === 'address'.*homeLocation: null/);
});
