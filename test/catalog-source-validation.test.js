import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.EMAIL_ENABLED = 'false';
const { assertSchoolSourceOwnership } = await import('../src/services/catalog-source-validation.js');
test('source ownership rejects a UMak source linked to UST before any data collection', () => {
  assert.throws(() => assertSchoolSourceOwnership({ allowed_host: 'www.umak.edu.ph', official_website_url: 'https://www.ust.edu.ph/' }), /does not match/);
  assert.doesNotThrow(() => assertSchoolSourceOwnership({ allowed_host: 'www.umak.edu.ph', official_website_url: 'https://www.umak.edu.ph/' }));
  assert.doesNotThrow(() => assertSchoolSourceOwnership({ allowed_host: 'mapua.edu.ph', official_website_url: 'https://www.mapua.edu.ph/' }));
  assert.doesNotThrow(() => assertSchoolSourceOwnership({ allowed_host: 'sti.edu', official_website_url: 'http://sti.edu/campuses/globalcity' }));
  assert.throws(() => assertSchoolSourceOwnership({ allowed_host: 'umak.edu.ph', official_website_url: 'file:///umak.edu.ph' }), /does not match/);
});
test('the guarded correction changes only the mismatched source association and preserves history and catalog data', () => {
  const sql = readFileSync(new URL('../database/migrations/020_correct_umak_catalog_source.sql', import.meta.url), 'utf8');
  assert.match(sql, /cs.school_id = '40000000-0000-4000-8000-000000000005'/);
  assert.match(sql, /umak.school_name = 'University of Makati'/);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|UPDATE schools|UPDATE programs|UPDATE assessment|last_status\s*=/i);
});
