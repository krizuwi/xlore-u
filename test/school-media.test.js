import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { validateSchoolMedia } from "../src/services/school-media.js";
import { schoolMediaPresets } from "../src/data/school-media-presets.js";
import { validateImageUpload } from "../src/services/media-upload.js";

process.env.DATABASE_URL = "postgres://test:test@127.0.0.1/test";
process.env.DB_SSL = "disable";
process.env.EMAIL_ENABLED = "false";
process.env.NODE_ENV = "test";
const { app } = await import("../src/app.js");
const { pool, rawPool } = await import("../src/db/pool.js");
const { createAccessToken } = await import("../src/utils/security.js");
const admin = { user_id: "00000000-0000-4000-8000-000000000001", email: "unicourse02@gmail.com", email_verified_at: new Date() };
const item = { name: "Example School", type: "Public", city: "Manila", address: "Campus address", latitude: 14.5, longitude: 121, status: "Active", website: "https://example.edu/" };
const media = { logoUrl: "https://example.edu/logo.png", logoCredit: { credit: "School", sourceUrl: "https://example.edu/" }, campusPhotos: [{ url: "https://example.edu/campus.jpg", caption: "Campus", credit: "Photographer", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" }] };

test("nine schools have logos and credits; STI photos are left for the team", () => {
  assert.equal(schoolMediaPresets.length, 9);
  assert.equal(new Set(schoolMediaPresets.map(s => s.id)).size, 9);
  for (const school of schoolMediaPresets) {
    const validated = validateSchoolMedia(school);
    assert.equal(validated.campusPhotos.length, school.name === "STI College Global City" ? 0 : 2);
    assert(validated.logoUrl && validated.logoCredit.sourceUrl);
    for (const photo of validated.campusPhotos) assert(photo.caption && photo.credit && photo.sourceUrl && photo.license);
  }
});
test("media allows deliberate removal and preserves photo order", () => {
  assert.deepEqual(validateSchoolMedia({ logoUrl: "", campusPhotos: [] }).campusPhotos, []);
  assert.equal(validateSchoolMedia({ logoUrl: "", campusPhotos: [] }).logoUrl, null);
  const next = { ...media, campusPhotos: [...media.campusPhotos, { url: "https://example.edu/library.jpg" }] };
  assert.deepEqual(validateSchoolMedia(next).campusPhotos.map(p => p.url), next.campusPhotos.map(p => p.url));
});
test("media rejects executable URLs, insecure URLs, credentials, malformed records and duplicates", () => {
  for (const logoUrl of ["javascript:alert(1)", "http://example.edu/logo.png", "https://user:password@example.edu/logo.png", "bad-url", {}]) assert.throws(() => validateSchoolMedia({ ...media, logoUrl }));
  for (const campusPhotos of [null, "photos", [null], [{ url: "" }], [...media.campusPhotos, ...media.campusPhotos], Array.from({ length: 11 }, (_, i) => ({ url: `https://example.edu/${i}.jpg` }))]) assert.throws(() => validateSchoolMedia({ ...media, campusPhotos }));
  assert.throws(() => validateSchoolMedia({ ...media, campusPhotos: [{ ...media.campusPhotos[0], sourceUrl: "javascript:alert(1)" }] }));
  assert.throws(() => validateSchoolMedia({ ...media, campusPhotos: [{ ...media.campusPhotos[0], caption: "x".repeat(201) }] }));
});

async function serverFor(t) {
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api`;
}
function mockSave(t, user = admin) {
  t.mock.method(pool, "execute", async () => [[user]]);
  const calls = [];
  t.mock.method(rawPool, "connect", async () => ({ query: async (sql, values) => {
    calls.push({ sql, values }); return { command: "UPDATE", rowCount: 1, rows: [] };
  }, release() {} }));
  return calls;
}
const headers = () => ({ Authorization: `Bearer ${createAccessToken(admin)}`, "Content-Type": "application/json" });
const schoolId = schoolMediaPresets[0].id;
test("administrator media changes save with school details and audit in one transaction", async t => {
  const base = await serverFor(t), calls = mockSave(t);
  const response = await fetch(`${base}/admin/schools/${schoolId}`, { method: "PUT", headers: headers(), body: JSON.stringify({ ...item, media }) });
  assert.equal(response.status, 200);
  const write = calls.find(c => c.sql.includes("SET logo_url"));
  assert.equal(write.values[0], media.logoUrl);
  assert.equal(JSON.parse(write.values[2])[0].caption, "Campus");
  assert(calls.some(c => c.sql.includes("INSERT INTO admin_audit_log")));
  assert.equal(calls.at(-1).sql, "COMMIT");
});
test("an older school-details edit without media leaves existing images untouched", async t => {
  const base = await serverFor(t), calls = mockSave(t);
  assert.equal((await fetch(`${base}/admin/schools/${schoolId}`, { method: "PUT", headers: headers(), body: JSON.stringify(item) })).status, 200);
  assert(!calls.some(c => c.sql.includes("SET logo_url")));
});
test("students cannot change media and invalid media is rejected before database writes", async t => {
  const base = await serverFor(t), calls = mockSave(t, { ...admin, email: "student@example.com" });
  assert.equal((await fetch(`${base}/admin/schools/${schoolId}`, { method: "PUT", headers: headers(), body: JSON.stringify({ ...item, media }) })).status, 403);
  assert.equal(calls.length, 0);
});
test("invalid admin image URLs are rejected before any transaction begins", async t => {
  const base = await serverFor(t), calls = mockSave(t);
  assert.equal((await fetch(`${base}/admin/schools/${schoolId}`, { method: "PUT", headers: headers(), body: JSON.stringify({ ...item, media: { ...media, logoUrl: "javascript:alert(1)" } }) })).status, 400);
  assert.equal(calls.length, 0);
});
test("image uploads reject unsupported, oversized or non-binary files", () => {
  assert.equal(validateImageUpload(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])), "image/png");
  assert.equal(validateImageUpload(Buffer.from([255,216,255,0,0,0,0,0,0,0,0,0])), "image/jpeg");
  assert.equal(validateImageUpload(Buffer.from("RIFF0000WEBP")), "image/webp");
  for (const value of [Buffer.from("<svg>bad</svg>"), Buffer.from("<script>bad</script>"), Buffer.alloc(5 * 1024 * 1024 + 1), "image", null]) assert.throws(() => validateImageUpload(value));
  assert.equal(validateSchoolMedia({ ...media, logoUrl: `/api/school-media/${schoolId}` }).logoUrl, `/api/school-media/${schoolId}`);
  for (const value of ["/evil.svg", "/api/school-media/../../secrets", "//evil.example/image.png"]) assert.throws(() => validateSchoolMedia({ ...media, logoUrl: value }));
});
test("administrator can upload an image, with typed bytes and an audit entry", async t => {
  const base = await serverFor(t); t.mock.method(pool, "execute", async () => [[admin]]);
  const calls = [];
  t.mock.method(rawPool, "connect", async () => ({ query: async (sql, values) => {
    calls.push({ sql, values }); return { command: sql.includes("SELECT school_id") ? "SELECT" : "INSERT", rowCount: 1, rows: sql.includes("SELECT school_id") ? [{ school_id: schoolId }] : [] };
  }, release() {} }));
  const response = await fetch(`${base}/admin/schools/${schoolId}/media/assets`, { method: "POST", headers: { ...headers(), "Content-Type": "image/png" }, body: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]) });
  assert.equal(response.status, 201);
  assert.match((await response.json()).url, /^\/api\/school-media\/[0-9a-f-]+$/);
  assert(calls.some(c => c.sql.includes("INSERT INTO school_media_assets") && c.values[2] === "image/png" && Buffer.isBuffer(c.values[3])));
  assert(calls.some(c => c.sql.includes("INSERT INTO admin_audit_log")));
});
test("public school images use the stored type, immutable caching and public embedding", async t => {
  const base = await serverFor(t);
  t.mock.method(pool, "execute", async sql => {
    assert.match(sql, /FROM school_media_assets/);
    return [[{ content_type: "image/png", image_data: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]) }]];
  });
  const response = await fetch(`${base}/school-media/${schoolId}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^image\/png/);
  assert.equal(response.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("cache-control"), /immutable/);
});
