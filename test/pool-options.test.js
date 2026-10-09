import test from "node:test";
import assert from "node:assert/strict";
import { createPoolOptions, transactionPoolerUrl } from "../src/db/pool-options.js";

const db = { connectionString: "postgres://test:test@localhost/db", poolMax: 5, idleTimeoutMs: 30000, connectTimeoutMs: 10000, sslMode: "require" };

test("persistent/local servers preserve their pool settings", () => {
  const options = createPoolOptions(db);
  assert.equal(options.max, 5);
  assert.equal(options.idleTimeoutMillis, 30000);
  assert.equal(options.connectionTimeoutMillis, 10000);
  assert.equal(options.allowExitOnIdle, undefined);
  assert.equal(options.maxLifetimeSeconds, undefined);
});

test("Vercel caps oversized pools and releases idle connections promptly", () => {
  const options = createPoolOptions(db, { serverless: true });
  assert.equal(options.max, 2);
  assert.equal(options.idleTimeoutMillis, 1000);
  assert.equal(options.maxLifetimeSeconds, 60);
  assert.equal(options.allowExitOnIdle, true);
  assert.equal(createPoolOptions({ ...db, poolMax: 1, idleTimeoutMs: 500 }, { serverless: true }).max, 1);
  assert.equal(createPoolOptions({ ...db, poolMax: 1, idleTimeoutMs: 500 }, { serverless: true }).idleTimeoutMillis, 500);
});

test("serverless tuning preserves the existing TLS verification policy", () => {
  for (const serverless of [false, true]) {
    assert.deepEqual(createPoolOptions(db, { serverless }).ssl, { rejectUnauthorized: false });
    assert.deepEqual(createPoolOptions({ ...db, sslMode: "verify-full", sslCa: "provider-ca" }, { serverless }).ssl, { rejectUnauthorized: true, ca: "provider-ca" });
    assert.equal(createPoolOptions({ ...db, sslMode: "disable" }, { serverless }).ssl, false);
  }
});

test("transaction pooling changes only the known Supabase port", () => {
  const original = new URL("postgresql://postgres.example:test%40pass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require");
  const target = new URL(transactionPoolerUrl(original.toString()));
  assert.equal(target.port, "6543");
  for (const field of ["protocol", "hostname", "username", "password", "pathname", "search"]) assert.equal(target[field], original[field]);
  assert.equal(transactionPoolerUrl(target.toString()), target.toString());
});

test("pooler conversion rejects direct or unrelated database endpoints", () => {
  for (const url of ["postgres://test:test@localhost:5432/db", "postgres://test:test@db.example.supabase.co:5432/postgres", "postgres://test:test@aws.pooler.supabase.com.evil.test:5432/db", "https://aws.pooler.supabase.com:5432/db", "postgres://test:test@aws.pooler.supabase.com:1234/db"]) {
    assert.throws(() => transactionPoolerUrl(url), /Expected an existing Supabase/);
  }
});
