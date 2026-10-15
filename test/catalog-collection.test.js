import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.DB_SSL = 'disable';
process.env.EMAIL_ENABLED = 'false';
process.env.CATALOG_MIN_HOST_DELAY_MS = '1';
process.env.SGAI_API_KEY = 'test-key';
const { rawPool } = await import('../src/db/pool.js');
const { runCatalogUpdate, inspectCatalogSource } = await import('../src/services/catalog-updater.js');
const { inspectAiHybridSource } = await import('../src/services/ai-hybrid-scraper.js');
const { fetchAllowedHtml } = await import('../src/services/robots.js');
const { catalogFailure } = await import('../src/services/catalog-errors.js');

let hostNumber = 0;
function source(overrides = {}) {
  const host = `school${++hostNumber}.edu.test`;
  return { source_id: `source-${hostNumber}`, school_id: 'school-id', school_name: 'Example University',
    source_url: `https://${host}/`, official_website_url: `https://${host}/`, allowed_host: host,
    source_type: 'school_profile', parser_config: {}, ...overrides };
}
function fetchMock(t, page = '<html><head><title>Example University</title><meta name="description" content="Example University offers undergraduate degree programs for students in its local community."></head></html>') {
  t.mock.method(globalThis, 'fetch', async url => {
    const response = String(url).endsWith('/robots.txt') ? new Response('User-agent: *\nAllow: /') : new Response(page, { headers: { 'content-type': 'text/html' } });
    Object.defineProperty(response, 'url', { value: String(url) }); return response;
  });
}
function databaseMock(t, sources, fail = () => false, acquired = true, { settings = {}, aliases = [] } = {}) {
  const calls = []; let released = false;
  const client = { release() { released = true; }, async query(sql, args) {
    calls.push({ sql, args });
    if (fail(sql)) throw new Error('database operation failed');
    if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired }] };
    if (sql.includes('SELECT cs.*')) return { rows: sources };
    if (sql.includes('INSERT INTO catalog_update_runs') && sql.includes('RETURNING')) return { rows: [{ run_id: 'run-id' }] };
    if (sql.includes('SELECT * FROM schools')) return { rows: [{ official_website_url: 'https://old.edu.test/', description: 'Old description' }] };
    if (sql.includes('FROM program_aliases')) return { rows: aliases };
    if (sql.includes('INSERT INTO school_programs')) return { rows: [{ school_program_id: 'offering-id', inserted: false }] };
    return { rows: [] };
  } };
  t.mock.method(rawPool, 'connect', async () => client);
  t.mock.method(rawPool, 'query', async () => ({ command: 'SELECT', rows: [{ preferences: { frequency: 'Weekly', timeout: 5, ...settings } }] }));
  return { calls, isReleased: () => released };
}
test('no due sources skip without writing a false completed run; lock is transaction scoped', async t => {
  const db = databaseMock(t, []);
  const result = await runCatalogUpdate({ triggerType: 'scheduled', dueOnly: true });
  assert.equal(result.skipped, true);
  assert.ok(db.calls.some(c => c.sql === 'ROLLBACK'));
  assert.ok(!db.calls.some(c => c.sql.includes('INSERT INTO catalog_update_runs')));
  assert.ok(!db.calls.some(c => /pg_try_advisory_lock\(|pg_advisory_unlock/.test(c.sql)));
  assert.equal(db.isReleased(), true);
});
test('an existing collector lock skips without inserting a run', async t => {
  const db = databaseMock(t, [], () => false, false);
  assert.equal((await runCatalogUpdate()).skipped, true);
  assert.equal(db.calls.length, 3);
});
test('a failed source rolls back partial writes and a later source can commit', async t => {
  const one = source(), two = source(); fetchMock(t);
  let failedOnce = false;
  const db = databaseMock(t, [one, two], sql => {
    if (sql.includes('INSERT INTO catalog_change_log') && !failedOnce) { failedOnce = true; return true; }
    return false;
  });
  const result = await runCatalogUpdate();
  assert.equal(result.status, 'partial'); assert.equal(result.checked, 2); assert.equal(result.succeeded, 1);
  assert.equal(result.changed, 2);
  assert.ok(db.calls.some(c => c.sql === 'ROLLBACK TO SAVEPOINT catalog_source'));
  const failedUpdate = db.calls.find(c => c.sql.includes("last_status = 'failed'"));
  assert.equal(failedUpdate.args[1], one.source_id);
  const snapshots = db.calls.filter(c => c.sql.includes('INSERT INTO catalog_run_source_results'));
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].args[1], one.source_id);
  assert.equal(snapshots[0].args[5], 'failed');
  assert.match(snapshots[0].args[9], /database operation failed/);
  assert.equal(snapshots[1].args[1], two.source_id);
  assert.equal(snapshots[1].args[5], 'success');
  assert.equal(JSON.parse(snapshots[1].args[8])[0].title, 'Example University');
  assert.equal(db.calls.at(-1).sql, 'COMMIT'); assert.equal(db.isReleased(), true);
});
test('a batch database failure rolls back and records zero saved changes, not a stale running job', async t => {
  fetchMock(t); const db = databaseMock(t, [source()], sql => sql.includes('UPDATE catalog_update_runs SET status'));
  await assert.rejects(runCatalogUpdate(), /database operation failed/);
  assert.equal(db.calls.at(-2).sql, 'ROLLBACK');
  assert.match(db.calls.at(-1).sql, /'failed'/);
  assert.match(db.calls.at(-1).args.at(-1), /all changes.*rolled back/);
  assert.equal(db.calls.at(-1).args[3], 1); assert.equal(db.isReleased(), true);
});
test('a 200 program page without recognized programs is a failure, not a false verified source', async t => {
  fetchMock(t, '<main><h1>Programs</h1><p>Enable JavaScript to continue</p></main>');
  const db = databaseMock(t, [source({ source_type: 'program_catalog' })]);
  const result = await runCatalogUpdate();
  assert.equal(result.status, 'failed'); assert.equal(result.changed, 0); assert.equal(result.succeeded, 0);
  assert.match(result.errors[0], /No recognizable programs/);
  assert.ok(!db.calls.some(c => c.sql.includes("last_status = 'success'")));
});
test('an unchanged empty page cannot reuse a historically false successful content hash', async t => {
  const html = '<main><h1>Programs</h1></main>'; fetchMock(t, html);
  const db = databaseMock(t, [source({ source_type: 'program_catalog', last_content_hash: crypto.createHash('sha256').update(html).digest('hex') })]);
  assert.equal((await runCatalogUpdate()).status, 'failed');
  assert.ok(!db.calls.some(c => c.sql.includes("last_status = 'unchanged'")));
});
test('identity-only school homepages preserve descriptions; challenge pages are not profiles', async t => {
  fetchMock(t, '<title>Example University</title>');
  assert.equal((await inspectCatalogSource(source())).profile.description, null);
  fetchMock(t, '<title>Just a moment</title>');
  await assert.rejects(inspectCatalogSource(source()), /No usable school profile/);
});
test('403 robots blocks stop before requesting the page, without retries or impersonation', async t => {
  const calls = []; t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), options }); return new Response('Forbidden', { status: 403 });
  });
  const s = source(); await assert.rejects(fetchAllowedHtml(s.source_url, s.allowed_host), /robots.txt returned HTTP 403/);
  assert.equal(calls.length, 1); assert.ok(calls[0].url.endsWith('/robots.txt'));
  assert.match(calls[0].options.headers['User-Agent'], /XloreUCatalogUpdater/);
  assert.equal(catalogFailure('robots.txt returned HTTP 403').code, 'access_blocked');
  assert.match(catalogFailure('Source returned HTTP 403.').action, /Increasing the timeout will not fix/);
  assert.equal(catalogFailure('Source returned HTTP 503.').code, 'temporarily_unavailable');
  assert.equal(catalogFailure('ScrapeGraphAI URL extraction timed out after 90 seconds.').code, 'provider_timeout');
});

test('AI and Hybrid use their hosted path after a 403; Standard still stops', async t => {
  const s = source({ source_type: 'program_catalog' });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    return new Response('Forbidden', { status: 403 });
  });
  const hosted = async (url, host, school) => {
    assert.equal(url, s.source_url);
    assert.equal(host, s.allowed_host);
    assert.equal(school, s.school_name);
    return { contentForHash: 'Bachelor of Science in Nursing', finalUrl: url, aiNames: ['Bachelor of Science in Nursing'] };
  };
  await assert.rejects(inspectCatalogSource(s), /robots.txt returned HTTP 403/);
  for (const mode of ['ai', 'hybrid']) {
    const result = await inspectAiHybridSource(s, { mode, inspectStandard: inspectCatalogSource, extractHosted: hosted });
    assert.deepEqual(result.candidates, []);
    assert.deepEqual(result.aiNames, ['Bachelor of Science in Nursing']);
  }
  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => url.endsWith('/robots.txt')));
});
test('a configured AI catalog run uses the dedicated hosted scraper without a direct site request', async t => {
  const s = source({ source_type: 'program_catalog' });
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    urls.push(String(url));
    assert.equal(options.headers['SGAI-APIKEY'], 'test-key');
    assert.match(String(url), /\/extract$/);
    const body = JSON.parse(options.body);
    assert.equal(body.url, s.source_url);
    return Response.json({ json: { university: s.school_name, programs: ['BS Computer Science'] } });
  });
  const db = databaseMock(t, [s], () => false, true, {
    settings: { scrapingMode: 'ai' },
    aliases: [{ normalized_alias: 'bs computer science', program_id: 'program-id', program_name: 'BS Computer Science' }]
  });
  const result = await runCatalogUpdate();
  assert.equal(result.status, 'completed');
  assert.equal(result.discovered, 1);
  assert.equal(result.succeeded, 1);
  assert.deepEqual(urls.map(url => url.split('/').at(-1)), ['extract']);
  assert.equal(db.isReleased(), true);
});
test('robots disallow stops page requests; outside-host and HTTP redirects are rejected before contact', async t => {
  const s = source(); let count = 0;
  t.mock.method(globalThis, 'fetch', async () => { count++; return new Response('User-agent: *\nDisallow: /'); });
  await assert.rejects(fetchAllowedHtml(s.source_url, s.allowed_host), /robots.txt policy/);
  assert.equal(count, 1);
  for (const destination of ['https://other.edu.test/private', 'http://insecure.edu.test/private']) {
    count = 0; const next = source();
    t.mock.method(globalThis, 'fetch', async () => { count++; return new Response(null, { status: 302, headers: { location: destination } }); });
    await assert.rejects(fetchAllowedHtml(next.source_url, next.allowed_host), /outside the allowed host|must use HTTPS/);
    assert.equal(count, 1);
  }
});
test('redirects to disallowed paths are checked against robots before fetching them', async t => {
  const s = source(); const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    if (String(url).endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /private');
    return new Response(null, { status: 302, headers: { location: '/private' } });
  });
  await assert.rejects(fetchAllowedHtml(s.source_url, s.allowed_host), /robots.txt policy/);
  assert.equal(calls.length, 2);
});
test('a redirected subdomain needs its own robots permission before the page is contacted', async t => {
  const s = source(); const nextHost = `www.${s.allowed_host}`; const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    if (String(url) === `https://${nextHost}/robots.txt`) return new Response('User-agent: *\nDisallow: /');
    if (String(url).endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /');
    return new Response(null, { status: 302, headers: { location: `https://${nextHost}/` } });
  });
  await assert.rejects(fetchAllowedHtml(s.source_url, s.allowed_host), /robots.txt policy/);
  assert.deepEqual(calls, [`${s.source_url}robots.txt`, s.source_url, `https://${nextHost}/robots.txt`]);
});
test('same-origin allowed redirects succeed and URL credentials are rejected before contact', async t => {
  const s = source(); const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    if (String(url).endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /');
    if (String(url).endsWith('/programs')) {
      const response = new Response('<main>Catalog</main>', { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(response, 'url', { value: String(url) }); return response;
    }
    return new Response(null, { status: 302, headers: { location: '/programs' } });
  });
  assert.equal((await fetchAllowedHtml(s.source_url, s.allowed_host)).finalUrl, `${s.source_url}programs`);
  const before = calls.length;
  await assert.rejects(fetchAllowedHtml(`https://user:secret@${s.allowed_host}/`, s.allowed_host), /URL credentials/);
  assert.equal(calls.length, before);
});
