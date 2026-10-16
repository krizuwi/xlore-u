import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgres://test:test@127.0.0.1/test";
process.env.DB_SSL = "disable";
process.env.EMAIL_ENABLED = "false";
process.env.NODE_ENV = "test";

const { extractProgramsWithScrapeGraph, extractProgramsFromUrlWithScrapeGraph, prepareScrapeGraphHtml, verifiedAiProgramNames, verifiedUrlExtractPrograms } = await import("../src/services/scrapegraph-client.js");
const { inspectAiHybridSource } = await import("../src/services/ai-hybrid-scraper.js");
const { detectProgramsForMode } = await import("../src/services/catalog-updater.js");

const html = "<html><body><nav>Fake program</nav><main><h2>BS Computer Science</h2><p>BS Nursing</p></main></body></html>";
const aliases = new Map([["bs computer science", { normalized_alias: "bs computer science", program_id: "program-1", program_name: "BS Computer Science" }]]);

test("ScrapeGraphAI receives only cleaned source HTML and returns page-grounded names", async () => {
  const names = await extractProgramsWithScrapeGraph(html, "Example University", {
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      assert.match(url, /\/extract$/);
      assert.equal(options.headers["SGAI-APIKEY"], "test-key");
      const body = JSON.parse(options.body);
      assert.doesNotMatch(body.html, /Fake program/);
      assert.match(body.html, /BS Computer Science/);
      assert.equal(body.schema.properties.programs.type, "array");
      return Response.json({ json: { programs: ["BS Computer Science", "Invented Degree", "BS Nursing"] } });
    }
  });
  assert.deepEqual(names, ["BS Computer Science", "BS Nursing"]);
});

test("AI results without source evidence or a valid program list are rejected", () => {
  assert.deepEqual(verifiedAiProgramNames({ programs: ["Invented Degree"] }, prepareScrapeGraphHtml(html)), []);
  assert.throws(() => verifiedAiProgramNames({ programs: "BS Nursing" }, html), /program list/);
});

test("visible programs inside an ASP.NET form reach AI without hidden fields", () => {
  const page = '<html><body><form><input type="hidden" value="private-token"><h2>BS Nursing</h2><button>Submit</button></form></body></html>';
  const prepared = prepareScrapeGraphHtml(page);
  assert.match(prepared, /BS Nursing/);
  assert.doesNotMatch(prepared, /private-token|Submit/);
});

test("listings outside a short main banner remain available to AI", () => {
  const page = '<html><body><main><h1>Program Offerings</h1></main><section><h2>University Programs</h2><ul><li>Bachelor of Science in Nursing</li></ul></section></body></html>';
  assert.match(prepareScrapeGraphHtml(page), /Bachelor of Science in Nursing/);
});

test("URL extraction uses only /extract and validates the configured university", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(String(url));
    assert.match(url, /\/extract$/);
    assert.equal(options.headers["SGAI-APIKEY"], "test-key");
    const body = JSON.parse(options.body);
    assert.equal(body.url, "https://example.edu/programs");
    assert.equal(body.html, undefined);
    assert.deepEqual(body.schema.required, ["university", "programs"]);
    return Response.json({ json: { university: "Example University", programs: ["BS Nursing", "BS Nursing", "Invented Degree"] } });
  };
  const extracted = await extractProgramsFromUrlWithScrapeGraph("https://example.edu/programs", "example.edu", "Example University", { apiKey: "test-key", fetchImpl });
  assert.deepEqual(extracted.aiNames, ["BS Nursing", "Invented Degree"]);
  assert.match(extracted.contentForHash, /bs nursing/);
  assert.deepEqual(calls.map(url => url.split("/").at(-1)), ["extract"]);
  await assert.rejects(extractProgramsFromUrlWithScrapeGraph("https://other.edu/programs", "example.edu", "Example University", { apiKey: "test-key", fetchImpl }), /outside the allowed host/);
  assert.throws(() => verifiedUrlExtractPrograms({ university: "Another University", programs: ["BS Nursing"] }, "Example University"), /did not match/);
});

test("hosted timeouts identify the failing step", async () => {
  await assert.rejects(extractProgramsFromUrlWithScrapeGraph("https://example.edu/programs", "example.edu", "Example University", {
    apiKey: "test-key",
    fetchImpl: async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); }
  }), /ScrapeGraphAI URL extraction timed out after \d+ seconds/);
});

test("AI and Hybrid try direct links before hosted scraping and retry direct timeouts", async () => {
  const source = { source_type: "program_catalog", source_url: "https://example.edu/programs", allowed_host: "example.edu", school_name: "Example University", official_website_url: "https://example.edu/" };
  let directCalls = 0, hostedCalls = 0;
  const inspectStandard = async (_source, options) => {
    directCalls += 1;
    assert.equal(options.requestTimeoutMs, 15_000);
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  };
  const extractHosted = async () => { hostedCalls += 1; return { contentForHash: "BS Computer Science", aiNames: ["BS Computer Science"] }; };
  await inspectAiHybridSource(source, { mode: "ai", requestTimeoutMs: 15_000, inspectStandard, extractHosted });
  const hybrid = await inspectAiHybridSource(source, { mode: "hybrid", requestTimeoutMs: 15_000, inspectStandard, extractHosted });
  assert.equal(directCalls, 2);
  assert.equal(hostedCalls, 2);
  assert.deepEqual(hybrid.aiNames, ["BS Computer Science"]);
  await assert.rejects(inspectAiHybridSource(source, { mode: "hybrid", requestTimeoutMs: 15_000,
    inspectStandard: async () => { throw new Error("Blocked by the source website's robots.txt policy."); },
    extractHosted: async () => { throw new Error("Hosted extractor must not run."); }
  }), /robots.txt policy/);
});

test("Hybrid uses the standard parser first and AI only as a fallback", async () => {
  let calls = 0;
  const extractAi = async () => { calls += 1; return ["BS Computer Science", "Bachelor of Made Up Degree"]; };
  const standard = await detectProgramsForMode(["BS Computer Science"], aliases, { mode: "hybrid", extractAi });
  assert.equal(standard.size, 1);
  assert.equal(calls, 0);
  const fallback = await detectProgramsForMode(["Unrelated text"], aliases, { mode: "hybrid", extractAi });
  assert.equal(calls, 1);
  assert.equal(fallback.size, 1);
  assert.equal(fallback.values().next().value.program_id, "program-1");
});

test("AI mode ignores standard candidates and cannot create new programs", async () => {
  const result = await detectProgramsForMode(["Bachelor of New Engineering"], aliases, {
    mode: "ai",
    extractAi: async () => ["BS Computer Science", "Bachelor of Made Up Degree"]
  });
  assert.deepEqual([...result.values()].map(item => item.program_id), ["program-1"]);
});

test("AI uses linked degree titles first without sending the page to hosted extraction", async () => {
  const source = { source_type: 'program_catalog', source_url: 'https://example.edu/programs',
    allowed_host: 'example.edu', school_name: 'Example University', official_website_url: 'https://example.edu/' };
  const linkedPrograms = [{ name: 'BS Computer Science', url: 'https://example.edu/programs/computer-science' }];
  const inspected = await inspectAiHybridSource(source, { mode: 'ai', inspectStandard: async () => ({
    html: '<a href="/programs/computer-science">BS Computer Science</a>', candidates: [], linkedPrograms
  }), extractHosted: async () => { throw new Error('Hosted extraction should not run'); } });
  const detected = await detectProgramsForMode(inspected.candidates, aliases, { mode: 'ai',
    html: inspected.html, linkedPrograms: inspected.linkedPrograms,
    extractAi: async () => { throw new Error('AI should not run'); } });
  assert.equal(detected.size, 1);
  assert.equal([...detected.values()][0].sourceUrl, linkedPrograms[0].url);
});

test('AI mode can add a new degree verified by an official link', async () => {
  const linkedPrograms = [{ name: 'BS Nursing', url: 'https://example.edu/degrees/nursing' }];
  const detected = await detectProgramsForMode([], new Map(), { mode: 'ai', linkedPrograms,
    extractAi: async () => { throw new Error('AI should not run'); } });
  assert.equal(detected.size, 1);
  assert.equal([...detected.values()][0].existing, false);
});

test('AI and Hybrid use hosted fallback when a public listing endpoint fails', async () => {
  const source = { source_type: 'program_catalog', source_url: 'https://help.example.edu/kb/section/12',
    allowed_host: 'example.edu', school_name: 'Example University', official_website_url: 'https://example.edu/' };
  for (const mode of ['ai', 'hybrid']) {
    let hosted = 0;
    const result = await inspectAiHybridSource(source, { mode,
      inspectStandard: async () => { const error = new Error('Public listing unavailable');
        error.code = 'crawl_discovery_failed'; throw error; },
      extractHosted: async () => { hosted++; return { aiNames: ['BS Computer Science'] }; }
    });
    assert.equal(hosted, 1);
    assert.deepEqual(result.aiNames, ['BS Computer Science']);
  }
});
