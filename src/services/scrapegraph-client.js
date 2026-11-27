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

const CATEGORY_URL_EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    university: { type: "string" },
    categories: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          url: { type: "string" }
        },
        required: ["label", "url"]
      }
    }
  },
  required: ["university", "categories"]
};

const MAX_CATEGORY_DESTINATIONS = 16;

export const CLICKABLE_CATEGORY_NAVIGATION_PROMPT = [
  "Additional Instruction: Clickable Academic Category Navigation",
  "Some university websites display academic programs through clickable cards, images, or category buttons instead of showing the programs directly on the main page.",
  "When encountering this structure:",
  "1. Identify all clickable academic category cards and extract their labels and destination URLs.",
  "2. Navigate to each category's destination page.",
  "3. Extract the academic programs available on each destination page.",
  "4. Associate each extracted program with its corresponding academic category.",
  "5. Continue processing all relevant categories instead of stopping at the first destination.",
  "6. If a category card does not expose a direct URL, use browser interaction to click it and access its destination.",
  "7. Preserve the existing extraction format and data structure.",
  "8. Avoid extracting unrelated navigation links or duplicate programs.",
  "Important: Do not assume that the initial page contains all academic programs. Treat it as a directory page when it contains clickable academic category cards. The actual program information may be located on the destination pages."
].join("\n");

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

function trustedCategoryDestination(rawCategoryUrl, baseUrl, allowedHost) {
  if (typeof rawCategoryUrl !== "string" || !rawCategoryUrl.trim()) return null;
  try {
    const resolved = new URL(rawCategoryUrl, baseUrl);
    assertTrustedUrl(resolved.toString(), allowedHost);
    const base = new URL(baseUrl);
    resolved.hash = "";
    if (resolved.origin === base.origin && resolved.pathname === base.pathname && resolved.search === base.search) {
      return null;
    }
    if (/\.(?:pdf|docx?|xlsx?|zip|jpg|png)$/i.test(resolved.pathname)) return null;
    if (/\b(?:contact|about|login|signin|register|privacy|terms|news|events|blog|careers|jobs|alumni|library)\b/i.test(resolved.pathname)) {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

export async function extractProgramsFromUrlWithScrapeGraph(rawUrl, allowedHost, schoolName, {
  apiKey = config.scrapeGraph.apiKey,
  fetchImpl = fetch
} = {}) {
  if (!apiKey) throw new Error("ScrapeGraphAI is not configured. Set SGAI_API_KEY on the backend.");
  const url = assertTrustedUrl(rawUrl, allowedHost);
  const basePrompt = "Read this exact official page. Identify the university named on the page and list exact undergraduate degree or program titles visibly shown there. Do not invent, expand abbreviations, or include headings. Return an empty list if there are none.\n\n" + CLICKABLE_CATEGORY_NAVIGATION_PROMPT;
  const result = await requestHosted("/extract", {
    url: url.toString(),
    prompt: basePrompt,
    schema: URL_EXTRACT_SCHEMA
  }, apiKey, fetchImpl, "URL extraction");
  let aiNames = verifiedUrlExtractPrograms(result?.json, schoolName);
  const aiCategories = {};

  let categoryCards = Array.isArray(result?.json?.categories) ? result.json.categories : null;
  if (!aiNames.length && !categoryCards) {
    try {
      const categoryResult = await requestHosted("/extract", {
        url: url.toString(),
        prompt: `Read this official academic directory page for ${schoolName}. Identify all clickable academic category cards, images, or buttons that lead to academic program pages, and extract their category labels and destination URLs. Avoid unrelated navigation links.\n\n${CLICKABLE_CATEGORY_NAVIGATION_PROMPT}`,
        schema: CATEGORY_URL_EXTRACT_SCHEMA
      }, apiKey, fetchImpl, "category discovery");
      if ( Array.isArray(categoryResult?.json?.categories) ) {
        categoryCards = categoryResult.json.categories;
      }
    } catch {
      categoryCards = null;
    }
  }

  if (Array.isArray(categoryCards) && categoryCards.length) {
    const visitedUrls = new Set([url.toString()]);
    const collectedNames = [...aiNames];
    const seenNormalized = new Set(collectedNames.map(normalize));

    for (const card of categoryCards.slice(0, MAX_CATEGORY_DESTINATIONS)) {
      const destinationUrl = trustedCategoryDestination(card?.url, url.toString(), allowedHost);
      if (!destinationUrl || visitedUrls.has(destinationUrl)) continue;
      visitedUrls.add(destinationUrl);
      const categoryLabel = typeof card?.label === "string" ? card.label.trim() : "";
      try {
        const destResult = await requestHosted("/extract", {
          url: destinationUrl,
          prompt: basePrompt,
          schema: URL_EXTRACT_SCHEMA
        }, apiKey, fetchImpl, "URL extraction");
        const destPrograms = verifiedUrlExtractPrograms(destResult?.json, schoolName);
        for (const programName of destPrograms) {
          const norm = normalize(programName);
          if (!seenNormalized.has(norm)) {
            seenNormalized.add(norm);
            collectedNames.push(programName);
          }
          if (categoryLabel && !aiCategories[norm]) {
            aiCategories[norm] = categoryLabel;
          }
        }
      } catch {
        // Continue processing remaining academic categories when one destination fails.
      }
    }
    aiNames = collectedNames.slice(0, 100);
  }

  return {
    finalUrl: url.toString(),
    aiNames,
    ...(Object.keys(aiCategories).length ? { aiCategories } : {}),
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
      prompt: "Extract exact undergraduate degree or program titles explicitly shown on this official page for " + schoolName + ". Return only titles visible in the provided HTML. Do not infer, expand abbreviations, or invent programs. If none are present, return an empty programs array.\n\n" + CLICKABLE_CATEGORY_NAVIGATION_PROMPT,
      schema: EXTRACT_SCHEMA
    }, apiKey, fetchImpl, "program extraction");
  return verifiedAiProgramNames(result?.json, prepared);
}
