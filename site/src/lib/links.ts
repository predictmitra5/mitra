/*
 * Where the app lives. The website is its own project (DECISIONS.md
 * 2026-10-20), so every "Open Mitra" link points across to the app; set
 * NEXT_PUBLIC_APP_URL on the website's Vercel project if the app's address
 * changes.
 */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://mitra-gamma-ten.vercel.app").replace(/\/+$/, "");

export function app(path = "/"): string {
  return `${APP_URL}${path === "/" ? "" : path}`;
}
