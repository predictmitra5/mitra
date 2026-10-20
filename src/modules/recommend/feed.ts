import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { gatherCandidates, readViewerProfile, type Viewer } from "./candidates";
import { DEFAULT_RERANK, DEFAULT_WEIGHTS, isColdStartViewer, recommend, type Ranked } from "./ranking";

/*
 * The video feed's order for one viewer (2026-10-19): gather candidates, rank
 * them, and return the video ids with the reason each was picked. "Following"
 * keeps only followed founders and startups, newest and best first.
 */

type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export type FeedPick = { videoId: string; reason: string; score: number };
export type VideoFeed = { picks: FeedPick[]; coldStart: boolean; following: boolean };

export const FEED_LENGTH = 30;

export async function recommendVideos<Q extends PgQueryResultHKT>(
  database: Database<Q>, viewer: Viewer, now: Date = new Date(), options: { following?: boolean; first?: string | null; limit?: number } = {},
): Promise<VideoFeed> {
  const profile = await readViewerProfile(database, viewer, now);
  const candidates = await gatherCandidates(database, viewer, profile, now, { following: options.following });
  let ranked: Ranked[] = recommend(candidates, profile, now, DEFAULT_WEIGHTS, DEFAULT_RERANK);
  if (options.following) {
    ranked = [...ranked].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }
  // A shared link (/watch/<id>) opens on that video, then carries on as usual.
  if (options.first) {
    const at = ranked.findIndex((r) => r.videoId === options.first);
    if (at > 0) ranked = [ranked[at], ...ranked.slice(0, at), ...ranked.slice(at + 1)];
  }
  const picks = ranked.slice(0, options.limit ?? FEED_LENGTH).map((r) => ({ videoId: r.videoId, reason: r.reason, score: Math.round(r.score * 1000) / 1000 }));
  if (options.first && !picks.some((p) => p.videoId === options.first)) picks.unshift({ videoId: options.first, reason: "Shared with you", score: 0 });
  return { picks, coldStart: isColdStartViewer(profile), following: !!options.following };
}
