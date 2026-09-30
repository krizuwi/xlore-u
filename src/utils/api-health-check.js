import pg from "pg";
import { config } from "../config.js";
import { rawPool } from "../db/pool.js";

const TIMEOUT_MS = 3000;

// Explicit inventory: health polling must never submit forms or mutate data.
const PUBLIC_ROUTES = [
    "/schools", "/schools/meta/filters", "/programs",
    "/assessments/questions", "/catalog/status"
];
const PROTECTED_ROUTES = [
    "/auth/me", "/assessments", "/assessments/:id/results",
    "/saved", "/comparison", "/dashboard"
];
const ACTION_ROUTES = [
    ...["register", "verify-email", "forgot-password", "reset-password",
        "resend-verification", "login", "google", "refresh", "logout"]
        .map((path) => ["POST", `/auth/${path}`]),
    ["PATCH", "/auth/me"], ["POST", "/assessments"],
    ["POST", "/schools/:id/visit"],
    ["POST", "/saved/schools/:id"], ["DELETE", "/saved/schools/:id"],
    ["POST", "/saved/programs/:id"], ["DELETE", "/saved/programs/:id"],
    ["PUT", "/comparison/schools"], ["POST", "/comparison/schools/:id"],
    ["DELETE", "/comparison/schools/:id"], ["DELETE", "/comparison"]
];

async function measure(check) {
    const start = performance.now();

    try {
        await check();

        return {
            status: "healthy",
            responseTime: Math.round(performance.now() - start)
        };
    } catch {
        return {
            status: "unhealthy",
            responseTime: Math.round(performance.now() - start)
        };
    }
}

async function checkDatabase() {
    // A dedicated connection lets this probe use short timeouts
    // without changing normal application queries.
    const client = new pg.Client({
        ...rawPool.options,
        connectionTimeoutMillis: TIMEOUT_MS,
        query_timeout: TIMEOUT_MS,
        statement_timeout: TIMEOUT_MS
    });

    try {
        await client.connect();
        await client.query("SELECT 1");
    } finally {
        await client.end();
    }
}

async function checkUrl(url) {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "error"
    });

    try {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // Include reading and parsing the response in the check.
        return await response.json();
    } finally {
        if (!response.bodyUsed) {
            await response.body?.cancel();
        }
    }
}

/**
 * Probe public GET routes; explicitly report routes requiring credentials,
 * writes, or unavailable fixture IDs as skipped. apiUrl includes /api.
 * Healthy means a 2xx response with valid JSON, not full business validation.
 */
export async function checkAllRoutes(apiUrl) {
    const baseUrl = apiUrl.replace(/\/+$/, "");
    const routes = {};
    const payloads = {};

    async function probe(path, requestPath = path) {
        routes[`GET ${path}`] = await measure(async () => {
            payloads[path] = await checkUrl(`${baseUrl}${requestPath}`);
        });
    }

    await Promise.all(PUBLIC_ROUTES.map((path) =>
        probe(path, ["/schools", "/programs"].includes(path) ? `${path}?limit=1` : path)
    ));

    await Promise.all(["/schools", "/programs"].map(async (path) => {
        const id = payloads[path]?.data?.[0]?.id;
        if (typeof id === "string" && id.length > 0) {
            await probe(`${path}/:id`, `${path}/${encodeURIComponent(id)}`);
        } else {
            routes[`GET ${path}/:id`] = {
                status: "skipped",
                reason: "No record ID available from the list endpoint."
            };
        }
    }));

    for (const path of PROTECTED_ROUTES) {
        routes[`GET ${path}`] = { status: "skipped", reason: "Requires an authenticated user and test data." };
    }
    for (const [method, path] of ACTION_ROUTES) {
        routes[`${method} ${path}`] = { status: "skipped", reason: "Action routes require isolated integration tests." };
    }
    for (const path of ["/health", "/health-check"]) {
        routes[`GET ${path}`] = { status: "skipped", reason: "Excluded to prevent recursive health checks." };
    }
    return routes;
}

// Check recorded scraper results without triggering a catalog update.
// Allow two scheduling intervals before treating a successful run as stale.
export async function checkScraping(apiUrl) {
    const { lastRun, sources } = await checkUrl(`${apiUrl}/catalog/status`);
    const finishedAt = Date.parse(lastRun?.finishedAt);
    const maxAgeMs = config.catalogUpdater.intervalHours * 2 * 60 * 60 * 1000;
    const ageMs = Date.now() - finishedAt;

    if (
        !(Number(sources?.enabled) > 0) ||
        lastRun?.status !== "completed" ||
        !(Number(lastRun?.sourcesChecked) > 0) ||
        Number(lastRun?.sourcesSucceeded) !== Number(lastRun?.sourcesChecked) ||
        !Number.isFinite(finishedAt) ||
        ageMs < 0 ||
        ageMs > maxAgeMs
    ) {
        throw new Error("Scraping has no recent successful catalog run.");
    }
}

export async function getSystemHealth(apiUrl) {
    // All checks start together. Each reports its own failure.
    const [database, routes, scraping] = await Promise.all([
        measure(checkDatabase),
        checkAllRoutes(apiUrl),
        measure(() => checkScraping(apiUrl.replace(/\/+$/, "")))
    ]);
    const assessment = routes["GET /assessments/questions"];

    const healthy =
        database.status === "healthy" &&
        assessment.status === "healthy" &&
        scraping.status === "healthy" &&
        Object.values(routes).every((route) => route.status !== "unhealthy");

    return {
        status: healthy ? "ok" : "unavailable",
        database:
            database.status === "healthy" ? "connected" : "disconnected",
        timestamp: new Date().toISOString(),
        routes,
        checks: {
            database,
            assessment,
            scraping
        }
    };
}
