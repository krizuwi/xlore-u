import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('backend deployment persists one Tokyo function region aligned with the Supabase database', () => {
  const configuration = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(configuration.$schema, 'https://openapi.vercel.sh/vercel.json');
  assert.deepEqual(configuration.regions, ['hnd1']);
  assert.equal(configuration.functions, undefined);
  assert.equal(configuration.env, undefined);
  assert.equal(configuration.builds, undefined);
  assert.equal(configuration.rewrites, undefined);
});
