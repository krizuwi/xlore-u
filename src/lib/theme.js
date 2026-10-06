export const themeStorageKey = "xloreTheme";

export function normalizeTheme(value) {
  return value === "light" ? "light" : "dark";
}

export function readTheme() {
  try { return normalizeTheme(localStorage.getItem(themeStorageKey)); }
  catch { return "dark"; }
}

export function applyTheme(theme) {
  const value = normalizeTheme(theme);
  document.documentElement.dataset.theme = value;
  try { localStorage.setItem(themeStorageKey, value); } catch { /* Theme still works when browser storage is unavailable. */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", value === "dark" ? "#0c111b" : "#2447d8");
}
