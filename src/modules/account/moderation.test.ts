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
import { approveDraft, createGoalDraft } from "@/modules/goals/service";
import { executeTrade, previewTrade, readPublicMarket } from "@/modules/market/service";
import { readPositions } from "./positions";
import { applyOwnerCommand } from "@/modules/market/lifecycle";

const { profiles, markets, wallets, positions, adminActions, evidence } = schema;
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
  // Posting a goal requires a profile photo (2026-09-24).
  await db.update(profiles).set({ photoPath: `${id}/test.webp`, photoUpdatedAt: now }).where(eq(profiles.id, id));
  return id;
}
async function goal(who = subject, deadline = "2026-10-15") {
  const draft = await createGoalDraft(db, who, { type: "club", club: "Chess Club", deadline }, now);
  await approveDraft(db, owner, draft.id, 5000, "", now);
  return draft.id;
}
async function buy(userId: string, marketId: string, side: "YES" | "NO" = "YES", points = 10) {
  const preview = await previewTrade(db, userId, { marketId, side, action: "buy", amountMicro: points * 1_000_000 }, clock);
  return executeTrade(db, userId, preview, clock);
}
const balance = async (userId: string) => (await db.select().from(wallets).where(eq(wallets.userId, userId)))[0].balanceMicro;
const market = async (id: string) => (await db.select().from(markets).where(eq(markets.id, id)))[0];

describe("banning a person", () => {
  it("locks them out of trading, posting and every other action", async () => {
    const theirs = await goal(other);
    await banPerson(db, owner, trader, "Harassing other students.", clock);
    expect(await isBanned(db, trader)).toBe(true);
    const [row] = await db.select().from(profiles).where(eq(profiles.id, trader));
    expect(row).toMatchObject({ bannedBy: owner, banReason: "Harassing other students." });
    await expect(previewTrade(db, trader, { marketId: theirs, side: "YES", action: "buy", amountMicro: 1_000_000 }, clock))
      .rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
    await expect(createGoalDraft(db, trader, { type: "club", club: "Chess Club", deadline: "2026-10-15" }, now))
      .rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
  });

  it("cancels their open goals and refunds every trader at held cost", async () => {
    const theirs = await goal();
    const before = await balance(trader);
    await buy(trader, theirs, "YES", 20);
    const result = await banPerson(db, owner, subject, "Fake account.", clock);
    expect(result).toEqual({ cancelled: 1, rejected: 0, remaining: 0 });
    expect(await market(theirs)).toMatchObject({ status: "cancelled", cancelReason: BAN_CANCEL_REASON });
    expect(await balance(trader)).toBe(before);
  });

  it("rejects their drafts, telling them why", async () => {
    const draft = await createGoalDraft(db, subject, { type: "club", club: "Chess Club", deadline: "2026-10-15" }, now);
    expect(await banPerson(db, owner, subject, "Fake account.", clock)).toMatchObject({ rejected: 1 });
    expect((await market(draft.id)).status).toBe("rejected");
    const [reason] = await db.select().from(adminActions).where(and(eq(adminActions.marketId, draft.id), eq(adminActions.kind, "reject")));
    expect(reason.reason).toBe(BAN_REJECT_REASON);
  });

  it("lets a goal that is already ruled finish, because it no longer needs their proof", async () => {
    const theirs = await goal(subject, "2026-09-25");
    await buy(trader, theirs);
    const goalRow = await market(theirs);
    const afterProof = () => new Date(goalRow.evidenceDeadlineAt.getTime() + 1000);
    await applyOwnerCommand(db, owner, { marketId: theirs, requestId: randomUUID(), action: "rule", expectedVersion: 0,
      outcome: "yes", basis: "reviewed_proof", reason: "Offer letter reviewed." }, afterProof);
    expect(await banPerson(db, owner, subject, "Fake account.", afterProof)).toMatchObject({ cancelled: 0, remaining: 0 });
    expect((await market(theirs)).status).toBe("ruled");
  });

  it("stops linking to their photo wherever their remaining goals still show", async () => {
    const theirs = await goal(subject, "2026-09-25");
    await buy(trader, theirs);
    const goalRow = await market(theirs);
    const afterProof = () => new Date(goalRow.evidenceDeadlineAt.getTime() + 1000);
    await applyOwnerCommand(db, owner, { marketId: theirs, requestId: randomUUID(), action: "rule", expectedVersion: 0,
      outcome: "yes", basis: "reviewed_proof", reason: "Offer letter reviewed." }, afterProof);
    expect((await readPublicMarket(db, theirs))?.photoUpdatedAt).not.toBeNull();
    await banPerson(db, owner, subject, "Fake account.", afterProof);
    // The photo route refuses a banned person, so a link would be a broken image.
    expect((await readPublicMarket(db, theirs))?.photoUpdatedAt).toBeNull();
    expect((await readPositions(db, trader, 1, afterProof)).goals[0].photoUpdatedAt).toBeNull();
  });

  it("leaves their bets on other people's goals in place", async () => {
    const theirs = await goal(other);
    await buy(trader, theirs, "NO", 15);
    await banPerson(db, owner, trader, "Spam.", clock);
    const [held] = await db.select().from(positions).where(and(eq(positions.userId, trader), eq(positions.marketId, theirs)));
    expect(held.noSharesMicro).toBeGreaterThan(0);
    expect((await market(theirs)).status).toBe("open");
  });

  it("is safe to run again: nothing is cancelled twice and the ban is recorded once", async () => {
    await goal();
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
  it("restores access; cancelled goals stay cancelled", async () => {
    const theirs = await goal();
    const elsewhere = await goal(other);
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
  it("shows the owner everyone with their goals and standing, and nobody else", async () => {
    await goal();
    const people = await listPeople(db, owner);
    expect(people.map((p) => p.handle).sort()).toEqual(["other", "owner", "subject", "trader"]);
    expect(people.find((p) => p.handle === "subject")).toMatchObject({ activeGoals: 1, bannedAt: null, isOwner: false });
    expect(people.find((p) => p.handle === "owner")?.isOwner).toBe(true);
    await expect(listPeople(db, trader)).rejects.toMatchObject({ code: "NOT_OWNER" });
  });
});

describe("the owner's waiting count", () => {
  it("counts goals to approve and proof to read, for the owner only", async () => {
    expect(await ownerQueue(db, owner)).toBe(0);
    await createGoalDraft(db, subject, { type: "club", club: "Chess Club", deadline: "2026-10-15" }, now);
    const live = await goal(other);
    await db.insert(evidence).values({ marketId: live, submittedBy: other, kind: "link", linkUrl: "https://example.com/proof" });
    expect(await ownerQueue(db, owner)).toBe(2);
    expect(await ownerQueue(db, trader)).toBeNull();
    expect(await ownerQueueOrNull(db, null)).toBeNull();
    expect(await ownerQueueOrNull(db, "not-a-uuid")).toBeNull();
  });
});
