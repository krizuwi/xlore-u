import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the removed Google Maps route button is absent from every former location', () => {
  for (const path of ['components/SchoolCard.jsx', 'pages/ComparisonPage.jsx', 'pages/AssessmentPage.jsx', 'pages/SchoolDetailPage.jsx', 'pages/MapPage.jsx']) {
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /SchoolRouteLink|Check route in Google Maps/);
  }
});

test('original school map links and honest distance labels remain available', () => {
  const detail = readFileSync(new URL('../src/pages/SchoolDetailPage.jsx', import.meta.url), 'utf8');
  const map = readFileSync(new URL('../src/pages/MapPage.jsx', import.meta.url), 'utf8');
  const compare = readFileSync(new URL('../src/pages/ComparisonPage.jsx', import.meta.url), 'utf8');
  assert.match(detail, /<SchoolHero[^>]*mapUrl=\{mapUrl\}/);
  assert.match(map, /href=\{mapUrls.external\}/);
  assert.match(compare, /Straight-line estimate/);
  assert.match(compare, /not driving or commute distances/);
});
