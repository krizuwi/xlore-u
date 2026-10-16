import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import bcrypt from "bcryptjs";

process.env.DATABASE_URL = "postgres://test:test@127.0.0.1/test";
process.env.DB_SSL = "disable";
process.env.EMAIL_ENABLED = "false";
process.env.NODE_ENV = "test";
process.env.GOOGLE_CLIENT_ID = "admin-test-client";
const { app } = await import("../src/app.js");
const { pool, rawPool } = await import("../src/db/pool.js");
const { createAccessToken } = await import("../src/utils/security.js");
const { validateProgram, validateQuestion, validateSchool } = await import("../src/services/admin-validation.js");
const { scoreAssessment } = await import("../src/services/recommendation.js");
const { isAdminUser } = await import("../src/utils/admin-access.js");
const { googleClient } = await import("../src/services/google-auth.js");

const admin = { user_id: "00000000-0000-4000-8000-000000000001", email: "unicourse02@gmail.com", email_verified_at: new Date(), full_name: "Administrator" };
const programId = "30000000-0000-4000-8000-000000000001";
const schoolId = "40000000-0000-4000-8000-000000000001";
const program = { name: "Test program", description: "A program description", category: "Computing", degreeLevel: "Bachelor", status: "Active", careerPaths: ["Developer"], interestTags: ["technology"], schools: [{ id: schoolId, tuition: 12500 }] };

async function serverFor(t) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api`;
}
function mockIdentity(t, user) {
  return t.mock.method(pool, "execute", async (sql) => {
    assert.match(sql, /FROM users/);
    return [[user]];
  });
}
function headers() { return { Authorization: `Bearer ${createAccessToken(admin)}`, "Content-Type": "application/json" }; }

test("only the exact verified administrator email grants access", () => {
  assert.equal(isAdminUser(admin), true);
  assert.equal(isAdminUser({ ...admin, email: " UniCourse02@Gmail.com " }), true);
  assert.equal(isAdminUser({ ...admin, email_verified_at: null }), false);
  assert.equal(isAdminUser({ ...admin, email: "student@gmail.com", role: "admin" }), false);
  assert.equal(isAdminUser({ ...admin, email: "unicourse02+other@gmail.com" }), false);
});

test("all admin endpoints reject requests without a session before any database writes", async t => {
  const base = await serverFor(t);
  const db = t.mock.method(pool, "execute", async () => { throw new Error("Unexpected SQL"); });
  for (const [method, path] of [["GET", "/admin/schools"], ["GET", "/admin/scraping/runs"], ["PATCH", "/admin/settings"], ["DELETE", `/admin/programs/${programId}`], ["POST", "/admin/scraping/run"]]) {
    const response = await fetch(base + path, { method });
    assert.equal(response.status, 401);
  }
  assert.equal(db.mock.callCount(), 0);
});

test("finished scraper results include each source's returned items and errors", async t => {
  const base = await serverFor(t);
  mockIdentity(t, admin);
  const runId = "50000000-0000-4000-8000-000000000001";
  const calls = [];
  t.mock.method(pool, "query", async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("AS finished")) return [[{ finished: 1, successful: 0, issues: 1 }]];
    if (sql.includes("AS total")) return [[{ total: 1 }]];
    if (sql.includes("FROM catalog_run_source_results")) return [[{ sourceId: "source-1", school: "Example University", status: "success", returnedItems: [{ title: "BS Computer Science" }] }]];
    if (sql.includes("FROM catalog_change_log")) return [[{ id: "change-1", action: "insert" }]];
    return [[{ id: runId, mode: "hybrid", status: "partial", sourcesChecked: 2, sourcesSucceeded: 1, records: 1, changes: 1 }]];
  });
  const list = await fetch(`${base}/admin/scraping/runs`, { headers: headers() });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).runs[0].status, "partial");
  const detail = await fetch(`${base}/admin/scraping/runs/${runId}`, { headers: headers() });
  assert.equal(detail.status, 200);
  const body = await detail.json();
  assert.equal(body.run.mode, "hybrid");
  assert.equal(body.sources[0].returnedItems[0].title, "BS Computer Science");
  assert.equal(body.changes.length, 1);
  assert.ok(calls.slice(3).every(call => call.params[0] === runId));
});

test("scraper results can be scoped to a university", async t => {
  const base = await serverFor(t);
  mockIdentity(t, admin);
  const runId = "50000000-0000-4000-8000-000000000001";
  const calls = [];
  t.mock.method(pool, "query", async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("AS finished")) return [[{ finished: 1, successful: 1, issues: 0 }]];
    if (sql.includes("AS total")) return [[{ total: 1 }]];
    if (sql.includes("FROM catalog_run_source_results WHERE")) return [[{ sourceId: "source-1", school: "Example University", returnedItems: [] }]];
    if (sql.includes("FROM catalog_change_log")) return [[]];
    return [[{ id: runId, status: "completed" }]];
  });
  const list = await fetch(`${base}/admin/scraping/runs?schoolId=${schoolId}`, { headers: headers() });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).runs.length, 1);
  assert.match(calls[0].sql, /EXISTS \(SELECT 1 FROM catalog_run_source_results/);
  assert.deepEqual(calls[0].params, [schoolId]);
  const detail = await fetch(`${base}/admin/scraping/runs/${runId}?schoolId=${schoolId}`, { headers: headers() });
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).sources.length, 1);
  assert.deepEqual(calls[4].params, [runId, schoolId]);
  assert.deepEqual(calls[5].params, [runId, schoolId]);
});

test("collection history pages through filtered runs in groups of 15", async t => {
  const base = await serverFor(t);
  mockIdentity(t, admin);
  const calls = [];
  t.mock.method(pool, "query", async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("AS finished")) return [[{ finished: 41, successful: 30, issues: 11 }]];
    if (sql.includes("AS total")) return [[{ total: 17 }]];
    return [Array.from({ length: 2 }, (_, index) => ({ id: `run-${index}`, status: "failed" }))];
  });
  const response = await fetch(`${base}/admin/scraping/runs?schoolId=${schoolId}&page=2&status=issues&search=timeout`, { headers: headers() });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual({ page: body.page, pageSize: body.pageSize, total: body.total, totalPages: body.totalPages },
    { page: 2, pageSize: 15, total: 17, totalPages: 2 });
  assert.equal(body.summary.finished, 41);
  assert.equal(body.runs.length, 2);
  assert.match(calls[1].sql, /r.status IN \('partial', 'failed'\)/);
  assert.match(calls[1].sql, /ILIKE/);
  assert.deepEqual(calls[2].params, [schoolId, "%timeout%", "%timeout%", "%timeout%", 15, 15]);
});

test("adding sources reuses an existing university and enables its profile and program catalog", async t => {
  const base = await serverFor(t);
  mockIdentity(t, admin);
  const calls = [];
  t.mock.method(rawPool, "connect", async () => ({
    query: async (sql, values = []) => {
      calls.push({ sql, values });
      if (sql.includes("FROM schools WHERE school_id")) return { command: "SELECT", rows: [{ school_name: "Example Technical University", official_website_url: "https://www.example.edu.ph" }] };
      return { command: "INSERT", rowCount: 1, rows: [] };
    }, release() {}
  }));
  const programUrl = "https://catalog.example.edu.ph/programs";
  const response = await fetch(`${base}/admin/scraping/sources`, {
    method: "POST", headers: headers(), body: JSON.stringify({ schoolId, programUrl })
  });
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  const body = await response.json();
  assert.equal(body.schoolId, schoolId);
  const sourceInserts = calls.filter(call => call.sql.includes("INSERT INTO catalog_sources"));
  assert.equal(sourceInserts.length, 2);
  assert.deepEqual(sourceInserts.map(call => call.values.slice(1, 5)), [
    ["school_profile", "School profile", "https://www.example.edu.ph", "example.edu.ph"],
    ["program_catalog", "Program catalog", programUrl, "example.edu.ph"]
  ]);
  assert.ok(sourceInserts.every(call => call.sql.includes("source_type, name, source_url")));
  assert.ok(sourceInserts.every(call => call.sql.includes("ON CONFLICT (school_id, source_type, source_url) DO UPDATE")));
  assert.ok(!calls.some(call => call.sql.includes("INSERT INTO schools") || call.sql.includes("INSERT INTO available_schools")));
  assert.equal(calls.at(-1).sql, "COMMIT");
});

test("university sources reject a catalog on another domain", async t => {
  const base = await serverFor(t);
  mockIdentity(t, admin);
  const calls = [];
  t.mock.method(rawPool, "connect", async () => ({
    query: async sql => {
      calls.push(sql);
      if (sql.includes("FROM schools WHERE school_id")) return { command: "SELECT", rows: [{ school_name: "Example University", official_website_url: "https://example.edu.ph" }] };
      return { command: "INSERT", rowCount: 1, rows: [] };
    }, release() {}
  }));
  const response = await fetch(`${base}/admin/scraping/sources`, {
    method: "POST", headers: headers(), body: JSON.stringify({ schoolId, programUrl: "https://another.edu.ph/programs" })
  });
  assert.equal(response.status, 400);
  assert.ok(calls.includes("ROLLBACK"));
  assert.ok(!calls.some(sql => sql.includes("INSERT INTO catalog_sources")));
});

test("a valid student token cannot impersonate the admin using request data", async t => {
  const base = await serverFor(t);
  mockIdentity(t, { ...admin, email: "student@gmail.com" });
  const response = await fetch(base + "/admin/programs", { method: "POST", headers: headers(), body: JSON.stringify({ ...program, email: admin.email, role: "admin" }) });
  assert.equal(response.status, 403);
});

test("an unverified allowed email has no admin access", async t => {
  const base = await serverFor(t);
  mockIdentity(t, { ...admin, email_verified_at: null });
  assert.equal((await fetch(base + "/admin/settings", { headers: headers() })).status, 403);
});

test("dedicated admin login rejects a non-admin with a correct password", async t => {
  const base = await serverFor(t);
  mockIdentity(t, { ...admin, email: "student@gmail.com", password_hash: await bcrypt.hash("test-password", 4) });
  const response = await fetch(base + "/auth/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "student@gmail.com", password: "test-password" }) });
  assert.equal(response.status, 403);
});

test("an authorized program edit saves canonical fields, school tuition, and its audit record atomically", async t => {
  const base = await serverFor(t);
  mockIdentity(t, admin);
  const calls = [];
  t.mock.method(rawPool, "connect", async () => ({
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes("SELECT school_id FROM school_programs")) return { command: "SELECT", rows: [] };
      if (sql.includes("SELECT school_id FROM schools")) return { command: "SELECT", rows: [{ school_id: schoolId }] };
      return { command: sql.startsWith("UPDATE") ? "UPDATE" : "INSERT", rowCount: 1, rows: [] };
    }, release() {}
  }));
  const response = await fetch(`${base}/admin/programs/${programId}`, { method: "PUT", headers: headers(), body: JSON.stringify(program) });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.ok(calls.some(c => c.sql.includes("UPDATE programs") && c.values.includes(program.name)));
  assert.ok(calls.some(c => c.sql.includes("INSERT INTO school_programs") && c.values.includes(12500)));
  assert.ok(calls.some(c => c.sql.includes("INSERT INTO admin_audit_log") && c.values[0] === admin.user_id));
  assert.equal(calls.at(-1).sql, "COMMIT");
});

test("archiving the last active question rolls back", async t => {
  const base = await serverFor(t); mockIdentity(t, admin);
  const calls = [];
  t.mock.method(rawPool, "connect", async () => ({ query: async sql => {
    calls.push(sql);
    return sql.includes("FROM assessment_questions") && sql.startsWith('SELECT') ? { command: "SELECT", rows: [] } : { command: "UPDATE", rowCount: 1, rows: [] };
  }, release() {} }));
  const response = await fetch(base + "/admin/questions/interests", { method: "DELETE", headers: headers() });
  assert.equal(response.status, 400);
  assert.equal(calls.at(-1), "ROLLBACK");
});

test("invalid tuition, malformed URLs, and invalid score mappings are rejected", () => {
  assert.throws(() => validateProgram({ ...program, schools: [{ id: schoolId, tuition: -1 }] }), /Tuition/);
  assert.throws(() => validateProgram({ ...program, schools: [null] }), /offering/);
  assert.throws(() => validateSchool({ name: "School", type: "Public", city: "Manila", address: "Address", latitude: 14, longitude: 120, website: "javascript:alert(1)" }), /HTTP/);
  const question = { prompt: "A question?", status: "Active", options: [{ id: "a", label: "First", scores: { technology: 3 } }, { id: "b", label: "Second", scores: { business: 3 } }] };
  assert.throws(() => validateQuestion({ ...question, options: [{ ...question.options[0], scores: { bogus: 3 } }, question.options[1]] }), /valid interest weights/);
  assert.throws(() => validateQuestion({ ...question, options: [null, question.options[1]] }), /answer must/);
  const saved = validateQuestion(question);
  const result = scoreAssessment([{ questionId: "custom", optionId: "a" }], [{ ...saved, id: "custom" }]);
  assert.equal(result.primaryDirection, "Technology and Computing");
});

test("verified administrator password login creates a session and returns the admin role", async t => {
  const base = await serverFor(t);
  mockIdentity(t, { ...admin, password_hash: await bcrypt.hash("test-admin-password", 4) });
  const calls = [];
  t.mock.method(rawPool, "connect", async () => ({
    query: async (sql, values) => { calls.push({ sql, values }); return { command: "INSERT", rowCount: 1, rows: [] }; },
    release() {}
  }));
  const response = await fetch(base + "/auth/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: admin.email, password: "test-admin-password" }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.user.role, "admin");
  assert.equal(body.user.emailVerified, true);
  assert(body.accessToken && body.refreshToken);
  assert(calls.some(c => c.sql.includes("INSERT INTO user_sessions")));
  assert.equal(calls.at(-1).sql, "COMMIT");
});

test("Google admin login rejects other accounts before creating any account or session", async t => {
  const base = await serverFor(t);
  t.mock.method(googleClient, "verifyIdToken", async () => ({ getPayload: () => ({ sub: "google-test", email: "student@gmail.com", email_verified: true }) }));
  const db = t.mock.method(rawPool, "connect", async () => { throw new Error("Unexpected database write"); });
  const response = await fetch(base + "/auth/admin/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: "verified-in-test" }) });
  assert.equal(response.status, 403);
  assert.equal(db.mock.callCount(), 0);
});

test("verified administrator Google login creates an admin session", async t => {
  const base = await serverFor(t);
  t.mock.method(googleClient, "verifyIdToken", async () => ({ getPayload: () => ({ sub: "google-admin-test", email: admin.email, email_verified: true, given_name: "Admin", family_name: "User" }) }));
  const calls = [];
  t.mock.method(rawPool, "connect", async () => ({
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes("SELECT * FROM users")) return { command: "SELECT", rows: [{ ...admin, is_active: true }] };
      return { command: "INSERT", rowCount: 1, rows: [] };
    }, release() {}
  }));
  const response = await fetch(base + "/auth/admin/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: "verified-in-test" }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.user.role, "admin");
  assert(body.accessToken && body.refreshToken);
  assert.equal(calls.at(-1).sql, "COMMIT");
});
