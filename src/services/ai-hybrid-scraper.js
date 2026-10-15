import { config } from "../config.js";
import { assertSchoolSourceOwnership } from "./catalog-source-validation.js";
import { extractProgramsWithScrapeGraph, extractProgramsFromUrlWithScrapeGraph } from "./scrapegraph-client.js";

const HYBRID_DIRECT_TIMEOUT_MS = 8_000;
const RETRYABLE_DIRECT_FAILURE = /HTTP (403|429|5\d\d)\b|abort|timeout|timed out|fetch failed/i;

// This is the AI/Hybrid program-source path. The Standard source inspector is
// passed in only for Hybrid's first attempt and for unchanged school profiles.
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

  if (mode === 'hybrid') {
    try {
      return await inspectStandard(source, {
        requestTimeoutMs: Math.min(requestTimeoutMs, HYBRID_DIRECT_TIMEOUT_MS)
      });
    } catch (error) {
      if (!RETRYABLE_DIRECT_FAILURE.test(String(error.message))) throw error;
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
