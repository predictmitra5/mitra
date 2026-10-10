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
import { insertGoalMarket, openEventMarket } from "@/test/markets";
import { readFeed, readPriceSeries, readQuotes, readTicker, recordClick, recordExposures, readEventCounts, thinSeries } from "./feed";
import { CAPPED_SLOTS, MAX_PER_GROUP_IN_TOP } from "./ranking";

const { profiles, markets, feedEvents, priceHistory } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-09-19T12:00:00Z"), clock = () => now;
let owner: string, alice: string, bob: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles, venues, resolution_sources CASCADE`);
  owner = await account("owner");
  alice = await account("alice");
  bob = await account("bob");
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
});

afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  return id;
}

/** An open event market at `venue`, trading until 9 PM Eastern on `cutoffDate`. */
async function openMarket(venue = "Test Tavern", cutoffDate = "2026-10-01", extra: Parameters<typeof openEventMarket>[3] = {}) {
  const cutoff = new Date(`${cutoffDate}T21:00:00-04:00`);
  const market = await openEventMarket(db, owner, now, { venueName: venue, question: `Will ${venue} be busy on ${cutoffDate}?`, cutoff, ...extra });
  return market.id;
}

/** Move a market's opening back, to age it past the newborn window. */
async function age(marketId: string, hours: number) {
  await db.update(markets)
    .set({ approvedAt: new Date(now.getTime() - hours * 3_600_000) })
    .where(eq(markets.id, marketId));
}

async function trade(userId: string, marketId: string, amountMicro = 10_000_000) {
  const preview = await previewTrade(db, userId, { marketId, side: "YES", action: "buy", amountMicro }, clock);
  return executeTrade(db, userId, preview, clock);
}

describe("the public feed", () => {
  it("is empty before anything is published, and never fails on an empty database", async () => {
    const feed = await readFeed(db, now);
    expect(feed.cards).toEqual([]);
    expect(feed.past).toEqual([]);
    expect(feed.featured).toBeNull();
    expect(feed.closingSoon).toEqual([]);
  });

  it("shows a published market with its venue, category, event and current price", async () => {
    const id = await openMarket("Midway on High");
    const feed = await readFeed(db, now);
    expect(feed.cards).toHaveLength(1);
    expect(feed.cards[0]).toMatchObject({
      id, venueName: "Midway on High", venueSlug: "midway-on-high", category: "nightlife", eventTitle: "Friday night",
      isSample: false, status: "open", tradingOpen: true, reason: "just added", timeZone: "America/New_York",
    });
    expect(feed.cards[0].yesPrice).toBeCloseTo(0.5, 4);
  });

  it("marks sample markets", async () => {
    await openMarket("Sample Bar", "2026-10-01", { isSample: true });
    expect((await readFeed(db, now)).cards[0].isSample).toBe(true);
  });

  it("never shows earlier goal markets, drafts, or anything private", async () => {
    const goal = await insertGoalMarket(db, alice, owner, now);
    const draft = await insertGoalMarket(db, alice, owner, now, { status: "draft" });
    await openMarket("Public Bar");

    const feed = await readFeed(db, now);
    expect(feed.cards.map((card) => card.id)).not.toContain(goal.id);
    expect(feed.cards.map((card) => card.id)).not.toContain(draft.id);

    const visible = JSON.stringify(feed);
    expect(visible).not.toContain("Chess Club");
    for (const privateValue of [owner, alice, bob, "subjectUserId", "liquidityMicro", "score", "groupKey"]) {
      expect(visible).not.toContain(privateValue);
    }
  });

  it("shows only the chosen campus, or only one venue", async () => {
    const osu = await openMarket("Ohio Bar");
    const uiuc = await openMarket("Illinois Bar", "2026-10-01", { campus: "uiuc" });
    expect((await readFeed(db, now, { campus: "osu" })).cards.map((card) => card.id)).toEqual([osu]);
    expect((await readFeed(db, now, { campus: "uiuc" })).cards.map((card) => card.id)).toEqual([uiuc]);
    const [venue] = await db.select().from(schema.venues).where(eq(schema.venues.name, "Ohio Bar"));
    expect((await readFeed(db, now, { venueId: venue.id })).cards.map((card) => card.id)).toEqual([osu]);
  });

  it("lists closed, resolved and void markets separately, latest cutoff first", async () => {
    const open = await openMarket("Open Bar", "2026-12-01");
    const voided = await openMarket("Void Bar", "2026-10-01");
    const closed = await openMarket("Closed Bar", "2026-10-02");
    await applyOwnerCommand(db, owner, { marketId: voided, requestId: randomUUID(), action: "cancel", reason: "Broken terms.", expectedVersion: 0 }, clock);
    await db.update(markets).set({ status: "closed", tradingClosedAt: now }).where(eq(markets.id, closed));
    const feed = await readFeed(db, now);
    expect(feed.cards.map((card) => card.id)).toEqual([open]);
    expect(feed.past.map((card) => card.id)).toEqual([closed, voided]);
    expect(feed.past.map((card) => card.status)).toEqual(["closed", "cancelled"]);
    expect(feed.past.every((card) => !card.tradingOpen)).toBe(true);
  });

  it("ranks a market with real trading above an equally aged one with none", async () => {
    const busy = await openMarket("Busy Bar");
    const quiet = await openMarket("Quiet Bar");
    await age(busy, 200);
    await age(quiet, 200);
    await trade(bob, busy);

    const order = (await readFeed(db, now)).cards.map((card) => card.id);
    expect(order[0]).toBe(busy);
    expect(order).toContain(quiet);
  });

  it("counts clicks from the last day only, ignoring older ones", async () => {
    const recent = await openMarket("Recent Bar");
    const stale = await openMarket("Stale Bar");
    await age(recent, 200);
    await age(stale, 200);

    await recordClick(db, recent);
    await db.insert(feedEvents).values({
      marketId: stale, kind: "click", createdAt: new Date(now.getTime() - 48 * 3_600_000),
    });

    const order = (await readFeed(db, now)).cards.map((card) => card.id);
    expect(order[0]).toBe(recent);
  });

  it("holds one venue to two of the leading slots once enough venues have markets", async () => {
    // One venue floods the feed; ten others have one market each.
    for (let i = 0; i < 5; i += 1) {
      const id = await openMarket("Loud Bar", `2026-10-0${i + 1}`);
      await age(id, 100);
      await trade(bob, id, 20_000_000);
    }
    for (let i = 0; i < 10; i += 1) {
      const id = await openMarket(`Venue ${i}`);
      await age(id, 100);
    }

    const feed = await readFeed(db, now);
    const top = feed.cards.slice(0, CAPPED_SLOTS);
    expect(top.filter((card) => card.venueName === "Loud Bar")).toHaveLength(MAX_PER_GROUP_IN_TOP);
    // Displaced markets are pushed down, never dropped.
    expect(feed.cards.filter((card) => card.venueName === "Loud Bar")).toHaveLength(5);
  });
});

describe("feed measurement", () => {
  it("records exposures and clicks against the right markets", async () => {
    const first = await openMarket("First Bar");
    const second = await openMarket("Second Bar");

    await recordExposures(db, [first, second, first]);
    await recordClick(db, first);

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
    await expect(recordExposures(db, [missing])).resolves.toBeUndefined();
    await expect(recordClick(db, missing)).resolves.toBeUndefined();
    expect((await readEventCounts(db, [missing])).size).toBe(0);
  });

  it("stores no viewer identity at all, by design", async () => {
    const id = await openMarket();
    await recordClick(db, id);
    const [row] = await db.select().from(feedEvents);
    expect(Object.keys(row).sort()).toEqual(["createdAt", "id", "kind", "marketId"]);
  });
});

describe("market information on each card", () => {
  it("reports play-point volume as the sum of traded amounts", async () => {
    const id = await openMarket("Volume Bar");
    await trade(bob, id, 10_000_000);
    await trade(bob, id, 5_000_000);

    const [card] = (await readFeed(db, now)).cards;
    // Trades spend up to the cap, so volume is close to, and never above, what was spent.
    expect(card.volumeMicro).toBeGreaterThan(14_000_000);
    expect(card.volumeMicro).toBeLessThanOrEqual(15_000_000);
  });

  it("reports zero volume for a market nobody has traded", async () => {
    await openMarket("Quiet Bar");
    expect((await readFeed(db, now)).cards[0].volumeMicro).toBe(0);
  });

  it("measures the 24-hour change against the price a day ago", async () => {
    const id = await openMarket("Moving Bar");
    // Pretend the market opened three days ago at 30%, sat at 40% two days ago.
    await db.update(markets).set({ approvedAt: new Date(now.getTime() - 72 * 3_600_000) }).where(eq(markets.id, id));
    await db.delete(priceHistory).where(eq(priceHistory.marketId, id));
    await db.insert(priceHistory).values([
      { marketId: id, yesPriceBp: 3000, recordedAt: new Date(now.getTime() - 72 * 3_600_000) },
      { marketId: id, yesPriceBp: 4000, recordedAt: new Date(now.getTime() - 48 * 3_600_000) },
    ]);

    const [card] = (await readFeed(db, now)).cards;
    // The live price is the opening 50%, and 40% was the last point before the window.
    expect(card.change24hBp).toBe(Math.round(card.yesPrice * 10_000) - 4000);
    expect(card.change24hBp).toBe(1000);
  });

  it("measures a sample market's change against its demonstration history", async () => {
    const id = await openMarket("Sample Bar", "2026-10-01", {
      isSample: true, openingBp: 4200,
      sampleHistory: [{ at: new Date(now.getTime() - 72 * 3_600_000), yesBp: 5000 }, { at: new Date(now.getTime() - 30 * 3_600_000), yesBp: 4100 }],
    });
    const [card] = (await readFeed(db, now)).cards;
    expect(card.id).toBe(id);
    expect(card.change24hBp).toBe(100);
  });

  it("falls back to the opening price for a market younger than a day", async () => {
    const id = await openMarket("Young Bar");
    await trade(bob, id, 30_000_000);
    const [card] = (await readFeed(db, now)).cards;
    // Opened at 50%; a YES buy moves it up, so the change is positive and matches.
    expect(card.change24hBp).toBeGreaterThan(0);
    expect(card.change24hBp).toBe(Math.round(card.yesPrice * 10_000) - 5000);
  });

  it("never exposes how many people traded, which could identify someone in a small group", async () => {
    const id = await openMarket("Private Bar");
    await trade(bob, id);
    const feed = await readFeed(db, now);
    const visible = JSON.stringify(feed);
    for (const hidden of ["traders", "uniqueTraders", "trades24h", "clicks24h", "subjectUserId", bob]) {
      expect(visible).not.toContain(hidden);
    }
  });
});

describe("the featured market and the closing soon list", () => {
  it("features the market that moved most today, with a series ending at the live price", async () => {
    const small = await openMarket("Small Move Bar");
    const big = await openMarket("Big Move Bar");
    await trade(bob, small, 10_000_000);
    await trade(alice, big, 40_000_000);

    const { featured } = await readFeed(db, now);
    expect(featured?.id).toBe(big);
    expect(featured?.moving).toBe(true);
    const times = (featured?.series ?? []).map((point) => new Date(point.at).getTime());
    expect(times.length).toBeGreaterThanOrEqual(2);
    // Oldest first, and the last point is the price the buttons show.
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(featured?.series.at(-1)?.yesBp).toBe(Math.round((featured?.yesPrice ?? 0) * 10_000));
  });

  it("counts a fall as a move, by its size", async () => {
    const rising = await openMarket("Rising Bar");
    const falling = await openMarket("Falling Bar");
    await trade(bob, rising, 10_000_000);
    const preview = await previewTrade(db, alice, { marketId: falling, side: "NO", action: "buy", amountMicro: 40_000_000 }, clock);
    await executeTrade(db, alice, preview, clock);

    const { featured } = await readFeed(db, now);
    expect(featured?.id).toBe(falling);
    expect(featured?.change24hBp).toBeLessThan(0);
  });

  it("falls back to the leading traded market when nothing moved today, without calling it a mover", async () => {
    const untraded = await openMarket("Brand New Bar");
    const traded = await openMarket("Busy Bar");
    await age(traded, 200);
    await trade(alice, traded, 10_000_000);
    // Move the trade two days back, so nothing moved in the last 24 hours.
    const twoDaysAgo = new Date(now.getTime() - 48 * 3_600_000);
    await db.update(schema.trades).set({ createdAt: twoDaysAgo }).where(eq(schema.trades.marketId, traded));
    // The opening point first, then the trade's, both before the 24-hour window.
    await db.update(priceHistory).set({ recordedAt: sql`${twoDaysAgo}::timestamptz - (case when ${priceHistory.yesPriceBp} = 5000 then interval '1 hour' else interval '0' end)` })
      .where(eq(priceHistory.marketId, traded));

    const feed = await readFeed(db, now);
    // The newborn head start still ranks the untraded market first in the grid...
    expect(feed.cards[0].id).toBe(untraded);
    // ...but the featured market is one with a chart to draw.
    expect(feed.featured?.id).toBe(traded);
    expect(feed.featured?.moving).toBe(false);
  });

  it("lists markets closing soonest first, five at most", async () => {
    const later = await openMarket("Later Bar", "2026-12-01");
    const sooner = await openMarket("Sooner Bar", "2026-10-01");
    expect((await readFeed(db, now)).closingSoon.map((card) => card.id)).toEqual([sooner, later]);
    for (let i = 0; i < 6; i += 1) await openMarket(`Bar ${i}`, "2026-11-01");
    expect((await readFeed(db, now)).closingSoon).toHaveLength(5);
  });

  it("feeds the ticker the leading markets in ranked order", async () => {
    const first = await openMarket("Busy Bar");
    await openMarket("Quiet Bar");
    await trade(bob, first, 20_000_000);
    const [feed, ticker] = [await readFeed(db, now), await readTicker(db, now)];
    expect(ticker.map((card) => card.id)).toEqual(feed.cards.map((card) => card.id));
  });

  it("features nothing on an empty database", async () => {
    const feed = await readFeed(db, now);
    expect(feed.featured).toBeNull();
    expect(feed.closingSoon).toEqual([]);
    expect(await readTicker(db, now)).toEqual([]);
  });
});

describe("price series", () => {
  it("returns one market's history for its own page, ending at the given current price", async () => {
    const id = await openMarket("Series Bar");
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

  it("leaves a short series alone", () => {
    const short = [{ at: new Date(0), yesBp: 1 }, { at: new Date(1), yesBp: 2 }];
    expect(thinSeries(short, 100)).toEqual(short);
  });
});

describe("live quotes", () => {
  it("match what the feed shows, and record nothing, so polling cannot inflate the ranking", async () => {
    const id = await openMarket();
    await trade(bob, id);
    const card = (await readFeed(db, now)).cards[0];
    const before = await db.select().from(feedEvents);
    const [quote] = await readQuotes(db, [id], now);
    expect(quote).toEqual({
      id, yesBp: Math.round(card.yesPrice * 10_000), change24hBp: card.change24hBp, volumeMicro: card.volumeMicro, tradingOpen: true,
    });
    await readQuotes(db, [id, id, id], now);
    expect(await db.select().from(feedEvents)).toHaveLength(before.length);
  });

  it("returns nothing for drafts, unknown ids or anything that is not an id", async () => {
    const draft = await insertGoalMarket(db, alice, owner, now, { status: "draft" });
    expect(await readQuotes(db, [draft.id, randomUUID(), "'; drop table markets; --", ""], now)).toEqual([]);
    expect(await readQuotes(db, [], now)).toEqual([]);
  });

  it("keeps quoting a market after trading closes, marked as closed", async () => {
    const id = await openMarket("Test Tavern", "2026-09-20");
    const [after] = await readQuotes(db, [id], new Date("2026-09-22T12:00:00Z"));
    expect(after).toMatchObject({ id, tradingOpen: false });
  });
});
