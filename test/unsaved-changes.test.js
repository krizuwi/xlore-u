import test from "node:test";
import assert from "node:assert/strict";
import { formSnapshot, leavesPage } from "../src/lib/unsaved-changes.js";

const input = (value, extra = {}) => ({ tagName: "INPUT", type: "text", value, name: "name", getAttribute: () => null, ...extra });
test("field edits warn, reverting a value is clean", () => {
  const field = input("Original");
  const form = { elements: [field] }, baseline = formSnapshot(form);
  field.value = "Edited";
  assert.notEqual(formSnapshot(form), baseline);
  field.value = "Original";
  assert.equal(formSnapshot(form), baseline);
});
test("focus, disabled state, password visibility and read-only values are not edits", () => {
  const field = input("secret", { type: "password" });
  const readOnly = input("account@example.test", { readOnly: true });
  const button = input("Save", { type: "submit" });
  const form = { elements: [field, readOnly, button] }, baseline = formSnapshot(form);
  field.type = "text"; field.disabled = true; readOnly.value = "other"; button.value = "Saving";
  assert.equal(formSnapshot(form), baseline);
});
test("checkbox and radio selection, unnamed media and file changes are captured", () => {
  const check = input("yes", { type: "checkbox", checked: false });
  const radio = input("5", { type: "radio", checked: false });
  const photo = input("campus.jpg", { name: "" });
  const file = input("", { type: "file", files: [] });
  const form = { elements: [check, radio, photo, file] }, baseline = formSnapshot(form);
  for (const [field, prop, value] of [[check, "checked", true], [radio, "checked", true], [photo, "value", "new.jpg"], [file, "files", [{ name: "logo.png", size: 30, lastModified: 123 }]]]) {
    const original = field[prop]; field[prop] = value;
    assert.notEqual(formSnapshot(form), baseline);
    field[prop] = original;
  }
  form.elements.push(input("", { name: "" }));
  assert.notEqual(formSnapshot(form), baseline);
});
test("multi-select and textarea changes are captured", () => {
  const select = input("", { tagName: "SELECT", multiple: true, selectedOptions: [{ value: "A" }] });
  const textarea = input("Draft", { tagName: "TEXTAREA" });
  const form = { elements: [select, textarea] }, baseline = formSnapshot(form);
  select.selectedOptions.push({ value: "B" });
  assert.notEqual(formSnapshot(form), baseline);
  select.selectedOptions.pop(); textarea.value = "New draft";
  assert.notEqual(formSnapshot(form), baseline);
});
test("route and query changes leave the page, hash-only movement does not", () => {
  const current = { pathname: "/profile", search: "", hash: "" };
  assert.equal(leavesPage(current, { ...current, pathname: "/schools" }), true);
  assert.equal(leavesPage(current, { ...current, search: "?tab=1" }), true);
  assert.equal(leavesPage(current, { ...current, hash: "#password" }), false);
  assert.equal(leavesPage({ ...current, pathname: "/login", state: { step: "forgot" } }, { ...current, pathname: "/login" }), true);
});
