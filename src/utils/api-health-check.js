import pg from "pg";
import { config } from "../config.js";
import { rawPool } from "../db/pool.js";

export const HEALTH_ROUTE_TIMEOUT_MS = 10000;
const DATABASE_TIMEOUT_MS = 5000;
const SLOW_MS = 3000;
const HEALTH_CACHE_MS = 30000;
const FAILURE_CACHE_MS = 5000;
const healthCache = new Map();
const PUBLIC_ROUTES = ["/schools", "/schools/meta/filters", "/programs", "/assessments/questions", "/catalog/status"];
const PROTECTED_ROUTES = ["/auth/me", "/assessments", "/assessments/:id/results", "/saved", "/comparison", "/dashboard"];
const ACTION_ROUTES = [
    ...["register", "verify-email", "forgot-password", "reset-password", "resend-verification", "login", "google", "refresh", "logout"].map(path => ["POST", "/auth/" + path]),
    ["PATCH", "/auth/me"], ["POST", "/assessments"], ["POST", "/schools/:id/visit"],
    ["POST", "/saved/schools/:id"], ["DELETE", "/saved/schools/:id"], ["POST", "/saved/programs/:id"], ["DELETE", "/saved/programs/:id"],
    ["PUT", "/comparison/schools"], ["POST", "/comparison/schools/:id"], ["DELETE", "/comparison/schools/:id"], ["DELETE", "/comparison"]
];
function checkError(code, reason) { return Object.assign(new Error(reason), { healthCode: code }); }
function failure(error, timeoutMs) {
    if (['TimeoutError', 'AbortError'].includes(error.name) || ['57014', 'ETIMEDOUT'].includes(error.code)) return { code: 'timeout', reason: 'Check exceeded its ' + timeoutMs + ' ms timeout.' };
    if (error.healthCode) return { code: error.healthCode, reason: error.message };
    // Never expose database credentials, internal hosts or arbitrary exception text.
    return { code: 'connection_failed', reason: 'The service connection or query failed.' };
}
export async function measureHealth(check, { timeoutMs = HEALTH_ROUTE_TIMEOUT_MS, slowMs = SLOW_MS } = {}) {
    const start = performance.now();
    try {
        const detail = await check();
        const responseTime = Math.round(performance.now() - start);
        return { status: responseTime > slowMs ? 'slow' : 'healthy', responseTime,
            ...(responseTime > slowMs ? { code: 'slow_response', reason: 'Responded successfully, but exceeded the ' + slowMs + ' ms performance target.' } : {}), ...detail };
    } catch (error) { return { status: 'unhealthy', responseTime: Math.round(performance.now() - start), ...failure(error, timeoutMs) }; }
}
async function checkDatabase() {
    const client = new pg.Client({ ...rawPool.options, connectionTimeoutMillis: DATABASE_TIMEOUT_MS, query_timeout: DATABASE_TIMEOUT_MS, statement_timeout: DATABASE_TIMEOUT_MS });
    try { await client.connect(); await client.query('SELECT 1'); }
    finally { await client.end(); }
}
async function checkUrl(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(HEALTH_ROUTE_TIMEOUT_MS), redirect: 'error' });
    try {
        if (!response.ok) throw checkError('http_error', 'Service returned HTTP ' + response.status + '.');
        try { return await response.json(); }
        catch (error) {
            if (['TimeoutError', 'AbortError'].includes(error.name)) throw error;
            throw checkError('invalid_response', 'Service returned an invalid JSON response.');
        }
    } finally { if (!response.bodyUsed) await response.body?.cancel(); }
}
async function limited(items, work) {
    // Two in-flight HTTP probes instead of five, plus a duplicate catalog request.
    let index = 0;
    async function worker() { while (index < items.length) { const item = items[index++]; await work(item); } }
    await Promise.all(Array.from({ length: Math.min(2, items.length) }, worker));
}
async function probeRoutes(apiUrl) {
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const routes = {}, payloads = {};
    async function probe(path, requestPath = path) {
        routes['GET ' + path] = await measureHealth(async () => {
            const data = await checkUrl(baseUrl + requestPath);
            if (path === '/assessments/questions' && (data.availability?.available !== true || !Array.isArray(data.data) || !data.data.length)) {
                throw checkError('assessment_unavailable', 'Assessment questions or their configuration are unavailable.');
            }
            payloads[path] = data;
        });
    }
    await limited(PUBLIC_ROUTES, path => probe(path, ['/schools', '/programs'].includes(path) ? path + '?limit=1' : path));
    await limited(['/schools', '/programs'], async path => {
        const id = payloads[path]?.data?.[0]?.id;
        if (typeof id === 'string' && id.length) await probe(path + '/:id', path + '/' + encodeURIComponent(id));
        else routes['GET ' + path + '/:id'] = { status: 'skipped', reason: 'No record ID available from the list endpoint.' };
    });
    for (const path of PROTECTED_ROUTES) routes['GET ' + path] = { status: 'skipped', reason: 'Requires an authenticated user and test data.' };
    for (const [method, path] of ACTION_ROUTES) routes[method + ' ' + path] = { status: 'skipped', reason: 'Action routes require isolated integration tests.' };
    for (const path of ['/health', '/health-check']) routes['GET ' + path] = { status: 'skipped', reason: 'Excluded to prevent recursive health checks.' };
    return { routes, payloads };
}
export async function checkAllRoutes(apiUrl) { return (await probeRoutes(apiUrl)).routes; }

export function assessScraping({ lastRun, sources } = {}, now = Date.now()) {
    const enabled = Number(sources?.enabled), failed = Number(sources?.enabledFailed ?? sources?.failed ?? 0);
    const blocked = Number(sources?.blocked ?? 0);
    const checked = Number(lastRun?.sourcesChecked), succeeded = Number(lastRun?.sourcesSucceeded);
    const finishedAt = Date.parse(lastRun?.finishedAt), age = now - finishedAt;
    const maxAgeMs = config.catalogUpdater.intervalHours * 2 * 60 * 60 * 1000;
    if (!(enabled > 0)) return { status: 'warning', code: 'no_enabled_sources', reason: 'No automatic catalog sources are enabled; use verified manual catalog maintenance.' };
    if (!lastRun || !(checked > 0)) return { status: 'warning', code: 'not_checked', reason: 'No recorded catalog collection run is available yet.' };
    if (!Number.isFinite(finishedAt) || age < 0 || age > maxAgeMs) return { status: 'warning', code: 'stale_catalog', reason: 'Catalog collection has no recent finished run; review the collection schedule.' };
    if (succeeded === 0 && lastRun.status === 'failed') {
        return { status: 'unhealthy', code: 'collection_failed', reason: 'The latest catalog run collected none of its ' + checked + ' sources successfully. Review Scraping Management.' };
    }
    if (lastRun.status !== 'completed' || succeeded !== checked || failed > 0) {
        return { status: 'warning', code: blocked > 0 ? 'sources_blocked' : 'partial_collection',
            reason: 'Latest catalog run: ' + succeeded + ' of ' + checked + ' sources succeeded. ' + failed + ' enabled sources need review' + (blocked > 0 ? '; ' + blocked + ' are access-blocked' : '') + '. Existing catalog records remain available.' };
    }
    return { status: 'healthy', reason: 'Latest catalog run: ' + succeeded + ' of ' + checked + ' sources succeeded.' };
}
export async function checkScraping(apiUrl) { return assessScraping(await checkUrl(apiUrl.replace(/\/+$/, '') + '/catalog/status')); }

async function computeSystemHealth(apiUrl) {
    const [database, { routes, payloads }] = await Promise.all([
        measureHealth(checkDatabase, { timeoutMs: DATABASE_TIMEOUT_MS }), probeRoutes(apiUrl)
    ]);
    const assessment = routes['GET /assessments/questions'];
    const catalogRoute = routes['GET /catalog/status'];
    const scraping = catalogRoute.status === 'unhealthy' ? { ...catalogRoute } : {
        ...catalogRoute, ...assessScraping(payloads['/catalog/status'])
    };
    // External collection failures stay visible but do not mean the assessment is offline.
    const unavailable = database.status === 'unhealthy' || Object.entries(routes).some(([name, route]) => name !== 'GET /catalog/status' && route.status === 'unhealthy');
    const degraded = [database, assessment, scraping, ...Object.values(routes)].some(check => ['slow', 'warning', 'unhealthy'].includes(check.status));
    return { status: unavailable ? 'unavailable' : degraded ? 'degraded' : 'ok', database: database.status === 'unhealthy' ? 'disconnected' : 'connected',
        timestamp: new Date().toISOString(), routes, checks: { database, assessment, scraping } };
}
export function clearHealthCache() { healthCache.clear(); }
export async function getSystemHealth(apiUrl) {
    const key = apiUrl.replace(/\/+$/, '');
    const previous = healthCache.get(key);
    if (previous?.pending) return structuredClone(await previous.pending);
    if (previous?.expiresAt > Date.now()) return structuredClone(previous.report);
    if (healthCache.size >= 16 && !healthCache.has(key)) {
        const idle = [...healthCache.entries()].find(([, entry]) => !entry.pending);
        if (idle) healthCache.delete(idle[0]);
    }
    const entry = {};
    entry.pending = computeSystemHealth(key);
    healthCache.set(key, entry);
    try {
        entry.report = await entry.pending;
        entry.expiresAt = Date.now() + (entry.report.status === 'unavailable' ? FAILURE_CACHE_MS : HEALTH_CACHE_MS);
        return structuredClone(entry.report);
    } catch (error) { healthCache.delete(key); throw error; }
    finally { entry.pending = null; }
}
