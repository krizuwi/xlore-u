import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Render the actual JSX component without a browser or access to user data.
const result = await build({
  stdin: {
    contents: `import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { MemoryRouter } from 'react-router-dom';
      import { ProgramSchoolOfferings } from './src/components/ProgramSchoolOfferings.jsx';
      export function render(schools) { return renderToStaticMarkup(<MemoryRouter><ProgramSchoolOfferings schools={schools} programName="BS IT" /></MemoryRouter>); }`,
    resolveDir: fileURLToPath(new URL("../", import.meta.url)), loader: "jsx"
  },
  bundle: true, packages: "external", platform: "node", format: "cjs", jsx: "automatic", write: false
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { render } = compiled.exports;
const school = id => ({ id, name: `School ${id}`, city: "Manila", schoolType: "Private" });

test("offered-by list starts closed behind a native keyboard-accessible View more disclosure", () => {
  const html = render([school("one")]);
  assert.match(html, /<details class="program-schools program-offerings-disclosure">/);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  assert.match(html, /<summary aria-label="Schools offering BS IT">/);
  assert.match(html, /View more/);
  assert.match(html, /View less/);
  assert.match(html, /href="\/schools\/one"/);
});

test("large offered-by lists retain every school and its details without losing links", () => {
  const schools = Array.from({ length: 30 }, (_, index) => school(String(index + 1)));
  const html = render(schools);
  assert.equal((html.match(/class="program-school-offering"/g) ?? []).length, 30);
  assert.match(html, /School 30/);
  assert.match(html, /Manila · Private/);
  assert.match(html, /role="region" aria-label="Schools offering BS IT" tabindex="0"/);
  const css = readFileSync(new URL("../src/pages/ProgramsPage.css", import.meta.url), "utf8");
  assert.match(css, /\.program-offerings-disclosure \.program-school-list \{[^}]*max-height: 250px;[^}]*overflow-y: auto;/);
  assert.match(css, /\.program-offerings-disclosure\[open\] \.program-offerings-less/);
});

test("missing schools show an honest empty state instead of an unusable View more button", () => {
  for (const schools of [undefined, []]) {
    const html = render(schools);
    assert.match(html, /No offering institution is listed yet/);
    assert.doesNotMatch(html, /<details|View more/);
  }
});
