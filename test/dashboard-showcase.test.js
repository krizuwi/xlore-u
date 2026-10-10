import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

process.env.DATABASE_URL = "postgres://test:test@127.0.0.1/test";
process.env.DB_SSL = "disable";
process.env.EMAIL_ENABLED = "false";
process.env.NODE_ENV = "test";
const { app } = await import("../src/app.js");
const { pool } = await import("../src/db/pool.js");
const { createAccessToken } = await import("../src/utils/security.js");
const { FEATURED_UP_DILIMAN_ID } = await import("../src/services/dashboard-showcase.js");
const user = { user_id: "00000000-0000-4000-8000-000000000002", email: "student@example.test", full_name: "Student", address: "Taguig" };

async function serve(t) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api/dashboard`;
}

for (const hasAssessment of [true, false]) {
  test(`dashboard serves scoped, active highlights with latest assessment = ${hasAssessment}`, async t => {
    const queries = [];
    const photo = { url: "https://example.test/campus.jpg", credit: "Owner", license: "CC BY-SA 4.0" };
    t.mock.method(pool, "execute", async (sql, values) => {
      queries.push(sql);
      if (sql.includes("FROM users")) return [[user]];
      if (sql.includes("COUNT(*)")) return [[{ count: 1 }]];
      if (sql.includes("FROM assessments a")) {
        assert.deepEqual(values, [user.user_id]);
        return [hasAssessment ? [{ assessmentId: "latest", primaryDirection: "Technology" }] : []];
      }
      if (sql.includes("visit_count")) return [[]];
      assert.match(sql, /is_active_available = TRUE/);
      assert.match(sql, /s\.campus_photos AS "campusPhotos"/);
      if (sql.includes("FROM user_school_visits")) {
        assert.deepEqual(values, [user.user_id]);
        assert.match(sql, /ORDER BY usv\.last_visited_at DESC/);
        assert.doesNotMatch(sql, /ORDER BY usv\.visit_count/);
        return [[{ id: "recent", name: "Recently viewed", campusPhotos: [photo] }]];
      }
      if (sql.includes("ORDER BY md5")) {
        assert.deepEqual(values, [user.user_id]);
        assert.match(sql, /CURRENT_DATE/);
        assert.match(sql, /jsonb_array_length/);
        return [[{ id: "random", name: "Discovery", campusPhotos: [photo] }]];
      }
      if (sql.includes("s.school_id = ?")) {
        assert.deepEqual(values, [FEATURED_UP_DILIMAN_ID]);
        return [[{ id: FEATURED_UP_DILIMAN_ID, name: "UP Diliman", campusPhotos: [photo] }]];
      }
      assert.match(sql, /FROM recommended_programs rp/);
      assert.deepEqual(values, ["latest", user.user_id]);
      assert.match(sql, /p.is_active = TRUE/);
      return [[{ id: "far", name: "Far", latitude: 14.5995, longitude: 120.9842, matchScore: 95 },
        { id: "near", name: "Near", latitude: 14.5176, longitude: 121.0509, matchScore: 70 }]];
    });
    const response = await fetch(await serve(t), { headers: { Authorization: `Bearer ${createAccessToken(user)}` } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.showcase.recentSchools[0].id, "recent");
    assert.deepEqual(body.showcase.discoverySchools[0].campusPhotos, [photo]);
    assert.equal(body.showcase.featuredSchool.id, FEATURED_UP_DILIMAN_ID);
    assert.equal(body.counts.savedSchools, 1);
    assert.deepEqual(body.showcase.recommendedSchools.map(s => s.id), hasAssessment ? ["near", "far"] : []);
    assert.equal(queries.filter(sql => sql.includes("FROM recommended_programs rp")).length, hasAssessment ? 1 : 0);
  });
}

test("dashboard requires authentication before accessing browsing or assessment records", async t => {
  const query = t.mock.method(pool, "execute", async () => { throw new Error("Unexpected DB access"); });
  assert.equal((await fetch(await serve(t))).status, 401);
  assert.equal(query.mock.callCount(), 0);
});

test("empty school data returns null featured school and empty highlight groups", async t => {
  t.mock.method(pool, "execute", async sql => {
    if (sql.includes("FROM users")) return [[user]];
    if (sql.includes("COUNT(*)")) return [[{ count: 0 }]];
    return [[]];
  });
  const response = await fetch(await serve(t), { headers: { Authorization: `Bearer ${createAccessToken(user)}` } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).showcase, { recentSchools: [], discoverySchools: [], featuredSchool: null, recommendedSchools: [] });
});
