import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import pg from "pg";

// Keep these HTTP integration tests independent of local credentials/services.
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1/test";
process.env.DB_SSL = "disable";
process.env.EMAIL_ENABLED = "false";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://localhost:5173";

const { app } = await import("../src/app.js");
const { pool } = await import("../src/db/pool.js");
const { checkAllRoutes } = await import("../src/utils/api-health-check.js");

for (const path of ["/api/health", "/api/health-check"]) {
  for (const scenario of ["healthy", "database", "assessment", "scraping", "invalid-json", "network-error", "schools"]) {
    test(`${path}: ${scenario}`, async (t) => {
      t.mock.method(pg.Client.prototype, "connect", async () => {
        if (scenario === "database") throw new Error("Database unavailable");
      });
      const query = t.mock.method(pg.Client.prototype, "query", async (sql) => {
        assert.equal(sql, "SELECT 1");
        return { rows: [{ value: 1 }] };
      });
      const end = t.mock.method(pg.Client.prototype, "end", async () => {});
      t.mock.method(pool, "query", async (sql) => {
        if (sql.includes("catalog_update_runs")) {
          return [[{
            status: scenario === "scraping" ? "failed" : "completed",
            sourcesChecked: 1,
            sourcesSucceeded: scenario === "scraping" ? 0 : 1,
            finishedAt: new Date().toISOString()
          }]];
        }
        assert.match(sql, /FROM catalog_sources/);
        return [[{ total: "1", enabled: "1", failed: "0" }]];
      });

      const server = app.listen(0, "127.0.0.1");
      t.after(async () => {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      });
      await once(server, "listening");
      const base = `http://127.0.0.1:${server.address().port}`;
      const realFetch = globalThis.fetch;
      const probes = [];
      t.mock.method(globalThis, "fetch", async (url, options) => {
        probes.push(url);
        assert.ok(options.signal instanceof AbortSignal);
        if (url.includes("/schools") || url.includes("/programs")) {
          return new Response(JSON.stringify({ data: [{ id: "sample-id" }] }), {
            status: scenario === "schools" && url.endsWith("/schools?limit=1") ? 500 : 200
          });
        }
        if (url.endsWith("/assessments/questions")) {
          if (scenario === "assessment") return new Response("{}", { status: 500 });
          if (scenario === "invalid-json") return new Response("invalid JSON");
          if (scenario === "network-error") throw new TypeError("fetch failed");
        }
        return realFetch(url, options);
      });

      const response = await realFetch(`${base}${path}`, {
        // Internal probes must ignore user-controlled host/proxy headers.
        headers: { Host: "untrusted.example", "X-Forwarded-Host": "untrusted.example", Origin: "http://localhost:5173" }
      });
      const body = await response.json();
      const healthy = scenario === "healthy";
      const failedCheck = ["invalid-json", "network-error"].includes(scenario) ? "assessment" : scenario;
      assert.equal(response.status, healthy ? 200 : 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(response.headers.get("content-type"), /application\/json/);
      assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
      assert.equal(body.status, healthy ? "ok" : "unavailable");
      assert.equal(body.database, scenario === "database" ? "disconnected" : "connected");
      assert.ok(Number.isFinite(Date.parse(body.timestamp)));
      assert.deepEqual(Object.keys(body.checks).sort(), ["assessment", "database", "scraping"]);
      for (const [name, check] of Object.entries(body.checks)) {
        assert.equal(check.status, name === failedCheck ? "unhealthy" : "healthy");
        assert.ok(Number.isInteger(check.responseTime) && check.responseTime >= 0);
      }
      assert.equal(body.routes["GET /schools"].status, scenario === "schools" ? "unhealthy" : "healthy");
      assert.equal(body.routes["GET /schools/:id"].status, scenario === "schools" ? "skipped" : "healthy");
      assert.equal(body.routes["GET /programs/:id"].status, "healthy");
      assert.ok(probes.every(url => !url.includes("/health") && !url.includes("/auth")));
      assert.equal(probes.length, scenario === "schools" ? 7 : 8);
      assert.equal(query.mock.callCount(), scenario === "database" ? 0 : 1);
      assert.equal(end.mock.callCount(), 1);
    });
  }
}

test("route inventory skips actions, protected routes, and detail routes without IDs", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push(url);
    assert.equal(options.method ?? "GET", "GET");
    return new Response(JSON.stringify({ data: [] }));
  });
  const routes = await checkAllRoutes("http://localhost/api/");
  assert.equal(requests.length, 5);
  assert.ok(requests.every(url => !url.includes("/api//")));
  for (const key of ["GET /schools/:id", "GET /programs/:id", "GET /auth/me", "GET /dashboard", "POST /auth/register", "DELETE /comparison", "GET /health-check"]) {
    assert.equal(routes[key].status, "skipped");
    assert.ok(routes[key].reason);
  }
});
