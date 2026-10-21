import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { build } from 'esbuild';
import { ADSENSE_CLIENT, ADSENSE_SLOT, ADSENSE_SCRIPT_URL, canServeHomepageAd, loadAdSense, requestAd } from '../src/lib/adsense.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const allowed = { enabled: 'true', production: true, hostname: 'www.xloreu.com', pathname: '/', user: null };

test('owner publisher is consistent in metadata, ads.txt and responsive unit', () => {
  assert.equal(ADSENSE_CLIENT, 'ca-pub-8222864305978009');
  assert.equal(ADSENSE_SLOT, '3234621623');
  const html = read('../index.html');
  assert.ok(html.includes(`<meta name="google-adsense-account" content="${ADSENSE_CLIENT}"`));
  assert.match(html, /name="google-site-verification"/);
  assert.equal(html.split(`src="${ADSENSE_SCRIPT_URL}"`).length - 1, 1);
  assert.match(html, /<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-8222864305978009"\s+crossorigin="anonymous"><\/script>/);
  assert.ok(html.indexOf(ADSENSE_SCRIPT_URL) < html.indexOf('</head>'));
  assert.equal(read('../public/ads.txt').trim(), 'google.com, pub-8222864305978009, DIRECT, f08c47fec0942fa0');
});

test('existing async verification script is reused without injecting a second loader', async () => {
  let queried = '';
  let created = false;
  await loadAdSense({
    querySelector(selector) { queried = selector; return { async: true }; },
    createElement() { created = true; throw new Error('Duplicate loader'); }
  });
  assert.equal(queried, `script[src="${ADSENSE_SCRIPT_URL}"]`);
  assert.equal(created, false);
});

test('ad serving requires explicit switch, production canonical host, public homepage and no account', () => {
  assert.equal(canServeHomepageAd(allowed), true);
  assert.equal(canServeHomepageAd({ ...allowed, hostname: 'xloreu.com' }), true);
  for (const enabled of [undefined, '', 'false', 'TRUE', true]) assert.equal(canServeHomepageAd({ ...allowed, enabled }), false);
  for (const hostname of ['localhost', '127.0.0.1', 'xlore-u-beta.vercel.app', 'preview.vercel.app', 'www.xloreu.com.evil.test']) assert.equal(canServeHomepageAd({ ...allowed, hostname }), false);
  for (const pathname of ['/login', '/register', '/privacy', '/assessment', '/assessment/123/results', '/dashboard', '/profile', '/schools/123', '/institution', '/admin']) assert.equal(canServeHomepageAd({ ...allowed, pathname }), false);
  for (const role of ['student', 'admin', 'institution']) assert.equal(canServeHomepageAd({ ...allowed, user: { role } }), false);
  assert.equal(canServeHomepageAd({ ...allowed, production: false }), false);
});

test('script is deduplicated across mounts and a failed load can recover on a later mount', async () => {
  const scripts = [];
  const fakeDocument = {
    createElement: type => ({ type, remove() { this.removed = true; } }),
    head: { appendChild(script) { scripts.push(script); } }
  };
  const failed = loadAdSense(fakeDocument);
  assert.equal(loadAdSense(fakeDocument), failed);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, ADSENSE_SCRIPT_URL);
  assert.equal(scripts[0].async, true);
  assert.equal(scripts[0].crossOrigin, 'anonymous');
  const rejection = assert.rejects(failed, /AdSense unavailable/);
  scripts[0].onerror();
  await rejection;
  assert.equal(scripts[0].removed, true);
  const success = loadAdSense(fakeDocument);
  assert.notEqual(success, failed);
  scripts[1].onload();
  await success;
  assert.equal(loadAdSense(fakeDocument), success);
  assert.equal(scripts.length, 2);
});

test('each connected, nonzero-width unit gets only one request, including StrictMode reruns', () => {
  const browser = {};
  const element = { isConnected: true, dataset: {}, getBoundingClientRect: () => ({ width: 320 }) };
  assert.equal(requestAd(null, browser), false);
  assert.equal(requestAd({ ...element, isConnected: false }, browser), false);
  assert.equal(requestAd({ ...element, getBoundingClientRect: () => ({ width: 0 }) }, browser), false);
  assert.equal(requestAd({ ...element, dataset: { adsbygoogleStatus: 'done' } }, browser), false);
  assert.equal(browser.adsbygoogle, undefined);
  assert.equal(requestAd(element, browser), true);
  assert.equal(requestAd(element, browser), false);
  assert.equal(browser.adsbygoogle.length, 1);
  assert.deepEqual(browser.adsbygoogle[0], {});
});

async function renderUnit(enabled, user = null, pathname = '/') {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/components/HomepageAd.jsx', import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external',
    loader: { '.css': 'empty' },
    define: {
      'import.meta.env.VITE_ADSENSE_ENABLED': enabled === undefined ? 'undefined' : JSON.stringify(enabled),
      'import.meta.env.PROD': 'true',
      'window.location.hostname': '"www.xloreu.com"'
    },
    plugins: [{ name: 'fake-auth', setup(builder) {
      builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ contents: `export const useAuth = () => ({ user: ${JSON.stringify(user)} });`, loader: 'js' }));
    } }]
  });
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
  const previousWindow = globalThis.window;
  try {
    globalThis.window = { location: { hostname: 'www.xloreu.com' } };
    return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [pathname] }, createElement(compiled.exports.HomepageAd)));
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test('disabled or protected placements render nothing; enabled unit is labeled and responsive', async () => {
  assert.equal(await renderUnit(undefined), '');
  assert.equal(await renderUnit('false'), '');
  assert.equal(await renderUnit('true', { role: 'student' }), '');
  assert.equal(await renderUnit('true', null, '/login'), '');
  const markup = await renderUnit('true');
  assert.match(markup, /aria-label="Advertisement"/);
  assert.ok(markup.includes(`data-ad-client="${ADSENSE_CLIENT}"`) && markup.includes(`data-ad-slot="${ADSENSE_SLOT}"`));
  assert.match(markup, /data-ad-format="auto" data-full-width-responsive="true"/);
  const source = read('../src/components/HomepageAd.jsx');
  assert.match(source, /aria-label="Advertisement"/);
  assert.match(source, /data-ad-format="auto" data-full-width-responsive="true"/);
  assert.match(source, /cancelled = true; observer\?\.disconnect\(\)/);
  const home = read('../src/pages/HomePage.jsx');
  assert.equal((home.match(/<HomepageAd\s*\/>/g) ?? []).length, 1);
  assert.ok(home.indexOf('<HomepageAd />') > home.indexOf('className="school-grid"'));
});
