export const themeStorageKey = "xloreTheme";

let requestedTheme;
let transitionTimer;

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

export function transitionTheme(theme) {
  requestedTheme = normalizeTheme(theme);
  const root = document.documentElement;
  if (root.dataset.theme === requestedTheme) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    applyTheme(requestedTheme);
  } else if (typeof document.startViewTransition === "function") {
    // A rapid second toggle can change the requested theme before the snapshot is ready.
    const transition = document.startViewTransition(() => applyTheme(requestedTheme));
    transition.ready.catch(() => {});
  } else {
    root.setAttribute("data-theme-changing", "");
    applyTheme(requestedTheme);
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => root.removeAttribute("data-theme-changing"), 650);
  }
}
