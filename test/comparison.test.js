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

const user = { user_id: "00000000-0000-4000-8000-000000000002", email: "student@example.test", address: "Taguig" };
const schools = [
  { id: "far", name: "Far", positionIndex: 1, latitude: "14.5995", longitude: "120.9842", programNames: "Test program" },
  { id: "near", name: "Near", positionIndex: 2, latitude: 14.5176, longitude: 121.0509, programNames: "Test program" },
  { id: "unknown", name: "Unknown", positionIndex: 3, latitude: null, longitude: null, programNames: null }
];

async function serve(t) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api/comparison`;
}

for (const scenario of ["known address", "unknown address", "empty comparison"]) {
  test(`comparison includes honest distance metadata: ${scenario}`, async t => {
    const identity = { ...user, address: scenario === "unknown address" ? "Unknown location" : user.address };
    const queries = [];
    t.mock.method(pool, "execute", async (sql, values) => {
      queries.push(sql);
      if (sql.includes("FROM users")) return [[identity]];
      if (sql.includes("FROM comparison_sets c")) {
        assert.match(sql, /s\.latitude, s\.longitude/);
        assert.deepEqual(values, [identity.user_id, identity.user_id]);
        return [scenario === "empty comparison" ? [] : schools];
      }
      assert.match(sql, /FROM school_programs sp/);
      return [[{ schoolId: "far", id: "program", name: "Test program" }]];
    });
    const response = await fetch(await serve(t), { headers: { Authorization: `Bearer ${createAccessToken(identity)}` } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.maximum, 3);
    if (scenario === "empty comparison") {
      assert.deepEqual(body.schools, []);
      assert.equal(queries.length, 2);
      return;
    }
    assert.deepEqual(body.schools.map(s => s.id), ["far", "near", "unknown"]);
    assert.deepEqual(body.schools[0].programs, ["Test program"]);
    assert.equal(body.schools[0].programOfferings[0].id, "program");
    assert.equal(body.schools[2].distanceKm, null);
    if (scenario === "unknown address") {
      assert.equal(body.locationBasis, null);
      assert.ok(body.schools.every(s => s.distanceKm === null));
    } else {
      assert.deepEqual(body.locationBasis, { area: "Taguig", approximate: true });
      assert.ok(body.schools[0].distanceKm > 0);
      assert.equal(body.schools[1].distanceKm, 0);
      assert.ok(body.schools.every(s => s.distanceArea === "Taguig"));
    }
  });
}

test("comparison distances require authentication before any database access", async t => {
  const query = t.mock.method(pool, "execute", async () => { throw new Error("Unexpected database access"); });
  assert.equal((await fetch(await serve(t))).status, 401);
  assert.equal(query.mock.callCount(), 0);
});
