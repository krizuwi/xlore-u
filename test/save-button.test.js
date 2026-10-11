import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const built = await build({ stdin: { contents: `import {renderToStaticMarkup} from 'react-dom/server';
  import {SaveButton} from './src/components/SaveButton.jsx';
  export function render(saved, disabled) {return renderToStaticMarkup(<SaveButton saved={saved} disabled={disabled} label="Save test item" onClick={()=>{}}/>);}`,
  resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true, packages: 'external',
  platform: 'node', format: 'cjs', jsx: 'automatic', write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);

test('save buttons use the same 18px heart with an outlined unsaved and filled saved state', () => {
  const unsaved = compiled.exports.render(false, false), saved = compiled.exports.render(true, false);
  assert.match(unsaved, /class="save-btn"/);
  assert.match(saved, /class="save-btn saved"/);
  assert.match(unsaved, /fill="none"/);
  assert.match(saved, /fill="currentColor"/);
  for (const html of [unsaved, saved]) {
    assert.match(html, /width="18" height="18"/);
    assert.match(html, /type="button"/);
    assert.match(html, /aria-label="Save test item"/);
    assert.match(html, /title="Save test item"/);
    assert.doesNotMatch(html, /<span>/);
  }
  assert.match(unsaved, /aria-pressed="false"/);
  assert.match(saved, /aria-pressed="true"/);
  assert.match(compiled.exports.render(true, true), /disabled=""/);
});

test('school, program and saved-program cards use one shared save control without width overrides', () => {
  for (const path of ['components/SchoolCard.jsx', 'pages/ProgramsPage.jsx', 'pages/SavedPage.jsx']) {
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
    assert.match(source, /<SaveButton saved/);
    assert.doesNotMatch(source, /program-save-btn/);
  }
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.program-save-btn/);
});
