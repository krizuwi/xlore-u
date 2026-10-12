import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const built = await build({ stdin: { contents: `import {renderToStaticMarkup} from 'react-dom/server';
  import {AnswerMappingField, AssessmentMappingFields, mappingSummary} from './src/admin/Pages/AssessmentMappingFields.jsx';
  export function renderAnswer(option, routing) { return renderToStaticMarkup(<AnswerMappingField option={option} index={0} routing={routing} onChange={()=>{}}/>); }
  export function renderRole(routing) { return renderToStaticMarkup(<AssessmentMappingFields routing={routing} onChange={()=>{}}/>); }
  export {mappingSummary};`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
  bundle: true, packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { renderAnswer, renderRole, mappingSummary } = compiled.exports;

test('core editor offers the actual four equal-vote macros, not technology weights', () => {
  const html = renderAnswer({ macro: 'B', scores: { technology: 3 } }, { role: 'macro-vote' });
  for (const name of ['Analytical', 'Creative', 'People-Oriented', 'Practical']) assert.ok(html.includes(name));
  assert.match(html, /value="B" selected=""/); assert.match(html, /1 vote/);
  assert.doesNotMatch(html, /technology|Interest weights|type="number"/);
});

test('practical preferences are unscored with explicit cost and distance priorities only', () => {
  const tuition = renderAnswer({ prioritize: true }, { role: 'constraint', constraintKey: 'tuition' });
  assert.match(tuition, /Unscored practical answer/); assert.match(tuition, /lower known tuition/); assert.match(tuition, /checked=""/);
  const travel = renderAnswer({}, { role: 'constraint', constraintKey: 'travel' });
  assert.doesNotMatch(travel, /checkbox|macro-profile|1 vote/);
  assert.match(renderRole({ role: 'constraint', constraintKey: 'travel' }), /value="travel" selected=""/);
  assert.match(mappingSummary({ routing: { role: 'macro-vote' } }), /1 vote/);
  assert.match(mappingSummary({ routing: { role: 'constraint', constraintKey: 'distance' } }), /Distance importance.*unscored/);
});

test('admin editor saves live routing and full preview calls the backend algorithm without saving an attempt', () => {
  const source = readFileSync(new URL('../src/admin/Pages/AssessmentManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /routing, options: mappedOptions/);
  assert.match(source, /adminWrite\('\/questions\/preview-routing'/);
  assert.match(source, /questionBankVersion: version/); assert.match(source, /routingSelection: selection/);
  assert.doesNotMatch(source, /Interest weights|option\.scores|technology|0–5/);
  assert.match(source, /Existing|existing|saved results/);
});
