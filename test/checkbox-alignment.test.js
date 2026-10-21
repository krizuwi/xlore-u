import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'espree';

const root = fileURLToPath(new URL('../src', import.meta.url));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : entry.name.endsWith('.jsx') ? [join(directory, entry.name)] : []);
}
const attribute = (node, name) => node.openingElement.attributes.find(item => item.type === 'JSXAttribute' && item.name.name === name)?.value?.value;

test('every native checkbox has a shared row and one wrapping text span beside it', () => {
  let count = 0;
  function visit(node, elements, filename) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXElement') {
      if (node.openingElement.name.name === 'input' && attribute(node, 'type') === 'checkbox') {
        count++;
        const parent = elements.at(-1), location = filename + ':' + node.loc.start.line;
        assert.equal(parent?.openingElement.name.name, 'label', location);
        assert.ok(attribute(parent, 'className')?.split(' ').includes('checkbox-row'), location);
        const children = parent.children.filter(child => child.type === 'JSXElement');
        assert.equal(children.length, 2, location);
        assert.equal(children[0], node, location);
        assert.equal(children[1].openingElement.name.name, 'span', location);
        assert.ok(!parent.children.some(child => child.type === 'JSXText' && child.value.trim()), 'No orphaned checkbox text: ' + location);
      }
      elements = [...elements, node];
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const child of value) visit(child, elements, filename);
      else if (value && typeof value === 'object') visit(value, elements, filename);
    }
  }
  for (const filename of files(root)) visit(parse(readFileSync(filename, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, loc: true }), [], filename);
  assert.ok(count >= 15, 'Institution, student, assessment, program and admin controls are audited.');
});

test('shared checkbox layout fixes size and first-line alignment without replacing native controls', () => {
  const css = readFileSync(join(root, 'index.css'), 'utf8');
  const row = css.match(/label\.checkbox-row:has\(> input\[type="checkbox"\]\)\s*\{([^}]+)\}/)?.[1];
  const box = css.match(/label\.checkbox-row > input\[type="checkbox"\]\s*\{([^}]+)\}/)?.[1];
  assert.match(row, /grid-template-columns: 18px minmax\(0, 1fr\)/);
  assert.match(row, /align-items: start/);
  for (const property of ['width', 'min-width', 'max-width', 'height', 'min-height', 'max-height']) assert.ok(box.includes(property + ': 18px;'), property);
  assert.match(box, /justify-self: start/); assert.match(box, /accent-color: var\(--blue\)/);
  assert.doesNotMatch(box, /appearance:\s*none|opacity:\s*0|position:\s*absolute/);
});
