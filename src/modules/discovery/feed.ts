import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { price } from "@/modules/market/lmsr";
import { toLmsr } from "@/modules/market/quote";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { isUuid } from "@/modules/market/input";
import { rankMarkets, type FeedReason, type MarketSignals, type RankedMarket } from "./ranking";

const { markets, profiles, trades, feedEventBuckets, priceHistory } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export const FEED_EVENT_RETENTION_HOURS = 24;
const MAX_CLICKS_PER_MARKET_HOUR = 3;
const MAX_EXPOSURES_PER_MARKET_HOUR = 500;

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
  /** When their profile photo last changed, which versions its public URL; null without one. */
  photoUpdatedAt: Date | null;
  yesPrice: number;
  tradingOpen: boolean;
  reason: FeedReason;
  /** When the goal went live, for "2d ago" in the card's meta line. */
  approvedAt: Date;
  /**
   * Points traded on this goal, all time. An aggregate, shown the way
   * Kalshi shows volume. Trader counts are deliberately not exposed: in a small
   * group "1 trader" can identify a person.
   */
  volumeMicro: number;
  /** YES price now minus 24 hours ago, in basis points. Opening price if younger. */
  change24hBp: number;
};

/** One point of a goal's price history, for a chart. */
export type PricePoint = { at: Date; yesBp: number };

/**
 * The featured goal carries its history, so the feed can draw its chart.
 * `moving` says it was chosen as the goal moving most today; when nothing
 * moved, the leading traded goal stands in and is not called a mover.
 */
export type FeaturedGoal = FeedCard & { series: PricePoint[]; moving: boolean };

export type Feed = {
  /** Every open goal, in ranked order. */
  cards: FeedCard[];
  /** One goal with its chart, decided 2026-09-24: the one moving most today. */
  featured: FeaturedGoal | null;
  /** Open goals whose trading deadline is nearest, for the desktop side list. */
  closingSoon: FeedCard[];
};

const CLOSING_SOON_COUNT = 5;
/** How many goals the ticker carries. */
export const TICKER_COUNT = 20;
/** A chart wider than this many points is visually identical; keep payloads small. */
const MAX_SERIES_POINTS = 120;

const SIGNAL_WINDOW_HOURS = 24;
/** An upper bound on one page of the feed, so a busy app cannot render forever. */
const MAX_CARDS = 60;

type FeedRow = MarketSignals & {
  question: string;
  goalType: string | null;
  displayName: string;
  handle: string;
  photoUpdatedAt: Date | null;
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
    photoUpdatedAt: row.photoUpdatedAt,
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
    approvedAt: row.approvedAt,
    // Filled in by readFeed once volume and history are loaded.
    volumeMicro: 0,
    change24hBp: 0,
  };
}

/** Evenly thins a series to at most max points, always keeping both ends. */
export function thinSeries(points: readonly PricePoint[], max = MAX_SERIES_POINTS): PricePoint[] {
  if (points.length <= max) return [...points];
  const out: PricePoint[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]);
  return out;
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
  const cards = await readRankedCards(database, now);
  const open = cards.filter((card) => card.tradingOpen);

  // "Moving most today" (2026-09-24): the biggest 24-hour move either way, ties
  // kept in rank order. When nothing moved, the leading traded goal stands in,
  // because a chart of a goal nobody has traded is a flat line.
  const mover = [...open]
    .filter((card) => card.change24hBp !== 0)
    .sort((a, b) => Math.abs(b.change24hBp) - Math.abs(a.change24hBp))[0];
  const pick = mover ?? open.find((card) => card.volumeMicro > 0) ?? open[0] ?? cards[0];
  let featured: FeaturedGoal | null = null;
  if (pick) {
    const history = (await readSeries(database, [pick.id])).get(pick.id) ?? [];
    // End the line at the live price, so the chart agrees with the buttons beside it.
    const current = { at: now, yesBp: Math.round(pick.yesPrice * 10_000) };
    featured = { ...pick, series: thinSeries([...history, current]), moving: pick === mover };
  }

  return {
    cards,
    featured,
    closingSoon: [...open]
      .sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime())
      .slice(0, CLOSING_SOON_COUNT),
  };
}

/** The leading goals for the price ticker on pages other than the feed. */
export async function readTicker<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date = new Date(),
): Promise<FeedCard[]> {
  return (await readRankedCards(database, now)).slice(0, TICKER_COUNT);
}

/** Every open goal, ranked, with its volume and 24-hour change filled in. */
async function readRankedCards<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date,
): Promise<FeedCard[]> {
  const since = new Date(now.getTime() - SIGNAL_WINDOW_HOURS * 3_600_000);

  const clickCounts = database
    .select({
      marketId: feedEventBuckets.marketId,
      clicks: sql<number>`sum(${feedEventBuckets.eventCount})::int`.as("clicks"),
    })
    .from(feedEventBuckets)
    .where(and(eq(feedEventBuckets.kind, "click"), gte(feedEventBuckets.bucketAt, since)))
    .groupBy(feedEventBuckets.marketId)
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
      photoUpdatedAt: profiles.photoUpdatedAt,
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
    // A banned or withdrawn person's goals are being cancelled; never show them meanwhile.
    .where(and(eq(markets.status, "open"), isNotNull(markets.approvedAt), isNull(profiles.bannedAt), isNull(profiles.withdrawnAt)))
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
      photoUpdatedAt: row.photoUpdatedAt,
      liquidityMicro: row.liquidityMicro,
      yesSharesMicro: row.yesSharesMicro,
      noSharesMicro: row.noSharesMicro,
    }));

  const cards = rankMarkets(signals, now).map((row) => toCard(row, now));
  const ids = cards.map((card) => card.id);
  const info = await readMarketInformation(database, ids, since);
  for (const card of cards) {
    card.volumeMicro = info.volume.get(card.id) ?? 0;
    const then = info.priceThen.get(card.id);
    card.change24hBp = then === undefined ? 0 : Math.round(card.yesPrice * 10_000) - then;
  }
  return cards;
}

/** A goal's live numbers, for pages that refresh prices while open. */
export type Quote = { id: string; yesBp: number; change24hBp: number; volumeMicro: number; tradingOpen: boolean };

/** One request refreshes at most a full feed page. */
export const MAX_QUOTES = MAX_CARDS;
const QUOTABLE = ["open", "closed", "ruled", "settled", "cancelled"] as const;

/**
 * Live prices for goals a page is already showing (decided 2026-09-24: prices
 * refresh about every 15 seconds). Read-only on purpose: it records no view or
 * click, so a page polling it cannot inflate the counts the feed ranks by. It
 * returns only numbers the goal's public page already shows.
 */
export async function readQuotes<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  ids: readonly string[],
  now: Date = new Date(),
): Promise<Quote[]> {
  const list = [...new Set(ids)].filter(isUuid).slice(0, MAX_QUOTES);
  if (list.length === 0) return [];
  const rows = await database
    .select({
      id: markets.id, status: markets.status, deadlineAt: markets.deadlineAt, tradingClosedAt: markets.tradingClosedAt,
      liquidityMicro: markets.liquidityMicro, yesSharesMicro: markets.yesSharesMicro, noSharesMicro: markets.noSharesMicro,
    })
    .from(markets)
    .where(and(inArray(markets.id, list), isNotNull(markets.approvedAt), inArray(markets.status, [...QUOTABLE])));
  const priced = rows.filter((row) => row.yesSharesMicro !== null && row.noSharesMicro !== null);
  const since = new Date(now.getTime() - SIGNAL_WINDOW_HOURS * 3_600_000);
  const info = await readMarketInformation(database, priced.map((row) => row.id), since);
  return priced.map((row) => {
    const yesBp = Math.round(price(toLmsr({
      liquidity: row.liquidityMicro / MICRO_PER_UNIT, yesSharesMicro: row.yesSharesMicro as number, noSharesMicro: row.noSharesMicro as number,
    }), "YES") * 10_000);
    const then = info.priceThen.get(row.id);
    return {
      id: row.id,
      yesBp,
      change24hBp: then === undefined ? 0 : yesBp - then,
      volumeMicro: info.volume.get(row.id) ?? 0,
      tradingOpen: row.status === "open" && !row.tradingClosedAt && row.deadlineAt.getTime() > now.getTime(),
    };
  });
}

/**
 * Volume and the price 24 hours ago, for a set of goals. The earlier price is
 * the last recorded point at or before the window; a goal younger than that
 * falls back to its first point, which approval writes at the opening price.
 */
async function readMarketInformation<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  ids: readonly string[],
  since: Date,
): Promise<{ volume: Map<string, number>; priceThen: Map<string, number> }> {
  const volume = new Map<string, number>();
  const priceThen = new Map<string, number>();
  if (ids.length === 0) return { volume, priceThen };
  const list = [...ids];

  const volumes = await database
    .select({ marketId: trades.marketId, total: sql<string>`coalesce(sum(${trades.amountMicro}), 0)` })
    .from(trades)
    .where(inArray(trades.marketId, list))
    .groupBy(trades.marketId);
  for (const row of volumes) volume.set(row.marketId, Number(row.total));

  const before = await database
    .selectDistinctOn([priceHistory.marketId], { marketId: priceHistory.marketId, yesBp: priceHistory.yesPriceBp })
    .from(priceHistory)
    .where(and(inArray(priceHistory.marketId, list), lte(priceHistory.recordedAt, since)))
    .orderBy(priceHistory.marketId, desc(priceHistory.recordedAt));
  for (const row of before) priceThen.set(row.marketId, row.yesBp);

  const missing = list.filter((id) => !priceThen.has(id));
  if (missing.length) {
    const first = await database
      .selectDistinctOn([priceHistory.marketId], { marketId: priceHistory.marketId, yesBp: priceHistory.yesPriceBp })
      .from(priceHistory)
      .where(inArray(priceHistory.marketId, missing))
      .orderBy(priceHistory.marketId, asc(priceHistory.recordedAt));
    for (const row of first) priceThen.set(row.marketId, row.yesBp);
  }

  return { volume, priceThen };
}

/** Full recorded price history for a few goals, oldest first. */
async function readSeries<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  ids: readonly string[],
): Promise<Map<string, PricePoint[]>> {
  const out = new Map<string, PricePoint[]>();
  if (ids.length === 0) return out;
  const rows = await database
    .select({ marketId: priceHistory.marketId, at: priceHistory.recordedAt, yesBp: priceHistory.yesPriceBp })
    .from(priceHistory)
    .where(inArray(priceHistory.marketId, [...ids]))
    .orderBy(asc(priceHistory.recordedAt));
  for (const row of rows) {
    const list = out.get(row.marketId) ?? [];
    list.push({ at: row.at, yesBp: row.yesBp });
    out.set(row.marketId, list);
  }
  return out;
}

/** One goal's price history, for its own page. Public: prices are already public. */
export async function readPriceSeries<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  marketId: string,
  current: { at: Date; yesBp: number },
): Promise<PricePoint[]> {
  const history = (await readSeries(database, [marketId])).get(marketId) ?? [];
  return thinSeries([...history, current]);
}

/**
 * Record that these goals were shown in the feed. Measurement must never break
 * the page, so a failure here is swallowed: a missing row costs a little ranking
 * accuracy, while a thrown error would blank the home page for every visitor.
 */
export async function recordExposures<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  marketIds: readonly string[],
  now: Date = new Date(),
): Promise<void> {
  if (marketIds.length === 0) return;
  try {
    const hour = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
    const counts = new Map<string, number>();
    for (const id of marketIds) if (isUuid(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!counts.size) return;
    await database.insert(feedEventBuckets).values([...counts].map(([marketId, eventCount]) => ({
      marketId, kind: "exposure" as const, bucketAt: new Date(hour), eventCount,
    }))).onConflictDoUpdate({
      target: [feedEventBuckets.marketId, feedEventBuckets.kind, feedEventBuckets.bucketAt],
      set: { eventCount: sql`least(${feedEventBuckets.eventCount} + excluded.event_count, ${MAX_EXPOSURES_PER_MARKET_HOUR})` },
    });
  } catch {
    // Deliberately ignored; see above.
  }
}

/** Record that a goal page was opened. Swallowed on failure for the same reason. */
export async function recordClick<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  marketId: string,
  now: Date = new Date(),
): Promise<void> {
  if (!isUuid(marketId)) return;
  try {
    const hour = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
    await database.insert(feedEventBuckets).values({
      marketId, kind: "click", bucketAt: new Date(hour), eventCount: 1,
    }).onConflictDoUpdate({
      target: [feedEventBuckets.marketId, feedEventBuckets.kind, feedEventBuckets.bucketAt],
      set: { eventCount: sql`least(${feedEventBuckets.eventCount} + 1, ${MAX_CLICKS_PER_MARKET_HOUR})` },
    });
  } catch {
    // Deliberately ignored; see above.
  }
}

/** Old aggregate buckets are no longer part of ranking and can be discarded. */
export async function pruneFeedEventBuckets<Q extends PgQueryResultHKT>(database: Database<Q>, now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - FEED_EVENT_RETENTION_HOURS * 3_600_000);
  await database.delete(feedEventBuckets).where(lte(feedEventBuckets.bucketAt, cutoff));
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
      marketId: feedEventBuckets.marketId,
      kind: feedEventBuckets.kind,
      total: sql<number>`sum(${feedEventBuckets.eventCount})::int`,
    })
    .from(feedEventBuckets)
    .where(inArray(feedEventBuckets.marketId, [...marketIds]))
    .groupBy(feedEventBuckets.marketId, feedEventBuckets.kind);

  for (const row of rows) {
    const entry = counts.get(row.marketId) ?? { exposures: 0, clicks: 0 };
    if (row.kind === "exposure") entry.exposures = Number(row.total);
    else entry.clicks = Number(row.total);
    counts.set(row.marketId, entry);
  }
  return counts;
}
