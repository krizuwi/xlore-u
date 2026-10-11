import 'dotenv/config';
import fs from 'node:fs/promises';
import pg from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Maintenance-only additive import. Default is a read-only dry run.
const file = process.argv[2];
const apply = process.argv.includes('--apply');
if (!file) throw new Error('Provide a reviewed catalog manifest path.');
const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
if (manifest.status !== 'approved-existing-school-batch') throw new Error('Manifest is not approved.');
const tags = new Set(['technology', 'analytical', 'science', 'health', 'business', 'creative', 'communication', 'social']);
const degreeLevels = new Set(['Bachelor', 'Associate', 'Diploma', 'Certificate', 'Postgraduate']);
const normalized = name => name.toLowerCase().replace(/^bachelor of science(?: in)?\s+/, 'bs ')
  .replace(/^bachelor of arts(?: in)?\s+/, 'ba ').replace(/^ab\s+/, 'ba ')
  .replace(/\s*\([a-z0-9-]+\)\s*$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();
for (const entry of manifest.entries) {
  if (!entry.name || entry.name.length > 190 || !entry.description || !entry.category ||
      !entry.interestTags.length || entry.interestTags.some(tag => !tags.has(tag)) ||
      !entry.schoolId || !entry.schoolName || new URL(entry.sourceUrl).protocol !== 'https:' ||
      !degreeLevels.has(entry.degreeLevel ?? 'Bachelor')) {
    throw new Error('Invalid reviewed catalog entry.');
  }
}
for (const item of manifest.schoolDescriptions ?? []) {
  if (!item.schoolId || !item.schoolName || !item.description?.trim() || item.description.length > 5000 ||
      new URL(item.sourceUrl).protocol !== 'https:') throw new Error('Invalid school description patch.');
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
  if (apply) await client.query('LOCK TABLE schools, programs, school_programs, available_schools IN SHARE ROW EXCLUSIVE MODE');
  const schools = (await client.query(`SELECT s.*, a.is_active_available
    FROM schools s LEFT JOIN available_schools a ON a.school_id = s.school_id`)).rows;
  // Ensure this connection is the catalog reviewed, not a different local/test database.
  for (const expected of manifest.expectedSchools) {
    if (!schools.some(s => s.school_id === expected.id && s.school_name === expected.name)) {
      throw new Error('Database does not match reviewed school inventory. No changes applied.');
    }
  }
  const programs = (await client.query('SELECT * FROM programs ORDER BY program_name')).rows;
  const beforeLinks = (await client.query('SELECT * FROM school_programs')).rows;
  const questionsBefore = (await client.query('SELECT * FROM assessment_questions ORDER BY question_id')).rows;
  const questionHash = createHash('sha256').update(JSON.stringify(questionsBefore)).digest('hex');
  const descriptions = (manifest.schoolDescriptions ?? []).filter(item => {
    const school = schools.find(s => s.school_id === item.schoolId && s.school_name === item.schoolName);
    if (!school) throw new Error('A description target school changed.');
    // Never overwrite an administrator's nonblank description, including inactive schools.
    return !school.description?.trim();
  });
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
    if (match && match.degree_level !== (entry.degreeLevel ?? 'Bachelor')) throw new Error(`Degree-level conflict requires review: ${entry.name}`);
    const programId = match?.program_id || randomUUID();
    if (!match) programs.push({ program_id: programId, program_name: entry.name, is_active: true, degree_level: entry.degreeLevel ?? 'Bachelor' });
    const exists = beforeLinks.some(l => l.program_id === programId && l.school_id === entry.schoolId);
    plan.push({ ...entry, programId, createProgram: !match, addLink: !exists });
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', batch: manifest.batch,
    newPrograms: plan.filter(p => p.createProgram).length, newLinks: plan.filter(p => p.addLink).length,
    blankSchoolDescriptions: descriptions.length, questionHash,
    schools: [...new Set(plan.map(p => p.schoolName))], ...(process.env.CATALOG_VERBOSE === 'true' ? { plan: plan.map(p => ({ school: p.schoolName,
      program: p.name, createProgram: p.createProgram, addLink: p.addLink })) } : {}) }, null, 2));
  if (apply) {
    // A durable, catalog-only backup is mandatory before the first write. No user records.
    const backupDirectory = process.env.CATALOG_BACKUP_DIR;
    if (!backupDirectory || !path.isAbsolute(backupDirectory)) throw new Error('Set an absolute CATALOG_BACKUP_DIR outside the repository before applying.');
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const relativeBackup = path.relative(repositoryRoot, path.resolve(backupDirectory));
    if (!(relativeBackup === '..' || relativeBackup.startsWith(`..${path.sep}`) || path.isAbsolute(relativeBackup))) {
      throw new Error('Catalog backups must be outside the repository.');
    }
    const backupFile = path.join(backupDirectory, `${manifest.batch}-${Date.now()}.json`);
    await fs.mkdir(backupDirectory, { recursive: true });
    await fs.writeFile(backupFile, JSON.stringify({ batch: manifest.batch, backedUpAt: new Date().toISOString(),
      schools, programs: programs.filter(program => !plan.some(item => item.createProgram && item.programId === program.program_id)),
      schoolPrograms: beforeLinks, questions: questionsBefore, questionHash, plannedChanges: plan, descriptionPatches: descriptions }, null, 2), { flag: 'wx' });
    for (const item of descriptions) {
      const update = await client.query(`UPDATE schools SET description = $1, catalog_last_updated_at = CURRENT_TIMESTAMP
        WHERE school_id = $2 AND COALESCE(TRIM(description), '') = ''`, [item.description, item.schoolId]);
      if (update.rowCount !== 1) throw new Error('Description changed concurrently; rolling back.');
    }
    for (const item of plan) {
      if (item.createProgram) await client.query(`INSERT INTO programs
        (program_id, program_name, description, category, degree_level, requirements,
         career_paths, interest_tags, source_url, last_verified_at, created_from_scrape, is_active)
        VALUES ($1,$2,$3,$4,$8,$5,'[]'::jsonb,$6::jsonb,$7,CURRENT_TIMESTAMP,false,true)`,
        [item.programId, item.name, item.description, item.category,
          "See the institution's official admissions page for current requirements and program availability.",
          JSON.stringify(item.interestTags), item.sourceUrl, item.degreeLevel ?? 'Bachelor']);
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
    const questionsAfter = (await client.query('SELECT * FROM assessment_questions ORDER BY question_id')).rows;
    if (createHash('sha256').update(JSON.stringify(questionsAfter)).digest('hex') !== questionHash) throw new Error('Question bank changed during maintenance; rolling back.');
    await client.query('COMMIT');
    transaction = false;
    console.log(JSON.stringify({ committed: true, batch: manifest.batch,
      newProgramIds: plan.filter(p => p.createProgram).map(p => p.programId),
      backupFile, blankSchoolDescriptionsFilled: descriptions.map(item => item.schoolName), questionHash,
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
