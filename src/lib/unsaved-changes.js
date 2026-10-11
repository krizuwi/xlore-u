// Compare actual editable values, including unnamed media fields and files.
// Button state, focus, password visibility and read-only values are not edits.
export function formSnapshot(form) {
  return JSON.stringify(Array.from(form.elements).filter(field =>
    ["INPUT", "TEXTAREA", "SELECT"].includes(field.tagName) && !field.readOnly &&
    !["submit", "reset", "button", "hidden"].includes(field.type)
  ).map(field => {
    const key = field.name || field.id || field.getAttribute("aria-label") || "";
    if (field.type === "checkbox" || field.type === "radio") return [key, field.value, field.checked];
    if (field.type === "file") return [key, Array.from(field.files || []).map(file => [file.name, file.size, file.lastModified])];
    if (field.tagName === "SELECT" && field.multiple) return [key, Array.from(field.selectedOptions).map(option => option.value)];
    return [key, field.value];
  }));
}

// Stateful drafts can be disabled once they become read-only results. A saved
// draft changing to an empty result-screen value must not become dirty again.
export function createProgressGuard(value) {
  let current = value, baseline = value, active = true;
  return {
    update(nextValue, enabled = true) { current = nextValue; active = enabled; },
    isDirty() { return active && current !== baseline; },
    markClean() { baseline = current; }
  };
}

export function leavesPage(current, next) {
  return current.pathname !== next.pathname || current.search !== next.search ||
    current.state?.step !== next.state?.step;
}
