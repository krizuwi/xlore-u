// Read-only diagnostic: fetches allowed official pages, never runs collection
// and never changes source history, school data, offerings or assessments.
import { rawPool } from '../src/db/pool.js';
import { inspectCatalogSource, recognizeCatalogPrograms } from '../src/services/catalog-updater.js';
import { catalogFailure } from '../src/services/catalog-errors.js';

try {
  const sources = await rawPool.query(`SELECT cs.*, s.school_name, s.official_website_url
    FROM catalog_sources cs JOIN schools s ON s.school_id = cs.school_id
    WHERE cs.enabled ORDER BY s.school_name, cs.source_type`);
  const aliases = (await rawPool.query(`SELECT pa.normalized_alias, p.program_id, p.program_name
    FROM program_aliases pa JOIN programs p ON p.program_id = pa.program_id`)).rows;
  for (const source of sources.rows) {
    try {
      const result = await inspectCatalogSource(source);
      const recognized = result.candidates ? recognizeCatalogPrograms(result.candidates, aliases).length : undefined;
      if (recognized === 0) throw new Error('No recognizable programs were found on the source page.');
      console.log(JSON.stringify({ school: source.school_name, type: source.source_type, status: 'page_accessible',
        url: result.finalUrl, candidateCount: result.candidates?.length, recognizedProgramCount: recognized, usableProfile: Boolean(result.profile),
        note: 'Read-only fetch and extraction check; no database updates have been performed.' }));
    } catch (error) {
      console.log(JSON.stringify({ school: source.school_name, type: source.source_type, status: 'failed',
        error: error.message, ...catalogFailure(error.message) }));
      process.exitCode = 1;
    }
  }
} finally { await rawPool.end(); }
