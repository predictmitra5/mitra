/*
 * A founder's LinkedIn profile (2026-10-22): only a linkedin.com/in/ profile
 * link is accepted, stored in one canonical form. Shared by the server and the
 * founder steps.
 */
export function linkedinProfileUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean || clean.length > 300) return null;
  let url: URL;
  try { url = new URL(/^[a-z]+:\/\//i.test(clean) ? clean : `https://${clean}`); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== "linkedin.com" && !/^[a-z]{2,3}\.linkedin\.com$/.test(host)) return null;
  const match = /^\/in\/([A-Za-z0-9\-_%.]{3,100})\/?$/.exec(url.pathname);
  return match ? `https://www.linkedin.com/in/${match[1]}/` : null;
}
