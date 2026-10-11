import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: `import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { SchoolLogo } from './src/components/SchoolLogo.jsx';
  export function render(school) { return renderToStaticMarkup(<SchoolLogo school={school} className="comparison-school-logo" />); }`,
  resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true, packages: 'external',
  platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'import.meta.env': '{}' }, write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);

test('comparison uses the admin-managed school logo with accessible school-specific text', () => {
  const html = compiled.exports.render({ id: 'sti', name: 'STI College Global City', logoUrl: 'https://example.test/sti.png' });
  assert.match(html, /school-logo comparison-school-logo/);
  assert.match(html, /src="https:\/\/example\.test\/sti\.png"/);
  assert.match(html, /alt="STI College Global City logo"/);
  assert.match(html, /loading="lazy"/);
  const page = readFileSync(new URL('../src/pages/ComparisonPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /<SchoolLogo school=\{school\} className="comparison-school-logo" \/>/);
  assert.doesNotMatch(page, /<div className="comparison-logo"><Scale/);
});

test('schools without a logo retain the shared readable initials fallback', () => {
  const html = compiled.exports.render({ id: 'school', name: 'University of the Philippines' });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /aria-label="University of the Philippines">UP<\/span>/);
});
