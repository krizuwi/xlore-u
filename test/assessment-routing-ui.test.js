import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const result = await build({ stdin: { contents: `import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { MemoryRouter } from 'react-router-dom';
  import { AssessmentRoutingStep } from './src/components/AssessmentRoutingStep.jsx';
  import { SchoolCard } from './src/components/SchoolCard.jsx';
  export function renderSchool(school) { return renderToStaticMarkup(<MemoryRouter><SchoolCard school={school} showMinimumTuition /></MemoryRouter>); }
  export function render(plan, selection, busy = false, error = '') { return renderToStaticMarkup(<AssessmentRoutingStep
    plan={plan} selection={selection} busy={busy} error={error}
    onSelection={()=>{}} onBack={()=>{}} onComplete={()=>{}}/>); }`,
resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true, packages: 'external',
platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'import.meta.env': '{}' }, write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { render, renderSchool } = compiled.exports;
const plan = { primaryProfile: 'A', leadingProfiles: ['A'], followUpCount: 1, profiles: { A: 'Analytical', B: 'Creative' },
  branches: { A: [{ id: 'computing', label: 'Writing software' }, { id: 'engineering', label: 'Building structures' }] },
  constraints: { 18: { label: 'less than 30 minutes' } } };

test('one targeted follow-up shows the actual branches without duplicating result filters', () => {
  const html = render(plan, { profile: 'A', field: '' });
  assert.match(html, /Follow-up 1 of 1/); assert.match(html, /Writing software/); assert.match(html, /Building structures/);
  assert.match(html, /add no assessment points/);
  assert.doesNotMatch(html, /Set your school limits|routing-budget|routing-distance|<input/);
  assert.match(html, /disabled="">.*See my programs and schools/s);
});
test('ties show only the tied macro choices, no field or constraints until the signpost is resolved', () => {
  const html = render({ ...plan, primaryProfile: null, leadingProfiles: ['A', 'B'], followUpCount: 2 }, { profile: '', field: '' });
  assert.match(html, /Follow-up 1 of 2/); assert.match(html, /Analytical/); assert.match(html, /Creative/);
  assert.doesNotMatch(html, /Writing software|routing-budget|routing-distance/);
});
test('selected field enables final completion; submitting disables edits and errors remain beside the form', () => {
  const html = render(plan, { profile: 'A', field: 'computing' });
  assert.match(html, /aria-pressed="true"/); assert.match(html, /<button class="primary-btn">/);
  const busy = render(plan, { profile: 'A', field: 'computing' }, true, 'Please retry');
  assert.match(busy, /Creating your roadmap/); assert.match(busy, /Please retry/); assert.match(busy, /type="button" disabled=""/);
});
test('all stages remain guarded and final payload includes routing without pre-result limits', () => {
  const source = readFileSync(new URL('../src/pages/AssessmentPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /JSON\.stringify\(\{ answers, routingSelection \}\)/);
  assert.match(source, /workflowVersion: workflow\.version, routingSelection/);
  assert.doesNotMatch(source, /schoolLimits|setSchoolLimits/);
  assert.match(source, /api\('\/assessments\/routing'/);
  assert.match(source, /Section 3 · Your roadmap/);
  assert.match(source, /status === 'routed'/);
});
test('results retain tuition, distance, school type and sorting filters', () => {
  const source = readFileSync(new URL('../src/pages/AssessmentPage.jsx', import.meta.url), 'utf8');
  for (const id of ['result-max-tuition', 'result-max-distance', 'result-school-type', 'result-sort']) {
    assert.ok(source.includes(`id="${id}"`));
  }
  assert.match(source, /filterAssessmentSchools\(schools, filters\)/);
});
test('routed results retain the method explanation without the removed disclaimer sentence', () => {
  const source = readFileSync(new URL('../src/pages/AssessmentPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /This roadmap uses equal-vote preferences and an unscored field choice\./);
  assert.doesNotMatch(source, /It is not a psychometric diagnosis, aptitude score or guarantee of admission or success\./);
});

test('both program expansion states use a spaced toggle outside the card grid', () => {
  const source = readFileSync(new URL('../src/pages/AssessmentPage.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(source, /<button className="secondary-btn results-program-toggle"/);
  assert.match(source, /showAllPrograms \? 'Show fewer programs' : `View all \$\{programs.length\} related programs`/);
  assert.match(css, /\.results-program-toggle\s*\{\s*margin-top:\s*24px;/);
});
test('routed school cards show relevant program fees, not unrelated school-wide estimates or fake match percentages', () => {
  const school = { id: 'school', name: 'Example', city: 'Manila', schoolType: 'Private', tuitionRange: 'UNRELATED FEE RANGE',
    matchLabel: 'Offers your selected field', matchScore: 0, minimumTuition: 20000, matchedPrograms: ['BS IT'] };
  const html = renderSchool(school);
  assert.match(html, /20,000/); assert.match(html, /Offers your selected field/);
  assert.doesNotMatch(html, /UNRELATED FEE RANGE|0% match/);
  assert.match(renderSchool({ ...school, minimumTuition: null }), /Matched program fees not confirmed/);
});
