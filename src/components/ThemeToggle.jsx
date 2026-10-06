import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, themeStorageKey } from "../lib/theme.js";

export function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const syncTheme = event => {
      if (event.key === themeStorageKey || event.key === null) setTheme(readTheme());
    };
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  return <button className="theme-toggle" type="button" onClick={() => setTheme(current => current === "dark" ? "light" : "dark")} aria-label={label} title={label}>
    {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
  </button>;
}
