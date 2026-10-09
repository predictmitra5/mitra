import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "./provision";
import { BAN_CANCEL_REASON, BAN_REJECT_REASON, banPerson, listPeople, unbanPerson } from "./moderation";
import { isBanned } from "./standing";
import { ownerQueue, ownerQueueOrNull } from "./owner-queue";
import { submitProposal } from "@/modules/events/service";
import { executeTrade, previewTrade } from "@/modules/market/service";
import { insertGoalMarket, openEventMarket } from "@/test/markets";
import { applyOwnerCommand } from "@/modules/market/lifecycle";

const { profiles, markets, wallets, positions, adminActions, marketProposals } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-09-24T12:00:00Z"), clock = () => now;
let owner: string, subject: string, trader: string, other: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles CASCADE`);
  owner = await account("owner"); subject = await account("subject"); trader = await account("trader"); other = await account("other");
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
});
afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, new Date("2026-09-01T12:00:00Z"));
  return id;
}
/** A goal market about `who` from before the 2026-10-08 pivot. */
async function goal(who = subject, deadline = "2026-10-15") {
  return (await insertGoalMarket(db, who, owner, now, { deadline: new Date(`${deadline}T23:59:59-04:00`) })).id;
}
async function event(venueName = "Test Tavern") {
  return (await openEventMarket(db, owner, now, { venueName })).id;
}
async function suggest(who: string) {
  return submitProposal(db, who, "osu", {
    question: "Will the Oval be packed on Saturday?", category: "campus", venueName: "The Oval",
    windowStartAt: new Date("2026-10-03T16:00:00Z"), resolutionNote: "A headcount from the student union.",
  }, now);
}
async function buy(userId: string, marketId: string, side: "YES" | "NO" = "YES", points = 10) {
  const preview = await previewTrade(db, userId, { marketId, side, action: "buy", amountMicro: points * 1_000_000 }, clock);
  return executeTrade(db, userId, preview, clock);
}
const balance = async (userId: string) => (await db.select().from(wallets).where(eq(wallets.userId, userId)))[0].balanceMicro;
const market = async (id: string) => (await db.select().from(markets).where(eq(markets.id, id)))[0];

describe("banning a person", () => {
  it("locks them out of trading, suggesting and every other action", async () => {
    const theirs = await event();
    await banPerson(db, owner, trader, "Harassing other students.", clock);
    expect(await isBanned(db, trader)).toBe(true);
    const [row] = await db.select().from(profiles).where(eq(profiles.id, trader));
    expect(row).toMatchObject({ bannedBy: owner, banReason: "Harassing other students." });
    await expect(previewTrade(db, trader, { marketId: theirs, side: "YES", action: "buy", amountMicro: 1_000_000 }, clock))
      .rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
    await expect(suggest(trader)).rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
  });

  it("cancels earlier goal markets about them and refunds every trader at held cost", async () => {
    const theirs = await goal();
    const before = await balance(trader);
    await buy(trader, theirs, "YES", 20);
    const result = await banPerson(db, owner, subject, "Fake account.", clock);
    expect(result).toEqual({ cancelled: 1, rejected: 0, remaining: 0 });
    expect(await market(theirs)).toMatchObject({ status: "cancelled", cancelReason: BAN_CANCEL_REASON });
    expect(await balance(trader)).toBe(before);
  });

  it("turns down their waiting suggestions, telling them why", async () => {
    const proposal = await suggest(subject);
    expect(await banPerson(db, owner, subject, "Fake account.", clock)).toMatchObject({ rejected: 1 });
    const [row] = await db.select().from(marketProposals).where(eq(marketProposals.id, proposal.id));
    expect(row).toMatchObject({ status: "rejected", reviewReason: BAN_REJECT_REASON });
    const [audit] = await db.select().from(adminActions).where(eq(adminActions.kind, "reject"));
    expect(audit.details).toMatchObject({ proposalId: proposal.id });
  });

  it("lets an earlier goal market that is already ruled finish, because it no longer needs their proof", async () => {
    const theirs = await goal(subject, "2026-09-25");
    await buy(trader, theirs);
    const goalRow = await market(theirs);
    const afterProof = () => new Date(goalRow.evidenceDeadlineAt.getTime() + 1000);
    await applyOwnerCommand(db, owner, { marketId: theirs, requestId: randomUUID(), action: "rule", expectedVersion: 0,
      outcome: "yes", basis: "checked_source", reason: "Offer letter reviewed." }, afterProof);
    expect(await banPerson(db, owner, subject, "Fake account.", afterProof)).toMatchObject({ cancelled: 0, remaining: 0 });
    expect((await market(theirs)).status).toBe("ruled");
  });

  it("leaves their positions in event markets in place", async () => {
    const theirs = await event();
    await buy(trader, theirs, "NO", 15);
    await banPerson(db, owner, trader, "Spam.", clock);
    const [held] = await db.select().from(positions).where(and(eq(positions.userId, trader), eq(positions.marketId, theirs)));
    expect(held.noSharesMicro).toBeGreaterThan(0);
    expect((await market(theirs)).status).toBe("open");
  });

  it("is safe to run again: nothing is cancelled twice and the ban is recorded once", async () => {
    await goal(); await suggest(subject);
    await banPerson(db, owner, subject, "Fake account.", clock);
    expect(await banPerson(db, owner, subject, "Fake account, again.", clock)).toEqual({ cancelled: 0, rejected: 0, remaining: 0 });
    const bans = await db.select().from(adminActions).where(eq(adminActions.kind, "ban"));
    expect(bans).toHaveLength(1);
    const [row] = await db.select().from(profiles).where(eq(profiles.id, subject));
    expect(row.banReason).toBe("Fake account.");
  });

  it("is for the owner only, and never bans the owner", async () => {
    await expect(banPerson(db, trader, subject, "Not my call.", clock)).rejects.toMatchObject({ code: "NOT_OWNER" });
    await expect(banPerson(db, owner, owner, "Myself.", clock)).rejects.toMatchObject({ code: "OWNER_ACCOUNT" });
    await expect(banPerson(db, owner, randomUUID(), "Nobody.", clock)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(banPerson(db, owner, "not-a-uuid", "Nobody.", clock)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(banPerson(db, owner, subject, " ", clock)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await isBanned(db, subject)).toBe(false);
  });
});

describe("lifting a ban", () => {
  it("restores access; cancelled markets stay cancelled", async () => {
    const theirs = await goal();
    const elsewhere = await event();
    await banPerson(db, owner, subject, "Mistake.", clock);
    await unbanPerson(db, owner, subject, clock);
    expect(await isBanned(db, subject)).toBe(false);
    expect((await market(theirs)).status).toBe("cancelled");
    await expect(buy(subject, elsewhere)).resolves.toBeTruthy();
    const [lifted] = await db.select().from(adminActions).where(eq(adminActions.kind, "unban"));
    expect(lifted.details).toMatchObject({ targetUserId: subject, banReason: "Mistake." });
  });

  it("is for the owner only", async () => {
    await banPerson(db, owner, subject, "Spam.", clock);
    await expect(unbanPerson(db, trader, subject, clock)).rejects.toMatchObject({ code: "NOT_OWNER" });
    expect(await isBanned(db, subject)).toBe(true);
  });
});

describe("the people list", () => {
  it("shows the owner everyone with their waiting suggestions and standing, and nobody else", async () => {
    await suggest(subject); await suggest(subject);
    const people = await listPeople(db, owner);
    expect(people.map((p) => p.handle).sort()).toEqual(["other", "owner", "subject", "trader"]);
    expect(people.find((p) => p.handle === "subject")).toMatchObject({ pendingSuggestions: 2, bannedAt: null, isOwner: false });
    expect(people.find((p) => p.handle === "owner")?.isOwner).toBe(true);
    await expect(listPeople(db, trader)).rejects.toMatchObject({ code: "NOT_OWNER" });
  });
});

describe("the owner's waiting count", () => {
  it("counts suggestions waiting for review, for the owner only", async () => {
    expect(await ownerQueue(db, owner)).toBe(0);
    await suggest(subject); await suggest(other);
    expect(await ownerQueue(db, owner)).toBe(2);
    expect(await ownerQueue(db, trader)).toBeNull();
    expect(await ownerQueueOrNull(db, null)).toBeNull();
    expect(await ownerQueueOrNull(db, "not-a-uuid")).toBeNull();
  });
});
