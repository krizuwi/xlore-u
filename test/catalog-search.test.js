import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { programSearch, schoolSearch } from "../src/utils/catalog-search.js";

process.env.DATABASE_URL = "postgres://test:test@127.0.0.1/test";
process.env.DB_SSL = "disable";
process.env.EMAIL_ENABLED = "false";
process.env.NODE_ENV = "test";
const { app } = await import("../src/app.js");
const { pool } = await import("../src/db/pool.js");

async function serve(t) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api`;
}

for (const [name, compile] of [["schools", schoolSearch], ["programs", programSearch]]) {
  test(`${name} binds keywords, matches every group and scopes related records`, () => {
    const search = compile("BSIT Manila");
    assert.equal((search.condition.match(/\?/g) ?? []).length, search.values.length);
    assert.equal((search.order.match(/\?/g) ?? []).length, search.orderValues.length);
    assert.ok(search.values.includes("% information technology%"));
    assert.ok(search.values.includes("% manila%"));
    assert.match(search.condition, / AND /);
    assert.match(search.condition, /EXISTS/);
    assert.doesNotMatch(search.condition, /BSIT|Manila/);
    assert.match(search.condition, name === "schools" ? /px\.is_active = TRUE/ : /ax\.is_active_available = TRUE/);
    const fullName = compile("Manila BSIT University of the Philippines");
    assert.ok(fullName.values.includes("% university of the philippines%"));
    assert.ok(fullName.values.includes("% manila%"));
    assert.equal(compile("   ").condition, "");
    assert.match(compile("%__").condition, /FALSE/);
    assert.throws(() => compile("a".repeat(201)), error => error.status === 400);
    assert.throws(() => compile(Array.from({ length: 13 }, (_, i) => `term${i}`).join(" ")), error => error.status === 400);
  });

  test(`${name} API preserves filters, totals, pagination and relevance bindings`, async t => {
    const queries = [];
    t.mock.method(pool, "execute", async (sql, values) => {
      queries.push({ sql, values });
      assert.equal((sql.match(/\?/g) ?? []).length, values.length);
      if (sql.includes(" AS total")) return [[{ total: 14, lastSyncAt: null }]];
      return [[{ id: "sample", name: "Sample", programNames: "BS Information Technology" }]];
    });
    const suffix = name === "schools" ? "&city=Manila&schoolType=Public" : "&category=Technology&degreeLevel=Bachelor";
    const response = await fetch(`${await serve(t)}/${name}?search=BSIT%20Manila&page=2&limit=8${suffix}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.pagination, { page: 2, limit: 8, total: 14, pages: 2 });
    assert.equal(body.data[0].id, "sample");
    assert.equal(queries.length, 2);
    assert.doesNotMatch(queries[0].sql, /CASE WHEN/);
    assert.match(queries[1].sql, /ORDER BY CASE WHEN/);
    assert.match(queries[1].sql, /LIMIT 8 OFFSET 8/);
    assert.ok(queries[0].values.includes(name === "schools" ? "Public" : "Technology"));
  });
}

test("an explicitly chosen school sort takes priority over relevance", async t => {
  t.mock.method(pool, "execute", async (sql, values) => {
    assert.equal((sql.match(/\?/g) ?? []).length, values.length);
    assert.doesNotMatch(sql, /CASE WHEN/);
    if (sql.includes(" AS total")) return [[{ total: 0 }]];
    assert.match(sql, /ORDER BY s\.google_rating DESC/);
    return [[]];
  });
  const response = await fetch(`${await serve(t)}/schools?search=PUP&sort=rating`);
  assert.equal(response.status, 200);
});

test("invalid search is rejected before any database access", async t => {
  t.mock.method(pool, "execute", () => { throw new Error("Database must not be queried"); });
  const response = await fetch(`${await serve(t)}/programs?search=${"a".repeat(201)}`);
  assert.equal(response.status, 400);
});
