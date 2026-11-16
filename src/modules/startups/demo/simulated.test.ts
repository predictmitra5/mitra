import { describe, expect, it } from "vitest";
import { demoBook, demoHistory, demoQuote, demoSpark, demoVolumeBuckets, type DemoMarketInput } from "./simulated";

const DAY = 86_400_000;
const now = new Date("2026-11-15T18:00:00Z");
const open: DemoMarketInput = {
  id: "6b64e355-844f-4bf4-88ba-9781bd5bdc66",
  openedAt: new Date(now.getTime() - 200 * DAY),
  deadlineAt: new Date("2027-12-31T05:00:00Z"),
  tradingOpen: true,
  ruledOutcome: null,
};
const ids = Array.from({ length: 30 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

describe("simulated demo trading", () => {
  it("gives everyone the same numbers at the same moment", () => {
    expect(demoQuote(open, now)).toEqual(demoQuote({ ...open }, new Date(now)));
    expect(demoHistory(open, now)).toEqual(demoHistory(open, now));
  });

  it("never rewrites history that was already shown", () => {
    const earlier = demoHistory(open, now);
    const later = demoHistory(open, new Date(now.getTime() + 3 * DAY));
    const priceAt = (points: { at: Date; yesBp: number }[], t: number) => [...points].reverse().find((p) => p.at.getTime() <= t)!.yesBp;
    for (const t of [open.openedAt.getTime() + 5 * DAY, open.openedAt.getTime() + 60 * DAY, now.getTime() - 20 * DAY]) {
      expect(priceAt(later, t)).toBe(priceAt(earlier, t));
    }
  });

  it("opens at 50/50 and ends at the quoted last trade", () => {
    for (const id of ids) {
      const market = { ...open, id };
      const history = demoHistory(market, now);
      expect(history[0]).toEqual({ at: market.openedAt, yesBp: 5000 });
      expect(history.at(-1)!.at.getTime()).toBe(now.getTime());
      expect(history.at(-1)!.yesBp).toBe(demoQuote(market, now).lastYesCents * 100);
      for (let i = 1; i < history.length; i += 1) expect(history[i].at.getTime()).toBeGreaterThan(history[i - 1].at.getTime());
    }
  });

  it("offers both sides a cent or three apart, inside 1 to 99", () => {
    for (const id of ids) {
      const q = demoQuote({ ...open, id }, now);
      expect(q.yesAskCents).not.toBeNull();
      expect(q.noAskCents).not.toBeNull();
      const spread = q.yesAskCents! + q.noAskCents! - 100;
      expect(spread).toBeGreaterThanOrEqual(1);
      expect(spread).toBeLessThanOrEqual(3);
      for (const cents of [q.yesAskCents!, q.noAskCents!, q.lastYesCents]) {
        expect(cents).toBeGreaterThanOrEqual(1);
        expect(cents).toBeLessThanOrEqual(99);
      }
      expect(q.volumeContracts).toBeGreaterThan(0);
      expect(q.traders).toBeGreaterThan(0);
      expect(q.traders).toBeLessThanOrEqual(q.volumeContracts);
    }
  });

  it("varies from market to market", () => {
    const prices = new Set(ids.map((id) => demoQuote({ ...open, id }, now).lastYesCents));
    expect(prices.size).toBeGreaterThan(8);
  });

  it("keeps volume growing as time passes", () => {
    let previous = 0;
    for (let minutes = 0; minutes <= 180; minutes += 15) {
      const volume = demoQuote(open, new Date(now.getTime() + minutes * 60_000)).volumeContracts;
      expect(volume).toBeGreaterThanOrEqual(previous);
      previous = volume;
    }
    const buckets = demoVolumeBuckets(open, now);
    const daily = buckets.filter((b) => !b.hourly).reduce((sum, b) => sum + b.micro, 0) / 1_000_000;
    expect(Math.abs(daily - demoQuote(open, now).volumeContracts)).toBeLessThanOrEqual(buckets.length);
    expect(buckets.some((b) => b.hourly)).toBe(true);
  });

  it("lists a book whose best levels match the offers", () => {
    const q = demoQuote(open, now);
    const book = demoBook(open, now);
    const asks = book.filter((r) => r.direction === "sell").map((r) => r.price);
    const bids = book.filter((r) => r.direction === "buy").map((r) => r.price);
    expect(Math.min(...asks)).toBe(q.yesAskCents);
    expect(100 - Math.max(...bids)).toBe(q.noAskCents);
    expect(book.every((r) => r.quantity > 0)).toBe(true);
  });

  it("stops at the close, offers nothing, and settles toward a ruled outcome", () => {
    for (const outcome of ["yes", "no"] as const) {
      for (const id of ids.slice(0, 10)) {
        const ruled: DemoMarketInput = { id, openedAt: new Date("2026-01-10T00:00:00Z"), deadlineAt: new Date("2026-09-30T04:00:00Z"), tradingOpen: false, ruledOutcome: outcome };
        const q = demoQuote(ruled, now);
        expect(q.yesAskCents).toBeNull();
        expect(q.noAskCents).toBeNull();
        expect(q.change24hBp).toBe(0);
        expect(demoBook(ruled, now)).toEqual([]);
        if (outcome === "yes") expect(q.lastYesCents).toBeGreaterThanOrEqual(90);
        else expect(q.lastYesCents).toBeLessThanOrEqual(10);
        expect(demoHistory(ruled, now).at(-1)!.at.getTime()).toBe(ruled.deadlineAt.getTime());
      }
    }
  });

  it("draws a small chart of the last three months", () => {
    const spark = demoSpark(open, now);
    expect(spark).toHaveLength(40);
    expect(spark[0].at.getTime()).toBe(now.getTime() - 92 * DAY);
    expect(spark.at(-1)!.at.getTime()).toBe(now.getTime());
  });

  it("handles a market that opened moments ago", () => {
    const fresh = { ...open, openedAt: new Date(now.getTime() - 5 * 60_000) };
    const q = demoQuote(fresh, now);
    expect(Math.abs(q.lastYesCents - 50)).toBeLessThanOrEqual(2);
    expect(demoHistory(fresh, now)[0].yesBp).toBe(5000);
  });
});
