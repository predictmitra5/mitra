"use server";

import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { recommendVideos } from "@/modules/recommend/feed";
import { VIEWER_COOKIE, viewerFor } from "@/modules/recommend/events";
import { readVideoCards } from "@/modules/startups/read";
import { isUuid } from "@/modules/market/input";
import { toVideoCardData, type VideoCardData } from "./video-data";

/**
 * The next few cards for the feed as the viewer scrolls (2026-10-19), ranked
 * again with everything they did so far, leaving out what is already on screen.
 */
export async function moreVideos(shown: string[], following: boolean): Promise<VideoCardData[]> {
  const exclude = new Set((Array.isArray(shown) ? shown : []).filter(isUuid).slice(0, 300));
  try {
    let identity = null;
    try { identity = await currentIdentity(); } catch { /* a visitor */ }
    const viewer = viewerFor(identity?.id, (await cookies()).get(VIEWER_COOKIE)?.value);
    const now = new Date();
    const feed = await recommendVideos(getDb(), viewer, now, { following, limit: 200 });
    const picks = feed.picks.filter((p) => !exclude.has(p.videoId)).slice(0, 8);
    const cards = await readVideoCards(getDb(), picks.map((p) => p.videoId), identity?.id ?? null, now, new Map(picks.map((p) => [p.videoId, p.reason])));
    return cards.map(toVideoCardData);
  } catch {
    return [];
  }
}
