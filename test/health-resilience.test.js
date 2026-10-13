import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable';
process.env.NODE_ENV = 'test';
process.env.EMAIL_ENABLED = 'false';
const { assessScraping, checkAllRoutes, measureHealth, getSystemHealth, clearHealthCache, HEALTH_ROUTE_TIMEOUT_MS } = await import('../src/utils/api-health-check.js');
const recent = { lastRun: { status: 'completed', sourcesChecked: 16, sourcesSucceeded: 16, finishedAt: new Date().toISOString() }, sources: { enabled: 17, enabledFailed: 0, blocked: 0 } };
test('successful slow checks remain usable and failures include safe diagnostic reasons', async t => {
  let ticks = 0;
  t.mock.method(performance, 'now', () => ticks++ === 0 ? 0 : 3500);
  assert.equal((await measureHealth(async () => {})).status, 'slow');
  const failed = await measureHealth(async () => { throw new Error('password-secret postgres://private'); });
  assert.equal(failed.status, 'unhealthy'); assert.equal(failed.code, 'connection_failed');
  assert.doesNotMatch(JSON.stringify(failed), /password-secret|postgres:/);
  assert.equal((await measureHealth(async () => { throw new DOMException('timed out', 'TimeoutError'); })).code, 'timeout');
});
test('catalog partial and blocked sources are warnings, not false successes or assessment outages', () => {
  const partial = assessScraping({ ...recent, lastRun: { ...recent.lastRun, status: 'partial', sourcesSucceeded: 15 }, sources: { enabled: 17, enabledFailed: 2, blocked: 2 } });
  assert.equal(partial.status, 'warning'); assert.equal(partial.code, 'sources_blocked'); assert.match(partial.reason, /15 of 16/);
  assert.match(partial.reason, /2 are access-blocked/);
  assert.equal(assessScraping(recent).status, 'healthy');
  assert.equal(assessScraping({ ...recent, lastRun: { ...recent.lastRun, status: 'failed', sourcesSucceeded: 0 } }).status, 'unhealthy');
  assert.equal(assessScraping({ ...recent, lastRun: null }).code, 'not_checked');
  assert.equal(assessScraping({ ...recent, sources: { enabled: 0 } }).code, 'no_enabled_sources');
  assert.equal(assessScraping(recent, Date.now() + 20 * 86400000).code, 'stale_catalog');
});
test('route probes are bounded to two concurrent requests and use the longer timeout', async t => {
  let active = 0, max = 0; const timeouts = [];
  const timeout = AbortSignal.timeout;
  t.mock.method(AbortSignal, 'timeout', ms => { timeouts.push(ms); return timeout(ms); });
  t.mock.method(globalThis, 'fetch', async url => {
    active++; max = Math.max(max, active);
    await new Promise(resolve => setImmediate(resolve)); active--;
    return new Response(JSON.stringify(String(url).endsWith('/assessments/questions') ? { availability: { available: true }, data: [{ id: 'q' }] } : { data: [] }));
  });
  const routes = await checkAllRoutes('http://127.0.0.1:3210/api');
  assert.equal(routes['GET /assessments/questions'].status, 'healthy');
  assert.equal(max, 2); assert.ok(timeouts.every(ms => ms === HEALTH_ROUTE_TIMEOUT_MS));
});
test('simultaneous health calls and subsequent polls share one probe round without sharing mutable reports', async t => {
  clearHealthCache(); let queries = 0, fetches = 0;
  t.mock.method(pg.Client.prototype, 'connect', async () => {});
  t.mock.method(pg.Client.prototype, 'query', async () => { queries++; return { rows: [{}] }; });
  t.mock.method(pg.Client.prototype, 'end', async () => {});
  t.mock.method(globalThis, 'fetch', async url => {
    fetches++; await new Promise(resolve => setImmediate(resolve));
    return new Response(JSON.stringify(String(url).endsWith('/catalog/status') ? recent : String(url).endsWith('/assessments/questions') ? { availability: { available: true }, data: [{ id: 'q' }] } : { data: [{ id: 'record' }] }));
  });
  const [a, b] = await Promise.all([getSystemHealth('http://127.0.0.1:3211/api'), getSystemHealth('http://127.0.0.1:3211/api')]);
  a.checks.assessment.status = 'unhealthy';
  const c = await getSystemHealth('http://127.0.0.1:3211/api');
  assert.equal(b.status, 'ok'); assert.equal(c.checks.assessment.status, 'healthy');
  assert.equal(queries, 1); assert.equal(fetches, 7);
  clearHealthCache();
});
