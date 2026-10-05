import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { MAX_QUOTES, readQuotes } from "@/modules/discovery/feed";

/*
 * Live prices for goals already on screen (decided 2026-09-24). Pages poll this
 * about every 15 seconds while visible. It is read-only and records nothing, so
 * polling cannot inflate the feed's view counts, and it returns only numbers a
 * goal's page already shows to anyone (browsing without an account returned on
 * 2026-10-05). No identity is read.
 */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = raw.split(",").map((id) => id.trim()).filter(Boolean).slice(0, MAX_QUOTES);
  try {
    const quotes = await readQuotes(getDb(), ids);
    return Response.json({ at: new Date().toISOString(), quotes }, { headers });
  } catch {
    return Response.json({ error: "Prices are unavailable right now." }, { status: 503, headers });
  }
}
