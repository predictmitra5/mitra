import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";

/*
 * Activity (2026-10-19): one timeline of what happened to the founders and
 * startups a member follows (updates, milestones, new videos), and to their
 * own trades (fills, payouts, refunds). A visitor, or a member who follows
 * nobody yet, sees the latest updates from every startup instead.
 */

const { startupUpdates, startups, videos, startupFollows, founderFollows, ledgerEntries, markets } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export type ActivityItem =
  | { kind: "update"; id: string; at: Date; title: string; body: string; milestone: boolean; verification: string; startupName: string | null; startupSlug: string | null; isDemo: boolean }
  | { kind: "video"; id: string; at: Date; title: string; startupName: string; startupSlug: string; isDemo: boolean }
  | { kind: "money"; id: string; at: Date; what: "trade_buy" | "trade_sell" | "settlement" | "cancellation_refund"; amountMicro: number; marketId: string; question: string; shortQuestion: string | null };

const DAY = 86_400_000;

export async function readActivity<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string | null, now: Date = new Date(), limit = 60): Promise<{ items: ActivityItem[]; personal: boolean }> {
  const since = new Date(now.getTime() - 120 * DAY);
  let startupIds: string[] = [];
  let founderIds: string[] = [];
  if (userId && isUuid(userId)) {
    startupIds = (await database.select({ id: startupFollows.startupId }).from(startupFollows).where(eq(startupFollows.userId, userId))).map((r) => r.id);
    founderIds = (await database.select({ id: founderFollows.founderId }).from(founderFollows).where(eq(founderFollows.userId, userId))).map((r) => r.id);
  }
  const personal = startupIds.length + founderIds.length > 0;
  const followed = personal
    ? or(startupIds.length ? inArray(startupUpdates.startupId, startupIds) : undefined, founderIds.length ? inArray(startupUpdates.founderId, founderIds) : undefined)
    : undefined;
  const updates = await database.select({
    id: startupUpdates.id, at: startupUpdates.happenedAt, title: startupUpdates.title, body: startupUpdates.body, kind: startupUpdates.kind,
    verification: startupUpdates.verification, isDemo: startupUpdates.isDemo, startupName: startups.name, startupSlug: startups.slug,
  }).from(startupUpdates).leftJoin(startups, eq(startups.id, startupUpdates.startupId))
    .where(and(isNull(startupUpdates.removedAt), gte(startupUpdates.happenedAt, since), or(isNull(startupUpdates.startupId), eq(startups.status, "approved")), followed))
    .orderBy(desc(startupUpdates.happenedAt)).limit(limit);

  const videoFilter = personal
    ? or(startupIds.length ? inArray(videos.startupId, startupIds) : undefined, founderIds.length ? inArray(videos.founderId, founderIds) : undefined)
    : undefined;
  const fresh = await database.select({ id: videos.id, at: videos.publishedAt, title: videos.title, isDemo: videos.isDemo, startupName: startups.name, startupSlug: startups.slug })
    .from(videos).innerJoin(startups, eq(startups.id, videos.startupId))
    .where(and(eq(videos.status, "approved"), eq(startups.status, "approved"), gte(videos.publishedAt, new Date(now.getTime() - 45 * DAY)), videoFilter))
    .orderBy(desc(videos.publishedAt)).limit(20);

  const money = userId && isUuid(userId) ? await database.select({
    id: ledgerEntries.id, at: ledgerEntries.createdAt, what: ledgerEntries.kind, amountMicro: ledgerEntries.amountMicro, marketId: markets.id,
    question: markets.question, shortQuestion: markets.shortQuestion,
  }).from(ledgerEntries).innerJoin(markets, eq(markets.id, ledgerEntries.marketId))
    .where(and(eq(ledgerEntries.userId, userId), inArray(ledgerEntries.kind, ["trade_buy", "trade_sell", "settlement", "cancellation_refund"])))
    .orderBy(desc(ledgerEntries.createdAt)).limit(20) : [];

  const items: ActivityItem[] = [
    ...updates.map((u) => ({ kind: "update" as const, id: u.id, at: u.at, title: u.title, body: u.body, milestone: u.kind === "milestone", verification: u.verification, startupName: u.startupName, startupSlug: u.startupSlug, isDemo: u.isDemo })),
    ...fresh.map((v) => ({ kind: "video" as const, id: v.id, at: v.at as Date, title: v.title, startupName: v.startupName, startupSlug: v.startupSlug, isDemo: v.isDemo })),
    ...money.map((m) => ({ kind: "money" as const, id: m.id, at: m.at, what: m.what as "trade_buy", amountMicro: m.amountMicro, marketId: m.marketId, question: m.question, shortQuestion: m.shortQuestion })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
  return { items, personal };
}
