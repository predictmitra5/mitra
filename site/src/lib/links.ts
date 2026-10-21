/*
 * Where the app lives. The website is its own project (DECISIONS.md
 * 2026-10-20) at mitra.market, and the app is at app.mitra.market (DECISIONS.md
 * 2026-10-21), so every "Open Mitra" link points across to it; set
 * NEXT_PUBLIC_APP_URL on the website's Vercel project if the app's address
 * changes.
 */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.mitra.market").replace(/\/+$/, "");

export function app(path = "/"): string {
  return `${APP_URL}${path === "/" ? "" : path}`;
}
