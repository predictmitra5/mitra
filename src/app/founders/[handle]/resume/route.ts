import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { LIMITS } from "@/modules/security/rate-limit";
import { limitResponse } from "@/modules/security/request";
import { resumeLink } from "@/modules/startups/resume";

/*
 * A founder's resume (2026-10-22): a redirect to a link to the PDF on
 * Supabase's own domain that works for five minutes, once the owner has
 * approved the founder (before then only for the founder and the owner).
 */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const blocked = await limitResponse(request, LIMITS.feed);
  if (blocked) return blocked;
  const { handle } = await params;
  let viewer: string | null = null;
  try { viewer = (await currentIdentity())?.id ?? null; } catch { /* a visitor */ }
  try {
    const link = await resumeLink(getDb(), handle, viewer);
    if (!link) return new Response("Not found.", { status: 404, headers });
    return new Response(null, { status: 302, headers: { ...headers, Location: link } });
  } catch {
    return new Response("The resume is unavailable right now.", { status: 503, headers });
  }
}
