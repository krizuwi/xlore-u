import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const result = await build({ stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
import {SourceCollectionStatus} from './src/admin/Management/ScrapingManagement/SourceCollectionStatus.jsx';
export function render(source) { return renderToStaticMarkup(<SourceCollectionStatus source={source}/>); }`,
  resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
test('blocked sources explain permission/manual maintenance and are never shown as successful', () => {
  const html = compiled.exports.render({ status: 'failed', error: 'robots.txt returned HTTP 403', diagnostic: { code: 'access_blocked', action: 'Request permission or maintain the school manually.' } });
  assert.match(html, /Blocked by website/); assert.match(html, /HTTP 403/);
  assert.match(html, /Request permission/); assert.match(html, /has not succeeded/);
  assert.doesNotMatch(html, /<strong>success/);
});
test('source status safely renders errors and retains success/unchecked compatibility', () => {
  assert.match(compiled.exports.render({ status: 'success' }), /<strong>success/);
  assert.match(compiled.exports.render({}), /Not checked/);
  assert.doesNotMatch(compiled.exports.render({ error: '<script>oops</script>' }), /<script>/);
});
