import 'dotenv/config';
import fs from 'node:fs/promises';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

// Maintenance-only additive import. Default is a read-only dry run.
const file = process.argv[2];
const apply = process.argv.includes('--apply');
if (!file) throw new Error('Provide a reviewed catalog manifest path.');
const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
if (manifest.status !== 'approved-existing-school-batch') throw new Error('Manifest is not approved.');
const tags = new Set(['technology', 'analytical', 'science', 'health', 'business', 'creative', 'communication', 'social']);
const normalized = name => name.toLowerCase().replace(/^bachelor of science(?: in)?\s+/, 'bs ')
  .replace(/^bachelor of arts(?: in)?\s+/, 'ba ').replace(/^ab\s+/, 'ba ')
  .replace(/\s*\([a-z0-9-]+\)\s*$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();
for (const entry of manifest.entries) {
  if (!entry.name || entry.name.length > 190 || !entry.description || !entry.category ||
      !entry.interestTags.length || entry.interestTags.some(tag => !tags.has(tag)) ||
      !entry.schoolId || !entry.schoolName || new URL(entry.sourceUrl).protocol !== 'https:') {
    throw new Error('Invalid reviewed catalog entry.');
  }
}
const sslMode = (process.env.DB_SSL || 'require').toLowerCase();
if (!['require', 'disable', 'verify-full'].includes(sslMode)) throw new Error('Invalid DB_SSL.');
if (sslMode === 'verify-full' && !process.env.DB_SSL_CA) throw new Error('DB_SSL_CA required.');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: sslMode === 'disable' ? false : { rejectUnauthorized: sslMode === 'verify-full',
    ...(sslMode === 'verify-full' ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}) },
  connectionTimeoutMillis: 15000, statement_timeout: 20000
});
let transaction = false;
try {
  await client.connect();
  await client.query(apply ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN READ ONLY');
  transaction = true;
  await client.query("SET LOCAL lock_timeout = '5s'");
  if (apply) await client.query("SELECT pg_advisory_xact_lock(hashtext('verified-catalog-import'))");
  const schools = (await client.query(`SELECT s.school_id, s.school_name, a.is_active_available
    FROM schools s LEFT JOIN available_schools a ON a.school_id = s.school_id`)).rows;
  // Ensure this connection is the catalog reviewed, not a different local/test database.
  for (const expected of manifest.expectedSchools) {
    if (!schools.some(s => s.school_id === expected.id && s.school_name === expected.name)) {
      throw new Error('Database does not match reviewed school inventory. No changes applied.');
    }
  }
  const programs = (await client.query('SELECT * FROM programs ORDER BY program_name')).rows;
  const beforeLinks = (await client.query('SELECT * FROM school_programs')).rows;
  const plan = [];
  for (const entry of manifest.entries) {
    const school = schools.find(s => s.school_id === entry.schoolId && s.school_name === entry.schoolName);
    if (!school?.is_active_available) throw new Error('A target school is inactive or changed.');
    const candidates = programs.filter(p => normalized(p.program_name) === normalized(entry.name));
    // Prefer a full exact name, otherwise require an unambiguous equivalent award.
    const exact = candidates.find(p => p.program_name === entry.name);
    if (!exact && candidates.length > 1) throw new Error(`Ambiguous program: ${entry.name}`);
    const match = exact || candidates[0];
    if (match && !match.is_active) throw new Error(`Archived program requires review: ${entry.name}`);
    const programId = match?.program_id || randomUUID();
    if (!match) programs.push({ program_id: programId, program_name: entry.name, is_active: true });
    const exists = beforeLinks.some(l => l.program_id === programId && l.school_id === entry.schoolId);
    plan.push({ ...entry, programId, createProgram: !match, addLink: !exists });
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', batch: manifest.batch,
    newPrograms: plan.filter(p => p.createProgram).length, newLinks: plan.filter(p => p.addLink).length,
    schools: [...new Set(plan.map(p => p.schoolName))], plan: plan.map(p => ({ school: p.schoolName,
      program: p.name, createProgram: p.createProgram, addLink: p.addLink })) }, null, 2));
  if (apply) {
    for (const item of plan) {
      if (item.createProgram) await client.query(`INSERT INTO programs
        (program_id, program_name, description, category, degree_level, requirements,
         career_paths, interest_tags, source_url, last_verified_at, created_from_scrape, is_active)
        VALUES ($1,$2,$3,$4,'Bachelor',$5,'[]'::jsonb,$6::jsonb,$7,CURRENT_TIMESTAMP,false,true)`,
        [item.programId, item.name, item.description, item.category,
          "See the institution's official admissions page for current requirements and program availability.",
          JSON.stringify(item.interestTags), item.sourceUrl]);
      if (item.addLink) await client.query(`INSERT INTO school_programs
        (school_program_id, school_id, program_id, tuition_per_semester, is_top_program, source_url, last_verified_at)
        VALUES ($1,$2,$3,NULL,false,$4,CURRENT_TIMESTAMP) ON CONFLICT (school_id,program_id) DO NOTHING`,
        [randomUUID(), item.schoolId, item.programId, item.sourceUrl]);
    }
    // Assert all pre-existing links and their complete metadata remain untouched.
    const afterLinks = (await client.query('SELECT * FROM school_programs')).rows;
    for (const link of beforeLinks) {
      const after = afterLinks.find(l => l.school_program_id === link.school_program_id);
      if (JSON.stringify(link) !== JSON.stringify(after)) throw new Error('Existing link changed; rolling back.');
    }
    for (const item of plan) {
      if (!afterLinks.some(l => l.school_id === item.schoolId && l.program_id === item.programId)) {
        throw new Error('Post-import link verification failed; rolling back.');
      }
    }
    await client.query('COMMIT');
    transaction = false;
    console.log(JSON.stringify({ committed: true, batch: manifest.batch,
      newProgramIds: plan.filter(p => p.createProgram).map(p => p.programId),
      addedLinks: plan.filter(p => p.addLink).map(p => ({ schoolId: p.schoolId, programId: p.programId })) }));
  } else {
    await client.query('ROLLBACK');
    transaction = false;
  }
} catch (error) {
  if (transaction) await client.query('ROLLBACK').catch(() => {});
  // Never log connection strings or credential-bearing errors.
  console.error(JSON.stringify({ failed: true, code: error.code || null,
    message: (error.message || 'Catalog import failed').replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]') }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
