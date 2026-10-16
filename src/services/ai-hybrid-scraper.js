import { config } from "../config.js";
import { assertSchoolSourceOwnership } from "./catalog-source-validation.js";
import { extractProgramsWithScrapeGraph, extractProgramsFromUrlWithScrapeGraph } from "./scrapegraph-client.js";

const RETRYABLE_DIRECT_FAILURE = /HTTP (403|429|5\d\d)\b|abort|timeout|timed out|fetch failed/i;

// Try official page links before paying for hosted extraction.
export async function inspectAiHybridSource(source, {
  mode,
  requestTimeoutMs = config.catalogUpdater.requestTimeoutMs,
  inspectStandard,
  extractHosted = extractProgramsFromUrlWithScrapeGraph
}) {
  if (!['ai', 'hybrid'].includes(mode)) throw new Error('Invalid AI scraping mode.');
  if (source.source_type !== 'program_catalog') {
    return inspectStandard(source, { requestTimeoutMs });
  }
  assertSchoolSourceOwnership(source);

  if (mode === 'hybrid' || mode === 'ai') {
    try {
      const inspected = await inspectStandard(source, { requestTimeoutMs });
      if (mode === 'hybrid' || inspected.linkedPrograms?.length) return inspected;
    } catch (error) {
      if (error.code !== 'crawl_discovery_failed' && !RETRYABLE_DIRECT_FAILURE.test(String(error.message))) throw error;
    }
  }

  const extracted = await extractHosted(source.source_url, source.allowed_host, source.school_name);
  return { ...extracted, profile: null, candidates: [] };
}

export async function detectAiHybridPrograms(candidates, aliasMap, {
  mode,
  html,
  schoolName,
  aiNames,
  detectStandard,
  extractAi = extractProgramsWithScrapeGraph
}) {
  if (!['ai', 'hybrid'].includes(mode)) throw new Error('Invalid AI scraping mode.');
  if (mode === 'hybrid') {
    const standard = detectStandard(candidates, aliasMap);
    if (standard.size) return standard;
  }
  const names = aiNames ?? await extractAi(html, schoolName);
  // AI can only add offerings for existing catalog aliases found on the page.
  return detectStandard(names, aliasMap, { allowNew: false });
}
