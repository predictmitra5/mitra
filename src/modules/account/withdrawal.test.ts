import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { publishMarket, submitProposal } from "@/modules/events/service";
import { executeTrade, previewTrade } from "@/modules/market/service";
import { insertGoalMarket, openEventMarket } from "@/test/markets";
import { provisionAccount } from "./provision";
import { WithdrawalError, withdrawAccount, type WithdrawalStorage } from "./withdrawal";

const { profiles, markets, wallets, positions, evidence, adminActions, marketProposals } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-05T16:00:00Z"), clock = () => now;
let owner: string, subject: string, trader: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles CASCADE`);
  owner = await account("owner"); subject = await account("subject"); trader = await account("trader");
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
});
afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, new Date("2026-09-01T12:00:00Z"));
  await db.update(profiles).set({ photoPath: `${id}/photo.webp`, photoUpdatedAt: now }).where(eq(profiles.id, id));
  return id;
}

/** A goal market about the subject from before the 2026-10-08 pivot. */
async function openGoal() {
  return (await insertGoalMarket(db, subject, owner, now, { deadline: new Date("2026-10-15T23:59:59-04:00") })).id;
}

async function suggest(question: string) {
  return submitProposal(db, subject, "osu", {
    question, category: "food", venueName: "Buckeye Donuts", windowStartAt: new Date("2026-10-10T02:00:00Z"),
    resolutionNote: "The shop's own sales count.",
  }, now);
}

async function buy(marketId: string, points = 20) {
  const input = { marketId, side: "YES" as const, action: "buy" as const, amountMicro: points * 1_000_000 };
  const preview = await previewTrade(db, trader, input, clock);
  return executeTrade(db, trader, preview, clock);
}

function fakeStorage(): WithdrawalStorage & { remove: ReturnType<typeof vi.fn> } {
  return { remove: vi.fn(async () => undefined) };
}

describe("account withdrawal", () => {
  it("refunds earlier goal markets about them, removes personal proof, and leaves accounting tombstones", async () => {
    const marketId = await openGoal();
    const before = (await db.select().from(wallets).where(eq(wallets.userId, trader)))[0].balanceMicro;
    await buy(marketId);
    await db.insert(evidence).values({
      marketId, submittedBy: subject, kind: "file", originalPath: `${marketId}/proof/original.pdf`,
      originalContentType: "application/pdf", originalBytes: 123, status: "published",
      verifiedStatement: "Membership confirmed.", reviewedBy: owner, reviewedAt: now,
    });
    const storage = fakeStorage();

    await withdrawAccount(db, subject, storage, clock);

    expect(storage.remove).toHaveBeenCalledWith(subject, {
      photoPath: `${subject}/photo.webp`, evidencePaths: [`${marketId}/proof/original.pdf`],
    });
    expect((await db.select().from(markets).where(eq(markets.id, marketId)))[0]).toMatchObject({ status: "cancelled" });
    expect((await db.select().from(wallets).where(eq(wallets.userId, trader)))[0].balanceMicro).toBe(before);
    expect((await db.select().from(positions).where(eq(positions.marketId, marketId)))[0]).toMatchObject({ yesSharesMicro: 0, yesCostBasisMicro: 0 });
    expect((await db.select().from(evidence).where(eq(evidence.marketId, marketId)))[0]).toMatchObject({
      originalPath: null, verifiedStatement: null, removedAt: now,
    });
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, subject));
    expect(profile).toMatchObject({ displayName: "Deleted member", adultConfirmedAt: null, photoPath: null, withdrawnAt: now });
    expect(profile.handle).toMatch(/^deleted_/);
    expect((await db.select().from(adminActions).where(eq(adminActions.kind, "withdraw_account")))).toHaveLength(1);
  });

  it("leaves ruled goal markets and historical trades in place", async () => {
    const marketId = await openGoal();
    await db.update(markets).set({ status: "ruled", ruledOutcome: "yes", ruledAt: now, rulingVersion: 1,
      rulingReason: "Confirmed.", contestEndsAt: new Date(now.getTime() + 86_400_000) }).where(eq(markets.id, marketId));
    await withdrawAccount(db, subject, fakeStorage(), clock);
    expect((await db.select().from(markets).where(eq(markets.id, marketId)))[0].status).toBe("ruled");
  });

  it("deletes suggestions that were never published, and keeps a published one as the market's history", async () => {
    await suggest("Will Buckeye Donuts sell 1,500 donuts?");
    const published = await suggest("Will Buckeye Donuts sell 1,200 donuts?");
    await publishMarket(db, owner, {
      proposalId: published.id, campus: "osu", category: "food", question: published.question, venue: { name: "Buckeye Donuts" },
      eventTitle: "Friday overnight", timeZone: "America/New_York",
      windowStartAt: new Date("2026-10-10T02:00:00Z"), windowEndAt: new Date("2026-10-10T08:00:00Z"),
      tradingCutoffAt: new Date("2026-10-10T02:00:00Z"), resultsDueAt: new Date("2026-10-13T08:00:00Z"),
      yesCondition: "More than 1,200 donuts sold in the window.", noCondition: "1,200 or fewer, or no count by the deadline.",
      rules: "Each donut counts once; a dozen counts as 12.", source: { name: "Shop count", method: "The shop's register count.", operational: false },
      openingProbabilityBp: 5500, isSample: false,
    }, now);
    const event = await openEventMarket(db, owner, now, { venueName: "Test Tavern" });
    await buy(event.id);
    await withdrawAccount(db, subject, fakeStorage(), clock);
    expect((await db.select().from(marketProposals)).map((row) => row.id)).toEqual([published.id]);
    // Their leaving does not touch event markets, which have no subject.
    expect((await db.select().from(markets).where(eq(markets.id, event.id)))[0].status).toBe("open");
  });

  it("never deletes the owner account", async () => {
    await expect(withdrawAccount(db, owner, fakeStorage(), clock)).rejects.toMatchObject<Partial<WithdrawalError>>({ code: "OWNER_ACCOUNT" });
    expect((await db.select().from(profiles).where(eq(profiles.id, owner)))[0].withdrawnAt).toBeNull();
  });

  it("fails closed on storage cleanup and can be retried", async () => {
    const storage = fakeStorage();
    storage.remove.mockRejectedValueOnce(new Error("storage down"));
    await expect(withdrawAccount(db, subject, storage, clock)).rejects.toMatchObject<Partial<WithdrawalError>>({ code: "UNAVAILABLE" });
    let [profile] = await db.select().from(profiles).where(eq(profiles.id, subject));
    expect(profile.withdrawnAt).toEqual(now);
    expect(profile.photoPath).not.toBeNull();

    await withdrawAccount(db, subject, storage, clock);
    [profile] = await db.select().from(profiles).where(eq(profiles.id, subject));
    expect(profile.photoPath).toBeNull();
    expect((await db.select().from(adminActions).where(eq(adminActions.kind, "withdraw_account")))).toHaveLength(1);
  });
});
