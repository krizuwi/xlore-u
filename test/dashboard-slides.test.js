import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardSlides, DASHBOARD_SLIDE_MS, RANKING_SOURCE } from "../src/lib/dashboard-slides.js";

const school = id => ({ id, name: `School ${id}`, city: "Manila", campusPhotos: [{ url: `https://example.test/${id}.jpg`, credit: "Photographer" }] });
const latest = { assessmentId: "latest" };

test("new students get an assessment CTA using an honestly identified campus background", () => {
  const discovery = school("random");
  const slides = buildDashboardSlides({ discoverySchools: [discovery], recommendedSchools: [school("old")] });
  assert.equal(slides[0].id, "assessment");
  assert.equal(slides[0].to, "/assessment");
  assert.equal(slides[0].action, "Assessment now");
  assert.equal(slides[0].school, discovery);
  assert.ok(!slides.some(s => s.kind === "recommended"));
});

test("completed assessment highlights recommendations without inviting a retake", () => {
  const slides = buildDashboardSlides({ recommendedSchools: [school("one"), school("two"), school("three")] }, latest);
  assert.deepEqual(slides.map(s => s.id), ["recommended:one", "recommended:two"]);
  assert.ok(slides.every(s => s.to.startsWith("/schools/")));
  assert.ok(!slides.some(s => s.kind === "assessment"));
});

test("recent views retain recency order and discovery avoids repeated schools where possible", () => {
  const featured = school("up");
  const recent = [school("newest"), school("older")];
  const showcase = { featuredSchool: featured, recentSchools: recent, discoverySchools: [featured, ...recent, school("new")] };
  const slides = buildDashboardSlides(showcase, latest);
  assert.deepEqual(slides.filter(s => s.kind === "recent").map(s => s.school.id), ["newest", "older"]);
  assert.deepEqual(slides.filter(s => s.kind === "discovery").map(s => s.school.id), ["new"]);
  assert.match(slides.find(s => s.kind === "ranked").description, /#104 in QS Asia 2026/);
  assert.match(RANKING_SOURCE, /964949/);
  assert.equal(DASHBOARD_SLIDE_MS, 5000);
});

test("overlapping categories still preserve distinct highlights with unique slide keys", () => {
  const up = school("up");
  const slides = buildDashboardSlides({ featuredSchool: up, recentSchools: [up, up], discoverySchools: [up] }, latest);
  assert.deepEqual(slides.map(s => s.kind), ["recent", "ranked", "discovery"]);
  assert.equal(new Set(slides.map(s => s.id)).size, slides.length);
});

test("empty catalog, missing photos and absent rollout data always have useful navigation", () => {
  assert.equal(buildDashboardSlides({}, latest)[0].to, "/schools");
  assert.equal(buildDashboardSlides()[0].to, "/assessment");
  const noPhoto = { id: "sti", name: "STI", campusPhotos: [] };
  const slides = buildDashboardSlides({ recommendedSchools: [noPhoto] }, latest);
  assert.equal(slides[0].school, noPhoto);
  assert.deepEqual(slides[0].school.campusPhotos, []);
});

test("polling refresh preserves slide identities while updating admin-managed media", () => {
  const initial = { discoverySchools: [school("one")] };
  const updated = { discoverySchools: [{ ...school("one"), campusPhotos: [{ url: "https://example.test/new.jpg" }] }] };
  assert.deepEqual(buildDashboardSlides(initial, latest).map(s => s.id), buildDashboardSlides(updated, latest).map(s => s.id));
  assert.equal(buildDashboardSlides(updated, latest)[0].school.campusPhotos[0].url, "https://example.test/new.jpg");
});
