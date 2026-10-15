import { load } from "cheerio";
import { config } from "../config.js";
import { assertTrustedUrl } from "./robots.js";

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    programs: {
      type: "array",
      maxItems: 100,
      items: { type: "string" }
    }
  },
  required: ["programs"]
};

const URL_EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    university: { type: "string" },
    programs: { type: "array", maxItems: 100, items: { type: "string" } }
  },
  required: ["university", "programs"]
};

function normalize(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function apiFailure(status) {
  const reason = status === 401 ? "invalid API key" : status === 402 ? "insufficient credits" : status === 429 ? "rate limit reached" : "HTTP " + status;
  return new Error("ScrapeGraphAI request failed: " + reason + ".");
}

async function requestHosted(path, body, apiKey, fetchImpl, phase) {
  try {
    const response = await fetchImpl(config.scrapeGraph.apiUrl + path, {
      method: "POST",
      headers: { "SGAI-APIKEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.scrapeGraph.timeoutMs)
    });
    if (!response.ok) throw apiFailure(response.status);
    return await response.json();
  } catch (error) {
    if (error.name === "TimeoutError") {
      throw new Error(`ScrapeGraphAI ${phase} timed out after ${Math.round(config.scrapeGraph.timeoutMs / 1000)} seconds.`, { cause: error });
    }
    throw error;
  }
}

export function verifiedUrlExtractPrograms(json, schoolName) {
  if (!json || !Array.isArray(json.programs)) throw new Error("ScrapeGraphAI returned no program list.");
  const reportedSchool = normalize(json.university);
  const expectedSchool = normalize(schoolName);
  if (!reportedSchool || !expectedSchool || !reportedSchool.includes(expectedSchool)) {
    throw new Error("ScrapeGraphAI extraction did not match the configured university.");
  }
  return [...new Set(json.programs
    .filter(name => typeof name === "string" && name.length >= 3 && name.length <= 190)
    .map(name => name.trim())
    .filter(name => normalize(name).length >= 3))].slice(0, 100);
}

export async function extractProgramsFromUrlWithScrapeGraph(rawUrl, allowedHost, schoolName, {
  apiKey = config.scrapeGraph.apiKey,
  fetchImpl = fetch
} = {}) {
  if (!apiKey) throw new Error("ScrapeGraphAI is not configured. Set SGAI_API_KEY on the backend.");
  const url = assertTrustedUrl(rawUrl, allowedHost);
  const result = await requestHosted("/extract", {
    url: url.toString(),
    prompt: "Read this exact official page. Identify the university named on the page and list exact undergraduate degree or program titles visibly shown there. Do not invent, expand abbreviations, or include headings. Return an empty list if there are none.",
    schema: URL_EXTRACT_SCHEMA
  }, apiKey, fetchImpl, "URL extraction");
  const aiNames = verifiedUrlExtractPrograms(result?.json, schoolName);
  return {
    finalUrl: url.toString(),
    aiNames,
    contentForHash: JSON.stringify({ url: url.toString(), programs: aiNames.map(normalize).sort() })
  };
}

export function prepareScrapeGraphHtml(html) {
  const $ = load(html);
  // Some university sites wrap the entire page in an ASP.NET form. Preserve
  // its visible content while removing controls and hidden form values.
  $("form").each((_, element) => $(element).replaceWith($(element).contents()));
  $("script, style, nav, footer, noscript, svg, iframe, input, button, select, textarea").remove();
  const main = $("main").first();
  const body = $("body");
  const mainTextLength = main.text().trim().length;
  const bodyTextLength = body.text().trim().length;
  // A few sites use <main> for a short banner while the actual listings sit
  // in sibling sections. Include the body when main misses most page text.
  const scope = mainTextLength >= 200 && mainTextLength >= bodyTextLength * 0.3 ? main : body;
  // Styling attributes and links add tokens without helping title extraction.
  scope.find("*").each((_, element) => {
    for (const attribute of Object.keys(element.attribs ?? {})) $(element).removeAttr(attribute);
  });
  const content = scope.html();
  return (content || "").slice(0, 120_000);
}

export function verifiedAiProgramNames(json, html) {
  if (!Array.isArray(json?.programs)) throw new Error("ScrapeGraphAI returned no program list.");
  const evidence = normalize(load(html).text());
  if (!evidence) throw new Error("The source page contains no readable program text.");
  return [...new Set(json.programs
    .filter(name => typeof name === "string" && name.length >= 3 && name.length <= 190)
    .map(name => name.trim())
    .filter(name => normalize(name).length >= 3 && evidence.includes(normalize(name))))
  ].slice(0, 100);
}

export async function extractProgramsWithScrapeGraph(html, schoolName, {
  apiKey = config.scrapeGraph.apiKey,
  fetchImpl = fetch
} = {}) {
  if (!apiKey) throw new Error("ScrapeGraphAI is not configured. Set SGAI_API_KEY on the backend.");
  const prepared = prepareScrapeGraphHtml(html);
  if (!prepared.trim()) throw new Error("The source page contains no readable HTML.");
  const result = await requestHosted("/extract", {
      html: prepared,
      prompt: "Extract exact undergraduate degree or program titles explicitly shown on this official page for " + schoolName + ". Return only titles visible in the provided HTML. Do not infer, expand abbreviations, or invent programs. If none are present, return an empty programs array.",
      schema: EXTRACT_SCHEMA
    }, apiKey, fetchImpl, "program extraction");
  return verifiedAiProgramNames(result?.json, prepared);
}
