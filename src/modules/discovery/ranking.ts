/*
 * Feed ranking, decided 2026-09-19 (see docs/DECISIONS.md).
 *
 * The owner asked for "a youtube algorithm behind it" and delegated the shape to
 * research. What the large systems do is learn from millions of interactions;
 * with a handful of goals and a handful of people there is nothing to learn
 * from, so this copies the structure rather than the model:
 *
 * - An activity score over time decay, as Reddit and Hacker News use, because
 *   that behaves sensibly with almost no data and can always be explained.
 * - A guaranteed head start for a new market, as TikTok gives a new video, so
 *   that a quiet one is seen at all before it is judged on its numbers.
 * - A cap on how much of the top one venue can occupy (one person, before the
 *   2026-10-08 pivot to event markets), because a pure activity score lets the
 *   busiest place crowd everything else out.
 *
 * Pure functions only: no database, no clock of its own, no I/O. The caller
 * supplies the counts and the current time so every case here is testable.
 */

/** Hacker News uses 1.8 over hours. Goals run for weeks, so decay is gentler. */
const GRAVITY = 1.5;
/** Hours added before exponentiating, so a brand-new goal is not divided by ~0. */
const AGE_OFFSET_HOURS = 2;
/** A newly approved goal carries this much score on top of its real activity. */
export const NEWBORN_BONUS = 1;
/** How long that head start lasts, fading linearly to zero across the window. */
export const NEWBORN_WINDOW_HOURS = 48;
/** Goals whose deadline is this close are worth more attention. */
export const URGENT_WITHIN_HOURS = 72;
const URGENCY_MULTIPLIER = 1.5;
/** How many of the leading slots the cap applies to. */
export const CAPPED_SLOTS = 10;
/** How many of those slots one venue may hold. */
export const MAX_PER_GROUP_IN_TOP = 2;

const MS_PER_HOUR = 3_600_000;

/** Weights on the 24-hour counts. A trade says far more than a click. */
const CLICK_WEIGHT = 1;
const TRADE_WEIGHT = 5;
const TRADER_WEIGHT = 3;

export type MarketSignals = {
  id: string;
  /** What the top-slot cap counts: the venue, or the person behind a retired goal market. */
  groupKey: string;
  approvedAt: Date;
  deadlineAt: Date;
  /** Feed cards opened in the last 24 hours. Not deduplicated; see the schema note. */
  clicks24h: number;
  /** Buys and sells in the last 24 hours. */
  trades24h: number;
  /** Distinct people who traded in the last 24 hours. */
  uniqueTraders24h: number;
};

/** Why a goal is placed where it is, in words a person can read. */
export type FeedReason = "just added" | "closing soon" | "active" | "quiet";

export type RankedMarket<T extends MarketSignals> = T & {
  score: number;
  reason: FeedReason;
};

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_HOUR;
}

/** Activity on a log scale, so the first click counts for much more than the fiftieth. */
export function interest(signals: MarketSignals): number {
  const weighted =
    CLICK_WEIGHT * Math.max(0, signals.clicks24h) +
    TRADE_WEIGHT * Math.max(0, signals.trades24h) +
    TRADER_WEIGHT * Math.max(0, signals.uniqueTraders24h);
  return Math.log10(1 + weighted);
}

/** Full for a fresh goal, fading linearly to nothing at the end of the window. */
export function newbornBonus(signals: MarketSignals, now: Date): number {
  const age = hoursBetween(signals.approvedAt, now);
  if (age >= NEWBORN_WINDOW_HOURS) return 0;
  const remaining = Math.max(0, NEWBORN_WINDOW_HOURS - age);
  return NEWBORN_BONUS * (remaining / NEWBORN_WINDOW_HOURS);
}

export function isJustAdded(signals: MarketSignals, now: Date): boolean {
  const age = hoursBetween(signals.approvedAt, now);
  return age >= 0 && age < NEWBORN_WINDOW_HOURS;
}

/** True while the deadline is ahead but close. A passed deadline is not urgent. */
export function isClosingSoon(signals: MarketSignals, now: Date): boolean {
  const remaining = hoursBetween(now, signals.deadlineAt);
  return remaining > 0 && remaining <= URGENT_WITHIN_HOURS;
}

export function score(signals: MarketSignals, now: Date): number {
  // A goal approved in the future cannot be older than zero hours.
  const age = Math.max(0, hoursBetween(signals.approvedAt, now));
  const base = interest(signals) + newbornBonus(signals, now);
  const urgency = isClosingSoon(signals, now) ? URGENCY_MULTIPLIER : 1;
  return (base * urgency) / Math.pow(age + AGE_OFFSET_HOURS, GRAVITY);
}

function reasonFor(signals: MarketSignals, now: Date): FeedReason {
  if (isJustAdded(signals, now)) return "just added";
  if (isClosingSoon(signals, now)) return "closing soon";
  if (interest(signals) > 0) return "active";
  return "quiet";
}

/**
 * Hold one venue to at most MAX_PER_GROUP_IN_TOP of the first CAPPED_SLOTS
 * places. A market displaced this way is not dropped: it moves down to just
 * after the capped region, keeping its order relative to the others displaced
 * with it.
 *
 * The cap is best effort, and deliberately so. It can only promote a market
 * that exists: when too few other venues have open markets to fill the leading
 * slots, the displaced ones come back up to fill them rather than leaving the
 * feed short. Early on, with a handful of venues, that is the normal case.
 */
export function applyGroupCap<T extends MarketSignals>(ordered: RankedMarket<T>[]): RankedMarket<T>[] {
  const kept: RankedMarket<T>[] = [];
  const displaced: RankedMarket<T>[] = [];
  const perGroup = new Map<string, number>();

  for (const market of ordered) {
    if (kept.length >= CAPPED_SLOTS) {
      // Past the capped region the cap no longer applies.
      kept.push(market);
      continue;
    }
    const held = perGroup.get(market.groupKey) ?? 0;
    if (held >= MAX_PER_GROUP_IN_TOP) {
      displaced.push(market);
      continue;
    }
    perGroup.set(market.groupKey, held + 1);
    kept.push(market);
  }

  if (displaced.length === 0) return kept;
  // Re-insert the displaced markets directly after the capped region.
  const head = kept.slice(0, CAPPED_SLOTS);
  const tail = kept.slice(CAPPED_SLOTS);
  return [...head, ...displaced, ...tail];
}

/**
 * Order goals for the feed. Ties break on the nearer deadline and then on id, so
 * the same inputs always produce the same order and tests are not flaky.
 */
export function rankMarkets<T extends MarketSignals>(markets: readonly T[], now: Date): RankedMarket<T>[] {
  const scored = markets.map((market) => ({
    ...market,
    score: score(market, now),
    reason: reasonFor(market, now),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.deadlineAt.getTime() !== b.deadlineAt.getTime()) {
      return a.deadlineAt.getTime() - b.deadlineAt.getTime();
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return applyGroupCap(scored);
}
