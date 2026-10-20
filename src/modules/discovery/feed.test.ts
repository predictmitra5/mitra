import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { executeTrade, previewTrade } from "@/modules/market/service";
import { applyOwnerCommand } from "@/modules/market/lifecycle";
import { insertGoalMarket, insertStartup, openEventMarket, openStartupMarket } from "@/test/markets";
import { pruneFeedEventBuckets, readCards, readFeed, readPriceSeries, readQuotes, readTicker, readVolumeBuckets, recordClick, recordExposures, readEventCounts, thinSeries } from "./feed";
import { CAPPED_SLOTS, MAX_PER_GROUP_IN_TOP } from "./ranking";
import { withFixtureGold } from "@/test/photo-fixture";

const { profiles, markets, feedEventBuckets, priceHistory, startups } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-19T12:00:00Z"), clock = () => now;
let owner: string, alice: string, bob: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles, venues, resolution_sources, startups, founders CASCADE`);
  owner = await account("owner");
  alice = await account("alice");
  bob = await account("bob");
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
});

afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  await withFixtureGold(db, id);
  return id;
}

/** An open startup market closing at the end of `closesOn`; a new startup unless one is given. */
async function openMarket(name = "Lumenly", closesOn = "2027-12-31", extra: { startupId?: string; industry?: "ai" | "gaming"; isDemo?: boolean; openingBp?: number } = {}) {
  const startupId = extra.startupId ?? (await insertStartup(db, now, { name, industry: extra.industry })).startup.id;
  const market = await openStartupMarket(db, owner, now, { startupId, question: `Will ${name} hit its goal by ${closesOn}?`, closesOn, isDemo: extra.isDemo, openingBp: extra.openingBp });
  return market.id;
}

/** Move a market's opening back, to age it past the newborn window. */
async function age(marketId: string, hours: number) {
  await db.update(markets).set({ approvedAt: new Date(now.getTime() - hours * 3_600_000) }).where(eq(markets.id, marketId));
}

async function trade(userId: string, marketId: string, amountMicro = 10_000_000, side: "YES" | "NO" = "YES") {
  const preview = await previewTrade(db, userId, { marketId, side, action: "buy", amountMicro }, clock);
  return executeTrade(db, userId, preview, clock);
}

describe("the market directory", () => {
  it("is empty before anything is published, and never fails on an empty database", async () => {
    const feed = await readFeed(db, now);
    expect(feed).toEqual({ cards: [], past: [], featured: null, closingSoon: [] });
  });

  it("shows a market with its startup, founder, industry, thumbnail details and current price", async () => {
    const id = await openMarket("Lumenly", "2027-12-31", { industry: "gaming" });
    const [card] = (await readFeed(db, now)).cards;
    expect(card).toMatchObject({
      id, startupName: "Lumenly", industry: "gaming", milestoneKind: "adoption", isSample: false, status: "open", tradingOpen: true,
      reason: "just added", timeZone: "America/New_York", founderRole: "Founder / CEO", productFeatures: ["check:One", "book:Two", "bot:Three"],
    });
    expect(card.founderName).toMatch(/^Founder /);
    expect(card.yesPrice).toBeCloseTo(0.5, 4);
    expect(card.spark.length).toBeGreaterThanOrEqual(1);
  });

  it("marks demo markets", async () => {
    await openMarket("Demo Co", "2027-12-31", { isDemo: true });
    expect((await readFeed(db, now)).cards[0].isSample).toBe(true);
  });

  it("never shows goal or event markets, drafts, unapproved startups, or anything private", async () => {
    const goal = await insertGoalMarket(db, alice, owner, now);
    const event = await openEventMarket(db, owner, now, { cutoff: new Date("2026-11-01T21:00:00-04:00") });
    const visible = await openMarket("Public Co");
    const hidden = await openMarket("Hidden Co");
    const [row] = await db.select().from(markets).where(eq(markets.id, hidden));
    await db.update(startups).set({ status: "suspended" }).where(eq(startups.id, row.startupId!));

    const feed = await readFeed(db, now);
    expect(feed.cards.map((card) => card.id)).toEqual([visible]);
    expect(feed.cards.map((card) => card.id)).not.toContain(goal.id);
    expect(feed.cards.map((card) => card.id)).not.toContain(event.id);
    const text = JSON.stringify(feed);
    for (const privateValue of [owner, alice, bob, "subjectUserId", "liquidityMicro", "score", "groupKey", "createdBy"]) expect(text).not.toContain(privateValue);
  });

  it("reads one startup's markets, or a given list in order", async () => {
    const { startup } = await insertStartup(db, now, { name: "Two Markets" });
    const a = await openMarket("Two Markets", "2027-06-30", { startupId: startup.id });
    const b = await openMarket("Two Markets", "2027-12-31", { startupId: startup.id });
    const other = await openMarket("Elsewhere");
    expect((await readFeed(db, now, { startupId: startup.id })).cards.map((card) => card.id).sort()).toEqual([a, b].sort());
    expect((await readCards(db, [other, a], now)).map((card) => card.id)).toEqual([other, a]);
  });

  it("lists closed, resolved and void markets separately, latest cutoff first", async () => {
    const open = await openMarket("Open Co", "2027-12-31");
    const voided = await openMarket("Void Co", "2027-01-31");
    const closed = await openMarket("Closed Co", "2027-02-28");
    await applyOwnerCommand(db, owner, { marketId: voided, requestId: randomUUID(), action: "cancel", reason: "Broken terms.", expectedVersion: 0 }, clock);
    await db.update(markets).set({ status: "closed", tradingClosedAt: now }).where(eq(markets.id, closed));
    const feed = await readFeed(db, now);
    expect(feed.cards.map((card) => card.id)).toEqual([open]);
    expect(feed.past.map((card) => card.id)).toEqual([closed, voided]);
    expect(feed.past.every((card) => !card.tradingOpen)).toBe(true);
  });

  it("shows a paused market as not trading", async () => {
    const id = await openMarket("Paused Co");
    await db.update(markets).set({ pausedAt: now, pausedReason: "Checking a claim." }).where(eq(markets.id, id));
    const [card] = (await readFeed(db, now)).cards;
    expect(card).toMatchObject({ paused: true, tradingOpen: false });
  });

  it("ranks a market with real trading above an equally aged one with none", async () => {
    const busy = await openMarket("Busy Co");
    const quiet = await openMarket("Quiet Co");
    await age(busy, 200);
    await age(quiet, 200);
    await trade(bob, busy);
    const order = (await readFeed(db, now)).cards.map((card) => card.id);
    expect(order[0]).toBe(busy);
    expect(order).toContain(quiet);
  });

  it("counts clicks from the last day only", async () => {
    const recent = await openMarket("Recent Co");
    const stale = await openMarket("Stale Co");
    await age(recent, 200);
    await age(stale, 200);
    await recordClick(db, recent);
    await db.insert(feedEventBuckets).values({
      marketId: stale, kind: "click", bucketAt: new Date(now.getTime() - 48 * 3_600_000), eventCount: 10,
    });

    const order = (await readFeed(db, now)).cards.map((card) => card.id);
    expect(order[0]).toBe(recent);
  });

  it("holds one startup to two of the leading slots once enough startups have markets", async () => {
    const { startup } = await insertStartup(db, now, { name: "Loud Co" });
    for (let i = 0; i < 5; i += 1) {
      const id = await openMarket("Loud Co", `2027-0${i + 1}-28`, { startupId: startup.id });
      await age(id, 100);
      await trade(bob, id, 20_000_000);
    }
    for (let i = 0; i < 10; i += 1) await age(await openMarket(`Startup ${i}`), 100);
    const feed = await readFeed(db, now);
    expect(feed.cards.slice(0, CAPPED_SLOTS).filter((card) => card.startupName === "Loud Co")).toHaveLength(MAX_PER_GROUP_IN_TOP);
    expect(feed.cards.filter((card) => card.startupName === "Loud Co")).toHaveLength(5);
  });
});

describe("feed measurement", () => {
  it("records exposures and clicks against the right markets", async () => {
    const first = await openMarket("First Bar");
    const second = await openMarket("Second Bar");

    await recordExposures(db, [first, second, first], now);
    await recordClick(db, first, now);

    const counts = await readEventCounts(db, [first, second]);
    expect(counts.get(first)).toEqual({ exposures: 2, clicks: 1 });
    expect(counts.get(second)).toEqual({ exposures: 1, clicks: 0 });
  });

  it("does nothing, and does not throw, when given no markets", async () => {
    await expect(recordExposures(db, [])).resolves.toBeUndefined();
    expect(await readEventCounts(db, [])).toEqual(new Map());
  });

  it("never throws when a market id does not exist, so measurement cannot blank the page", async () => {
    const missing = randomUUID();
    await expect(recordExposures(db, [missing], now)).resolves.toBeUndefined();
    await expect(recordClick(db, missing, now)).resolves.toBeUndefined();
    expect((await readEventCounts(db, [missing])).size).toBe(0);
  });

  it("aggregates market activity without viewer identity and caps ranking signals", async () => {
    const id = await openMarket();
    for (let i = 0; i < 10; i++) await recordClick(db, id, now);
    await recordClick(db, id, new Date(now.getTime() + 3_600_000));
    const rows = await db.select().from(feedEventBuckets);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.eventCount)).toEqual([3, 1]);
    for (const row of rows) expect(row).not.toHaveProperty("userId");
  });

  it("expires measurement buckets outside the ranking window", async () => {
    const id = await openMarket();
    await recordClick(db, id, now);
    await pruneFeedEventBuckets(db, new Date(now.getTime() + 26 * 3_600_000));
    expect(await db.select().from(feedEventBuckets)).toHaveLength(0);
  });

  it("never throws for missing markets or an empty list, so measurement cannot blank the page", async () => {
    await expect(recordExposures(db, [])).resolves.toBeUndefined();
    await expect(recordExposures(db, [randomUUID()])).resolves.toBeUndefined();
    await expect(recordClick(db, randomUUID())).resolves.toBeUndefined();
  });
});

describe("market information on each card", () => {
  it("reports credits traded and how many people traded, but never who", async () => {
    const id = await openMarket("Volume Co");
    await trade(bob, id, 10_000_000);
    await trade(alice, id, 5_000_000);
    await trade(bob, id, 5_000_000);
    const [card] = (await readFeed(db, now)).cards;
    expect(card.volumeMicro).toBeGreaterThan(19_000_000);
    expect(card.volumeMicro).toBeLessThanOrEqual(20_000_000);
    expect(card.traders).toBe(2);
    const text = JSON.stringify(card);
    for (const hidden of [bob, alice, "uniqueTraders", "trades24h", "clicks24h"]) expect(text).not.toContain(hidden);
  });

  it("measures the 24-hour change against the price a day ago", async () => {
    const id = await openMarket("Moving Co");
    await db.update(markets).set({ approvedAt: new Date(now.getTime() - 72 * 3_600_000) }).where(eq(markets.id, id));
    await db.delete(priceHistory).where(eq(priceHistory.marketId, id));
    await db.insert(priceHistory).values([
      { marketId: id, yesPriceBp: 3000, recordedAt: new Date(now.getTime() - 72 * 3_600_000) },
      { marketId: id, yesPriceBp: 4000, recordedAt: new Date(now.getTime() - 48 * 3_600_000) },
    ]);
    const [card] = (await readFeed(db, now)).cards;
    expect(card.change24hBp).toBe(1000);
  });

  it("shows a new sample market at 50/50 before anyone trades", async () => {
    const id = await openMarket("Sample Co", "2027-12-31", { isDemo: true });
    const [card] = (await readFeed(db, now)).cards;
    expect(card.id).toBe(id);
    expect(card.yesPrice).toBe(0.5);
    expect(card.change24hBp).toBe(0);
  });

  it("draws three months of price on the card, ending at today's price", async () => {
    const id = await openMarket("Spark Co");
    await db.insert(priceHistory).values([
      { marketId: id, yesPriceBp: 2000, recordedAt: new Date(now.getTime() - 200 * 86_400_000) },
      { marketId: id, yesPriceBp: 3000, recordedAt: new Date(now.getTime() - 40 * 86_400_000) },
    ]);
    await trade(bob, id, 20_000_000);
    const [card] = (await readFeed(db, now)).cards;
    // The price in force 92 days ago is carried to the left edge; nothing older is drawn.
    expect(card.spark[0].yesBp).toBe(2000);
    expect(new Date(card.spark[0].at).getTime()).toBeGreaterThanOrEqual(now.getTime() - 93 * 86_400_000);
    expect(card.spark.at(-1)!.yesBp).toBe(Math.round(card.yesPrice * 10_000));
  });

  it("sums volume per day and per hour for the chart's bars, never single trades", async () => {
    const id = await openMarket("Bars Co");
    await trade(bob, id, 10_000_000);
    await trade(alice, id, 6_000_000);
    const buckets = await readVolumeBuckets(db, id, now);
    const daily = buckets.filter((b) => !b.hourly);
    expect(daily).toHaveLength(1);
    expect(daily[0].micro).toBeGreaterThan(15_000_000);
    expect(buckets.some((b) => b.hourly)).toBe(true);
  });
});

describe("the featured market and the closing soon list", () => {
  it("features the market that moved most today, with a series ending at the live price", async () => {
    const small = await openMarket("Small Co");
    const big = await openMarket("Big Co");
    await trade(bob, small, 10_000_000);
    await trade(alice, big, 40_000_000);
    const { featured } = await readFeed(db, now, { all: true }, null);
    expect(featured?.id).toBe(big);
    expect(featured?.moving).toBe(true);
    expect(featured?.series.at(-1)?.yesBp).toBe(Math.round((featured?.yesPrice ?? 0) * 10_000));
  });

  it("features a pinned market while it is open", async () => {
    const pinned = await openMarket("Pinned Co");
    const big = await openMarket("Big Co");
    await trade(alice, big, 40_000_000);
    expect((await readFeed(db, now, { all: true }, pinned)).featured?.id).toBe(pinned);
    expect((await readFeed(db, now, { all: true }, null)).featured?.id).toBe(big);
  });

  it("lists markets closing soonest first, five at most, and feeds the ticker in ranked order", async () => {
    const later = await openMarket("Later Co", "2027-12-31");
    const sooner = await openMarket("Sooner Co", "2026-12-31");
    expect((await readFeed(db, now)).closingSoon.map((card) => card.id)).toEqual([sooner, later]);
    for (let i = 0; i < 6; i += 1) await openMarket(`Co ${i}`, "2027-06-30");
    const feed = await readFeed(db, now);
    expect(feed.closingSoon).toHaveLength(5);
    expect((await readTicker(db, now)).map((card) => card.id)).toEqual(feed.cards.map((card) => card.id));
  });
});

describe("price series", () => {
  it("returns one market's history ending at the given current price", async () => {
    const id = await openMarket("Series Co");
    await trade(bob, id, 10_000_000);
    const series = await readPriceSeries(db, id, { at: now, yesBp: 5555 });
    expect(series.length).toBeGreaterThanOrEqual(2);
    expect(series.at(-1)).toEqual({ at: now, yesBp: 5555 });
  });

  it("thins a long series evenly and keeps both ends", () => {
    const long = Array.from({ length: 1000 }, (_, i) => ({ at: new Date(i * 1000), yesBp: i }));
    const thin = thinSeries(long, 100);
    expect(thin).toHaveLength(100);
    expect(thin[0]).toEqual(long[0]);
    expect(thin.at(-1)).toEqual(long.at(-1));
  });
});

describe("live quotes", () => {
  it("match what the directory shows, and record nothing", async () => {
    const id = await openMarket();
    await trade(bob, id);
    const card = (await readFeed(db, now)).cards[0];
    const before = await db.select().from(feedEventBuckets);
    const [quote] = await readQuotes(db, [id], now);
    expect(quote).toEqual({ id, yesBp: Math.round(card.yesPrice * 10_000), change24hBp: card.change24hBp, volumeMicro: card.volumeMicro, tradingOpen: true });
    await readQuotes(db, [id, id, id], now);
    expect(await db.select().from(feedEventBuckets)).toHaveLength(before.length);
  });

  it("returns nothing for drafts, unknown ids or anything that is not an id, and marks paused markets closed", async () => {
    const draft = await insertGoalMarket(db, alice, owner, now, { status: "draft" });
    expect(await readQuotes(db, [draft.id, randomUUID(), "'; drop table markets; --", ""], now)).toEqual([]);
    const id = await openMarket("Paused Co");
    await db.update(markets).set({ pausedAt: now }).where(eq(markets.id, id));
    expect((await readQuotes(db, [id], now))[0]).toMatchObject({ tradingOpen: false });
  });
});
