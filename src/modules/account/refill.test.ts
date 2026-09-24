import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as memoryDb } from "drizzle-orm/pglite";
import { drizzle as postgresDb } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { approveDraft, createGoalDraft } from "@/modules/goals/service";
import { ECONOMY } from "@/modules/market/economy";
import { executeTrade, previewTrade } from "@/modules/market/service";
import { claimRefill, readRefillStatus, RefillError } from "./refill";
import { provisionAccount } from "./provision";
import { withFixturePhoto } from "@/test/photo-fixture";

const { profiles, wallets, ledgerEntries } = schema;
const hosted = process.env.MITRA_HOSTED_TEST === "1";
const start = ECONOMY.startingBalanceMicro;
const now = new Date("2026-09-18T12:00:00Z");
const clock = () => now;
const testSchema = `mitra_refill_test_${randomUUID().replaceAll("-", "")}`;
let memory: PGlite | undefined;
let remote: ReturnType<typeof postgres> | undefined;
let database: PgDatabase<PgQueryResultHKT, typeof schema>;
let owner: string, subject: string, trader: string;

beforeAll(async () => {
  if (hosted) {
    if (!process.env.DIRECT_DATABASE_URL) throw new Error("Hosted checks require DIRECT_DATABASE_URL in the process environment.");
    remote = postgres(process.env.DIRECT_DATABASE_URL, {
      prepare: false, ssl: "require", max: 6,
      connection: { search_path: testSchema, application_name: testSchema, statement_timeout: 15000, lock_timeout: 10000 },
      onnotice: () => {},
    });
    try {
      await remote.unsafe(`CREATE SCHEMA "${testSchema}"`);
      database = postgresDb(remote, { schema }) as unknown as typeof database;
    } catch { throw new Error("Could not initialize the isolated hosted test schema."); }
  } else {
    memory = new PGlite();
    database = memoryDb(memory, { schema }) as unknown as typeof database;
  }
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) {
      await database.execute(sql.raw(hosted ? statement.replaceAll('"public".', `"${testSchema}".`) : statement));
    }
  }
}, 90_000);

beforeEach(async () => {
  await database.execute(sql.raw(`TRUNCATE TABLE "${hosted ? testSchema : "public"}"."profiles" CASCADE`));
  owner = await account("owner");
  await database.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
  subject = await account("subject");
  trader = await account("trader");
}, 30_000);

afterAll(async () => {
  if (remote) {
    // Never drop a caller-supplied name or a schema outside this generated prefix.
    if (!/^mitra_refill_test_[0-9a-f]{32}$/.test(testSchema)) throw new Error("Unsafe test cleanup target.");
    await remote.unsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
    await remote.end();
  }
  await memory?.close();
}, 30_000);

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(database, id, { displayName: handle, handle, adultConfirmed: true }, now);
  await withFixturePhoto(database, id);
  return id;
}

async function setBalance(userId: string, balanceMicro: number, at: Date = now) {
  // Adjust through the ledger so the wallet keeps matching the sum of entries.
  const [wallet] = await database.select().from(wallets).where(eq(wallets.userId, userId));
  const delta = balanceMicro - wallet.balanceMicro;
  await database.update(wallets).set({ balanceMicro, updatedAt: at }).where(eq(wallets.userId, userId));
  if (delta !== 0) {
    await database.insert(ledgerEntries).values({
      userId, kind: "trade_buy", amountMicro: delta, memo: "test adjustment", createdAt: at,
    });
  }
}

async function refillsOf(userId: string) {
  return database.select().from(ledgerEntries).where(eq(ledgerEntries.kind, "refill"))
    .then((rows) => rows.filter((row) => row.userId === userId));
}

async function balanceOf(userId: string) {
  const [wallet] = await database.select().from(wallets).where(eq(wallets.userId, userId));
  return wallet.balanceMicro;
}

async function ledgerSum(userId: string) {
  const rows = await database.select().from(ledgerEntries);
  return rows.filter((row) => row.userId === userId).reduce((total, row) => total + row.amountMicro, 0);
}

async function failsWith(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "RefillError", code });
}

describe("claimRefill", () => {
  it("tops the balance back up to the starting balance and records one ledger entry", async () => {
    await setBalance(trader, 275 * 1_000_000);
    const receipt = await claimRefill(database, trader, randomUUID(), clock);

    expect(receipt.amountMicro).toBe(start - 275 * 1_000_000);
    expect(await balanceOf(trader)).toBe(start);
    const entries = await refillsOf(trader);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(receipt.requestId);
    expect(await ledgerSum(trader)).toBe(start);
  });

  it("refuses when cash is already at the starting balance and writes nothing", async () => {
    await failsWith(claimRefill(database, trader, randomUUID(), clock), "BALANCE_NOT_BELOW_START");
    expect(await refillsOf(trader)).toHaveLength(0);
    expect(await balanceOf(trader)).toBe(start);
  });

  it("counts only cash, so points held in an open prediction do not block a refill", async () => {
    const goal = await createGoalDraft(database, subject, { type: "internship", company: "Example Company", deadline: "2027-03-01" }, now);
    await approveDraft(database, owner, goal.id, 3000, "Clear written offer", now);
    const preview = await previewTrade(database, trader, { marketId: goal.id, action: "buy", side: "YES", amountMicro: 60_000_000 }, clock);
    await executeTrade(database, trader, preview, clock);

    const spent = start - (await balanceOf(trader));
    expect(spent).toBeGreaterThan(0);
    const receipt = await claimRefill(database, trader, randomUUID(), clock);
    expect(receipt.amountMicro).toBe(spent);
    // Cash is restored even though cash plus the open position now exceeds the start.
    expect(await balanceOf(trader)).toBe(start);
  });

  it("allows two refills per Eastern month and refuses the third", async () => {
    await setBalance(trader, 100 * 1_000_000);
    await claimRefill(database, trader, randomUUID(), clock);
    await setBalance(trader, 100 * 1_000_000);
    await claimRefill(database, trader, randomUUID(), clock);
    await setBalance(trader, 100 * 1_000_000);

    await failsWith(claimRefill(database, trader, randomUUID(), clock), "MONTHLY_LIMIT_REACHED");
    expect(await refillsOf(trader)).toHaveLength(ECONOMY.refillsPerMonth);
    expect(await balanceOf(trader)).toBe(100 * 1_000_000);
  });

  it("counts months in Eastern time, not UTC", async () => {
    // 1 October 02:00 UTC is still 30 September in New York.
    const septemberLate = new Date("2026-10-01T02:00:00Z");
    const octoberEarly = new Date("2026-10-01T05:00:00Z");
    await setBalance(trader, 100 * 1_000_000, septemberLate);
    await claimRefill(database, trader, randomUUID(), () => septemberLate);
    await setBalance(trader, 100 * 1_000_000, septemberLate);
    await claimRefill(database, trader, randomUUID(), () => septemberLate);
    await setBalance(trader, 100 * 1_000_000, septemberLate);
    await failsWith(claimRefill(database, trader, randomUUID(), () => septemberLate), "MONTHLY_LIMIT_REACHED");

    // The same wall-clock day in UTC, but a new month in Eastern time.
    const receipt = await claimRefill(database, trader, randomUUID(), () => octoberEarly);
    expect(receipt.amountMicro).toBe(start - 100 * 1_000_000);
    expect(await refillsOf(trader)).toHaveLength(3);
  });

  it("returns the original receipt when the same request is retried, and never credits twice", async () => {
    await setBalance(trader, 400 * 1_000_000);
    const requestId = randomUUID();
    const first = await claimRefill(database, trader, requestId, clock);
    // Spend again, so a second credit would be visible in the balance.
    await setBalance(trader, 200 * 1_000_000);

    const retry = await claimRefill(database, trader, requestId, clock);
    expect(retry).toEqual(first);
    expect(await balanceOf(trader)).toBe(200 * 1_000_000);
    expect(await refillsOf(trader)).toHaveLength(1);
  });

  it("rejects a request id belonging to another user or another kind of ledger entry", async () => {
    await setBalance(trader, 500 * 1_000_000);
    await setBalance(subject, 500 * 1_000_000);
    const theirs = await claimRefill(database, subject, randomUUID(), clock);
    await failsWith(claimRefill(database, trader, theirs.requestId, clock), "REQUEST_CONFLICT");

    const [grant] = (await database.select().from(ledgerEntries)).filter((row) => row.userId === trader && row.kind === "signup_grant");
    await failsWith(claimRefill(database, trader, grant.id, clock), "REQUEST_CONFLICT");
    expect(await refillsOf(trader)).toHaveLength(0);
  });

  it("rejects malformed request ids and people without an active adult profile", async () => {
    await setBalance(trader, 100 * 1_000_000);
    await failsWith(claimRefill(database, trader, "not-a-uuid", clock), "INVALID_REQUEST");
    await failsWith(claimRefill(database, randomUUID(), randomUUID(), clock), "PROFILE_REQUIRED");

    const legacy = await account("legacy");
    await database.update(profiles).set({ adultConfirmedAt: null }).where(eq(profiles.id, legacy));
    await failsWith(claimRefill(database, legacy, randomUUID(), clock), "PROFILE_REQUIRED");

    const gone = await account("gone");
    await database.update(profiles).set({ withdrawnAt: now }).where(eq(profiles.id, gone));
    await failsWith(claimRefill(database, gone, randomUUID(), clock), "PROFILE_REQUIRED");
  });
});

describe("readRefillStatus", () => {
  it("reports the remaining monthly refills and current eligibility", async () => {
    await setBalance(trader, 250 * 1_000_000);
    const before = await readRefillStatus(database, trader, clock);
    expect(before).toMatchObject({ balanceMicro: 250 * 1_000_000, targetMicro: start, remaining: ECONOMY.refillsPerMonth, monthlyLimit: ECONOMY.refillsPerMonth });
    expect(before.decision).toEqual({ eligible: true, amountMicro: start - 250 * 1_000_000 });
    expect(before.monthLabel).toBe("September 2026");

    await claimRefill(database, trader, randomUUID(), clock);
    const after = await readRefillStatus(database, trader, clock);
    expect(after.remaining).toBe(ECONOMY.refillsPerMonth - 1);
    expect(after.decision).toEqual({ eligible: false, reason: "BALANCE_NOT_BELOW_START" });
  });

  it("refuses to report for a withdrawn account", async () => {
    await database.update(profiles).set({ withdrawnAt: now }).where(eq(profiles.id, trader));
    await failsWith(readRefillStatus(database, trader, clock), "PROFILE_REQUIRED");
  });
});

describe.runIf(hosted)("hosted multi-connection concurrency", () => {
  it("never exceeds the monthly quota when two refills are claimed at once", async () => {
    await setBalance(trader, 100 * 1_000_000);
    await claimRefill(database, trader, randomUUID(), clock); // uses one of two
    await setBalance(trader, 100 * 1_000_000);

    const results = await Promise.allSettled([
      claimRefill(database, trader, randomUUID(), clock),
      claimRefill(database, trader, randomUUID(), clock),
    ]);
    const granted = results.filter((result) => result.status === "fulfilled");
    expect(granted).toHaveLength(1);
    expect(await refillsOf(trader)).toHaveLength(ECONOMY.refillsPerMonth);
    expect(await balanceOf(trader)).toBe(start);
    expect(await ledgerSum(trader)).toBe(start);
  }, 30_000);

  it("credits once when the same request arrives twice at the same moment", async () => {
    await setBalance(trader, 300 * 1_000_000);
    const requestId = randomUUID();
    const [first, second] = await Promise.all([
      claimRefill(database, trader, requestId, clock),
      claimRefill(database, trader, requestId, clock),
    ]);
    expect(first.amountMicro).toBe(second.amountMicro);
    expect(await refillsOf(trader)).toHaveLength(1);
    expect(await balanceOf(trader)).toBe(start);
  }, 30_000);
});

describe("RefillError", () => {
  it("is the only error type callers need to display", () => {
    expect(new RefillError("UNAVAILABLE", "message")).toBeInstanceOf(Error);
  });
});
