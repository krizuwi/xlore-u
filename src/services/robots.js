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
  if (hostname !== trusted && !hostname.endsWith(`.${trusted}`)) {
    throw new Error(`Source host ${hostname} is outside the allowed host ${trusted}.`);
  }
  return url;
}

async function loadRobots(url) {
  const robotsUrl = new URL("/robots.txt", url.origin).toString();
  const cached = robotsCache.get(robotsUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.parser;

  const timeout = withTimeout(Math.min(config.catalogUpdater.requestTimeoutMs, 8000));
  try {
    const response = await fetch(robotsUrl, {
      signal: timeout.signal,
      headers: { "User-Agent": config.catalogUpdater.userAgent, Accept: "text/plain" }
    });
    if (response.status === 404) {
      robotsCache.set(robotsUrl, { parser: null, expiresAt: Date.now() + 3_600_000 });
      return null;
    }
    if (!response.ok) {
      throw new Error(`robots.txt returned HTTP ${response.status}`);
    }
    const parser = robotsParser(robotsUrl, await response.text());
    robotsCache.set(robotsUrl, { parser, expiresAt: Date.now() + 3_600_000 });
    return parser;
  } finally {
    timeout.clear();
  }
}

export async function fetchAllowedHtml(rawUrl, allowedHost) {
  const url = assertTrustedUrl(rawUrl, allowedHost);
  const robots = await loadRobots(url);
  if (robots && robots.isAllowed(url.toString(), config.catalogUpdater.userAgent) === false) {
    throw new Error("Blocked by the source website's robots.txt policy.");
  }

  const crawlDelayMs = Number(robots?.getCrawlDelay(config.catalogUpdater.userAgent) ?? 0) * 1000;
  const waitMs = Math.max(config.catalogUpdater.minHostDelayMs, crawlDelayMs || 0);
  const lastRequestAt = lastRequestByHost.get(url.hostname) ?? 0;
  const remainingDelay = waitMs - (Date.now() - lastRequestAt);
  if (remainingDelay > 0) await sleep(remainingDelay);

  const timeout = withTimeout(config.catalogUpdater.requestTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: timeout.signal,
      redirect: "follow",
      headers: {
        "User-Agent": config.catalogUpdater.userAgent,
        Accept: "text/html,application/xhtml+xml"
      }
    });
    lastRequestByHost.set(url.hostname, Date.now());
    assertTrustedUrl(response.url, allowedHost);
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}.`);
    }
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > config.catalogUpdater.maxResponseBytes) {
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
