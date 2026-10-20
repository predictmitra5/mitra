/*
 * The visitor's random id for personalising the feed (2026-10-19): 24 url-safe
 * characters in a first-party cookie, holding nothing personal. Kept apart from
 * events.ts so the proxy can use it without loading the database code.
 */
export const VIEWER_COOKIE = "mitra_viewer";
export const VIEWER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isViewerToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,40}$/.test(value);
}

export function newViewerToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
