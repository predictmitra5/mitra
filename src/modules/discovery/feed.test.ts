import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { approveDraft, createGoalDraft } from "@/modules/goals/service";
import { executeTrade, previewTrade } from "@/modules/market/service";
import { readFeed, readPriceSeries, readQuotes, readTicker, recordClick, recordExposures, readEventCounts, thinSeries } from "./feed";
import { CAPPED_SLOTS, MAX_PER_SUBJECT_IN_TOP } from "./ranking";
import { withFixturePhoto } from "@/test/photo-fixture";

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
  await db.execute(sql`TRUNCATE TABLE profiles CASCADE`);
  owner = await account("owner");
  alice = await account("alice");
  bob = await account("bob");
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
});

afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  await withFixturePhoto(db, id);
  return id;
}

async function openGoal(subject: string, club = "Chess Club", deadline = "2026-10-01") {
  const draft = await createGoalDraft(db, subject, { type: "club", club, deadline }, now);
  await approveDraft(db, owner, draft.id, 5000, "Private approval note", now);
  return draft.id;
}

/** Move a market's approval time back, to age it past the newborn window. */
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
  it("is empty before anything is approved, and never fails on an empty database", async () => {
    const feed = await readFeed(db, now);
    expect(feed.cards).toEqual([]);
    expect(feed.featured).toBeNull();
    expect(feed.closingSoon).toEqual([]);
  });

  it("shows an approved goal with its public terms and current price", async () => {
    const id = await openGoal(alice);
    const feed = await readFeed(db, now);
    expect(feed.cards).toHaveLength(1);
    expect(feed.cards[0]).toMatchObject({
      id, displayName: "alice", handle: "alice", goalType: "club", tradingOpen: true, reason: "just added",
    });
    expect(feed.cards[0].yesPrice).toBeCloseTo(0.5, 4);
    expect(feed.cards[0].question).toContain("Chess Club");
  });

  it("never exposes drafts, rejections or anything private", async () => {
    const draft = await createGoalDraft(db, alice, { type: "club", club: "Secret Club", deadline: "2026-10-01" }, now);
    await openGoal(bob, "Public Club");

    const feed = await readFeed(db, now);
    expect(feed.cards.map((card) => card.id)).not.toContain(draft.id);

    const visible = JSON.stringify(feed);
    expect(visible).not.toContain("Secret Club");
    for (const privateValue of [owner, alice, bob, "Private approval note", "subjectUserId", "liquidityMicro", "score"]) {
      expect(visible).not.toContain(privateValue);
    }
  });

  it("ranks a goal with real trading above an equally aged one with none", async () => {
    const busy = await openGoal(alice, "Busy Club");
    const quiet = await openGoal(bob, "Quiet Club");
    await age(busy, 200);
    await age(quiet, 200);
    await trade(bob, busy);

    const order = (await readFeed(db, now)).cards.map((card) => card.id);
    expect(order[0]).toBe(busy);
    expect(order).toContain(quiet);
  });

  it("counts clicks from the last day only, ignoring older ones", async () => {
    const recent = await openGoal(alice, "Recent Club");
    const stale = await openGoal(bob, "Stale Club");
    await age(recent, 200);
    await age(stale, 200);

    await recordClick(db, recent);
    await db.insert(feedEvents).values({
      marketId: stale, kind: "click", createdAt: new Date(now.getTime() - 48 * 3_600_000),
    });

    const order = (await readFeed(db, now)).cards.map((card) => card.id);
    expect(order[0]).toBe(recent);
  });

  it("holds one person to two of the leading slots once enough people have goals", async () => {
    const subjects = [alice];
    for (let i = 0; i < 10; i += 1) subjects.push(await account(`person_${i}`));

    // Alice floods the feed; everyone else has one goal each.
    for (let i = 0; i < 5; i += 1) {
      const id = await openGoal(alice, `Alice Club ${i}`);
      await age(id, 100);
      await trade(bob, id, 20_000_000);
    }
    for (const person of subjects.slice(1)) {
      const id = await openGoal(person, "Their Club");
      await age(id, 100);
    }

    const feed = await readFeed(db, now);
    const top = feed.cards.slice(0, CAPPED_SLOTS);
    expect(top.filter((card) => card.handle === "alice")).toHaveLength(MAX_PER_SUBJECT_IN_TOP);
    // Displaced goals are pushed down, never dropped.
    expect(feed.cards.filter((card) => card.handle === "alice")).toHaveLength(5);
  });
});

describe("feed measurement", () => {
  it("records exposures and clicks against the right goals", async () => {
    const first = await openGoal(alice, "First Club");
    const second = await openGoal(bob, "Second Club");

    await recordExposures(db, [first, second, first]);
    await recordClick(db, first);

    const counts = await readEventCounts(db, [first, second]);
    expect(counts.get(first)).toEqual({ exposures: 2, clicks: 1 });
    expect(counts.get(second)).toEqual({ exposures: 1, clicks: 0 });
  });

  it("does nothing, and does not throw, when given no goals", async () => {
    await expect(recordExposures(db, [])).resolves.toBeUndefined();
    expect(await readEventCounts(db, [])).toEqual(new Map());
  });

  it("never throws when a goal id does not exist, so measurement cannot blank the page", async () => {
    const missing = randomUUID();
    await expect(recordExposures(db, [missing])).resolves.toBeUndefined();
    await expect(recordClick(db, missing)).resolves.toBeUndefined();
    expect((await readEventCounts(db, [missing])).size).toBe(0);
  });

  it("stores no viewer identity at all, by design", async () => {
    const id = await openGoal(alice);
    await recordClick(db, id);
    const [row] = await db.select().from(feedEvents);
    expect(Object.keys(row).sort()).toEqual(["createdAt", "id", "kind", "marketId"]);
  });
});

describe("market information on each card", () => {
  it("reports play-point volume as the sum of traded amounts", async () => {
    const id = await openGoal(alice, "Volume Club");
    await trade(bob, id, 10_000_000);
    await trade(bob, id, 5_000_000);

    const [card] = (await readFeed(db, now)).cards;
    // Trades spend up to the cap, so volume is close to, and never above, what was spent.
    expect(card.volumeMicro).toBeGreaterThan(14_000_000);
    expect(card.volumeMicro).toBeLessThanOrEqual(15_000_000);
  });

  it("reports zero volume for a goal nobody has traded", async () => {
    await openGoal(alice, "Quiet Club");
    expect((await readFeed(db, now)).cards[0].volumeMicro).toBe(0);
  });

  it("measures the 24-hour change against the price a day ago", async () => {
    const id = await openGoal(alice, "Moving Club");
    // Pretend the goal opened three days ago at 30%, sat at 40% two days ago.
    await db.update(markets).set({ approvedAt: new Date(now.getTime() - 72 * 3_600_000) }).where(eq(markets.id, id));
    await db.delete(priceHistory).where(eq(priceHistory.marketId, id));
    await db.insert(priceHistory).values([
      { marketId: id, yesPriceBp: 3000, recordedAt: new Date(now.getTime() - 72 * 3_600_000) },
      { marketId: id, yesPriceBp: 4000, recordedAt: new Date(now.getTime() - 48 * 3_600_000) },
    ]);

    const [card] = (await readFeed(db, now)).cards;
    // The live price is the approved 50%, and 40% was the last point before the window.
    expect(card.change24hBp).toBe(Math.round(card.yesPrice * 10_000) - 4000);
    expect(card.change24hBp).toBe(1000);
  });

  it("falls back to the opening price for a goal younger than a day", async () => {
    const id = await openGoal(alice, "Young Club");
    await trade(bob, id, 30_000_000);
    const [card] = (await readFeed(db, now)).cards;
    // Opened at 50%; a YES buy moves it up, so the change is positive and matches.
    expect(card.change24hBp).toBeGreaterThan(0);
    expect(card.change24hBp).toBe(Math.round(card.yesPrice * 10_000) - 5000);
  });

  it("never exposes how many people traded, which could identify someone in a small group", async () => {
    const id = await openGoal(alice, "Private Club");
    await trade(bob, id);
    const feed = await readFeed(db, now);
    const visible = JSON.stringify(feed);
    for (const hidden of ["traders", "uniqueTraders", "trades24h", "clicks24h", "subjectUserId", bob]) {
      expect(visible).not.toContain(hidden);
    }
  });
});

describe("the featured goal and the closing soon list", () => {
  it("features the goal that moved most today, with a series ending at the live price", async () => {
    const small = await openGoal(alice, "Small Move Club");
    const big = await openGoal(bob, "Big Move Club");
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
    const rising = await openGoal(alice, "Rising Club");
    const falling = await openGoal(bob, "Falling Club");
    await trade(bob, rising, 10_000_000);
    const preview = await previewTrade(db, alice, { marketId: falling, side: "NO", action: "buy", amountMicro: 40_000_000 }, clock);
    await executeTrade(db, alice, preview, clock);

    const { featured } = await readFeed(db, now);
    expect(featured?.id).toBe(falling);
    expect(featured?.change24hBp).toBeLessThan(0);
  });

  it("falls back to the leading traded goal when nothing moved today, without calling it a mover", async () => {
    const untraded = await openGoal(alice, "Brand New Club");
    const traded = await openGoal(bob, "Busy Club");
    await age(traded, 200);
    await trade(alice, traded, 10_000_000);
    // Move the trade two days back, so nothing moved in the last 24 hours.
    const twoDaysAgo = new Date(now.getTime() - 48 * 3_600_000);
    await db.update(schema.trades).set({ createdAt: twoDaysAgo }).where(eq(schema.trades.marketId, traded));
    // The opening point first, then the trade's, both before the 24-hour window.
    await db.update(priceHistory).set({ recordedAt: sql`${twoDaysAgo}::timestamptz - (case when ${priceHistory.yesPriceBp} = 5000 then interval '1 hour' else interval '0' end)` })
      .where(eq(priceHistory.marketId, traded));

    const feed = await readFeed(db, now);
    // The newborn head start still ranks the untraded goal first in the grid...
    expect(feed.cards[0].id).toBe(untraded);
    // ...but the featured goal is one with a chart to draw.
    expect(feed.featured?.id).toBe(traded);
    expect(feed.featured?.moving).toBe(false);
  });

  it("lists goals closing soonest first, five at most", async () => {
    const later = await openGoal(alice, "Later Club", "2026-12-01");
    const sooner = await openGoal(bob, "Sooner Club", "2026-10-01");
    expect((await readFeed(db, now)).closingSoon.map((card) => card.id)).toEqual([sooner, later]);
    for (let i = 0; i < 6; i += 1) await openGoal(await account(`closing_${i}`), `Club ${i}`, "2026-11-01");
    expect((await readFeed(db, now)).closingSoon).toHaveLength(5);
  });

  it("feeds the ticker the leading goals in ranked order", async () => {
    const first = await openGoal(alice, "Busy Club");
    await openGoal(bob, "Quiet Club");
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
  it("returns one goal's history for its own page, ending at the given current price", async () => {
    const id = await openGoal(alice, "Series Club");
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

describe("banned people", () => {
  it("leave the feed at once, even before their goals are cancelled", async () => {
    await openGoal(alice);
    const kept = await openGoal(bob);
    await db.update(profiles).set({ bannedAt: now }).where(eq(profiles.id, alice));
    const feed = await readFeed(db, now);
    expect(feed.cards.map((card) => card.id)).toEqual([kept]);
  });
});

describe("live quotes", () => {
  it("match what the feed shows, and record nothing, so polling cannot inflate the ranking", async () => {
    const id = await openGoal(alice);
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
    const draft = await createGoalDraft(db, alice, { type: "club", club: "Chess Club", deadline: "2026-10-01" }, now);
    expect(await readQuotes(db, [draft.id, randomUUID(), "'; drop table markets; --", ""], now)).toEqual([]);
    expect(await readQuotes(db, [], now)).toEqual([]);
  });

  it("keeps quoting a goal after trading closes, marked as closed", async () => {
    const id = await openGoal(alice, "Chess Club", "2026-09-20");
    const [after] = await readQuotes(db, [id], new Date("2026-09-22T12:00:00Z"));
    expect(after).toMatchObject({ id, tradingOpen: false });
  });
});
