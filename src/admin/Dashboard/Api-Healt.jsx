import { API_URL } from "../../lib/api.js";

const SERVICE_NAMES = ["database", "assessment", "scraping"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMeasuredCheck(check) {
  return isObject(check) &&
    ["healthy", "unhealthy"].includes(check.status) &&
    Number.isInteger(check.responseTime) && check.responseTime >= 0;
}

function isRouteCheck(check) {
  if (!isObject(check)) return false;
  if (check.status === "skipped") {
    return typeof check.reason === "string" && check.reason.trim().length > 0;
  }
  return isMeasuredCheck(check);
}

function isSystemHealth(health) {
  return isObject(health) &&
    ["ok", "unavailable"].includes(health.status) &&
    ["connected", "disconnected"].includes(health.database) &&
    typeof health.timestamp === "string" && Number.isFinite(Date.parse(health.timestamp)) &&
    isObject(health.checks) &&
    SERVICE_NAMES.every((name) => isMeasuredCheck(health.checks[name])) &&
    isObject(health.routes) && Object.keys(health.routes).length > 0 &&
    Object.entries(health.routes).every(([route, check]) =>
      /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/\S*$/.test(route) && isRouteCheck(check)
    );
}

/**
 * Fetch the backend health report, preserving its checks and routes objects.
 * routes["GET /schools"] contains status/responseTime, or status: "skipped"
 * and a reason. Skipped routes have not been verified healthy.
 * HTTP 503 is a valid report; transport errors and invalid reports reject.
 * @param {{ signal?: AbortSignal }} options
 * @returns {Promise<{
 *   status: "ok" | "unavailable",
 *   database: "connected" | "disconnected",
 *   timestamp: string,
 *   checks: Object<string, {status: "healthy" | "unhealthy", responseTime: number}>,
 *   routes: Object<string, {status: "healthy" | "unhealthy", responseTime: number} | {status: "skipped", reason: string}>
 * }>}
 */
export async function fetchApiHealth({ signal } = {}) {
  const response = await fetch(`${API_URL.replace(/\/+$/, "")}/health-check`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  // A 503 response still contains the individual service health results.
  if (response.status !== 200 && response.status !== 503) {
    throw new Error(`Unable to load system health (${response.status}).`);
  }

  const health = await response.json();
  if (!isSystemHealth(health)) {
    throw new Error("Invalid system health response.");
  }

  return health;
}
