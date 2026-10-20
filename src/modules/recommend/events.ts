import { and, count, eq, gte, inArray, like, lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { INTEREST_DAILY_DECAY, INTEREST_DELTA } from "./ranking";
import type { Viewer } from "./candidates";

/*
 * What viewers do with videos (2026-10-19). The browser reports impressions,
 * watch time, completions, rewatches, skips, shares, "not interested" and
 * opening the market; likes, saves, follows, comments and reports are recorded
 * by their own server actions, which check the account, so the browser cannot
 * claim them. Every event also moves the viewer's leaning towards the video's
 * industry (viewer_interests), which the ranking reads.
 *
 * Measurement must never break a page: callers swallow failures.
 *
 * Bounded like the 2026-10-07 feed counters: at most MAX_EVENTS_PER_VIEWER_HOUR
 * events per viewer per hour are kept, and a visitor's events and leanings
 * (random-cookie keys) are deleted after VISITOR_RETENTION_DAYS by the daily
 * maintenance route.
 */

const { videoEvents, videos, startups, viewerInterests } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type Kind = (typeof schema.videoEventKind.enumValues)[number];

/** What the browser may report. The rest come from server actions. */
export const CLIENT_KINDS = ["impression", "watch", "complete", "rewatch", "skip", "share", "not_interested", "open_market"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];
export type ClientEvent = { videoId: string; kind: ClientKind; watchMs?: number; progress?: number };

export const MAX_EVENTS_PER_REQUEST = 40;
export const MAX_EVENTS_PER_VIEWER_HOUR = 400;
export const VISITOR_RETENTION_DAYS = 60;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

import { isViewerToken } from "./viewer-cookie";
export { isViewerToken, VIEWER_COOKIE } from "./viewer-cookie";

/** The key events are stored under: the account when signed in, else the visitor cookie. */
export function viewerFor(userId: string | null | undefined, cookie: string | null | undefined): Viewer {
  if (userId && UUID.test(userId)) return { key: `u:${userId}`, userId };
  if (isViewerToken(cookie)) return { key: `v:${cookie}`, userId: null };
  return { key: null, userId: null };
}

/** Parses what the browser sent, dropping anything malformed. Never throws. */
export function parseClientEvents(body: unknown): ClientEvent[] {
  const list = Array.isArray((body as { events?: unknown })?.events) ? (body as { events: unknown[] }).events : [];
  const out: ClientEvent[] = [];
  for (const item of list.slice(0, MAX_EVENTS_PER_REQUEST)) {
    if (!item || typeof item !== "object") continue;
    const { videoId, kind, watchMs, progress } = item as Record<string, unknown>;
    if (typeof videoId !== "string" || !UUID.test(videoId) || !CLIENT_KINDS.includes(kind as ClientKind)) continue;
    out.push({
      videoId: videoId.toLowerCase(), kind: kind as ClientKind,
      watchMs: typeof watchMs === "number" && Number.isFinite(watchMs) ? Math.max(0, Math.round(watchMs)) : 0,
      progress: typeof progress === "number" && Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0,
    });
  }
  return out;
}

/** Records events for approved videos and updates the viewer's interests. Returns how many were stored. */
export async function recordVideoEvents<Q extends PgQueryResultHKT>(
  database: Database<Q>, viewer: Viewer, events: readonly { videoId: string; kind: Kind; watchMs?: number; progress?: number }[], now: Date = new Date(),
): Promise<number> {
  if (!viewer.key || events.length === 0) return 0;
  const ids = [...new Set(events.map((e) => e.videoId))];
  const known = await database.select({ id: videos.id, duration: videos.durationSeconds, industry: startups.industry }).from(videos)
    .innerJoin(startups, eq(startups.id, videos.startupId)).where(and(inArray(videos.id, ids), eq(videos.status, "approved")));
  const byId = new Map(known.map((v) => [v.id, v]));
  const [{ recent }] = await database.select({ recent: count() }).from(videoEvents)
    .where(and(eq(videoEvents.viewerKey, viewer.key), gte(videoEvents.createdAt, new Date(now.getTime() - 3_600_000))));
  const room = MAX_EVENTS_PER_VIEWER_HOUR - Number(recent);
  if (room <= 0) return 0;
  const rows = events.filter((e) => byId.has(e.videoId)).slice(0, room).map((e) => {
    const video = byId.get(e.videoId)!;
    // Watch time can't be longer than the video (plus a little for buffering).
    const cap = video.duration * 1100;
    return {
      videoId: e.videoId, viewerKey: viewer.key!, userId: viewer.userId, kind: e.kind,
      watchMs: Math.min(cap, Math.max(0, Math.round(e.watchMs ?? 0))),
      progressBp: e.kind === "complete" ? 10_000 : Math.round(Math.min(1, Math.max(0, e.progress ?? 0)) * 10_000),
      createdAt: now,
    };
  });
  if (rows.length === 0) return 0;
  await database.insert(videoEvents).values(rows);

  const deltas = new Map<string, number>();
  for (const row of rows) {
    const base = INTEREST_DELTA[row.kind] ?? 0;
    const delta = row.kind === "watch" ? Math.round(base * (row.progressBp / 10_000)) : base;
    if (!delta) continue;
    const industry = byId.get(row.videoId)!.industry;
    deltas.set(industry, (deltas.get(industry) ?? 0) + delta);
  }
  for (const [industry, delta] of deltas) await bumpInterest(database, viewer.key, industry, delta, now);
  return rows.length;
}

/** Decays the stored leaning by the days since it was last touched, then adds the change. */
export async function bumpInterest<Q extends PgQueryResultHKT>(database: Database<Q>, viewerKey: string, industry: string, delta: number, now: Date = new Date()) {
  const at = now.toISOString();
  await database.insert(viewerInterests).values({ viewerKey, industry: industry as (typeof schema.industry.enumValues)[number], score: Math.max(-20_000, Math.min(60_000, delta)), updatedAt: now })
    .onConflictDoUpdate({
      target: [viewerInterests.viewerKey, viewerInterests.industry],
      set: {
        score: sql`greatest(-20000, least(60000, round(${viewerInterests.score} * power(${INTEREST_DAILY_DECAY}, greatest(0, extract(epoch from (${at}::timestamptz - ${viewerInterests.updatedAt})) / 86400.0))) + ${delta}))::int`,
        updatedAt: now,
      },
    });
}

/** Server actions record the events the browser may not claim. */
export async function recordServerEvent<Q extends PgQueryResultHKT>(database: Database<Q>, viewer: Viewer, videoId: string, kind: Kind, now: Date = new Date()) {
  try {
    await recordVideoEvents(database, viewer, [{ videoId, kind }], now);
  } catch {
    // Measurement never blocks the action itself.
  }
}

/** Daily maintenance: a visitor's (random-cookie) events and leanings older than the retention window. */
export async function pruneVisitorActivity<Q extends PgQueryResultHKT>(database: Database<Q>, now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - VISITOR_RETENTION_DAYS * 86_400_000);
  await database.delete(videoEvents).where(and(like(videoEvents.viewerKey, "v:%"), lt(videoEvents.createdAt, cutoff)));
  await database.delete(viewerInterests).where(and(like(viewerInterests.viewerKey, "v:%"), lt(viewerInterests.updatedAt, cutoff)));
}
