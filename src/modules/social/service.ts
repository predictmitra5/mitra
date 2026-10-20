import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { isInactive } from "@/modules/account/standing";
import { photoUrl } from "@/modules/account/photo-url";

/*
 * Likes, saves, follows, comments and reports (2026-10-19). Every write needs
 * an active, adult-confirmed account; the caller passes the freshly verified
 * identity, never an id from a form. Toggles are idempotent: liking twice is
 * one like.
 */

const { profiles, videos, startups, founders, markets, videoLikes, videoSaves, founderFollows, startupFollows, comments, reports } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export class SocialError extends Error {
  constructor(public readonly code: "PROFILE_REQUIRED" | "NOT_FOUND" | "INVALID_INPUT" | "RATE_LIMITED", message: string) {
    super(message); this.name = "SocialError";
  }
}

export async function requireMember<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  if (!isUuid(userId)) throw new SocialError("PROFILE_REQUIRED", "Log in to do that.");
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile || !profile.adultConfirmedAt || isInactive(profile)) throw new SocialError("PROFILE_REQUIRED", "Finish setting up your account first.");
  return profile;
}

async function approvedVideo<Q extends PgQueryResultHKT>(database: Database<Q>, videoId: string) {
  if (!isUuid(videoId)) throw new SocialError("NOT_FOUND", "That video isn't available.");
  const [row] = await database.select({ id: videos.id, startupId: videos.startupId, founderId: videos.founderId }).from(videos)
    .innerJoin(startups, eq(startups.id, videos.startupId)).where(and(eq(videos.id, videoId), eq(videos.status, "approved"), eq(startups.status, "approved")));
  if (!row) throw new SocialError("NOT_FOUND", "That video isn't available.");
  return row;
}

export type Toggle = { on: boolean; count: number };

export async function setLike<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, videoId: string, on: boolean): Promise<Toggle> {
  await requireMember(database, userId);
  await approvedVideo(database, videoId);
  if (on) await database.insert(videoLikes).values({ videoId, userId }).onConflictDoNothing();
  else await database.delete(videoLikes).where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userId, userId)));
  return { on, count: await database.$count(videoLikes, eq(videoLikes.videoId, videoId)) };
}

export async function setSave<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, videoId: string, on: boolean): Promise<Toggle> {
  await requireMember(database, userId);
  await approvedVideo(database, videoId);
  if (on) await database.insert(videoSaves).values({ videoId, userId }).onConflictDoNothing();
  else await database.delete(videoSaves).where(and(eq(videoSaves.videoId, videoId), eq(videoSaves.userId, userId)));
  return { on, count: await database.$count(videoSaves, eq(videoSaves.videoId, videoId)) };
}

export async function setFounderFollow<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, founderId: string, on: boolean): Promise<Toggle> {
  await requireMember(database, userId);
  if (!isUuid(founderId)) throw new SocialError("NOT_FOUND", "That founder isn't available.");
  const [founder] = await database.select({ id: founders.id, userId: founders.userId }).from(founders).where(and(eq(founders.id, founderId), eq(founders.status, "approved")));
  if (!founder) throw new SocialError("NOT_FOUND", "That founder isn't available.");
  if (founder.userId === userId) throw new SocialError("INVALID_INPUT", "You can't follow your own founder profile.");
  if (on) await database.insert(founderFollows).values({ founderId, userId }).onConflictDoNothing();
  else await database.delete(founderFollows).where(and(eq(founderFollows.founderId, founderId), eq(founderFollows.userId, userId)));
  return { on, count: await database.$count(founderFollows, eq(founderFollows.founderId, founderId)) };
}

export async function setStartupFollow<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: string, on: boolean): Promise<Toggle> {
  await requireMember(database, userId);
  if (!isUuid(startupId)) throw new SocialError("NOT_FOUND", "That startup isn't available.");
  const [startup] = await database.select({ id: startups.id }).from(startups).where(and(eq(startups.id, startupId), eq(startups.status, "approved")));
  if (!startup) throw new SocialError("NOT_FOUND", "That startup isn't available.");
  if (on) await database.insert(startupFollows).values({ startupId, userId }).onConflictDoNothing();
  else await database.delete(startupFollows).where(and(eq(startupFollows.startupId, startupId), eq(startupFollows.userId, userId)));
  return { on, count: await database.$count(startupFollows, eq(startupFollows.startupId, startupId)) };
}

// --------------------------------------------------------------- comments

export type CommentTarget = "market" | "video" | "startup";
export type CommentView = {
  id: string; body: string; createdAt: Date; parentId: string | null;
  author: { handle: string; name: string; photo: string | null; isDemo: boolean; isFounder: boolean };
};

const MAX_COMMENT = 1000;
const COMMENTS_PER_HOUR = 30;

/** The startup a comment target belongs to, so its founders' comments can be marked. */
async function targetStartup<Q extends PgQueryResultHKT>(database: Database<Q>, target: CommentTarget, targetId: string): Promise<string | null> {
  if (!isUuid(targetId)) return null;
  if (target === "startup") {
    const [row] = await database.select({ id: startups.id }).from(startups).where(and(eq(startups.id, targetId), eq(startups.status, "approved")));
    return row?.id ?? null;
  }
  if (target === "video") {
    const [row] = await database.select({ id: videos.startupId }).from(videos).innerJoin(startups, eq(startups.id, videos.startupId))
      .where(and(eq(videos.id, targetId), eq(videos.status, "approved"), eq(startups.status, "approved")));
    return row?.id ?? null;
  }
  const [row] = await database.select({ id: markets.startupId, approved: markets.approvedAt }).from(markets).where(eq(markets.id, targetId));
  return row?.approved ? row.id ?? "" : null;
}

export async function addComment<Q extends PgQueryResultHKT>(
  database: Database<Q>, userId: string, input: { target: CommentTarget; targetId: string; body: string; parentId?: string | null }, now: Date = new Date(),
) {
  await requireMember(database, userId);
  if (!["market", "video", "startup"].includes(input.target)) throw new SocialError("INVALID_INPUT", "Comment on a market, a video or a startup.");
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (body.length < 1 || body.length > MAX_COMMENT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body)) {
    throw new SocialError("INVALID_INPUT", `Write 1 to ${MAX_COMMENT.toLocaleString("en-US")} characters.`);
  }
  if ((await targetStartup(database, input.target, input.targetId)) === null) throw new SocialError("NOT_FOUND", "That isn't available for comments.");
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const recent = await database.$count(comments, and(eq(comments.userId, userId), sql`${comments.createdAt} > ${hourAgo.toISOString()}::timestamptz`));
  if (recent >= COMMENTS_PER_HOUR) throw new SocialError("RATE_LIMITED", "You've commented a lot this hour. Try again later.");
  const parentId = input.parentId && isUuid(input.parentId) ? input.parentId : null;
  const [row] = await database.insert(comments).values({ target: input.target, targetId: input.targetId, userId, body, parentId, createdAt: now }).returning();
  return row;
}

export async function listComments<Q extends PgQueryResultHKT>(database: Database<Q>, target: CommentTarget, targetId: string, limit = 50): Promise<CommentView[]> {
  if (!isUuid(targetId)) return [];
  const startupId = await targetStartup(database, target, targetId);
  const insiders = new Set<string>();
  if (startupId) {
    const rows = await database.execute(sql`select f.user_id from startup_founders sf join founders f on f.id = sf.founder_id where sf.startup_id = ${startupId} and f.user_id is not null`);
    for (const r of (Array.isArray(rows) ? rows : (rows as unknown as { rows: { user_id: string }[] }).rows) as { user_id: string }[]) insiders.add(r.user_id);
  }
  const rows = await database.select({
    id: comments.id, body: comments.body, createdAt: comments.createdAt, parentId: comments.parentId, userId: comments.userId,
    handle: profiles.handle, name: profiles.displayName, photoUpdatedAt: profiles.photoUpdatedAt, photoPath: profiles.photoPath,
    isDemo: profiles.isDemo, bannedAt: profiles.bannedAt, withdrawnAt: profiles.withdrawnAt,
  }).from(comments).innerJoin(profiles, eq(profiles.id, comments.userId))
    .where(and(eq(comments.target, target), eq(comments.targetId, targetId), isNull(comments.removedAt)))
    .orderBy(desc(comments.createdAt)).limit(Math.min(200, Math.max(1, limit)));
  return rows.filter((r) => !isInactive(r)).map((r) => ({
    id: r.id, body: r.body, createdAt: r.createdAt, parentId: r.parentId,
    author: { handle: r.handle, name: r.name, photo: r.photoPath ? photoUrl(r.handle, r.photoUpdatedAt) : null, isDemo: r.isDemo, isFounder: insiders.has(r.userId) },
  }));
}

// ---------------------------------------------------------------- reports

export type ReportTarget = (typeof schema.reportTarget.enumValues)[number];

export async function fileReport<Q extends PgQueryResultHKT>(
  database: Database<Q>, userId: string, input: { target: ReportTarget; targetId: string; reason: string }, now: Date = new Date(),
) {
  await requireMember(database, userId);
  if (!schema.reportTarget.enumValues.includes(input.target) || !isUuid(input.targetId)) throw new SocialError("INVALID_INPUT", "That can't be reported.");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) throw new SocialError("INVALID_INPUT", "Say briefly what's wrong (3 to 500 characters).");
  const open = await database.$count(reports, and(eq(reports.reporterUserId, userId), eq(reports.targetId, input.targetId), eq(reports.status, "open")));
  if (open > 0) return null; // Already reported; one is enough.
  const [row] = await database.insert(reports).values({ target: input.target, targetId: input.targetId, reporterUserId: userId, reason, createdAt: now }).returning();
  return row;
}

/** Followed founders and startups for the portfolio and activity pages. Private to the member. */
export async function readFollowing<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  if (!isUuid(userId)) return { founders: [], startups: [] };
  const people = await database.select({ id: founders.id, handle: founders.handle, name: founders.name, headline: founders.headline, hue: founders.hue, portraitUrl: founders.portraitUrl })
    .from(founderFollows).innerJoin(founders, eq(founders.id, founderFollows.founderId))
    .where(and(eq(founderFollows.userId, userId), eq(founders.status, "approved"))).orderBy(desc(founderFollows.createdAt));
  const companies = await database.select({ id: startups.id, slug: startups.slug, name: startups.name, tagline: startups.tagline, industry: startups.industry, glyph: startups.glyph, hue: startups.hue, logoUrl: startups.logoUrl, isDemo: startups.isDemo })
    .from(startupFollows).innerJoin(startups, eq(startups.id, startupFollows.startupId))
    .where(and(eq(startupFollows.userId, userId), eq(startups.status, "approved"))).orderBy(desc(startupFollows.createdAt));
  return { founders: people, startups: companies };
}

/** Saved videos, newest first. */
export async function readSavedVideoIds<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, limit = 30): Promise<string[]> {
  if (!isUuid(userId)) return [];
  const rows = await database.select({ id: videoSaves.videoId }).from(videoSaves).where(eq(videoSaves.userId, userId)).orderBy(desc(videoSaves.createdAt)).limit(limit);
  return rows.map((r) => r.id);
}

/** Whether this member follows a startup and its founders, for buttons rendered on the server. */
export async function followState<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string | null | undefined, ids: { startupIds?: string[]; founderIds?: string[] }) {
  const out = { startups: new Set<string>(), founders: new Set<string>() };
  if (!userId || !isUuid(userId)) return out;
  if (ids.startupIds?.length) for (const r of await database.select({ id: startupFollows.startupId }).from(startupFollows).where(and(eq(startupFollows.userId, userId), inArray(startupFollows.startupId, ids.startupIds)))) out.startups.add(r.id);
  if (ids.founderIds?.length) for (const r of await database.select({ id: founderFollows.founderId }).from(founderFollows).where(and(eq(founderFollows.userId, userId), inArray(founderFollows.founderId, ids.founderIds)))) out.founders.add(r.id);
  return out;
}
