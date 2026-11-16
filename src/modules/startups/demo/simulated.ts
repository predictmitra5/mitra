/*
 * Simulated trading for demo markets (DECISIONS.md 2026-11-15). The owner asked
 * for "fake data for trading so the founders can see what it would look like",
 * in Kalshi's style: a price history, Yes and No offers, a book, volume and
 * traders on every demo market.
 *
 * Nothing here is stored or touches the exchange: every number is worked out
 * from the market's id and the moment it is shown, so
 *
 * - everyone sees the same numbers at the same moment;
 * - history already shown never changes as time passes (the price at a past
 *   moment depends only on that moment), while the present keeps moving;
 * - real markets never use it: their prices come only from actual executions.
 *
 * The price lives in log-odds: the market opens at 50/50 and drifts over a few
 * days to a level of its own, wanders on smooth noise at several time scales,
 * jumps now and then on "news" that fades over weeks, and, once a demo market
 * has been ruled, settles toward its outcome before trading closed. A trade may
 * happen in any ten-minute slot, more often by day than at night; the chart is
 * the last trade, as on a real market.
 */

export type DemoMarketInput = {
  id: string;
  /** When the market opened (its approval). */
  openedAt: Date;
  /** The trading cutoff. */
  deadlineAt: Date;
  tradingOpen: boolean;
  ruledOutcome: "yes" | "no" | null;
};

export type DemoPoint = { at: Date; yesBp: number };
export type DemoBookRow = { outcome: "yes"; direction: "buy" | "sell"; price: number; quantity: number };
export type DemoVolumeBucket = { at: Date; micro: number; hourly: boolean };
export type DemoQuote = {
  /** The last simulated trade, as the Yes price in cents. */
  lastYesCents: number;
  /** The best simulated offers; null once trading has closed. */
  yesAskCents: number | null;
  noAskCents: number | null;
  volumeContracts: number;
  traders: number;
  /** The Yes price now minus 24 hours ago, in basis points. */
  change24hBp: number;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** A trade may happen in any slot this long. */
const SLOT = 10 * MINUTE;
/** "News" may arrive once in each block this long. */
const NEWS_BLOCK = 9 * DAY;
/** How long news takes to fade to about a third. */
const NEWS_FADE = 40 * DAY;
/** How far back news can still be felt. */
const NEWS_LOOKBACK = 18;
/** How long a fresh market takes to leave 50/50 behind. */
const OPENING_DRIFT = 4 * DAY;
/** How long before close a ruled market settles toward its outcome. */
const SETTLING = 25 * DAY;
/** How far back to look for the latest trade before giving up (about three weeks). */
const MAX_LOOKBACK_SLOTS = 3_000;
const BOOK_LEVELS = 5;

type Model = {
  seed: number;
  open: number;
  end: number;
  outcome: "yes" | "no" | null;
  /** The market's own level, in log-odds. */
  center: number;
  /** How busy the market is, 0 to 1. */
  busy: number;
  /** Contracts traded on an ordinary day. */
  dailyBase: number;
  /** Traders per square root of contracts. */
  crowd: number;
  /** How deep the book is. */
  depth: number;
};

/** FNV-1a: the market's id as a 32-bit seed. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A number in [0, 1) that depends only on its three inputs. */
function unit(seed: number, channel: number, index: number): number {
  let h = (seed ^ Math.imul(channel + 1, 0x9e3779b1) ^ Math.imul(index | 0, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h = Math.imul(h ^ (h >>> 16), 0x2c1b3c6d);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Smooth value noise in [-1, 1] along x. */
function noise(seed: number, channel: number, x: number): number {
  const i = Math.floor(x), f = x - i;
  const a = unit(seed, channel, i) * 2 - 1, b = unit(seed, channel, i + 1) * 2 - 1;
  return a + (b - a) * (f * f * (3 - 2 * f));
}

const logit = (p: number) => Math.log(p / (1 - p));
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function model(market: DemoMarketInput, now: Date): Model {
  const seed = hashString(market.id);
  const open = market.openedAt.getTime();
  const stop = market.tradingOpen ? now.getTime() : Math.min(now.getTime(), market.deadlineAt.getTime());
  return {
    seed,
    open,
    end: Math.max(open, stop),
    outcome: market.ruledOutcome,
    center: logit(0.14 + 0.68 * unit(seed, 0, 1)),
    busy: unit(seed, 0, 2),
    dailyBase: 150 + 3_000 * unit(seed, 0, 3) ** 2,
    crowd: 1.2 + 1.4 * unit(seed, 0, 4),
    depth: 0.5 + unit(seed, 0, 5),
  };
}

/** The market's underlying chance of Yes at a moment, 0 to 1. */
function chance(m: Model, t: number): number {
  const d = t / DAY;
  let x = m.center
    + 0.85 * noise(m.seed, 1, d / 45)
    + 0.4 * noise(m.seed, 2, d / 11)
    + 0.16 * noise(m.seed, 3, d / 2.5)
    + 0.07 * noise(m.seed, 4, d / 0.4);
  const block = Math.floor(t / NEWS_BLOCK);
  for (let b = block; b > block - NEWS_LOOKBACK; b -= 1) {
    const at = newsAt(m, b);
    if (at === null || at > t) continue;
    x += (unit(m.seed, 7, b) * 2 - 1) * 1.1 * Math.exp(-(t - at) / NEWS_FADE);
  }
  // Every market opens at 50/50, which is 0 in log-odds.
  x *= 1 - Math.exp(-Math.max(0, t - m.open) / OPENING_DRIFT);
  if (m.outcome) {
    const k = clamp(1 - (m.end - t) / SETTLING, 0, 1);
    x += ((m.outcome === "yes" ? 3.6 : -3.6) - x) * k * k;
  }
  return 1 / (1 + Math.exp(-x));
}

/** When news arrived in a block, if it did, after the market opened. */
function newsAt(m: Model, block: number): number | null {
  if (unit(m.seed, 5, block) > 0.35) return null;
  const at = (block + unit(m.seed, 6, block)) * NEWS_BLOCK;
  return at >= m.open ? at : null;
}

/** Quieter overnight, Eastern time. */
function rhythm(t: number): number {
  const hour = (((Math.floor(t / HOUR) - 5) % 24) + 24) % 24;
  return hour >= 1 && hour < 7 ? 0.3 : 1;
}

/** The chance that a slot starting at t holds a trade. */
function activity(m: Model, t: number): number {
  const wave = 0.5 + 0.5 * noise(m.seed, 8, t / DAY / 6);
  return clamp((0.08 + 0.3 * m.busy) * (0.45 + wave) * rhythm(t), 0.02, 0.85);
}

function tradeIn(m: Model, slot: number): boolean {
  return unit(m.seed, 9, slot) < activity(m, slot * SLOT);
}

function tradePrice(m: Model, slot: number): number {
  const jitter = (unit(m.seed, 10, slot) - 0.5) * 2.4;
  return clamp(Math.round(100 * chance(m, slot * SLOT) + jitter), 1, 99);
}

/** The last trade at or before t, in cents; 50 before the first. */
function lastTrade(m: Model, t: number): number {
  const at = Math.min(t, m.end);
  const first = Math.ceil(m.open / SLOT);
  for (let slot = Math.floor(at / SLOT), n = 0; slot >= first && n < MAX_LOOKBACK_SLOTS; slot -= 1, n += 1) {
    if (tradeIn(m, slot)) return tradePrice(m, slot);
  }
  return 50;
}

/** Contracts traded in one whole UTC day. */
function dayVolume(m: Model, day: number): number {
  const noon = day * DAY + 17 * HOUR;
  const news = newsAt(m, Math.floor((day * DAY) / NEWS_BLOCK));
  const busyDay = news !== null && Math.floor(news / DAY) === day ? 3 : 1;
  return m.dailyBase * (0.3 + 2.2 * activity(m, noon)) * (0.55 + 0.9 * unit(m.seed, 11, day)) * busyDay;
}

function hourWeight(m: Model, hour: number): number {
  return rhythm(hour * HOUR) * (0.5 + unit(m.seed, 12, hour));
}

/** Contracts traded in [from, to), both inside one UTC day. */
function volumeWithinDay(m: Model, day: number, from: number, to: number): number {
  if (to <= from) return 0;
  const first = day * 24;
  let total = 0, part = 0;
  for (let hour = first; hour < first + 24; hour += 1) {
    const w = hourWeight(m, hour);
    total += w;
    const start = Math.max(from, hour * HOUR), stop = Math.min(to, (hour + 1) * HOUR);
    if (stop > start) part += (w * (stop - start)) / HOUR;
  }
  return (dayVolume(m, day) * part) / total;
}

/** Contracts traded in each UTC day the market traded, partial days pro rata. */
function dailyVolumes(m: Model): { day: number; contracts: number }[] {
  const out: { day: number; contracts: number }[] = [];
  for (let day = Math.floor(m.open / DAY); day * DAY < m.end; day += 1) out.push({ day, contracts: volumeOfDay(m, day) });
  return out;
}

function volumeOfDay(m: Model, day: number): number {
  const start = day * DAY, stop = start + DAY;
  return start >= m.open && stop <= m.end
    ? dayVolume(m, day)
    : volumeWithinDay(m, day, Math.max(start, m.open), Math.min(stop, m.end));
}

/**
 * Whole past days never change, so their sum is kept per market and day; card
 * lists and the 15-second quote polls then add only today's partial day.
 */
const wholeDays = new Map<string, number>();
const WHOLE_DAYS_KEPT = 2_000;

function totalVolume(m: Model): number {
  const first = Math.floor(m.open / DAY), last = Math.floor(m.end / DAY);
  if (last <= first) return volumeOfDay(m, first);
  const key = `${m.seed}:${m.open}:${last}`;
  let before = wholeDays.get(key);
  if (before === undefined) {
    before = 0;
    for (let day = first; day < last; day += 1) before += volumeOfDay(m, day);
    if (wholeDays.size >= WHOLE_DAYS_KEPT) wholeDays.clear();
    wholeDays.set(key, before);
  }
  return before + volumeOfDay(m, last);
}

function spreadAt(m: Model, slot: number): { below: number; above: number } {
  const r = unit(m.seed, 15, slot);
  const spread = r < 0.6 ? 1 : r < 0.9 ? 2 : 3;
  const below = unit(m.seed, 16, slot) < 0.5 ? Math.floor(spread / 2) : Math.ceil(spread / 2);
  return { below, above: spread - below };
}

/** The best Yes bid and ask around the last trade. */
function touch(m: Model, now: number, last: number): { bid: number; ask: number } {
  const { below, above } = spreadAt(m, Math.floor(now / SLOT));
  const bid = clamp(last - below, 1, 98);
  return { bid, ask: clamp(Math.max(last + above, bid + 1), 2, 99) };
}

/** A demo market's numbers at a moment: last trade, offers, volume, traders and the day's change. */
export function demoQuote(market: DemoMarketInput, now: Date): DemoQuote {
  const m = model(market, now);
  const last = lastTrade(m, m.end);
  const dayAgo = m.end - DAY >= m.open ? lastTrade(m, m.end - DAY) : 50;
  const volume = Math.round(totalVolume(m));
  const offers = market.tradingOpen ? touch(m, now.getTime(), last) : null;
  return {
    lastYesCents: last,
    yesAskCents: offers ? offers.ask : null,
    noAskCents: offers ? 100 - offers.bid : null,
    volumeContracts: volume,
    traders: Math.min(volume, Math.round(Math.sqrt(volume) * m.crowd)),
    change24hBp: (now.getTime() - DAY > m.end ? 0 : last - dayAgo) * 100,
  };
}

/**
 * The price history for the market page's chart: every ten minutes for the
 * last day, every two hours for the week before, every eight hours for three
 * months and daily before that, with repeats dropped (a step line holds its
 * price until the next point).
 */
export function demoHistory(market: DemoMarketInput, now: Date): DemoPoint[] {
  const m = model(market, now);
  const times: number[] = [m.open];
  const steps: [number, number][] = [[92 * DAY, DAY], [7 * DAY, 8 * HOUR], [DAY, 2 * HOUR], [0, SLOT]];
  let cursor = m.open;
  for (const [until, step] of steps) {
    const limit = m.end - until;
    for (let t = Math.ceil(cursor / step) * step; t < limit; t += step) if (t > m.open) times.push(t);
    cursor = Math.max(cursor, limit);
  }
  times.push(m.end);
  const out: DemoPoint[] = [];
  for (const at of times) {
    const yesBp = (at === m.open ? 50 : lastTrade(m, at)) * 100;
    if (out.length && out[out.length - 1].yesBp === yesBp && at !== m.end) continue;
    out.push({ at: new Date(at), yesBp });
  }
  return out;
}

/** The card's small chart: the last three months (or since opening) in a few points. */
export function demoSpark(market: DemoMarketInput, now: Date, points = 40): DemoPoint[] {
  const m = model(market, now);
  const start = Math.max(m.open, m.end - 92 * DAY);
  if (m.end <= start) return [];
  const out: DemoPoint[] = [];
  for (let i = 0; i < points; i += 1) {
    const at = start + ((m.end - start) * i) / (points - 1);
    out.push({ at: new Date(at), yesBp: (at === m.open ? 50 : lastTrade(m, at)) * 100 });
  }
  return out;
}

/** Volume bars: daily for the whole history, hourly for the last two days. */
export function demoVolumeBuckets(market: DemoMarketInput, now: Date): DemoVolumeBucket[] {
  const m = model(market, now);
  const daily = dailyVolumes(m).map(({ day, contracts }) => ({ at: new Date(day * DAY), micro: Math.round(contracts) * 1_000_000, hourly: false }));
  const hourly: DemoVolumeBucket[] = [];
  for (let hour = Math.floor(Math.max(m.open, m.end - 2 * DAY) / HOUR); hour * HOUR < m.end; hour += 1) {
    const day = Math.floor((hour * HOUR) / DAY);
    const contracts = volumeWithinDay(m, day, Math.max(hour * HOUR, m.open), Math.min((hour + 1) * HOUR, m.end));
    hourly.push({ at: new Date(hour * HOUR), micro: Math.round(contracts) * 1_000_000, hourly: true });
  }
  return [...daily, ...hourly];
}

/**
 * A resting book around the offers: five Yes asks and five Yes bids, as a real
 * book would list them (sell Yes for asks, buy Yes for bids). Empty once trading
 * has closed. It changes every ten minutes.
 */
export function demoBook(market: DemoMarketInput, now: Date): DemoBookRow[] {
  if (!market.tradingOpen) return [];
  const m = model(market, now);
  const last = lastTrade(m, m.end);
  const { bid, ask } = touch(m, now.getTime(), last);
  const slot = Math.floor(now.getTime() / SLOT);
  const size = (channel: number, level: number) =>
    Math.round((40 + 1_200 * unit(m.seed, channel, slot * 8 + level) ** 2) * (1 + level * 0.4) * m.depth);
  const rows: DemoBookRow[] = [];
  for (let level = 0; level < BOOK_LEVELS; level += 1) {
    if (ask + level <= 99) rows.push({ outcome: "yes", direction: "sell", price: ask + level, quantity: size(17, level) });
    if (bid - level >= 1) rows.push({ outcome: "yes", direction: "buy", price: bid - level, quantity: size(18, level) });
  }
  return rows;
}
