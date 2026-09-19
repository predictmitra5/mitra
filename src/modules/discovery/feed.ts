import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { price } from "@/modules/market/lmsr";
import { toLmsr } from "@/modules/market/quote";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { justAdded, rankMarkets, type FeedReason, type MarketSignals, type RankedMarket } from "./ranking";

const { markets, profiles, trades, feedEvents } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

/**
 * The public feed, decided 2026-09-19. Anyone may read this without an account,
 * so the projection below is the whole contract: it carries exactly what an
 * approved market page already shows in public, and nothing else. No account
 * identifiers, no wallet or position data, no owner notes, no objections.
 */
export type FeedCard = {
  id: string;
  question: string;
  goalType: string | null;
  deadlineAt: Date;
  /** The subject's public display name and handle, as the market page shows them. */
  displayName: string;
  handle: string;
  yesPrice: number;
  tradingOpen: boolean;
  reason: FeedReason;
};

/** A tab across the top of the feed. The owner chose to group by person. */
export type FeedPerson = {
  handle: string;
  displayName: string;
  openGoals: number;
};

export type Feed = {
  cards: FeedCard[];
  justAdded: FeedCard[];
  people: FeedPerson[];
};

const SIGNAL_WINDOW_HOURS = 24;
/** An upper bound on one page of the feed, so a busy app cannot render forever. */
const MAX_CARDS = 60;

type FeedRow = MarketSignals & {
  question: string;
  goalType: string | null;
  displayName: string;
  handle: string;
  liquidityMicro: number;
  yesSharesMicro: number | null;
  noSharesMicro: number | null;
  tradingClosedAt: Date | null;
};

function toCard(row: RankedMarket<FeedRow>, now: Date): FeedCard {
  return {
    id: row.id,
    question: row.question,
    goalType: row.goalType,
    deadlineAt: row.deadlineAt,
    displayName: row.displayName,
    handle: row.handle,
    yesPrice: price(
      toLmsr({
        liquidity: row.liquidityMicro / MICRO_PER_UNIT,
        yesSharesMicro: row.yesSharesMicro as number,
        noSharesMicro: row.noSharesMicro as number,
      }),
      "YES",
    ),
    tradingOpen: !row.tradingClosedAt && row.deadlineAt.getTime() > now.getTime(),
    reason: row.reason,
  };
}

/**
 * Read every open, approved goal with its last 24 hours of activity, then rank
 * it. The counts come from `feed_events` and `trades`; `feed_events` carries no
 * viewer identity, so clicks cannot be deduplicated per person.
 */
export async function readFeed<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date = new Date(),
): Promise<Feed> {
  const since = new Date(now.getTime() - SIGNAL_WINDOW_HOURS * 3_600_000);

  const clickCounts = database
    .select({
      marketId: feedEvents.marketId,
      clicks: sql<number>`count(*)::int`.as("clicks"),
    })
    .from(feedEvents)
    .where(and(eq(feedEvents.kind, "click"), gte(feedEvents.createdAt, since)))
    .groupBy(feedEvents.marketId)
    .as("click_counts");

  const tradeCounts = database
    .select({
      marketId: trades.marketId,
      trades: sql<number>`count(*)::int`.as("trades"),
      traders: sql<number>`count(distinct ${trades.userId})::int`.as("traders"),
    })
    .from(trades)
    .where(gte(trades.createdAt, since))
    .groupBy(trades.marketId)
    .as("trade_counts");

  const rows = await database
    .select({
      id: markets.id,
      subjectUserId: markets.subjectUserId,
      approvedAt: markets.approvedAt,
      deadlineAt: markets.deadlineAt,
      tradingClosedAt: markets.tradingClosedAt,
      question: markets.question,
      goalType: markets.goalType,
      displayName: profiles.displayName,
      handle: profiles.handle,
      liquidityMicro: markets.liquidityMicro,
      yesSharesMicro: markets.yesSharesMicro,
      noSharesMicro: markets.noSharesMicro,
      clicks: sql<number>`coalesce(${clickCounts.clicks}, 0)`,
      trades: sql<number>`coalesce(${tradeCounts.trades}, 0)`,
      traders: sql<number>`coalesce(${tradeCounts.traders}, 0)`,
    })
    .from(markets)
    .innerJoin(profiles, eq(profiles.id, markets.subjectUserId))
    .leftJoin(clickCounts, eq(clickCounts.marketId, markets.id))
    .leftJoin(tradeCounts, eq(tradeCounts.marketId, markets.id))
    .where(and(eq(markets.status, "open"), isNotNull(markets.approvedAt)))
    .limit(MAX_CARDS);

  const signals: FeedRow[] = rows
    // Approval sets the price; a row without one cannot be shown or ranked.
    .filter((row) => row.approvedAt !== null && row.yesSharesMicro !== null && row.noSharesMicro !== null)
    .map((row) => ({
      id: row.id,
      subjectUserId: row.subjectUserId,
      approvedAt: row.approvedAt as Date,
      deadlineAt: row.deadlineAt,
      tradingClosedAt: row.tradingClosedAt,
      clicks24h: Number(row.clicks),
      trades24h: Number(row.trades),
      uniqueTraders24h: Number(row.traders),
      question: row.question,
      goalType: row.goalType,
      displayName: row.displayName,
      handle: row.handle,
      liquidityMicro: row.liquidityMicro,
      yesSharesMicro: row.yesSharesMicro,
      noSharesMicro: row.noSharesMicro,
    }));

  const ranked = rankMarkets(signals, now);
  const fresh = justAdded(ranked, now);

  const people = new Map<string, FeedPerson>();
  for (const row of signals) {
    const existing = people.get(row.handle);
    if (existing) existing.openGoals += 1;
    else people.set(row.handle, { handle: row.handle, displayName: row.displayName, openGoals: 1 });
  }

  return {
    cards: ranked.map((row) => toCard(row, now)),
    justAdded: fresh.map((row) => toCard(row, now)),
    people: [...people.values()].sort(
      (a, b) => b.openGoals - a.openGoals || a.displayName.localeCompare(b.displayName),
    ),
  };
}

/**
 * Record that these goals were shown in the feed. Measurement must never break
 * the page, so a failure here is swallowed: a missing row costs a little ranking
 * accuracy, while a thrown error would blank the home page for every visitor.
 */
export async function recordExposures<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  marketIds: readonly string[],
): Promise<void> {
  if (marketIds.length === 0) return;
  try {
    await database
      .insert(feedEvents)
      .values(marketIds.map((marketId) => ({ marketId, kind: "exposure" as const })));
  } catch {
    // Deliberately ignored; see above.
  }
}

/** Record that a goal page was opened. Swallowed on failure for the same reason. */
export async function recordClick<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  marketId: string,
): Promise<void> {
  try {
    await database.insert(feedEvents).values({ marketId, kind: "click" });
  } catch {
    // Deliberately ignored; see above.
  }
}

/** Counts for a set of goals, for checking that measurement actually records. */
export async function readEventCounts<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  marketIds: readonly string[],
): Promise<Map<string, { exposures: number; clicks: number }>> {
  const counts = new Map<string, { exposures: number; clicks: number }>();
  if (marketIds.length === 0) return counts;
  const rows = await database
    .select({
      marketId: feedEvents.marketId,
      kind: feedEvents.kind,
      total: sql<number>`count(*)::int`,
    })
    .from(feedEvents)
    .where(inArray(feedEvents.marketId, [...marketIds]))
    .groupBy(feedEvents.marketId, feedEvents.kind);

  for (const row of rows) {
    const entry = counts.get(row.marketId) ?? { exposures: 0, clicks: 0 };
    if (row.kind === "exposure") entry.exposures = Number(row.total);
    else entry.clicks = Number(row.total);
    counts.set(row.marketId, entry);
  }
  return counts;
}
