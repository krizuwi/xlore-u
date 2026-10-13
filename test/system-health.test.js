import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const result = await build({ stdin: { contents: `import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SystemHealthPanel } from './src/admin/Dashboard/SystemHealthPanel.jsx';
export { isSystemHealth, fetchApiHealth } from './src/admin/Dashboard/Api-Healt.jsx';
export function render(health) { return renderToStaticMarkup(<MemoryRouter><SystemHealthPanel health={health} onRefresh={()=>{}} /></MemoryRouter>); }`,
  resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'import.meta.env': '{}' }, write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { isSystemHealth, fetchApiHealth, render } = compiled.exports;
const healthy = { status: 'healthy', responseTime: 400 };
const report = { status: 'degraded', database: 'connected', timestamp: '2026-10-13T11:00:00Z',
  checks: { database: healthy, assessment: { status: 'slow', responseTime: 3400, reason: 'Responded successfully after the performance target.' },
    scraping: { status: 'warning', responseTime: 500, code: 'sources_blocked', reason: '15 of 16 sources succeeded; 2 need review.' } },
  routes: { 'GET /assessments/questions': { status: 'slow', responseTime: 3400 }, 'POST /assessments': { status: 'skipped', reason: 'Not tested.' } } };
test('health API accepts slow and warning states with reasons, while preserving genuine failure support', () => {
  assert.equal(isSystemHealth(report), true);
  assert.equal(isSystemHealth({ ...report, status: 'unavailable', database: 'disconnected', checks: { ...report.checks, database: { status: 'unhealthy', responseTime: 5000 } } }), true);
  assert.equal(isSystemHealth({ ...report, status: 'made-up' }), false);
  assert.equal(isSystemHealth({ ...report, checks: { ...report.checks, assessment: { ...healthy, reason: 123 } } }), false);
  assert.equal(isSystemHealth({ ...report, checks: { ...report.checks, database: { ...healthy, responseTime: -1 } } }), false);
});
test('dashboard distinguishes warnings from outages and includes actionable reasons', () => {
  const html = render({ data: report, loading: false, error: '' });
  assert.match(html, /Services operational with warnings/);
  assert.match(html, /Slow response/); assert.match(html, /Needs review/); assert.match(html, /15 of 16/);
  assert.match(html, /Review catalog sources/); assert.match(html, /href="\/admin\/scraping"/);
  assert.doesNotMatch(html, /All checked services operational|is-unhealthy/);
  const failed = render({ data: { ...report, status: 'unavailable', checks: { ...report.checks, assessment: { status: 'unhealthy', responseTime: 10000, reason: 'Service returned HTTP 500.' } } }, loading: false, error: '' });
  assert.match(failed, /Some services are unavailable/); assert.match(failed, /is-unhealthy/); assert.match(failed, /HTTP 500/);
});
test('failed health retrieval does not label services healthy and diagnostic text is escaped', () => {
  assert.match(render({ data: null, loading: false, error: 'Connection failed' }), /Health check unavailable/);
  const html = render({ data: { ...report, checks: { ...report.checks, scraping: { ...report.checks.scraping, reason: '<script>unsafe</script>' } } }, loading: false, error: '' });
  assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
});
test('200 degraded and 503 unavailable reports are accepted without suppressing their health states', async t => {
  for (const [status, body] of [[200, report], [503, { ...report, status: 'unavailable' }]]) {
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(body), { status }));
    assert.deepEqual(await fetchApiHealth(), body);
  }
});
