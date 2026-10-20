import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull, type Viewer } from "@/modules/account/viewer";
import { recommendVideos } from "@/modules/recommend/feed";
import { VIEWER_COOKIE, viewerFor } from "@/modules/recommend/events";
import { readVideoCards } from "@/modules/startups/read";
import { toVideoCardData, type VideoCardData } from "./video-data";

/*
 * Loads the first cards of the video feed for whoever is looking (2026-10-19):
 * a member by account, a visitor by the random feed cookie the proxy set.
 * Errors never reach the page: it shows "temporarily unavailable" instead.
 */
export async function loadVideoFeed(options: { following?: boolean; first?: string | null } = {}): Promise<{
  cards: VideoCardData[]; signedIn: boolean; viewer: Viewer | null; unavailable: boolean; coldStart: boolean;
}> {
  let identity = null;
  try { identity = await currentIdentity(); } catch { /* show the feed as a visitor would */ }
  const viewer = identity ? await readViewerOrNull(getDb(), identity.id) : null;
  try {
    const now = new Date();
    const who = viewerFor(identity?.id, (await cookies()).get(VIEWER_COOKIE)?.value);
    const feed = await recommendVideos(getDb(), who, now, { following: options.following, first: options.first, limit: 12 });
    const cards = await readVideoCards(getDb(), feed.picks.map((p) => p.videoId), identity?.id ?? null, now, new Map(feed.picks.map((p) => [p.videoId, p.reason])));
    return { cards: cards.map(toVideoCardData), signedIn: !!identity, viewer, unavailable: false, coldStart: feed.coldStart };
  } catch {
    return { cards: [], signedIn: !!identity, viewer, unavailable: true, coldStart: true };
  }
}
