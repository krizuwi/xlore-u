// Exercise real admin SQL in one rollback-only transaction. No catalog changes,
// browser sessions, or test tokens are retained, and no scraping/email is sent.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import { app } from "../src/app.js";
import { rawPool } from "../src/db/pool.js";
import { createAccessToken } from "../src/utils/security.js";

const connection = await rawPool.connect();
const originalQuery = rawPool.query.bind(rawPool);
const originalConnect = rawPool.connect.bind(rawPool);
let server;
let queryQueue = Promise.resolve();
function serialQuery(sql, values) {
  const result = queryQueue.then(() => connection.query(sql, values));
  queryQueue = result.catch(() => {});
  return result;
}
try {
  await connection.query("BEGIN");
  const { rows: [admin] } = await connection.query(
    "SELECT * FROM users WHERE email = $1 AND is_active AND email_verified_at IS NOT NULL",
    ["unicourse02@gmail.com"]
  );
  assert(admin, "The administrator account must exist and have a verified email.");
  rawPool.query = serialQuery;
  rawPool.connect = async () => ({
    async query(sql, values) {
      if (sql === "BEGIN") return serialQuery("SAVEPOINT admin_check_write");
      if (sql === "COMMIT") return serialQuery("RELEASE SAVEPOINT admin_check_write");
      if (sql === "ROLLBACK") {
        await serialQuery("ROLLBACK TO SAVEPOINT admin_check_write");
        return serialQuery("RELEASE SAVEPOINT admin_check_write");
      }
      return serialQuery(sql, values);
    }, release() {}
  });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = { Authorization: `Bearer ${createAccessToken(admin)}`, "Content-Type": "application/json" };
  async function request(path, method = "GET", body, expected = 200, authenticated = true) {
    const response = await fetch(base + path, { method, headers: authenticated ? headers : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
  await request("/admin/schools", "GET", null, 401, false);
  for (const path of ["schools", "programs", "questions", "settings", "scraping", "logs", "growth"]) {
    await request(`/admin/${path}`);
  }
  const suffix = crypto.randomUUID();
  const school = { name: `Admin smoke school ${suffix}`, type: "Private", city: "Taguig", address: "Test address, Taguig", latitude: 14.5, longitude: 121, website: "https://example.com", description: "Rollback-only verification", status: "Active" };
  const createdSchool = await request("/admin/schools", "POST", school, 201);
  const program = { name: `Admin smoke program ${suffix}`, description: "Rollback-only verification", category: "Computing", degreeLevel: "Bachelor", duration: "4 years", status: "Active", interestTags: ["technology"], careerPaths: ["Developer"], schools: [{ id: createdSchool.id, tuition: 12345 }] };
  const createdProgram = await request("/admin/programs", "POST", program, 201);
  await request(`/admin/programs/${createdProgram.id}`, "PUT", { ...program, description: "Edited test description" });
  await request(`/admin/programs/${createdProgram.id}/category`, "PATCH", { category: "Updated category" });
  const publicProgram = await request(`/programs/${createdProgram.id}`);
  assert.equal(publicProgram.description, "Edited test description");
  assert.equal(publicProgram.category, "Updated category");
  assert.equal(publicProgram.schools[0].tuitionPerSemester, 12345);
  await request(`/admin/schools/${createdSchool.id}`, "PUT", { ...school, description: "Edited university" });
  assert.equal((await request(`/schools/${createdSchool.id}`)).description, "Edited university");
  const question = { prompt: `Rollback question ${suffix}?`, status: "Active", options: [{ id: "a", label: "Technology", scores: { technology: 3 } }, { id: "b", label: "Business", scores: { business: 3 } }] };
  const createdQuestion = await request("/admin/questions", "POST", question, 201);
  await request(`/admin/questions/${createdQuestion.id}`, "PUT", { ...question, prompt: "Updated rollback question?" });
  const bank = await request("/assessments/questions");
  assert(bank.data.some(q => q.id === createdQuestion.id && q.prompt === "Updated rollback question?"));
  assert(bank.data.every(q => q.options.every(o => !Object.hasOwn(o, "scores"))));
  await request(`/admin/questions/${createdQuestion.id}`, "DELETE");
  assert(!(await request("/assessments/questions")).data.some(q => q.id === createdQuestion.id));
  await request("/admin/settings", "PATCH", { workspaceName: "Rollback smoke workspace", frequency: "Manual only", timeout: 12 });
  assert.equal((await request("/admin/settings")).workspaceName, "Rollback smoke workspace");
  const scraping = await request("/admin/scraping");
  if (scraping.sources.length) {
    const source = scraping.sources[0];
    await request(`/admin/scraping/sources/${source.id}`, "PATCH", { enabled: !source.enabled });
    assert.equal((await request("/admin/scraping")).sources.find(s => s.id === source.id).enabled, !source.enabled);
  }
  await request(`/admin/programs/${createdProgram.id}`, "DELETE");
  await request(`/programs/${createdProgram.id}`, "GET", null, 404);
  await request(`/admin/schools/${createdSchool.id}`, "DELETE");
  assert(!(await request(`/schools?search=${encodeURIComponent(school.name)}`)).data.some(s => s.id === createdSchool.id));
  const logs = await request("/admin/logs");
  assert(logs.data.some(log => log.detail === program.name));
  console.log("Admin database smoke passed: protected access, real catalog CRUD, tuition, categories, questions, settings, sources, archives, and audit records.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  rawPool.query = originalQuery;
  rawPool.connect = originalConnect;
  await connection.query("ROLLBACK");
  connection.release();
  await rawPool.end();
  console.log("All smoke-test database changes rolled back; no browser login was created.");
}
