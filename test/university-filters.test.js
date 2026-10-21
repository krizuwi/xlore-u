import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterManagedUniversities } from '../src/admin/lib/university-filters.js';

const schools = [
  { id: 'one', name: 'STI College Taguig', city: 'Taguig', type: 'Private', status: 'Active', programNames: ['BS Information Technology'] },
  { id: 'two', name: 'STI College Makati', city: 'Makati', type: 'Private', status: 'Inactive', programNames: ['BS Information Technology'] },
  { id: 'three', name: 'Taguig City University', city: 'Taguig', type: 'Public', status: 'Active' },
  { id: 'four', name: 'Polytechnic University of the Philippines', city: 'Manila', type: 'Public', status: 'Inactive' }
];
const ids = result => result.map(item => item.id);

test('university status defaults to all and distinguishes Active from Inactive exactly', () => {
  const original = structuredClone(schools);
  assert.deepEqual(ids(filterManagedUniversities(schools)), ['one', 'two', 'three', 'four']);
  assert.deepEqual(ids(filterManagedUniversities(schools, { status: 'Active' })), ['one', 'three']);
  assert.deepEqual(ids(filterManagedUniversities(schools, { status: 'Inactive' })), ['two', 'four']);
  assert.deepEqual(schools, original);
});

test('status combines with university type, local/global keyword searches and existing program matching', () => {
  assert.deepEqual(ids(filterManagedUniversities(schools, { status: 'Inactive', type: 'Private', query: 'STI', searchQuery: 'Makati' })), ['two']);
  assert.deepEqual(ids(filterManagedUniversities(schools, { status: 'Active', type: 'Private', query: 'BSIT Taguig' })), ['one']);
  assert.deepEqual(filterManagedUniversities(schools, { status: 'Inactive', type: 'Private', query: 'Taguig' }), []);
  assert.deepEqual(ids(filterManagedUniversities(schools, { status: '', type: 'Private' })), ['one', 'two']);
});

test('status applies across the full catalog before pagination and resets the page on change', () => {
  const catalog = Array.from({ length: 20 }, (_, index) => ({ ...schools[index % 4], id: index }));
  const filtered = filterManagedUniversities(catalog, { status: 'Inactive' });
  assert.equal(filtered.length, 10);
  assert.deepEqual(ids(filtered.slice(6, 12)), [13, 15, 17, 19]);
  assert.ok(filtered.every(item => item.status === 'Inactive'));
  const source = readFileSync(new URL('../src/admin/Management/UniversitiesManagement/UniversitiesManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /aria-label="Filter university status"/);
  assert.match(source, /setStatus\(e.target.value\); setPage\(1\)/);
  assert.match(source, /<option value="">All statuses<\/option><option value="Active">Active<\/option><option value="Inactive">Inactive<\/option>/);
  assert.match(source, /filterManagedUniversities\(universities, \{ query, searchQuery, type, status \}\)/);
  assert.match(source, /PageFooter count=\{filtered.length\}/);
});
