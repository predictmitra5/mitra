/**
 * Black or white, the person's choice (decided 2026-10-05). Black is the
 * default. The choice lives in a cookie so the server renders the right theme
 * on the first paint; it is a display preference and never authorizes anything.
 */
export const THEME_COOKIE = "mitra_theme";
export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export function themeFor(value: unknown): Theme {
  return value === "light" ? "light" : "dark";
}
