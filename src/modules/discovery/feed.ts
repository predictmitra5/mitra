import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { PINNED_FEATURED_MARKET_ID } from "@/config/featured";
import { readExchange } from "@/modules/exchange/store";
import { quotes } from "@/modules/exchange/engine";
import { isUuid } from "@/modules/market/input";
import { rankMarkets, type FeedReason, type MarketSignals } from "./ranking";

const { markets, startups, startupFounders, founders, feedEventBuckets } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type MarketStatus = (typeof schema.marketStatus.enumValues)[number];

export const FEED_EVENT_RETENTION_HOURS = 24;
const MAX_CLICKS_PER_MARKET_HOUR = 3;
const MAX_EXPOSURES_PER_MARKET_HOUR = 500;

/**
 * A market as cards, the ticker and the directory show it (2026-10-19: startup
 * markets). Anyone may read this without an account, so the projection below
 * is the whole contract: what a market page already shows in public, the
 * startup and its primary founder, and nothing else. No account identifiers,
 * wallet or position data, owner notes or objections.
 */
export type FeedCard = {
  id: string;
  question: string;
  /** The card's few words (2026-10-09); null shows the full question. */
  shortQuestion: string | null;
  milestoneKind: string | null;
  startupId: string;
  startupName: string;
  startupSlug: string;
  startupTagline: string;
  industry: string;
  glyph: string;
  hue: number;
  logoUrl: string | null;
  /** For the founder-and-startup thumbnail on the card. */
  productFeatures: string[];
  thumbnailUrl: string | null;
  founderName: string | null;
  founderHandle: string | null;
  founderHue: number;
  founderPortraitUrl: string | null;
  founderRole: string | null;
  timeZone: string | null;
  /** Demonstration data (2026-10-19), labelled wherever it appears. */
  isSample: boolean;
  /** The trading cutoff. */
  deadlineAt: Date;
  status: MarketStatus;
  ruledOutcome: "yes" | "no" | null;
  yesPrice: number;
  hasPrice?: boolean;
  yesAskCents?: number | null;
  noAskCents?: number | null;
  tradingOpen: boolean;
  paused: boolean;
  reason: FeedReason;
  /** When the market opened. */
  approvedAt: Date;
  /** Trade Coins traded on this market, all time. */
  volumeMicro: number;
  /** Distinct traders, all time. Shown on startup markets, as the brief asks. */
  traders: number;
  /** YES price now minus 24 hours ago, in basis points. Opening price if younger. */
  change24hBp: number;
  /** The last three months of the price, thinned, for the card's chart. */
  spark: PricePoint[];
};

/** One point of a market's price history, for a chart. */
export type PricePoint = { at: Date; yesBp: number };

/**
 * The featured market carries its full history. `moving` says it was chosen as
 * the market moving most today; when nothing moved, the leading traded market
 * stands in and is not called a mover.
 */
export type FeaturedMarket = FeedCard & { series: PricePoint[]; moving: boolean };

export type Feed = {
  /** Every open market in scope, in ranked order. */
  cards: FeedCard[];
  /** Recently closed, resolved and void markets, latest cutoff first, for the status filter. */
  past: FeedCard[];
  /** One market with its chart: the owner's pin while it is open, else the one moving most today. */
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
const SPARK_POINTS = 40;

const SIGNAL_WINDOW_HOURS = 24;
/** An upper bound on one page of the directory, so a busy app cannot render forever. */
const MAX_CARDS = 80;
const MAX_PAST = 40;

/** Which markets a read covers: every approved startup's, one startup's, or a list. */
export type FeedScope = { all: true } | { startupId: string } | { ids: readonly string[] };

const cardColumns = {
  id: markets.id,
  startupId: markets.startupId,
  approvedAt: markets.approvedAt,
  deadlineAt: markets.deadlineAt,
  tradingClosedAt: markets.tradingClosedAt,
  pausedAt: markets.pausedAt,
  question: markets.question,
  shortQuestion: markets.shortQuestion,
  milestoneKind: markets.milestoneKind,
  status: markets.status,
  ruledOutcome: markets.ruledOutcome,
  timeZone: markets.timeZone,
  isSample: markets.isSample,
  startupName: startups.name,
  startupSlug: startups.slug,
  startupTagline: startups.tagline,
  industry: startups.industry,
  glyph: startups.glyph,
  hue: startups.hue,
  logoUrl: startups.logoUrl,
  productFeatures: startups.productFeatures,
  thumbnailUrl: startups.thumbnailUrl,
  liquidityMicro: markets.liquidityMicro,
  yesSharesMicro: markets.yesSharesMicro,
  noSharesMicro: markets.noSharesMicro,
};

type CardRow = {
  id: string;
  startupId: string | null;
  approvedAt: Date | null;
  deadlineAt: Date;
  tradingClosedAt: Date | null;
  pausedAt: Date | null;
  question: string;
  shortQuestion: string | null;
  milestoneKind: string | null;
  status: MarketStatus;
  ruledOutcome: "yes" | "no" | null;
  timeZone: string | null;
  isSample: boolean;
  startupName: string;
  startupSlug: string;
  startupTagline: string;
  industry: string;
  glyph: string;
  hue: number;
  logoUrl: string | null;
  productFeatures: string[] | null;
  thumbnailUrl: string | null;
  liquidityMicro: number;
  yesSharesMicro: number | null;
  noSharesMicro: number | null;
};

type FeedRow = MarketSignals & Omit<CardRow, "approvedAt">;

function toSignals(row: CardRow, counts = { clicks: 0, trades: 0, traders: 0 }): FeedRow {
  return {
    ...row,
    // The cap counts startups, so one company cannot fill the top of the list.
    groupKey: row.startupId ?? row.id,
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
    shortQuestion: row.shortQuestion,
    milestoneKind: row.milestoneKind,
    startupId: row.startupId as string,
    startupName: row.startupName,
    startupSlug: row.startupSlug,
    startupTagline: row.startupTagline,
    industry: row.industry,
    glyph: row.glyph,
    hue: row.hue,
    logoUrl: row.logoUrl,
    productFeatures: row.productFeatures ?? [],
    thumbnailUrl: row.thumbnailUrl,
    founderName: null,
    founderHandle: null,
    founderHue: 205,
    founderPortraitUrl: null,
    founderRole: null,
    timeZone: row.timeZone,
    isSample: row.isSample,
    deadlineAt: row.deadlineAt,
    status: row.status,
    ruledOutcome: row.ruledOutcome,
    yesPrice: 0.5, hasPrice: false, yesAskCents: null, noAskCents: null,
    tradingOpen: row.status === "open" && !row.tradingClosedAt && !row.pausedAt && row.deadlineAt.getTime() > now.getTime(),
    paused: !!row.pausedAt,
    reason,
    approvedAt: row.approvedAt,
    // Filled in once volume and history are loaded.
    volumeMicro: 0,
    traders: 0,
    change24hBp: 0,
    spark: [],
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
 * Read every open startup market in scope with its last 24 hours of activity,
 * rank it, and add the recent past for the status filter. This orders the
 * market directory only; the video feed's recommendation (src/modules/recommend)
 * never reads prices, trades or positions.
 */
export async function readFeed<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date = new Date(),
  scope: FeedScope = { all: true },
  pinnedId: string | null = PINNED_FEATURED_MARKET_ID,
): Promise<Feed> {
  const cards = await readRankedCards(database, now, scope);
  const past = await readPastCards(database, now, scope);
  const open = cards.filter((card) => card.tradingOpen);

  // "Moving most today" (2026-09-24): the biggest 24-hour move either way, ties
  // kept in rank order. When nothing moved, the leading traded market stands in.
  const mover = [...open]
    .filter((card) => card.change24hBp !== 0)
    .sort((a, b) => Math.abs(b.change24hBp) - Math.abs(a.change24hBp))[0];
  const pinned = pinnedId ? open.find((card) => card.id === pinnedId) : undefined;
  const pick = pinned ?? mover ?? open.find((card) => card.volumeMicro > 0) ?? open[0] ?? cards[0];
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

/** The leading markets for the price ticker. */
export async function readTicker<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date = new Date(),
  scope: FeedScope = { all: true },
): Promise<FeedCard[]> {
  return (await readRankedCards(database, now, scope)).slice(0, TICKER_COUNT);
}

/** Cards for a known set of markets, in the order given (a feed's predictions, search results, a profile). */
export async function readCards<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  ids: readonly string[],
  now: Date = new Date(),
): Promise<FeedCard[]> {
  const list = [...new Set(ids)].filter(isUuid).slice(0, MAX_CARDS);
  if (list.length === 0) return [];
  const rows = await database.select(cardColumns).from(markets)
    .innerJoin(startups, eq(startups.id, markets.startupId))
    .where(and(eq(markets.listed, true), inArray(markets.id, list), isNotNull(markets.approvedAt), eq(startups.status, "approved"),
      inArray(markets.status, ["open", "closed", "ruled", "settled", "cancelled"])));
  const byId = new Map(rows.filter(priced).map((row) => [row.id, toCard(toSignals(row), "quiet", now)]));
  const cards = list.map((id) => byId.get(id)).filter((card): card is FeedCard => !!card);
  await fillInformation(database, cards, now);
  return cards;
}

function inScope(scope: FeedScope) {
  // Only approved startups' markets are public.
  const visible = and(eq(startups.status, "approved"), eq(markets.listed, true));
  if ("startupId" in scope) return and(visible, eq(markets.startupId, scope.startupId));
  if ("ids" in scope) return and(visible, scope.ids.length ? inArray(markets.id, [...scope.ids]) : sql`false`);
  return visible;
}

function priced(row: CardRow): boolean {
  // Publishing sets the price; a row without one cannot be shown or ranked.
  return row.approvedAt !== null && row.startupId !== null;
}

/** Every open startup market in scope, ranked, with its volume, change and chart filled in. */
async function readRankedCards<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date,
  scope: FeedScope,
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


  const rows = await database
    .select({
      ...cardColumns,
      clicks: sql<number>`coalesce(${clickCounts.clicks}, 0)`,
      trades: sql<number>`0`,
      traders: sql<number>`0`,
    })
    .from(markets)
    // Startup markets only: retired goal and event markets never show here.
    .innerJoin(startups, eq(startups.id, markets.startupId))
    .leftJoin(clickCounts, eq(clickCounts.marketId, markets.id))
    .where(and(eq(markets.status, "open"), isNotNull(markets.approvedAt), inScope(scope)))
    .limit(MAX_CARDS);

  const signals: FeedRow[] = rows
    .filter(priced)
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
    .innerJoin(startups, eq(startups.id, markets.startupId))
    .where(and(inArray(markets.status, ["closed", "ruled", "settled", "cancelled"]), isNotNull(markets.approvedAt), inScope(scope)))
    .orderBy(desc(markets.deadlineAt))
    .limit(MAX_PAST);
  const cards = rows.filter(priced).map((row) => toCard(toSignals(row), "quiet", now));
  await fillInformation(database, cards, now);
  return cards;
}

/** Volume, traders, the 24-hour change, the chart and the primary founder, for a set of cards. */
async function fillInformation<Q extends PgQueryResultHKT>(database: Database<Q>, cards: FeedCard[], now: Date) {
 if (!cards.length) return;
 const [state,people]=await Promise.all([readExchange(database),readPrimaryFounders(database,[...new Set(cards.map(c=>c.startupId))])]);
 for(const card of cards){const q=quotes(state,card.id,now.getTime()),fills=state.fills.filter(f=>f.marketId===card.id),then=[...fills].reverse().find(f=>f.at<=now.getTime()-86_400_000);
 card.yesPrice=q.lastYes===null?0.5:q.lastYes/100;card.hasPrice=q.lastYes!==null;card.yesAskCents=q.yes?.price??null;card.noAskCents=q.no?.price??null;
 card.volumeMicro=q.volumeContracts*1_000_000;card.traders=q.traders;card.change24hBp=then&&q.lastYes!==null?q.lastYes*100-(then.outcome==='yes'?then.price:100-then.price)*100:0;
 card.spark=thinSeries(fills.map(f=>({at:new Date(f.at),yesBp:(f.outcome==='yes'?f.price:100-f.price)*100})),SPARK_POINTS);
 const founder=people.get(card.startupId);if(founder)Object.assign(card,founder);
 }
}

/** Each startup's primary founder (the one marked primary, else the first linked), for cards. */
export async function readPrimaryFounders<Q extends PgQueryResultHKT>(database: Database<Q>, startupIds: readonly string[]) {
  const out = new Map<string, { founderName: string; founderHandle: string; founderHue: number; founderPortraitUrl: string | null; founderRole: string }>();
  if (startupIds.length === 0) return out;
  const rows = await database.select({
    startupId: startupFounders.startupId, name: founders.name, handle: founders.handle, hue: founders.hue, portraitUrl: founders.portraitUrl, role: startupFounders.role,
  }).from(startupFounders).innerJoin(founders, eq(founders.id, startupFounders.founderId))
    .where(and(inArray(startupFounders.startupId, [...startupIds]), eq(founders.status, "approved")))
    .orderBy(desc(startupFounders.isPrimary), asc(startupFounders.createdAt));
  for (const row of rows) {
    if (!out.has(row.startupId)) out.set(row.startupId, { founderName: row.name, founderHandle: row.handle, founderHue: row.hue, founderPortraitUrl: row.portraitUrl, founderRole: row.role });
  }
  return out;
}

/** The last three months of each market's price, thinned for a small chart, with the price in force at the start carried in. */
/** A market's live numbers, for pages that refresh prices while open. */
export type Quote = { id: string; hasPrice: boolean; yesAskCents: number | null; noAskCents: number | null; yesBp: number; change24hBp: number; volumeMicro: number; tradingOpen: boolean };

/** One request refreshes at most a full feed page. */
export const MAX_QUOTES = MAX_CARDS;

/**
 * Live prices for markets a page is already showing (decided 2026-09-24: prices
 * refresh about every 15 seconds). Read-only on purpose: it records no view or
 * click, so a page polling it cannot inflate the counts the feed ranks by. It
 * returns only numbers the market's public page already shows.
 */
export async function readQuotes<Q extends PgQueryResultHKT>(database:Database<Q>,ids:readonly string[],now:Date=new Date()):Promise<Quote[]>{return (await readCards(database,ids,now)).map(c=>({id:c.id,yesBp:Math.round(c.yesPrice*10000),hasPrice:c.hasPrice??false,yesAskCents:c.yesAskCents??null,noAskCents:c.noAskCents??null,change24hBp:c.change24hBp,volumeMicro:c.volumeMicro,tradingOpen:c.tradingOpen}));}

/** Full recorded price history for a few markets, oldest first. */
export async function readSeries<Q extends PgQueryResultHKT>(database:Database<Q>,ids:readonly string[]):Promise<Map<string,PricePoint[]>>{const out=new Map<string,PricePoint[]>();const state=await readExchange(database);for(const fill of state.fills){if(!ids.includes(fill.marketId))continue;const list=out.get(fill.marketId)??[];list.push({at:new Date(fill.at),yesBp:(fill.outcome==='yes'?fill.price:100-fill.price)*100});out.set(fill.marketId,list);}return out;}
export async function readPriceSeries<Q extends PgQueryResultHKT>(database:Database<Q>,marketId:string,_current:{at:Date;yesBp:number}):Promise<PricePoint[]>{void _current;return thinSeries((await readSeries(database,[marketId])).get(marketId)??[]);}

/**
 * Record that these markets were shown in the feed. Measurement must never break
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

/** Record that a market page was opened. Swallowed on failure for the same reason. */
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

/** Counts for a set of markets, for checking that measurement actually records. */
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

/**
 * Trade Coins traded on a market per day, and per hour for the last two days, for
 * the chart's volume bars (2026-10-19). Sums only: never a single trade's size.
 */
export async function readVolumeBuckets<Q extends PgQueryResultHKT>(database:Database<Q>,marketId:string,now:Date=new Date()):Promise<{at:Date;micro:number;hourly:boolean}[]>{void now;const fills=(await readExchange(database)).fills.filter(f=>f.marketId===marketId),bins=new Map<number,number>();for(const f of fills){const at=Math.floor(f.at/3600000)*3600000;bins.set(at,(bins.get(at)??0)+f.quantity*1_000_000);}return [...bins].map(([at,micro])=>({at:new Date(at),micro,hourly:true}));}
