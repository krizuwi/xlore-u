import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: `import { renderToStaticMarkup } from 'react-dom/server';
  import { SchoolOfferingsPreview } from './src/admin/Management/ProgramsManagement/SchoolOfferingsPreview.jsx';
  export function render(schools) { return renderToStaticMarkup(<SchoolOfferingsPreview schools={schools} />); }`,
  resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true,
  packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const schools = Array.from({ length: 30 }, (_, index) => ({ id: String(index), name: `School ${index + 1}` }));

test('program management previews two schools and keeps every other school in a closed disclosure', () => {
  const html = compiled.exports.render(schools);
  assert.match(html, /<ul><li>School 1<\/li><li>School 2<\/li><\/ul><details/);
  assert.match(html, /See more \(28\)/);
  assert.match(html, /<summary>.*See less.*<\/summary>/);
  assert.doesNotMatch(html, /<details[^>]*\bopen/);
  assert.equal((html.match(/<li>/g) ?? []).length, 30);
  assert.match(html, /School 30/);
  const source = readFileSync(new URL('../src/admin/Management/ProgramsManagement/ProgramsManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /<SchoolOfferingsPreview schools=\{p.schools\} \/>/);
});

test('category management uses the same compact school list without changing category editing or search', () => {
  const source = readFileSync(new URL('../src/admin/Management/CategoriesManagement/CategoriesManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /<SchoolOfferingsPreview schools=\{p.schools\} \/>/);
  assert.doesNotMatch(source, /p\.schools\.map\(s => s\.name\)\.join/);
  assert.match(source, /catalogKeywordMatches\(p, value\)/);
  assert.match(source, /adminWrite\(`\/programs\/\$\{selected.id\}\/category`, "PATCH", \{ category: value \}\)/);
});

test('short and empty school lists do not display an unnecessary see-more control', () => {
  assert.match(compiled.exports.render([]), /Not assigned/);
  for (const count of [0, 1, 2]) assert.doesNotMatch(compiled.exports.render(schools.slice(0, count)), /<details|<summary/);
});

test('school names are safely rendered without changing the supplied assignments', () => {
  const items = [{ id: 'special', name: '<School & Campus>' }];
  const before = JSON.stringify(items);
  assert.match(compiled.exports.render(items), /&lt;School &amp; Campus&gt;/);
  assert.equal(JSON.stringify(items), before);
});
