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
const { validateNameParts } = await import("../src/utils/user-name.js");

const registration = { firstName: "Ana", middleName: "", lastName: "Santos", address: "Taguig City", email: "student@example.com", password: "test-password", confirmPassword: "test-password" };
const user = { user_id: "00000000-0000-4000-8000-000000000099", email: registration.email, full_name: "Ana Santos", first_name: "Ana", middle_name: "", last_name: "Santos", address: "Taguig City", email_verified_at: new Date(), password_hash: null };

async function serverFor(t) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api`;
}

test("each name accepts 20 characters and rejects 21 without truncation", () => {
  const boundary = { firstName: "a".repeat(20), middleName: "b".repeat(20), lastName: "c".repeat(20) };
  assert.equal(validateNameParts(boundary).fullName.length, 62);
  for (const field of ["firstName", "middleName", "lastName"]) {
    assert.throws(() => validateNameParts({ ...boundary, [field]: "a".repeat(21) }), /20 characters/);
  }
});

for (const [label, change, message] of [
  ["long first name", { firstName: "a".repeat(21) }, /First name/],
  ["long middle name", { middleName: "a".repeat(21) }, /Middle name/],
  ["long last name", { lastName: "a".repeat(21) }, /Last name/],
  ["51-character address", { address: "a".repeat(51) }, /5-50/],
  ["41-character email", { email: "a".repeat(29) + "@example.com" }, /40 characters/],
  ["missing password confirmation", { confirmPassword: undefined }, /passwords do not match/],
  ["different password confirmation", { confirmPassword: "different-password" }, /passwords do not match/]
]) {
  test(`registration rejects ${label} before database writes or email delivery`, async t => {
    const base = await serverFor(t);
    const db = t.mock.method(pool, "execute", async () => { throw new Error("Unexpected SQL"); });
    const response = await fetch(base + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...registration, ...change }) });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error.message, message);
    assert.equal(db.mock.callCount(), 0);
  });
}

test("registration accepts the exact name/address/email limits with matching passwords", async t => {
  const base = await serverFor(t);
  const response = await fetch(base + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...registration, firstName: "a".repeat(20), middleName: "b".repeat(20), lastName: "c".repeat(20), address: "d".repeat(50), email: "e".repeat(28) + "@example.com" }) });
  // Email is deliberately off: reaching this check proves input validation passed.
  assert.equal(response.status, 503);
  assert.match((await response.json()).error.message, /email is not configured/);
});

for (const [label, change] of [["first name", { firstName: "a".repeat(21) }], ["middle name", { middleName: "a".repeat(21) }], ["last name", { lastName: "a".repeat(21) }], ["address", { address: "a".repeat(51) }]]) {
  test(`profile rejects an over-limit ${label} without modifying the user`, async t => {
    const base = await serverFor(t);
    t.mock.method(pool, "execute", async sql => { assert.match(sql, /SELECT/); return [[user]]; });
    const response = await fetch(base + "/auth/me", { method: "PATCH", headers: { Authorization: `Bearer ${createAccessToken(user)}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...registration, ...change }) });
    assert.equal(response.status, 400);
  });
}

test("profile saves exact-limit names and address without changing the readonly email", async t => {
  const base = await serverFor(t);
  let updates = 0;
  t.mock.method(pool, "execute", async (sql, values) => {
    if (sql.startsWith("UPDATE")) {
      updates++;
      assert.equal(values[1].length, 20);
      assert.equal(values[2].length, 20);
      assert.equal(values[3].length, 20);
      assert.equal(values[4].length, 50);
      return [{ affectedRows: 1 }];
    }
    return [[user]];
  });
  const response = await fetch(base + "/auth/me", { method: "PATCH", headers: { Authorization: `Bearer ${createAccessToken(user)}`, "Content-Type": "application/json" }, body: JSON.stringify({ firstName: "a".repeat(20), middleName: "b".repeat(20), lastName: "c".repeat(20), address: "d".repeat(50) }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.email, user.email);
  assert.equal(updates, 1);
});
