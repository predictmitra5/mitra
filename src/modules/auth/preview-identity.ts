import type { AuthIdentity } from "./policy";

/*
 * A fictional signed-in identity for checking pages locally (2026-10-19), used
 * only by scripts/preview-startups.mjs, which runs `next dev` against a
 * disposable database schema full of demo data. It lets the preview trade,
 * follow and use the owner's tools as fictional people without any real
 * account or Supabase sign-in.
 *
 * It does nothing anywhere else: only when NODE_ENV is "development" (which
 * `next build` and Vercel never are; production builds compile this branch
 * away) and MITRA_PREVIEW_PERSONAS names the fictional accounts. The
 * mitra_preview_as cookie picks one ("member", "owner", "visitor").
 */

export const PREVIEW_COOKIE = "mitra_preview_as";
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** undefined: no preview here, use real sign-in. null: a visitor. Otherwise the fictional identity. */
export function previewIdentity(choice: string | undefined, environment: { NODE_ENV?: string; MITRA_PREVIEW_PERSONAS?: string } = process.env): AuthIdentity | null | undefined {
  if (environment.NODE_ENV !== "development" || !environment.MITRA_PREVIEW_PERSONAS) return undefined;
  let personas: Record<string, unknown>;
  try { personas = JSON.parse(environment.MITRA_PREVIEW_PERSONAS) as Record<string, unknown>; } catch { return undefined; }
  const pick = choice ?? "member";
  if (pick === "visitor") return null;
  const id = personas[pick];
  if (typeof id !== "string" || !UUID.test(id)) return undefined;
  return { id, email: `${pick}.preview@example.test` };
}
