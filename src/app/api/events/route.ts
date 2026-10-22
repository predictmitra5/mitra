import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { parseClientEvents, recordVideoEvents, viewerFor } from "@/modules/recommend/events";
import { isViewerToken, newViewerToken, VIEWER_COOKIE, VIEWER_COOKIE_MAX_AGE } from "@/modules/recommend/viewer-cookie";
import { LIMITS } from "@/modules/security/rate-limit";
import { limitResponse } from "@/modules/security/request";

/*
 * What the video player reports (2026-10-19): impressions, watch time,
 * completions, rewatches, skips, shares, "not interested" and opening the
 * market, in small batches (navigator.sendBeacon or fetch). A signed-in member
 * is recorded by account; a visitor by a random first-party cookie, set here
 * if the proxy has not already, which holds nothing personal. Measurement never
 * fails loudly: a bad batch is dropped and the page carries on.
 */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  // By address, so a visitor dropping the feed cookie on every request still has a ceiling.
  const blocked = await limitResponse(request, LIMITS.events);
  if (blocked) return blocked;
  let body: unknown = null;
  try {
    const text = await request.text();
    if (text.length > 20_000) return Response.json({ stored: 0 }, { status: 413, headers });
    body = JSON.parse(text);
  } catch {
    return Response.json({ stored: 0 }, { status: 400, headers });
  }
  const events = parseClientEvents(body);
  let identity = null;
  try { identity = await currentIdentity(); } catch { /* treat as a visitor */ }
  const jar = await cookies();
  let cookie = jar.get(VIEWER_COOKIE)?.value;
  if (!identity && !isViewerToken(cookie)) {
    cookie = newViewerToken();
    jar.set(VIEWER_COOKIE, cookie, { httpOnly: true, sameSite: "lax", path: "/", maxAge: VIEWER_COOKIE_MAX_AGE, secure: request.nextUrl.protocol === "https:" });
  }
  try {
    const stored = await recordVideoEvents(getDb(), viewerFor(identity?.id, cookie), events);
    return Response.json({ stored }, { headers });
  } catch {
    return Response.json({ stored: 0 }, { status: 503, headers });
  }
}
