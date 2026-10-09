import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "./provision";
import { loadPositions, readPositions, positionsPageNumber, POSITIONS_PAGE_SIZE, valueHolding } from "./positions";
import { approveDraft, createGoalDraft } from "@/modules/goals/service";
import { executeTrade, previewTrade } from "@/modules/market/service";
import { applyOwnerCommand } from "@/modules/market/lifecycle";
import { price } from "@/modules/market/lmsr";
import { toLmsr } from "@/modules/market/quote";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { withFixturePhoto } from "@/test/photo-fixture";

const { profiles, markets, positions, wallets, ledgerEntries } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-09-19T12:00:00Z"), clock = () => now;
let owner: string, subject: string, trader: string, other: string, marketId: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles CASCADE`);
  owner = await account("owner"); subject = await account("subject"); trader = await account("trader"); other = await account("other");
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
  marketId = await open();
});
afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID(); await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now); await withFixturePhoto(db, id); return id;
}
async function open(deadline = "2026-10-01") {
  const draft = await createGoalDraft(db, subject, { type: "club", club: "Chess Club", deadline }, now);
  await approveDraft(db, owner, draft.id, 5000, "Private approval note", now); return draft.id;
}
async function trade(userId = trader, side: "YES" | "NO" = "YES", action: "buy" | "sell" = "buy", amountMicro = 10_000_000, id = marketId) {
  const preview = await previewTrade(db, userId, { marketId: id, side, action, amountMicro }, clock);
  return executeTrade(db, userId, preview, clock);
}
async function market() { return (await db.select().from(markets).where(eq(markets.id, marketId)))[0]; }

describe("private positions", () => {
  it("isolates each trader and gives the owner no view of other people's holdings", async () => {
    await trade(); await trade(other, "NO", "buy", 20_000_000);
    const mine = await readPositions(db, trader, 1, clock), theirs = await readPositions(db, other, 1, clock);
    expect(mine.total).toBe(1); expect(mine.goals[0]).toMatchObject({ yesCostBasisMicro: 10_000_000, noSharesMicro: 0 });
    expect(theirs.goals[0]).toMatchObject({ noCostBasisMicro: 20_000_000, yesSharesMicro: 0 });
    expect((await readPositions(db, owner, 1, clock)).total).toBe(0);
    const visible = JSON.stringify(mine);
    for (const privateValue of [owner, subject, trader, other, "Private approval note", "adultConfirmedAt", "rulingReason", "userId"]) {
      expect(visible).not.toContain(privateValue);
    }
    await expect(trade(owner)).rejects.toMatchObject({ code: "DECIDES_OUTCOME" });
    expect((await readPositions(db, owner, 1, clock)).total).toBe(0);
  });
  it("shows both sides once per goal and exact held costs after a partial sale", async () => {
    const bought = await trade(); await trade(trader, "NO");
    await trade(trader, "YES", "sell", Math.floor(bought.sharesMicro / 3));
    const held = (await db.select().from(positions).where(and(eq(positions.userId, trader), eq(positions.marketId, marketId))))[0];
    const data = await readPositions(db, trader, 1, clock);
    expect(data.total).toBe(1);
    expect(data.goals[0]).toMatchObject({ yesSharesMicro: held.yesSharesMicro, noSharesMicro: held.noSharesMicro,
      yesCostBasisMicro: held.yesCostBasisMicro, noCostBasisMicro: held.noCostBasisMicro });
    expect(held.yesCostBasisMicro).toBeLessThan(10_000_000);
  });
  it("carries the goal type and the market's public chance, not a valuation of the holding", async () => {
    await trade(other, "NO", "buy", 5_000_000);
    const before = (await readPositions(db, other, 1, clock)).goals[0];
    await trade();
    const goal = await market();
    const live = price(toLmsr({ liquidity: goal.liquidityMicro / MICRO_PER_UNIT, yesSharesMicro: goal.yesSharesMicro!, noSharesMicro: goal.noSharesMicro! }), "YES");
    const mine = (await readPositions(db, trader, 1, clock)).goals[0], theirs = (await readPositions(db, other, 1, clock)).goals[0];
    expect(mine).toMatchObject({ goalType: "club", yesPrice: live });
    // Everyone holding the goal sees the same public number, whichever side they hold.
    expect(theirs.yesPrice).toBe(live); expect(live).toBeGreaterThan(before.yesPrice!);
    for (const internal of ["liquidityMicro", "marketYesMicro", "marketNoMicro"]) expect(mine).not.toHaveProperty(internal);
  });
  it("values each side at today's price, with the gain or loss since bought", () => {
    const value = valueHolding({ yesPrice: 0.71, yesSharesMicro: 66_300_000, noSharesMicro: 10_000_000, yesCostBasisMicro: 39_800_000, noCostBasisMicro: 4_000_000 });
    // The boards' own numbers: 66.3 Yes shares at 71¢ are worth 47.1 points.
    expect(value?.sides).toEqual([
      { side: "yes", sharesMicro: 66_300_000, costMicro: 39_800_000, valueMicro: 47_073_000, gainMicro: 7_273_000 },
      { side: "no", sharesMicro: 10_000_000, costMicro: 4_000_000, valueMicro: 2_900_000, gainMicro: -1_100_000 },
    ]);
    expect(value).toMatchObject({ valueMicro: 49_973_000, costMicro: 43_800_000, gainMicro: 6_173_000 });
    expect(valueHolding({ yesPrice: null, yesSharesMicro: 1, noSharesMicro: 0, yesCostBasisMicro: 1, noCostBasisMicro: 0 })).toBeNull();
    expect(valueHolding({ yesPrice: 0.5, yesSharesMicro: 0, noSharesMicro: 0, yesCostBasisMicro: 0, noCostBasisMicro: 0 })?.sides).toEqual([]);
  });
  it("totals every holding on every page, not only the page shown", async () => {
    await trade(trader, "YES", "buy", 20_000_000);
    const second = await open("2026-11-01");
    await trade(trader, "NO", "buy", 10_000_000, second);
    const page = await readPositions(db, trader, 1, clock);
    const expected = page.goals.map((goal) => valueHolding(goal)!).reduce((sum, v) => ({
      valueMicro: sum.valueMicro + v.valueMicro, costMicro: sum.costMicro + v.costMicro, gainMicro: sum.gainMicro + v.gainMicro,
    }), { valueMicro: 0, costMicro: 0, gainMicro: 0 });
    expect(page.totals).toEqual(expected);
    // Held cost is exactly what was paid, and buying moves the price, so the first buyer shows a gain on paper.
    expect(page.totals.costMicro).toBe(30_000_000);
    expect((await readPositions(db, other, 1, clock)).totals).toEqual({ valueMicro: 0, costMicro: 0, gainMicro: 0 });
  });
  it("removes fully sold positions and handles accounts without trades", async () => {
    expect(await readPositions(db, trader, 1, clock)).toEqual({ goals: [], total: 0, page: 1, pages: 1, totals: { valueMicro: 0, costMicro: 0, gainMicro: 0 } });
    const bought = await trade(); await trade(trader, "YES", "sell", bought.sharesMicro);
    expect((await readPositions(db, trader, 999, clock)).total).toBe(0);
    expect((await readPositions(db, trader, 999, clock)).page).toBe(1);
  });
  it("requires an active adult account for both reading and lifecycle work", async () => {
    await trade(); const goal = await market();
    for (const userId of ["invalid", randomUUID()]) await expect(readPositions(db, userId)).rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
    await db.update(profiles).set({ adultConfirmedAt: null }).where(eq(profiles.id, trader));
    await expect(loadPositions(db, trader, 1, () => goal.deadlineAt)).rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
    expect((await market()).status).toBe("open");
    await db.update(profiles).set({ adultConfirmedAt: now, withdrawnAt: now }).where(eq(profiles.id, trader));
    await expect(readPositions(db, trader)).rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
    await expect(loadPositions(db, trader, 1, () => goal.deadlineAt)).rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
    expect((await market()).status).toBe("open");
  });
  it.each(["draft", "rejected", "settled", "cancelled"] as const)("excludes %s even if a stale nonzero position exists", async (status) => {
    await trade(); await db.update(markets).set({ status }).where(eq(markets.id, marketId));
    expect((await readPositions(db, trader, 1, clock)).total).toBe(0);
  });
  it("excludes unapproved goals and preserves one-micro-share holdings", async () => {
    const draft = await createGoalDraft(db, subject, { type: "club", club: "Private draft", deadline: "2026-10-01" }, now);
    await db.insert(positions).values({ userId: trader, marketId: draft.id, yesSharesMicro: 1, yesCostBasisMicro: 1 });
    await db.insert(positions).values({ userId: trader, marketId, noSharesMicro: 1, noCostBasisMicro: 1 });
    const data = await readPositions(db, trader, 1, clock);
    expect(data.total).toBe(1); expect(data.goals[0]).toMatchObject({ marketId, noSharesMicro: 1, noCostBasisMicro: 1 });
  });
  it("orders by deadline then market id, paginates without duplicates, and clamps deleted pages", async () => {
    const template = await market();
    const fixtures = Array.from({ length: POSITIONS_PAGE_SIZE + 3 }, (_, i) => ({ ...template, id: randomUUID(),
      deadlineAt: new Date(template.deadlineAt.getTime() - (i % 3) * 60_000), question: `Goal ${i}` }));
    await db.insert(markets).values(fixtures);
    await db.insert(positions).values(fixtures.map((goal) => ({ marketId: goal.id, userId: trader, yesSharesMicro: 1, yesCostBasisMicro: 1 })));
    const first = await readPositions(db, trader, 1, clock), second = await readPositions(db, trader, 2, clock);
    expect(first).toMatchObject({ total: 23, page: 1, pages: 2 }); expect(first.goals).toHaveLength(20); expect(second.goals).toHaveLength(3);
    const expected = fixtures.sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime() || a.id.localeCompare(b.id)).map((r) => r.id);
    expect([...first.goals, ...second.goals].map((g) => g.marketId)).toEqual(expected);
    expect((await readPositions(db, trader, 999999, clock)).page).toBe(2);
    await db.update(positions).set({ yesSharesMicro: 0, yesCostBasisMicro: 0 }).where(eq(positions.userId, trader));
    expect(await readPositions(db, trader, 2, clock)).toEqual({ goals: [], page: 1, pages: 1, total: 0, totals: { valueMicro: 0, costMicro: 0, gainMicro: 0 } });
  });
  it("uses exact cutoff states even before a stored transition has run", async () => {
    await trade(); const goal = await market();
    expect((await readPositions(db, trader, 1, () => new Date(goal.deadlineAt.getTime() - 1))).goals[0].tradingOpen).toBe(true);
    expect((await readPositions(db, trader, 1, () => goal.deadlineAt)).goals[0].tradingOpen).toBe(false);
    await db.update(markets).set({ tradingClosedAt: now }).where(eq(markets.id, marketId));
    expect((await readPositions(db, trader, 1, clock)).goals[0].tradingOpen).toBe(false);
    await db.update(markets).set({ status: "ruled", ruledOutcome: "yes", contestEndsAt: goal.evidenceDeadlineAt }).where(eq(markets.id, marketId));
    const cutoff = await readPositions(db, trader, 1, () => goal.evidenceDeadlineAt);
    expect(cutoff.goals[0]).toMatchObject({ status: "ruled", contestOpen: false, tradingOpen: false });
  });
  it("advances overdue goals and payouts before displaying the remaining holdings", async () => {
    await trade(); const goal = await market();
    expect((await loadPositions(db, trader, 1, () => goal.deadlineAt)).goals[0].status).toBe("closed");
    await applyOwnerCommand(db, owner, { marketId, requestId: randomUUID(), action: "rule", expectedVersion: 0,
      outcome: "yes", basis: "reviewed_proof", reason: "Offer verified." }, () => goal.evidenceDeadlineAt);
    const ruled = await market();
    expect((await loadPositions(db, trader, 1, () => new Date(ruled.contestEndsAt!.getTime() - 1))).goals[0].contestOpen).toBe(true);
    expect((await loadPositions(db, trader, 1, () => ruled.contestEndsAt!)).total).toBe(0);
    await loadPositions(db, trader, 1, () => ruled.contestEndsAt!);
    const payouts = await db.select().from(ledgerEntries).where(and(eq(ledgerEntries.userId, trader), eq(ledgerEntries.kind, "settlement")));
    expect(payouts).toHaveLength(1);
    const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.userId, trader));
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, trader));
    expect(wallet.balanceMicro).toBe(entries.reduce((sum, entry) => sum + entry.amountMicro, 0));
  });
  it("removes cancelled holdings after the existing refund workflow", async () => {
    await trade();
    await applyOwnerCommand(db, owner, { marketId, requestId: randomUUID(), expectedVersion: 0, action: "cancel", reason: "Terms were ambiguous." }, clock);
    expect((await loadPositions(db, trader, 1, clock)).total).toBe(0);
  });
  it("rejects invalid page numbers before doing database work", async () => {
    for (const page of [0, -1, 1.2, NaN, Infinity, 1000000]) {
      await expect(readPositions(db, trader, page)).rejects.toMatchObject({ code: "INVALID_PAGE" });
    }
    for (const value of ["0", "01", "-1", "2.5", "1e3", "1000000", "", ["1", "2"]]) {
      expect(() => positionsPageNumber(value)).toThrow("Open the first page");
    }
    expect(positionsPageNumber(undefined)).toBe(1); expect(positionsPageNumber("12")).toBe(12);
  });
});
