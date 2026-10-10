import test from "node:test";
import assert from "node:assert/strict";
import { keywordMatches, normalizeSearch, searchTerms, searchText } from "../src/lib/keyword-search.js";
const cases = [
  ["Mapúa University, Manila", "mapua", true],
  ["School in Las Piñas", "LAS PINAS", true],
  ["Polytechnic University of the Philippines Manila BS Information Technology", "BSIT PUP", true],
  ["Polytechnic University of the Philippines Manila BS Information Technology", "Manila IT PUP", true],
  ["University of Santo Tomas BS Nursing", "nursing ust", true],
  ["University of the Philippines Diliman Quezon", "UPD QC", true],
  ["University of the Philippines Manila", "UPD", false],
  ["Ateneo de Manila University Quezon", "admu q.c.", true],
  ["BS Computer Science", "b.s.c.s.", true],
  ["Bachelor of Science in Information Technology", "BS IT", true],
  ["Bachelor of Science in Civil Engineering", "BSCE", true],
  ["De La Salle University Manila", "Manila DLSU", true],
  ["BS Computer Science", "comp sci", true],
  ["BS Nursing Makati", "nursing Manila", false],
  ["Literature Italian Humanities", "IT", false],
  ["University of the East", "NU", false],
  ["AIMS", "AIM", false],
  ["University of Santo Tomas", "STI", false],
  ["BS Nursing", "   ", true],
  ["BS Nursing", "%__", false],
  ["BS Nursing", "' OR 1=1 --", false],
  ["constructor", "constructor", true],
  ["toString", "toString", true],
  ["BS Nursing", "nursing,", true],
  ["San Beda College — Alabang", "Alabang San Beda", true]
];
for (const [value, query, expected] of cases) {
  test(`keyword search ${JSON.stringify(query)} in ${JSON.stringify(value)}`, () => {
    assert.equal(keywordMatches(value, query), expected);
  });
}
test("structured admin metadata is searchable without object placeholders", () => {
  const text = searchText("BS Computer Science", ["STEM", "analytical"], { name: "Mapúa", city: "Makati" });
  assert.equal(keywordMatches(text, "bscs mapua makati"), true);
  assert.equal(keywordMatches(text, "Manila"), false);
  assert.ok(!text.includes("[object Object]"));
});
test("normalization and queries are deterministic and never modified", () => {
  assert.equal(normalizeSearch("  MAPÚA — Las Piñas! "), "mapua las pinas");
  assert.deepEqual(searchTerms("BS IT Manila"), searchTerms("bsit manila"));
  assert.deepEqual(searchTerms(" \t\n"), []);
});


test("catalog search does not confuse course mentions with the program itself", async () => {
  const { catalogKeywordMatches } = await import("../src/lib/keyword-search.js");
  const engineering = { name: "BS Computer Engineering", description: "Work with computer science and information technology.", schools: [{ name: "Mapúa University", city: "Makati" }] };
  assert.equal(catalogKeywordMatches(engineering, "BSIT"), false);
  assert.equal(catalogKeywordMatches(engineering, "computer science Makati"), false);
  const computing = { ...engineering, name: "BS Computer Science" };
  assert.equal(catalogKeywordMatches(computing, "bscs mapua makati"), true);
});

test("combined course and location matches one actual offering, not Metro Manila region text", async () => {
  const { catalogKeywordMatches } = await import("../src/lib/keyword-search.js");
  const record = { name: "BS Information Technology", schools: [
    { name: "University of Santo Tomas", city: "Manila", address: "Manila, Metro Manila" },
    { name: "STI College Global City", city: "Taguig", address: "Bonifacio Global City, Metro Manila" }
  ] };
  assert.equal(catalogKeywordMatches(record, "BSIT UST Manila"), true);
  assert.equal(catalogKeywordMatches(record, "BSIT UST Taguig"), false);
  assert.equal(catalogKeywordMatches(record, "BSIT BGC"), true);
  assert.equal(catalogKeywordMatches({ ...record, schools: [record.schools[1]] }, "BSIT Manila"), false);
});

test("admin school keyword search includes its program names and keeps full institution names searchable", async () => {
  const { catalogKeywordMatches } = await import("../src/lib/keyword-search.js");
  const school = { name: "Ateneo de Manila University", city: "Quezon", address: "Loyola Heights, Quezon City", programNames: ["BS Computer Science"] };
  assert.equal(catalogKeywordMatches(school, "bscs admu qc", "school"), true);
  assert.equal(catalogKeywordMatches(school, "ateneo de manila university", "school"), true);
  assert.equal(catalogKeywordMatches(school, "BSIT", "school"), false);
  assert.equal(catalogKeywordMatches(school, "BSCS Manila", "school"), false);
});
