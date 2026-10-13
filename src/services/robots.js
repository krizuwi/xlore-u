import robotsParser from "robots-parser";
import { config } from "../config.js";

const robotsCache = new Map();
const lastRequestByHost = new Map();

function withTimeout(milliseconds) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milliseconds);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function assertTrustedUrl(rawUrl, allowedHost) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Catalog sources must use HTTPS.");
  const hostname = url.hostname.toLowerCase();
  const trusted = allowedHost.toLowerCase();
  if (url.username || url.password) throw new Error('Catalog sources must not contain URL credentials.');
  if (hostname !== trusted && !hostname.endsWith(`.${trusted}`)) {
    throw new Error(`Source host ${hostname} is outside the allowed host ${trusted}.`);
  }
  return url;
}

async function trustedFetch(url, allowedHost, options, validateRedirect) {
  for (let redirects = 0; redirects <= 4; redirects++) {
    assertTrustedUrl(url, allowedHost);
    const response = await fetch(url, { ...options, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error('Source redirect has no destination.');
    const next = assertTrustedUrl(new URL(location, url).toString(), allowedHost);
    // Validate the destination before contacting it. Pages redirected to
    // another allowed origin must use that origin's robots policy.
    if (validateRedirect) await validateRedirect(next);
    url = next.toString();
  }
  throw new Error('Source exceeded the redirect limit.');
}

async function loadRobots(url, allowedHost, requestTimeoutMs) {
  const robotsUrl = new URL("/robots.txt", url.origin).toString();
  const cached = robotsCache.get(robotsUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.parser;

  const timeout = withTimeout(Math.min(requestTimeoutMs, 8000));
  try {
    const response = await trustedFetch(robotsUrl, allowedHost, {
      signal: timeout.signal,
      headers: { "User-Agent": config.catalogUpdater.userAgent, Accept: "text/plain" }
    });
    if (response.status === 404) {
      await response.body?.cancel();
      robotsCache.set(robotsUrl, { parser: null, expiresAt: Date.now() + 3_600_000 });
      return null;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`robots.txt returned HTTP ${response.status}`);
    }
    const parser = robotsParser(robotsUrl, await response.text());
    robotsCache.set(robotsUrl, { parser, expiresAt: Date.now() + 3_600_000 });
    return parser;
  } finally {
    timeout.clear();
  }
}

export async function fetchAllowedHtml(rawUrl, allowedHost, { requestTimeoutMs = config.catalogUpdater.requestTimeoutMs } = {}) {
  const url = assertTrustedUrl(rawUrl, allowedHost);
  const robots = await loadRobots(url, allowedHost, requestTimeoutMs);
  if (robots && robots.isAllowed(url.toString(), config.catalogUpdater.userAgent) === false) {
    throw new Error("Blocked by the source website's robots.txt policy.");
  }

  const crawlDelayMs = Number(robots?.getCrawlDelay(config.catalogUpdater.userAgent) ?? 0) * 1000;
  const waitMs = Math.max(config.catalogUpdater.minHostDelayMs, crawlDelayMs || 0);
  const lastRequestAt = lastRequestByHost.get(url.hostname) ?? 0;
  const remainingDelay = waitMs - (Date.now() - lastRequestAt);
  if (remainingDelay > 0) await sleep(remainingDelay);

  const timeout = withTimeout(requestTimeoutMs);
  try {
    const response = await trustedFetch(url.toString(), allowedHost, {
      signal: timeout.signal,
      headers: {
        "User-Agent": config.catalogUpdater.userAgent,
        Accept: "text/html,application/xhtml+xml"
      }
    }, async next => {
      const nextRobots = next.origin === url.origin ? robots : await loadRobots(next, allowedHost, requestTimeoutMs);
      if (nextRobots && nextRobots.isAllowed(next.toString(), config.catalogUpdater.userAgent) === false) {
        throw new Error("Blocked by the source website's robots.txt policy.");
      }
    });
    lastRequestByHost.set(url.hostname, Date.now());
    assertTrustedUrl(response.url, allowedHost);
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Source returned HTTP ${response.status}.`); }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      await response.body?.cancel();
      throw new Error(`Unsupported content type: ${contentType || "unknown"}.`);
    }
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > config.catalogUpdater.maxResponseBytes) {
      await response.body?.cancel();
      throw new Error("Source page is larger than the configured response limit.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > config.catalogUpdater.maxResponseBytes) {
      throw new Error("Source page exceeded the configured response limit.");
    }
    return { html: buffer.toString("utf8"), finalUrl: response.url };
  } finally {
    timeout.clear();
  }
}
