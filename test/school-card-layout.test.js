import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('school cards stack content vertically and anchor their actions at the bottom', () => {
  const card = css.match(/\.school-card\s*\{([^}]+)\}/)?.[1];
  assert.ok(card);
  assert.match(card, /display:\s*flex\s*;/);
  assert.match(card, /flex-direction:\s*column\s*;/);

  const actions = css.match(/\.school-card\s*>\s*\.card-actions\s*\{([^}]+)\}/)?.[1];
  assert.ok(actions);
  assert.match(actions, /margin-top:\s*auto\s*;/);
  assert.match(actions, /padding-top:\s*18px\s*;/);
});

test('the school action footer stays after optional programs and keeps comparison available', () => {
  const source = readFileSync(new URL('../src/components/SchoolCard.jsx', import.meta.url), 'utf8');
  const actions = source.indexOf('<div className="card-actions">');
  assert.ok(actions > source.indexOf('className="program-list"'));
  assert.match(source.slice(actions), /View details/);
  assert.match(source.slice(actions), /onCompare &&/);
  assert.match(source.slice(actions), /<\/div>\s*<\/article>/);
});
