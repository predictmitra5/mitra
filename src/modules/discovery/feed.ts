import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { price } from "@/modules/market/lmsr";
import { toLmsr } from "@/modules/market/quote";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { isUuid } from "@/modules/market/input";
import { rankMarkets, type FeedReason, type MarketSignals } from "./ranking";

const { markets, venues, events, trades, feedEvents, priceHistory } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type MarketStatus = (typeof schema.marketStatus.enumValues)[number];

/**
 * The public feed, decided 2026-09-19 and moved to event markets on
 * 2026-10-08. Anyone may read this without an account, so the projection below
 * is the whole contract: it carries exactly what a market page already shows in
 * public, and nothing else. No account identifiers, no wallet or position data,
 * no owner notes, no objections, and no people.
 */
export type FeedCard = {
  id: string;
  question: string;
  category: string | null;
  venueName: string | null;
  venueSlug: string | null;
  eventTitle: string | null;
  /** When the measured window starts. */
  windowStartAt: Date | null;
  timeZone: string | null;
  /** A hypothetical demonstration market (2026-10-08), labelled wherever it appears. */
  isSample: boolean;
  /** The trading cutoff. */
  deadlineAt: Date;
  status: MarketStatus;
  ruledOutcome: "yes" | "no" | null;
  yesPrice: number;
  tradingOpen: boolean;
  reason: FeedReason;
  /** When the market opened, for "2d ago". */
  approvedAt: Date;
  /**
   * Points traded on this market, all time. An aggregate, shown the way Kalshi
   * shows volume. Trader counts are deliberately not exposed: in a small group
   * "1 trader" can identify a person.
   */
  volumeMicro: number;
  /** YES price now minus 24 hours ago, in basis points. Opening price if younger. */
  change24hBp: number;
};

/** One point of a market's price history, for a chart. */
export type PricePoint = { at: Date; yesBp: number };

/**
 * The featured market carries its history, so the feed can draw its chart.
 * `moving` says it was chosen as the market moving most today; when nothing
 * moved, the leading traded market stands in and is not called a mover.
 */
export type FeaturedMarket = FeedCard & { series: PricePoint[]; moving: boolean };

export type Feed = {
  /** Every open market in scope, in ranked order. */
  cards: FeedCard[];
  /** Recently closed, resolved and void markets, latest cutoff first, for the status filter. */
  past: FeedCard[];
  /** One market with its chart: the one moving most today. */
  featured: FeaturedMarket | null;
  /** Open markets whose trading cutoff is nearest, for the desktop side list. */
  closingSoon: FeedCard[];
};

export const EMPTY_FEED: Feed = { cards: [], past: [], featured: null, closingSoon: [] };

const CLOSING_SOON_COUNT = 5;
/** How many markets the ticker carries. */
export const TICKER_COUNT = 20;
/** A chart wider than this many points is visually identical; keep payloads small. */
const MAX_SERIES_POINTS = 120;

const SIGNAL_WINDOW_HOURS = 24;
/** An upper bound on one page of the feed, so a busy app cannot render forever. */
const MAX_CARDS = 60;
const MAX_PAST = 40;

/** Which markets a read covers: one campus's, or one venue's. */
export type FeedScope = { campus: string } | { venueId: string };

const cardColumns = {
  id: markets.id,
  venueId: markets.venueId,
  approvedAt: markets.approvedAt,
  deadlineAt: markets.deadlineAt,
  tradingClosedAt: markets.tradingClosedAt,
  question: markets.question,
  category: markets.category,
  status: markets.status,
  ruledOutcome: markets.ruledOutcome,
  windowStartAt: markets.windowStartAt,
  timeZone: markets.timeZone,
  isSample: markets.isSample,
  venueName: venues.name,
  venueSlug: venues.slug,
  eventTitle: events.title,
  liquidityMicro: markets.liquidityMicro,
  yesSharesMicro: markets.yesSharesMicro,
  noSharesMicro: markets.noSharesMicro,
};

type CardRow = {
  id: string;
  venueId: string | null;
  approvedAt: Date | null;
  deadlineAt: Date;
  tradingClosedAt: Date | null;
  question: string;
  category: string | null;
  status: MarketStatus;
  ruledOutcome: "yes" | "no" | null;
  windowStartAt: Date | null;
  timeZone: string | null;
  isSample: boolean;
  venueName: string | null;
  venueSlug: string | null;
  eventTitle: string | null;
  liquidityMicro: number;
  yesSharesMicro: number | null;
  noSharesMicro: number | null;
};

type FeedRow = MarketSignals & Omit<CardRow, "approvedAt">;

function toSignals(row: CardRow, counts = { clicks: 0, trades: 0, traders: 0 }): FeedRow {
  return {
    ...row,
    // The cap counts venues; every event market has one.
    groupKey: row.venueId ?? row.id,
    approvedAt: row.approvedAt as Date,
    clicks24h: counts.clicks,
    trades24h: counts.trades,
    uniqueTraders24h: counts.traders,
  };
}

function toCard(row: FeedRow, reason: FeedReason, now: Date): FeedCard {
  return {
    id: row.id,
    question: row.question,
    category: row.category,
    venueName: row.venueName,
    venueSlug: row.venueSlug,
    eventTitle: row.eventTitle,
    windowStartAt: row.windowStartAt,
    timeZone: row.timeZone,
    isSample: row.isSample,
    deadlineAt: row.deadlineAt,
    status: row.status,
    ruledOutcome: row.ruledOutcome,
    yesPrice: price(
      toLmsr({
        liquidity: row.liquidityMicro / MICRO_PER_UNIT,
        yesSharesMicro: row.yesSharesMicro as number,
        noSharesMicro: row.noSharesMicro as number,
      }),
      "YES",
    ),
    tradingOpen: row.status === "open" && !row.tradingClosedAt && row.deadlineAt.getTime() > now.getTime(),
    reason,
    approvedAt: row.approvedAt,
    // Filled in once volume and history are loaded.
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
 * Read every open event market in scope with its last 24 hours of activity,
 * rank it, and add the recent past for the status filter. The counts come from
 * `feed_events` and `trades`; `feed_events` carries no viewer identity, so
 * clicks cannot be deduplicated per person.
 */
export async function readFeed<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date = new Date(),
  scope: FeedScope = { campus: "osu" },
): Promise<Feed> {
  const cards = await readRankedCards(database, now, scope);
  const past = await readPastCards(database, now, scope);
  const open = cards.filter((card) => card.tradingOpen);

  // "Moving most today" (2026-09-24): the biggest 24-hour move either way, ties
  // kept in rank order. When nothing moved, the leading traded market stands
  // in, because a chart of a market nobody has traded is a flat line.
  const mover = [...open]
    .filter((card) => card.change24hBp !== 0)
    .sort((a, b) => Math.abs(b.change24hBp) - Math.abs(a.change24hBp))[0];
  const pick = mover ?? open.find((card) => card.volumeMicro > 0) ?? open[0] ?? cards[0];
  let featured: FeaturedMarket | null = null;
  if (pick) {
    const history = (await readSeries(database, [pick.id])).get(pick.id) ?? [];
    // End the line at the live price, so the chart agrees with the buttons beside it.
    const current = { at: now, yesBp: Math.round(pick.yesPrice * 10_000) };
    featured = { ...pick, series: thinSeries([...history, current]), moving: pick === mover };
  }

  return {
    cards,
    past,
    featured,
    closingSoon: [...open]
      .sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime())
      .slice(0, CLOSING_SOON_COUNT),
  };
}

/** The leading markets for the price ticker on pages other than the feed. */
export async function readTicker<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date = new Date(),
  scope: FeedScope = { campus: "osu" },
): Promise<FeedCard[]> {
  return (await readRankedCards(database, now, scope)).slice(0, TICKER_COUNT);
}

function inScope(scope: FeedScope) {
  return "venueId" in scope ? eq(markets.venueId, scope.venueId) : eq(markets.campus, scope.campus);
}

/** Every open event market in scope, ranked, with its volume and 24-hour change filled in. */
async function readRankedCards<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date,
  scope: FeedScope,
): Promise<FeedCard[]> {
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
      ...cardColumns,
      clicks: sql<number>`coalesce(${clickCounts.clicks}, 0)`,
      trades: sql<number>`coalesce(${tradeCounts.trades}, 0)`,
      traders: sql<number>`coalesce(${tradeCounts.traders}, 0)`,
    })
    .from(markets)
    // Event markets only: a retired goal market has no venue and never shows here.
    .innerJoin(venues, eq(venues.id, markets.venueId))
    .leftJoin(events, eq(events.id, markets.eventId))
    .leftJoin(clickCounts, eq(clickCounts.marketId, markets.id))
    .leftJoin(tradeCounts, eq(tradeCounts.marketId, markets.id))
    .where(and(eq(markets.status, "open"), isNotNull(markets.approvedAt), inScope(scope)))
    .limit(MAX_CARDS);

  const signals: FeedRow[] = rows
    // Publishing sets the price; a row without one cannot be shown or ranked.
    .filter((row) => row.approvedAt !== null && row.yesSharesMicro !== null && row.noSharesMicro !== null)
    .map(({ clicks, trades: tradeCount, traders, ...row }) =>
      toSignals(row, { clicks: Number(clicks), trades: Number(tradeCount), traders: Number(traders) }));

  const cards = rankMarkets(signals, now).map((row) => toCard(row, row.reason, now));
  await fillInformation(database, cards, now);
  return cards;
}

/** Recent markets in scope that are no longer open: closed, resolved or void. */
async function readPastCards<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date,
  scope: FeedScope,
): Promise<FeedCard[]> {
  const rows = await database
    .select(cardColumns)
    .from(markets)
    .innerJoin(venues, eq(venues.id, markets.venueId))
    .leftJoin(events, eq(events.id, markets.eventId))
    .where(and(inArray(markets.status, ["closed", "ruled", "settled", "cancelled"]), isNotNull(markets.approvedAt), inScope(scope)))
    .orderBy(desc(markets.deadlineAt))
    .limit(MAX_PAST);
  const cards = rows
    .filter((row) => row.approvedAt !== null && row.yesSharesMicro !== null && row.noSharesMicro !== null)
    .map((row) => toCard(toSignals(row), "quiet", now));
  await fillInformation(database, cards, now);
  return cards;
}

async function fillInformation<Q extends PgQueryResultHKT>(database: Database<Q>, cards: FeedCard[], now: Date) {
  const since = new Date(now.getTime() - SIGNAL_WINDOW_HOURS * 3_600_000);
  const info = await readMarketInformation(database, cards.map((card) => card.id), since);
  for (const card of cards) {
    card.volumeMicro = info.volume.get(card.id) ?? 0;
    const then = info.priceThen.get(card.id);
    card.change24hBp = then === undefined ? 0 : Math.round(card.yesPrice * 10_000) - then;
  }
}

/** A market's live numbers, for pages that refresh prices while open. */
export type Quote = { id: string; yesBp: number; change24hBp: number; volumeMicro: number; tradingOpen: boolean };

/** One request refreshes at most a full feed page. */
export const MAX_QUOTES = MAX_CARDS;
const QUOTABLE = ["open", "closed", "ruled", "settled", "cancelled"] as const;

/**
 * Live prices for markets a page is already showing (decided 2026-09-24: prices
 * refresh about every 15 seconds). Read-only on purpose: it records no view or
 * click, so a page polling it cannot inflate the counts the feed ranks by. It
 * returns only numbers the market's public page already shows.
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
 * Volume and the price 24 hours ago, for a set of markets. The earlier price is
 * the last recorded point at or before the window; a market younger than that
 * falls back to its first point, which publishing writes at the opening price.
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

/** Full recorded price history for a few markets, oldest first. */
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

/** One market's price history, for its own page. Public: prices are already public. */
export async function readPriceSeries<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  marketId: string,
  current: { at: Date; yesBp: number },
): Promise<PricePoint[]> {
  const history = (await readSeries(database, [marketId])).get(marketId) ?? [];
  return thinSeries([...history, current]);
}

/**
 * Record that these markets were shown in the feed. Measurement must never break
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

/** Record that a market page was opened. Swallowed on failure for the same reason. */
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

/** Counts for a set of markets, for checking that measurement actually records. */
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
