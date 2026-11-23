import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const built = await build({ stdin: { contents: `import {renderToStaticMarkup} from 'react-dom/server';
  import {ProgramClustersField, SchoolOfferingsFields} from './src/admin/Management/ProgramsManagement/ProgramCatalogFields.jsx';
  export function clusters(options, selected) { return renderToStaticMarkup(<ProgramClustersField clusters={options} selected={selected} onChange={()=>{}}/>); }
  export function schools(items, offerings) { return renderToStaticMarkup(<form><SchoolOfferingsFields schools={items} offerings={offerings} onChange={()=>{}}/></form>); }`,
  resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true,
  packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const {clusters, schools} = compiled.exports;

test('cluster choices display actual assessment clusters and select their matching IDs', () => {
  const options = [{id:'technology-computing', name:'Technology & Computing', description:'Software and computing programs'},
    {id:'health-sciences', name:'Health Sciences & Allied Medicine', description:'Healthcare programs'}];
  const html = clusters(options, ['technology-computing']);
  assert.match(html, /<legend>Assessment clusters<\/legend>/);
  assert.match(html, /<summary>1 selected · Technology &amp; Computing<\/summary>/);
  assert.match(html, /<input(?=[^>]*name="clusterIds")(?=[^>]*value="technology-computing")(?=[^>]*checked)[^>]*>/);
  assert.match(html, /Healthcare programs/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, options.length);
  assert.doesNotMatch(html, /<details[^>]*\bopen/);
});

test('school search is a view-only control, while every offering remains mounted with its fee', () => {
  const html = schools([{id:'sti', name:'STI College Global City', status:'Active'}, {id:'ateneo', name:'Ateneo', status:'Inactive'}], {sti: '25000'});
  assert.match(html, /type="search" form=""/);
  assert.match(html, /Showing 2 of 2 schools · 1 selected/);
  assert.match(html, /aria-label="Offer at STI College Global City" checked/);
  assert.match(html, /aria-label="Tuition per semester for STI College Global City"[^>]*value="25000"/);
  assert.match(html, /Ateneo \(inactive\)/);
  assert.match(html, /aria-label="Tuition per semester for Ateneo"[^>]*disabled/);
});

test('an empty school catalog displays a useful empty state', () => {
  assert.match(schools([], {}), /No schools match your search/);
});
