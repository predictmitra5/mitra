import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { ECONOMY } from "@/modules/market/economy";
import { AccountError, provisionAccount, type AccountInput } from "./provision";

const { profiles, wallets, ledgerEntries } = schema;
const now = new Date("2026-09-16T12:00:00.000Z");
const input: AccountInput = { displayName: " Alex Student ", handle: " Alex_1 ", adultConfirmed: true };
const startingBalance = ECONOMY.startingBalanceMicro;
let client: PGlite;
let database: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  client = new PGlite(); // Isolated in-memory PostgreSQL; never reads DATABASE_URL.
  database = drizzle(client, { schema });
  await migrate(database, { migrationsFolder: "./drizzle" });
}, 30_000);

beforeEach(async () => {
  await client.exec("TRUNCATE TABLE profiles CASCADE");
});

afterAll(async () => {
  await client?.close();
});

async function counts() {
  return {
    profiles: (await database.select().from(profiles)).length,
    wallets: (await database.select().from(wallets)).length,
    grants: (await database.select().from(ledgerEntries).where(eq(ledgerEntries.kind, "signup_grant"))).length,
  };
}

describe("account provisioning against local PostgreSQL", () => {
  it("atomically creates an ordinary profile, wallet and auditable 1,000-point grant", async () => {
    const userId = randomUUID();
    const result = await provisionAccount(database, userId, input, now);
    expect(result).toMatchObject({
      created: true,
      balanceMicro: startingBalance,
      profile: { id: userId, displayName: "Alex Student", handle: "alex_1", isOwner: 0, adultConfirmedAt: now },
    });
    expect(await counts()).toEqual({ profiles: 1, wallets: 1, grants: 1 });
    expect(await database.select().from(ledgerEntries)).toMatchObject([
      { userId, amountMicro: startingBalance, kind: "signup_grant", marketId: null, tradeId: null, createdAt: now },
    ]);
  });

  it("retries preserve cash, identity fields and the original age affirmation", async () => {
    const userId = randomUUID();
    await provisionAccount(database, userId, input, now);
    await database.transaction(async (tx) => {
      await tx.insert(ledgerEntries).values({ userId, kind: "trade_buy", amountMicro: -200_000_000 });
      await tx.update(wallets).set({ balanceMicro: startingBalance - 200_000_000 }).where(eq(wallets.userId, userId));
    });
    const result = await provisionAccount(database, userId, {
      displayName: "Replacement Name", handle: "replacement", adultConfirmed: true,
    }, new Date("2026-09-17T12:00:00.000Z"));
    expect(result).toMatchObject({
      created: false,
      balanceMicro: startingBalance - 200_000_000,
      profile: { displayName: "Alex Student", handle: "alex_1", adultConfirmedAt: now },
    });
    expect(await counts()).toEqual({ profiles: 1, wallets: 1, grants: 1 });
  });

  it("overlapping calls remain repeat-safe on PGlite's serialized connection", async () => {
    // This does NOT prove unique-index waiting across independent hosted DB
    // sessions. That separate PostgreSQL concurrency check remains required.
    const userId = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => provisionAccount(database, userId, input, now)));
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.every((result) => result.balanceMicro === startingBalance)).toBe(true);
    expect(await counts()).toEqual({ profiles: 1, wallets: 1, grants: 1 });
  });

  it("normalizes handles and rolls back a different user's handle conflict", async () => {
    await provisionAccount(database, randomUUID(), input, now);
    await expect(provisionAccount(database, randomUUID(), { ...input, handle: "ALEX_1" }, now))
      .rejects.toMatchObject({ code: "HANDLE_TAKEN" });
    expect(await counts()).toEqual({ profiles: 1, wallets: 1, grants: 1 });
  });

  it("rolls back profile and wallet when the ledger write fails, then permits a clean retry", async () => {
    const userId = randomUUID();
    await client.exec(`
      CREATE FUNCTION fail_signup_for_test() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'private database details must not reach the user'; END; $$;
      CREATE TRIGGER fail_signup_for_test BEFORE INSERT ON ledger_entries
      FOR EACH ROW EXECUTE FUNCTION fail_signup_for_test();
    `);
    try {
      const error = await provisionAccount(database, userId, input, now).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(AccountError);
      expect(error).toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
      expect((error as Error).message).not.toContain("private database details");
      expect(error).not.toHaveProperty("cause");
      expect(await counts()).toEqual({ profiles: 0, wallets: 0, grants: 0 });
    } finally {
      await client.exec("DROP TRIGGER fail_signup_for_test ON ledger_entries; DROP FUNCTION fail_signup_for_test();");
    }
    expect((await provisionAccount(database, userId, input, now)).created).toBe(true);
    expect(await counts()).toEqual({ profiles: 1, wallets: 1, grants: 1 });
  });

  it("does not reactivate withdrawn profiles or grant again", async () => {
    const userId = randomUUID();
    await provisionAccount(database, userId, input, now);
    await database.update(profiles).set({ withdrawnAt: now }).where(eq(profiles.id, userId));
    await expect(provisionAccount(database, userId, input, now)).rejects.toMatchObject({ code: "ACCOUNT_WITHDRAWN" });
    expect((await database.select().from(profiles))[0].withdrawnAt).toEqual(now);
    expect(await counts()).toEqual({ profiles: 1, wallets: 1, grants: 1 });
  });

  it("records an explicit affirmation for a legacy active profile without another grant", async () => {
    const userId = randomUUID();
    await provisionAccount(database, userId, input, now);
    await database.update(profiles).set({ adultConfirmedAt: null }).where(eq(profiles.id, userId));
    await expect(provisionAccount(database, userId, { ...input, adultConfirmed: false }, now))
      .rejects.toMatchObject({ code: "ADULT_CONFIRMATION_REQUIRED" });
    expect((await database.select().from(profiles))[0].adultConfirmedAt).toBeNull();
    const result = await provisionAccount(database, userId, input, now);
    expect(result.created).toBe(false);
    expect(result.profile.adultConfirmedAt).toEqual(now);
    expect(await counts()).toEqual({ profiles: 1, wallets: 1, grants: 1 });
  });

  it.each(["wallet missing", "grant missing", "duplicate grants", "balance mismatch", "invalid grant"])(
    "fails closed for an existing account with %s", async (problem) => {
      const userId = randomUUID();
      await database.insert(profiles).values({ id: userId, handle: "legacy", displayName: "Legacy Student" });
      if (problem !== "wallet missing") {
        await database.insert(wallets).values({ userId, balanceMicro: problem === "balance mismatch" ? 42 : startingBalance });
      }
      if (problem !== "grant missing") {
        await database.insert(ledgerEntries).values({
          userId, kind: "signup_grant", amountMicro: problem === "invalid grant" ? 0 : startingBalance,
        });
      }
      if (problem === "duplicate grants") {
        await database.insert(ledgerEntries).values({ userId, kind: "signup_grant", amountMicro: startingBalance });
      }
      const before = await counts();
      await expect(provisionAccount(database, userId, input, now)).rejects.toMatchObject({ code: "ACCOUNT_INCONSISTENT" });
      expect(await counts()).toEqual(before);
      expect((await database.select().from(profiles))[0].adultConfirmedAt).toBeNull();
    },
  );

  it.each([false, undefined, "true", 1])("requires a literal adult affirmation, rejecting %s", async (adultConfirmed) => {
    await expect(provisionAccount(database, randomUUID(), { ...input, adultConfirmed } as AccountInput, now))
      .rejects.toMatchObject({ code: "ADULT_CONFIRMATION_REQUIRED" });
    expect(await counts()).toEqual({ profiles: 0, wallets: 0, grants: 0 });
  });

  it.each([
    { ...input, displayName: " " },
    { ...input, displayName: "x".repeat(81) },
    { ...input, displayName: "Alex\nStudent" },
    { ...input, handle: "xx" },
    { ...input, handle: "x".repeat(25) },
    { ...input, handle: "aléx" },
    { ...input, handle: "alex; drop table profiles" },
  ])("rejects malformed profile fields before writing", async (invalidInput) => {
    await expect(provisionAccount(database, randomUUID(), invalidInput, now)).rejects.toMatchObject({ code: "INVALID_PROFILE" });
    expect(await counts()).toEqual({ profiles: 0, wallets: 0, grants: 0 });
  });

  it("rejects a malformed identity before writing", async () => {
    await expect(provisionAccount(database, "not-an-auth-user-id", input, now)).rejects.toMatchObject({ code: "INVALID_IDENTITY" });
    expect(await counts()).toEqual({ profiles: 0, wallets: 0, grants: 0 });
  });

  it("ignores injected identifiers, balances, roles and timestamps", async () => {
    const verifiedUserId = randomUUID();
    const result = await provisionAccount(database, verifiedUserId, {
      ...input,
      id: randomUUID(),
      userId: randomUUID(),
      isOwner: 1,
      balanceMicro: 999_999_999_999,
      adultConfirmedAt: new Date("2000-01-01"),
      withdrawnAt: now,
    } as AccountInput, now);
    expect(result).toMatchObject({
      balanceMicro: startingBalance,
      profile: { id: verifiedUserId, isOwner: 0, adultConfirmedAt: now, withdrawnAt: null },
    });
    expect(await counts()).toEqual({ profiles: 1, wallets: 1, grants: 1 });
  });
});
