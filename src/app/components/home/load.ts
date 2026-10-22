import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { timed } from "@/modules/diagnostics/timing";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull, type Viewer } from "@/modules/account/viewer";
import { readFeed, recordExposures } from "@/modules/discovery/feed";
import { recommendVideos } from "@/modules/recommend/feed";
import { VIEWER_COOKIE, viewerFor } from "@/modules/recommend/events";
import { latestVideoIds, readVideoCards } from "@/modules/startups/read";
import { toCardData } from "../market/card-data";
import type { CardData } from "../market/market-card";
import { toVideoCardData, type VideoCardData } from "../feed/video-data";

/*
 * The home page's data (2026-10-20, YouTube's home): the recommended founder
 * videos, each with its startup's market; the market moving most today (or the
 * owner's pin) with its founder's newest video, for the first slot; and the
 * markets closing soonest, for the shelf. Errors never reach the page.
 */

export type HomeData = {
  items: VideoCardData[];
  highlight: VideoCardData | null;
  closingSoon: CardData[];
  signedIn: boolean;
  viewer: Viewer | null;
  unavailable: boolean;
};

export async function loadHome(options: { following?: boolean } = {}): Promise<HomeData> {
  let identity = null;
  try { identity = await timed("home.identity", () => currentIdentity()); } catch { /* show the page as a visitor would */ }
  const database = getDb();
  // The top bar and the feed don't depend on each other, so they load side by
  // side (2026-10-22); readViewerOrNull never throws.
  const viewerRead = identity ? readViewerOrNull(database, identity.id) : Promise.resolve(null);
  const content = timed("home.feed", () => loadContent(database, identity?.id ?? null, options));
  const [viewer, result] = await Promise.all([viewerRead, content.then((value) => value, () => null)]);
  if (!result) return { items: [], highlight: null, closingSoon: [], signedIn: !!identity, viewer, unavailable: true };
  return { ...result, signedIn: !!identity, viewer, unavailable: false };
}

async function loadContent(database: ReturnType<typeof getDb>, userId: string | null, options: { following?: boolean }) {
  const now = new Date();
  const who = viewerFor(userId ?? undefined, (await cookies()).get(VIEWER_COOKIE)?.value);
  // The moving market's newest video is looked up as soon as the market feed
  // is in, without waiting for the recommendations.
  const marketsRead = options.following ? Promise.resolve(null) : readFeed(database, now);
  const highlightRead = marketsRead.then(async (markets) => {
    const featured = markets?.featured ?? null;
    return featured ? (await latestVideoIds(database, [featured.startupId])).get(featured.startupId) ?? null : null;
  });
  const [feed, markets, highlightVideo] = await Promise.all([
    recommendVideos(database, who, now, { following: options.following, limit: 36 }),
    marketsRead,
    highlightRead,
  ]);
  const reasons = new Map(feed.picks.map((p) => [p.videoId, p.reason]));
  const featured = markets?.featured ?? null;
  const models = await readVideoCards(database, [...feed.picks.map((p) => p.videoId), ...(highlightVideo ? [highlightVideo] : [])], userId, now, reasons);
  const cards = models.map(toVideoCardData);
  const highlightCard = highlightVideo ? cards.find((card) => card.id === highlightVideo) ?? null : null;
  // The first slot shows the moving market itself, whatever the video's own flagship is.
  const highlight = featured && highlightCard ? { ...highlightCard, market: toCardData(featured) } : null;
  // One card per market: a founder's second video would repeat the same question.
  const seen = new Set(highlight?.market ? [highlight.market.id] : []);
  const items = cards.filter((card) => {
    if (card.id === highlight?.id || !feed.picks.some((p) => p.videoId === card.id)) return false;
    if (!card.market) return true;
    if (seen.has(card.market.id)) return false;
    seen.add(card.market.id);
    return true;
  });
  // Signed-out browsing stays read-only (2026-10-07); members add bounded, anonymous counts.
  if (userId) {
    const shown = [highlight?.market?.id, ...items.map((card) => card.market?.id)].filter((id): id is string => !!id);
    await recordExposures(database, [...new Set(shown)]);
  }
  return { items, highlight, closingSoon: (markets?.closingSoon ?? []).slice(0, 10).map(toCardData) };
}
