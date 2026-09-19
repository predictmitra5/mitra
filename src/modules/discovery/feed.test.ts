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
import { readFeed, recordClick, recordExposures, readEventCounts } from "./feed";
import { CAPPED_SLOTS, MAX_PER_SUBJECT_IN_TOP } from "./ranking";

const { profiles, markets, feedEvents } = schema;
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
    expect(feed.justAdded).toEqual([]);
    expect(feed.people).toEqual([]);
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

  it("lists the people with open goals as tabs, busiest first", async () => {
    await openGoal(alice, "Chess Club");
    await openGoal(alice, "Debate Club");
    await openGoal(bob, "Running Club");

    const feed = await readFeed(db, now);
    expect(feed.people).toEqual([
      { handle: "alice", displayName: "alice", openGoals: 2 },
      { handle: "bob", displayName: "bob", openGoals: 1 },
    ]);
  });

  it("puts a goal approved just now in the Just added row and an older one out of it", async () => {
    const old = await openGoal(alice, "Old Club");
    await age(old, 200);
    const fresh = await openGoal(bob, "New Club");

    const feed = await readFeed(db, now);
    expect(feed.justAdded.map((card) => card.id)).toEqual([fresh]);
    expect(feed.cards.map((card) => card.id)).toContain(old);
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
