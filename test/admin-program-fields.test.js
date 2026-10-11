import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const built = await build({ stdin: { contents: `import {renderToStaticMarkup} from 'react-dom/server';
  import {getInterestTagOptions, InterestTagsField, SchoolOfferingsFields} from './src/admin/Management/ProgramsManagement/ProgramCatalogFields.jsx';
  export {getInterestTagOptions};
  export function tags(options, selected) { return renderToStaticMarkup(<InterestTagsField options={options} selected={selected} onChange={()=>{}}/>); }
  export function schools(items, offerings) { return renderToStaticMarkup(<form><SchoolOfferingsFields schools={items} offerings={offerings} onChange={()=>{}}/></form>); }`,
  resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' }, bundle: true,
  packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const {getInterestTagOptions, tags, schools} = compiled.exports;

test('checkbox choices include standard tags and every existing catalog or edited-program tag', () => {
  const options = getInterestTagOptions([{interestTags: [' Maritime ', 'technology', 'maritime']}], ['aviation']);
  for (const tag of ['technology', 'analytical', 'science', 'health', 'business', 'creative', 'communication', 'social', 'maritime', 'aviation']) assert.ok(options.includes(tag));
  assert.equal(options.filter(tag => tag === 'maritime').length, 1);
  assert.equal(getInterestTagOptions().length, 8);
  const html = tags(options, ['maritime', 'technology']);
  assert.match(html, /<summary>2 selected/);
  assert.match(html, /<input(?=[^>]*name="interestTags")(?=[^>]*value="maritime")(?=[^>]*checked)[^>]*>/);
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
