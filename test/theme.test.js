import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTheme, themeStorageKey } from "../src/lib/theme.js";

test("both interfaces use the existing shared theme preference", () => {
  assert.equal(themeStorageKey, "xloreTheme");
  assert.equal(normalizeTheme("light"), "light");
  assert.equal(normalizeTheme("dark"), "dark");
});
test("missing or invalid preferences keep the existing dark default", () => {
  for (const value of [null, undefined, "", "invalid"]) assert.equal(normalizeTheme(value), "dark");
});
