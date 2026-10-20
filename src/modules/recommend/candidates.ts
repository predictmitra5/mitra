import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import type { Candidate, CandidateSource, VideoStats, ViewerProfile } from "./ranking";

/*
 * Candidate generation for the For you feed (2026-10-19). Each source below is
 * its own small query, the way large recommenders gather candidates before
 * ranking them, so a source can be tuned or replaced (by collaborative
 * filtering trained offline, say) without touching the others:
 *
 *   followed      videos from founders and startups the viewer follows
 *   affinity      the viewer's strongest industries
 *   similar       what viewers who liked the same videos also liked
 *   trending      the best engagement over the last week
 *   fresh         posted in the last week
 *   underexposed  seen least, so new founders are seen at all
 *   explore       a sample from everything else
 *
 * Only videos the owner approved, from approved startups, are candidates. No
 * source reads market data; see ranking.ts.
 */

const { videos, startups, founders, videoEvents, videoLikes, videoSaves, comments, founderFollows, startupFollows, viewerInterests } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export type Viewer = { key: string | null; userId: string | null };

const DAY_MS = 86_400_000;
const STATS_WINDOW_DAYS = 60;
const SEEN_WINDOW_DAYS = 45;
const PER_SOURCE = 40;
const POSITIVE = ["complete", "like", "save", "share", "rewatch"] as const;

/** Approved videos whose startup is approved too, with the founder still approved or absent. */
function publishedVideo() {
  return and(eq(videos.status, "approved"), isNotNull(videos.publishedAt), eq(startups.status, "approved"),
    sql`(${videos.founderId} is null or exists (select 1 from ${founders} f where f.id = ${videos.founderId} and f.status = 'approved'))`);
}

type Row = { videoId: string; startupId: string; founderId: string | null; industry: string; publishedAt: Date; durationSeconds: number };

const rowColumns = {
  videoId: videos.id, startupId: videos.startupId, founderId: videos.founderId, industry: startups.industry,
  publishedAt: videos.publishedAt, durationSeconds: videos.durationSeconds,
};

async function select<Q extends PgQueryResultHKT>(database: Database<Q>, where: ReturnType<typeof and>, order: ReturnType<typeof desc> | ReturnType<typeof sql>, limit = PER_SOURCE): Promise<Row[]> {
  const rows = await database.select(rowColumns).from(videos).innerJoin(startups, eq(startups.id, videos.startupId))
    .where(and(publishedVideo(), where)).orderBy(order).limit(limit);
  return rows.map((r) => ({ ...r, publishedAt: r.publishedAt as Date }));
}

/** What this viewer has shown us: interests, follows, what they saw and what they said no to. */
export async function readViewerProfile<Q extends PgQueryResultHKT>(database: Database<Q>, viewer: Viewer, now: Date): Promise<ViewerProfile> {
  const profile: ViewerProfile = {
    interests: {}, followedFounders: new Set(), followedStartups: new Set(), seen: new Map(),
    notInterestedVideos: new Set(), notInterestedStartups: new Set(), notInterestedFounders: new Set(),
  };
  const since = new Date(now.getTime() - SEEN_WINDOW_DAYS * DAY_MS);
  const key = viewer.key;
  // Independent reads, in parallel.
  const [f, s, interests, seen] = await Promise.all([
    viewer.userId ? database.select({ id: founderFollows.founderId }).from(founderFollows).where(eq(founderFollows.userId, viewer.userId)) : [],
    viewer.userId ? database.select({ id: startupFollows.startupId }).from(startupFollows).where(eq(startupFollows.userId, viewer.userId)) : [],
    key ? database.select({ industry: viewerInterests.industry, score: viewerInterests.score, updatedAt: viewerInterests.updatedAt })
      .from(viewerInterests).where(eq(viewerInterests.viewerKey, key)) : [],
    key ? readSeen(database, key, since) : [],
  ]);
  profile.followedFounders = new Set(f.map((r) => r.id));
  profile.followedStartups = new Set(s.map((r) => r.id));
  for (const row of interests) {
    const days = Math.max(0, (now.getTime() - row.updatedAt.getTime()) / DAY_MS);
    profile.interests[row.industry] = row.score * 0.97 ** days;
  }
  if (!key) return profile;
  const hidden: string[] = [];
  const shown = new Map<string, { at: Date; progress: number; skipped: boolean }>();
  for (const row of seen) {
    if (row.notInterested) hidden.push(row.videoId);
    // An impression alone (scrolled past in the list) is not "seen" for ranking.
    if (row.shown) shown.set(row.videoId, { at: new Date(row.at), progress: Number(row.progress) / 10_000, skipped: !!row.skipped && Number(row.progress) < 1500 });
  }
  profile.seen = shown;
  profile.notInterestedVideos = new Set(hidden);
  if (hidden.length) {
    const owners = await database.select({ startupId: videos.startupId, founderId: videos.founderId }).from(videos).where(inArray(videos.id, hidden));
    profile.notInterestedStartups = new Set(owners.map((o) => o.startupId));
  }
  return profile;
}

/** What one viewer has been shown recently, per video. */
async function readSeen<Q extends PgQueryResultHKT>(database: Database<Q>, key: string, since: Date) {
  return database.select({
    videoId: videoEvents.videoId,
    at: sql<Date>`max(${videoEvents.createdAt})`,
    progress: sql<number>`max(${videoEvents.progressBp})::int`,
    skipped: sql<boolean>`bool_or(${videoEvents.kind} = 'skip')`,
    shown: sql<boolean>`bool_or(${videoEvents.kind} in ('watch', 'complete', 'skip', 'rewatch'))`,
    notInterested: sql<boolean>`bool_or(${videoEvents.kind} = 'not_interested')`,
  }).from(videoEvents).where(and(eq(videoEvents.viewerKey, key), gte(videoEvents.createdAt, since))).groupBy(videoEvents.videoId);
}

/** Engagement counts for a set of videos over the stats window. */
export async function readVideoStats<Q extends PgQueryResultHKT>(database: Database<Q>, ids: readonly string[], now: Date): Promise<Map<string, VideoStats>> {
  const out = new Map<string, VideoStats>();
  if (ids.length === 0) return out;
  const since = new Date(now.getTime() - STATS_WINDOW_DAYS * DAY_MS);
  const [events, likes, saves, talk] = await Promise.all([database.select({
    videoId: videoEvents.videoId,
    impressions: sql<number>`count(*) filter (where ${videoEvents.kind} = 'impression')::int`,
    watches: sql<number>`count(*) filter (where ${videoEvents.kind} = 'watch')::int`,
    completes: sql<number>`count(*) filter (where ${videoEvents.kind} = 'complete')::int`,
    skips: sql<number>`count(*) filter (where ${videoEvents.kind} = 'skip')::int`,
    rewatches: sql<number>`count(*) filter (where ${videoEvents.kind} = 'rewatch')::int`,
    shares: sql<number>`count(*) filter (where ${videoEvents.kind} = 'share')::int`,
    follows: sql<number>`count(*) filter (where ${videoEvents.kind} in ('follow_founder', 'follow_startup'))::int`,
    progress: sql<number>`coalesce(avg(${videoEvents.progressBp}) filter (where ${videoEvents.kind} = 'watch'), 0)::float`,
  }).from(videoEvents).where(and(inArray(videoEvents.videoId, [...ids]), gte(videoEvents.createdAt, since))).groupBy(videoEvents.videoId),
  database.select({ videoId: videoLikes.videoId, n: sql<number>`count(*)::int` }).from(videoLikes).where(inArray(videoLikes.videoId, [...ids])).groupBy(videoLikes.videoId),
  database.select({ videoId: videoSaves.videoId, n: sql<number>`count(*)::int` }).from(videoSaves).where(inArray(videoSaves.videoId, [...ids])).groupBy(videoSaves.videoId),
  database.select({ videoId: comments.targetId, n: sql<number>`count(*)::int` }).from(comments)
    .where(and(eq(comments.target, "video"), inArray(comments.targetId, [...ids]), sql`${comments.removedAt} is null`)).groupBy(comments.targetId)]);
  const count = (list: { videoId: string; n: number }[]) => new Map(list.map((r) => [r.videoId, Number(r.n)]));
  const [likeMap, saveMap, talkMap] = [count(likes), count(saves), count(talk)];
  const byVideo = new Map(events.map((e) => [e.videoId, e]));
  for (const id of ids) {
    const e = byVideo.get(id);
    out.set(id, {
      impressions: Number(e?.impressions ?? 0), watches: Number(e?.watches ?? 0), completes: Number(e?.completes ?? 0),
      skips: Number(e?.skips ?? 0), rewatches: Number(e?.rewatches ?? 0), shares: Number(e?.shares ?? 0), follows: Number(e?.follows ?? 0),
      meanProgress: Number(e?.progress ?? 0) / 10_000,
      likes: likeMap.get(id) ?? 0, saves: saveMap.get(id) ?? 0, comments: talkMap.get(id) ?? 0,
    });
  }
  return out;
}

/** Gathers candidates from every source, merged, with the sources that found each one. */
export async function gatherCandidates<Q extends PgQueryResultHKT>(
  database: Database<Q>, viewer: Viewer, profile: ViewerProfile, now: Date, options: { following?: boolean } = {},
): Promise<Candidate[]> {
  const found = new Map<string, { row: Row; sources: Set<CandidateSource> }>();
  const add = (rows: Row[], source: CandidateSource) => {
    for (const row of rows) {
      const entry = found.get(row.videoId) ?? { row, sources: new Set<CandidateSource>() };
      entry.sources.add(source);
      found.set(row.videoId, entry);
    }
  };
  const week = new Date(now.getTime() - 7 * DAY_MS);
  // Every source is its own query, run side by side.
  const sources: Promise<[Row[], CandidateSource]>[] = [];
  const from = (source: CandidateSource, rows: Promise<Row[]>) => sources.push(rows.then((list) => [list, source]));

  const followedFounders = [...profile.followedFounders];
  const followedStartups = [...profile.followedStartups];
  if (followedFounders.length || followedStartups.length) {
    from("followed", select(database, sql`(${followedFounders.length ? inArray(videos.founderId, followedFounders) : sql`false`} or ${followedStartups.length ? inArray(videos.startupId, followedStartups) : sql`false`})`, desc(videos.publishedAt), 80));
  }
  if (!options.following) {
    const top = Object.entries(profile.interests).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    if (top.length) from("affinity", select(database, inArray(startups.industry, top as (typeof startups.industry.enumValues)[number][]), desc(videos.publishedAt)));
    if (viewer.key) from("similar", similarVideos(database, viewer.key));
    const positive = POSITIVE.map((k) => `'${k}'`).join(", ");
    from("trending", select(database, sql`true`, sql`(select count(*) from ${videoEvents} e where e.video_id = ${videos.id} and e.created_at >= ${week.toISOString()}::timestamptz and e.kind in (${sql.raw(positive)})) desc`));
    from("fresh", select(database, gte(videos.publishedAt, week), desc(videos.publishedAt)));
    from("underexposed", select(database, sql`true`, sql`(select count(*) from ${videoEvents} e where e.video_id = ${videos.id} and e.kind = 'impression') asc`, 20));
    from("explore", select(database, sql`true`, sql`md5(${videos.id}::text || ${now.toISOString().slice(0, 13)})`, 20));
  }
  for (const [rows, source] of await Promise.all(sources)) add(rows, source);
  return build(database, found, now);
}

/** Viewers who engaged with the same videos as this one, and what else they engaged with: collaborative filtering at its simplest. */
async function similarVideos<Q extends PgQueryResultHKT>(database: Database<Q>, viewerKey: string): Promise<Row[]> {
  const similar = await database.execute(sql`
    with mine as (
      select distinct video_id from ${videoEvents} where viewer_key = ${viewerKey} and kind in ('complete', 'like', 'save', 'share', 'rewatch')
    ), neighbours as (
      select viewer_key, count(*) as overlap from ${videoEvents}
      where video_id in (select video_id from mine) and viewer_key <> ${viewerKey} and kind in ('complete', 'like', 'save', 'share', 'rewatch')
      group by viewer_key order by overlap desc limit 60
    )
    select e.video_id as id, sum(n.overlap)::int as weight from ${videoEvents} e join neighbours n on n.viewer_key = e.viewer_key
    where e.kind in ('complete', 'like', 'save', 'share', 'rewatch') and e.video_id not in (select video_id from mine)
    group by e.video_id order by weight desc limit ${PER_SOURCE}`);
  const list = (Array.isArray(similar) ? similar : (similar as unknown as { rows: { id: string }[] }).rows) as { id: string }[];
  return list.length ? select(database, inArray(videos.id, list.map((r) => r.id)), desc(videos.publishedAt)) : [];
}

async function build<Q extends PgQueryResultHKT>(database: Database<Q>, found: Map<string, { row: Row; sources: Set<CandidateSource> }>, now: Date): Promise<Candidate[]> {
  const ids = [...found.keys()];
  const founderIds = [...new Set([...found.values()].map((f) => f.row.founderId).filter((id): id is string => !!id))];
  const [stats, rows] = await Promise.all([
    readVideoStats(database, ids, now),
    founderIds.length ? database.select({ founderId: videos.founderId, n: sql<number>`count(*)::int` }).from(videoEvents)
      .innerJoin(videos, eq(videos.id, videoEvents.videoId)).where(and(inArray(videos.founderId, founderIds), eq(videoEvents.kind, "impression"))).groupBy(videos.founderId) : [],
  ]);
  const exposure = new Map<string, number>();
  for (const row of rows) if (row.founderId) exposure.set(row.founderId, Number(row.n));
  return [...found.values()].map(({ row, sources }) => ({
    ...row, stats: stats.get(row.videoId)!, founderImpressions: row.founderId ? exposure.get(row.founderId) ?? 0 : 0, sources: [...sources],
  }));
}
