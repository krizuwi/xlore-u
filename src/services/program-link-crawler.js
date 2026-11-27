import { load } from 'cheerio';
import { assertTrustedUrl, fetchAllowedHtml, fetchAllowedJson } from './robots.js';

const DEGREE_TITLE = /\b(?:bachelor(?:'s)?\s+(?:of|in)\s+[a-z]|(?:b\.?\s?(?:s|a|f|ed|eng|sc|tech|arch|ba)\.?|ab|bsed|beed|bfa|beng|bit|bsn|bsa|bsit|bscs|bsba|bstm|bshm|bsoa)\s+(?:in\s+)?[a-z])/i;
const GENERIC_LABEL = /^(?:programs?|degree(?:s)?|courses?|academics?|undergraduate(?: programs?)?|learn more|read more|view details|view programs?|explore(?: programs?)?|see (?:more|programs?|courses?)|discover|click here|find out more)$/i;
const UNRELATED_NAV = /\b(?:contact|about(?:\s+us)?|login|sign\s*in|register|privacy|terms|policy|news|events|blog|careers|jobs|alumni|library|scholarship|tuition|faq|help|support|sitemap|search|calendar|portal|donate|giving|history|board|trustees|directory|map|campus\s+life|athletics|sports|how\s+to\s+apply)\b/i;
const CATEGORY_LABEL = /\b(?:college|school|faculty|institute|department|division|academy|cluster|track|strand|engineering|aviation|aeronautics|avionics|aircraft|computing|computer|information\s+technology|data\s+science|cyber|business|management|accountancy|accounting|commerce|economics|finance|marketing|entrepreneurship|office\s+administration|health|nursing|medical|pharmacy|therapy|nutrition|midwifery|dentistry|optometry|hospitality|tourism|culinary|hotel|architecture|design|multimedia|fine\s+arts|arts|sciences|humanities|social\s+sciences?|natural\s+sciences?|communication|journalism|broadcasting|education|teaching|psychology|sociology|biology|chemistry|physics|mathematics|maritime|criminology|public\s+administration)\b/i;
const CATEGORY_PATH = /\b(?:programs?|degrees?|courses?|academics?|colleges?|schools?|facult(?:y|ies)|departments?|institutes?|undergraduate|studies|offerings?|categories|category|tracks?|clusters?|curricul(?:um|a)|divisions?)\b/i;
const MAX_DETAIL_PAGES = 16;
const MAX_DYNAMIC_ARTICLES = 500;
const MAX_DYNAMIC_PAGES = 25;
const MAX_LIST_LINKS = 500;

export class CrawlDiscoveryError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.code = 'crawl_discovery_failed';
  }
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function degreeTitle(value) {
  const title = clean(value);
  return title.length >= 8 && title.length <= 190 && DEGREE_TITLE.test(title) && !GENERIC_LABEL.test(title);
}

function isCategoryLabel(value) {
  const title = clean(value);
  return title.length >= 3 && title.length <= 190 && !GENERIC_LABEL.test(title) &&
    !UNRELATED_NAV.test(title) && CATEGORY_LABEL.test(title);
}

function withCategory(program, category) {
  const label = clean(category);
  if (label && !degreeTitle(label)) {
    Object.defineProperty(program, 'category', {
      value: label,
      enumerable: false,
      configurable: true,
      writable: true
    });
  }
  return program;
}

function extractRawUrl($, element) {
  const direct = $(element).attr('href') || $(element).attr('data-href') || $(element).attr('data-url') || $(element).attr('data-link');
  if (direct && !/^(?:#|javascript:)/i.test(direct.trim())) return direct;
  const onclick = $(element).attr('onclick') || '';
  const match = /(?:location(?:\.href)?\s*=\s*|location\.(?:assign|replace)\(\s*|window\.open\(\s*)['"]([^'"]+)['"]/i.exec(onclick);
  return match?.[1] ?? null;
}

function extractCardLabel($, element) {
  const headingChild = clean($(element).find('h1, h2, h3, h4, h5, h6, .card-title, [class*="title"]').first().text());
  let label = clean($(element).text() || $(element).attr('title') || $(element).attr('aria-label') || $(element).find('img[alt]').first().attr('alt'));
  if (!degreeTitle(label) && headingChild && (degreeTitle(headingChild) || isCategoryLabel(headingChild))) {
    label = headingChild;
  }
  if (!label || GENERIC_LABEL.test(label)) {
    const container = $(element).closest('li, article, section, .card, .program-card, [class*="card"], [class*="category"], [class*="college"], [class*="department"], [class*="program"]');
    const heading = clean(
      container.find('h1, h2, h3, h4, h5, h6, strong, .card-title, [class*="title"]').first().text() ||
      container.find('img[alt]').first().attr('alt')
    );
    if (degreeTitle(heading) || isCategoryLabel(heading)) label = heading;
  }
  return label;
}

function trustedDegreeLink(rawUrl, baseUrl, allowedHost) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  try {
    const url = new URL(rawUrl, baseUrl);
    assertTrustedUrl(url.toString(), allowedHost);
    const base = new URL(baseUrl);
    if (url.origin === base.origin && url.pathname === base.pathname && url.search === base.search) return null;
    if (/\.(?:pdf|docx?|xlsx?|zip|jpg|png)$/i.test(url.pathname)) return null;
    url.hash = '';
    return url.toString();
  } catch { return null; }
}

export function discoverProgramLinks(html, baseUrl, allowedHost) {
  const $ = load(html);
  $('nav, footer, header, script, style, noscript').remove();
  const links = new Map();
  $('a[href], [data-href], [data-url], [data-link], [onclick]').each((_index, element) => {
    const label = extractCardLabel($, element);
    if (!label || GENERIC_LABEL.test(label) || label.length > 190) return;
    const rawUrl = extractRawUrl($, element);
    const url = trustedDegreeLink(rawUrl, baseUrl, allowedHost);
    if (!url) return;
    const explicit = degreeTitle(label);
    const pathText = new URL(url).pathname.replace(/[/_-]/g, ' ');
    if (!explicit) {
      if (UNRELATED_NAV.test(label) || UNRELATED_NAV.test(pathText)) return;
      if (!CATEGORY_PATH.test(pathText) && !isCategoryLabel(label)) return;
    }
    if (!links.has(url)) links.set(url, { title: label, url, explicit });
  });
  return [...links.values()];
}

export function discoverEmbeddedProgramLinks(html, baseUrl, allowedHost) {
  const $ = load(html);
  const programs = new Map();
  function visit(value, found, state, depth = 0) {
    if (state.overflow || depth > 12 || !value || typeof value !== 'object') return;
    if (++state.visited > 10_000) { state.overflow = true; return; }
    if (Array.isArray(value)) { for (const child of value) visit(child, found, state, depth + 1); return; }
    const title = value.name ?? value.title ?? value.programName ?? value.headline;
    const rawUrl = value.url ?? value.href ?? value.link ?? value.permalink;
    const url = trustedDegreeLink(rawUrl, baseUrl, allowedHost);
    if (degreeTitle(title) && url) found.set(url, { name: clean(title), url });
    for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child, found, state, depth + 1);
  }
  $('script[type="application/ld+json"], script[type="application/json"], script#__NEXT_DATA__').each((_index, element) => {
    const content = $(element).html();
    if (!content || content.length > 2_000_000) return;
    try {
      const found = new Map();
      const state = { visited: 0, overflow: false };
      visit(JSON.parse(content), found, state);
      if (!state.overflow) for (const [url, program] of found) programs.set(url, program);
    } catch { /* Ignore unrelated or malformed page data. */ }
  });
  return [...programs.values()];
}

async function crawlDynamicSection(html, finalUrl, allowedHost, requestTimeoutMs, fetchJson) {
  const sectionId = /^\/kb\/section\/(\d+)\/?$/.exec(new URL(finalUrl).pathname)?.[1];
  if (!sectionId || !/id=["']article-list-view["']/.test(html) || !html.includes('kb/articleList')) return null;
  const programs = [];
  let total = null;
  let received = 0;
  const seenIds = new Set();
  for (let page = 1; page <= MAX_DYNAMIC_PAGES; page++) {
    const apiUrl = new URL('/kb/section_article/list', finalUrl);
    apiUrl.search = new URLSearchParams({ sectionid: sectionId, requiresCounts: 'true',
      page: String(page), perpage: '100' }).toString();
    const { json } = await fetchJson(apiUrl.toString(), allowedHost, { requestTimeoutMs });
    if (!Array.isArray(json?.result) || !Number.isSafeInteger(json.count) || json.count < 0) {
      throw new Error('The source returned an invalid article list.');
    }
    if (total === null) total = json.count;
    if (json.count !== total) throw new Error('The source article count changed during collection.');
    if (total > MAX_DYNAMIC_ARTICLES) throw new Error('The source article list exceeds the crawl limit.');
    for (const article of json.result) {
      if (!Number.isSafeInteger(article?.id) || article.id <= 0 || seenIds.has(article.id)) continue;
      seenIds.add(article.id);
      received += 1;
      if (String(article?.section?.id) !== sectionId || article.isSection ||
          typeof article.slugTitle !== 'string' || !/^[a-z0-9-]+$/.test(article.slugTitle) ||
          !degreeTitle(article.name)) continue;
      programs.push({ name: clean(article.name),
        url: new URL(`/kb/article/${article.id}/${article.slugTitle}`, finalUrl).toString() });
    }
    if (received >= total) return programs;
    if (json.result.length === 0) throw new Error('The source article list ended before all pages were returned.');
  }
  throw new Error('The source article list exceeded the page limit before completion.');
}

function extractDestinationPrograms(html, pageUrl, allowedHost, categoryLabel) {
  const extracted = [];
  const seenNames = new Set();
  const addProgram = (name, url) => {
    const cleaned = clean(name);
    const key = cleaned.toLowerCase();
    if (!cleaned || seenNames.has(key)) return;
    seenNames.add(key);
    extracted.push(withCategory({ name: cleaned, url }, categoryLabel));
  };

  for (const embedded of discoverEmbeddedProgramLinks(html, pageUrl, allowedHost)) {
    addProgram(embedded.name, embedded.url);
  }
  for (const subLink of discoverProgramLinks(html, pageUrl, allowedHost)) {
    if (subLink.explicit) addProgram(subLink.title, subLink.url);
  }

  const $ = load(html);
  $('nav, footer, header, script, style, noscript, svg').remove();
  const selectors = 'main h1, article h1, h1, main h2, article h2, h2, main h3, article h3, h3, main h4, article h4, h4, main h5, article h5, h5, main h6, article h6, h6, main li, article li, li, main td, article td, td';
  $(selectors).each((_index, element) => {
    let text = clean($(element).clone().children('ul, ol, table, div, p, small').remove().end().text() || $(element).text());
    text = text
      .replace(/\s+(?:Course Description|Program Educational Outcomes|Program Requirements|Grade Requirement|Career Opportunities|Overview).*$/i, '')
      .replace(/\s*[|•]\s*.*$/, '')
      .trim();
    if (degreeTitle(text)) addProgram(text, pageUrl);
  });

  return extracted;
}

function discoverInPageCategoryPrograms(html, baseUrl, allowedHost) {
  const $ = load(html);
  $('nav, footer, header, script, style, noscript').remove();
  const programs = [];
  $('a[href^="#"], [data-target^="#"], [data-bs-target^="#"], [aria-controls]').each((_index, element) => {
    const rawTarget = $(element).attr('data-bs-target') || $(element).attr('data-target') || $(element).attr('href') || $(element).attr('aria-controls') || '';
    const targetId = rawTarget.replace(/^#/, '').trim();
    if (!targetId || !/^[A-Za-z0-9_-]+$/.test(targetId)) return;
    const label = extractCardLabel($, element);
    if (!isCategoryLabel(label)) return;
    const panel = $(`#${targetId}`);
    if (!panel.length) return;
    for (const item of extractDestinationPrograms(panel.html() || '', baseUrl, allowedHost, label)) {
      programs.push(item);
    }
  });
  return programs;
}

function deduplicatePrograms(programs) {
  const byName = new Map();
  for (const item of programs) {
    const key = clean(item.name).toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, item);
    } else if (existing.category === undefined && item.category !== undefined) {
      withCategory(existing, item.category);
    }
  }
  return [...byName.values()];
}

export async function crawlProgramLinks(html, finalUrl, allowedHost, {
  requestTimeoutMs,
  fetchPage = fetchAllowedHtml,
  fetchJson = fetchAllowedJson
} = {}) {
  const links = discoverProgramLinks(html, finalUrl, allowedHost);
  const programs = [
    ...discoverEmbeddedProgramLinks(html, finalUrl, allowedHost),
    ...links.filter(link => link.explicit).map(link => ({ name: link.title, url: link.url })),
    ...discoverInPageCategoryPrograms(html, finalUrl, allowedHost)
  ];
  try {
    const dynamicPrograms = await crawlDynamicSection(html, finalUrl, allowedHost, requestTimeoutMs, fetchJson);
    if (dynamicPrograms?.length) {
      programs.push(...dynamicPrograms);
      return deduplicatePrograms(programs);
    }
  } catch (error) {
    throw new CrawlDiscoveryError(`Public article-list crawl failed: ${error.message}`, error);
  }
  if (links.length > MAX_LIST_LINKS) throw new CrawlDiscoveryError('The source has more links than the crawl limit.');
  const ambiguous = links.filter(link => !link.explicit);
  if (ambiguous.length > MAX_DETAIL_PAGES) throw new CrawlDiscoveryError('The source has more unclear degree links than the detail-page crawl limit.');
  for (const link of ambiguous) {
    try {
      const detail = await fetchPage(link.url, allowedHost, { requestTimeoutMs });
      const destinationPrograms = extractDestinationPrograms(detail.html, detail.finalUrl, allowedHost, link.title);
      programs.push(...destinationPrograms);
    } catch {
      // A failed detail page does not invalidate titles already visible on the listing.
    }
  }
  return deduplicatePrograms(programs);
}
