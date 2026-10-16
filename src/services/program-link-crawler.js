import { load } from 'cheerio';
import { assertTrustedUrl, fetchAllowedHtml, fetchAllowedJson } from './robots.js';

const DEGREE_TITLE = /\b(?:bachelor(?:'s)?\s+(?:of|in)\s+[a-z]|b\.?\s?(?:s|a|f|ed|eng|sc|tech|arch|ba)\.?\s+(?:in\s+)?[a-z])/i;
const GENERIC_LABEL = /^(?:programs?|degree(?:s)?|courses?|academics?|undergraduate(?: programs?)?|learn more|read more|view details)$/i;
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
  $('a[href]').each((_index, element) => {
    let label = clean($(element).text() || $(element).attr('title') || $(element).attr('aria-label'));
    if (GENERIC_LABEL.test(label)) {
      const container = $(element).closest('li, article, .card, .program-card');
      const heading = clean(container.find('h2, h3, h4').first().text());
      if (degreeTitle(heading)) label = heading;
    }
    if (!label || GENERIC_LABEL.test(label) || label.length > 190) return;
    const url = trustedDegreeLink($(element).attr('href'), baseUrl, allowedHost);
    if (!url) return;
    if (!degreeTitle(label) && !/\b(?:programs?|degrees?|courses?|academics|college)\b/i.test(new URL(url).pathname.replace(/[/-]/g, ' '))) return;
    if (!links.has(url)) links.set(url, { title: label, url, explicit: degreeTitle(label) });
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

export async function crawlProgramLinks(html, finalUrl, allowedHost, {
  requestTimeoutMs,
  fetchPage = fetchAllowedHtml,
  fetchJson = fetchAllowedJson
} = {}) {
  const links = discoverProgramLinks(html, finalUrl, allowedHost);
  const programs = [...discoverEmbeddedProgramLinks(html, finalUrl, allowedHost),
    ...links.filter(link => link.explicit).map(link => ({ name: link.title, url: link.url }))];
  try {
    const dynamicPrograms = await crawlDynamicSection(html, finalUrl, allowedHost, requestTimeoutMs, fetchJson);
    if (dynamicPrograms?.length) {
      programs.push(...dynamicPrograms);
      return [...new Map(programs.map(item => [`${item.name.toLowerCase()}|${item.url}`, item])).values()];
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
      const $ = load(detail.html);
      $('nav, footer, header, script, style, noscript').remove();
      const title = $('main h1, article h1, h1, main h2, article h2').toArray()
        .map(element => clean($(element).text())).find(degreeTitle);
      if (title) programs.push({ name: title, url: detail.finalUrl });
    } catch {
      // A failed detail page does not invalidate titles already visible on the listing.
    }
  }
  return [...new Map(programs.map(item => [`${item.name.toLowerCase()}|${item.url}`, item])).values()];
}
