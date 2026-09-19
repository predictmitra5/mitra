import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as memoryDb } from "drizzle-orm/pglite";
import { drizzle as postgresDb } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "./provision";
import { claimRefill, readRefillStatus } from "./refill";
import { approveDraft, createGoalDraft } from "@/modules/goals/service";
import { executeTrade, previewTrade } from "@/modules/market/service";
import { advanceMarket, applyOwnerCommand } from "@/modules/market/lifecycle";

const { profiles, wallets, ledgerEntries, markets, positions } = schema;
const start = new Date("2026-09-18T12:00:00Z"), target = 1_000_000_000;
const at = (when = start) => () => when;
const hosted = process.env.MITRA_HOSTED_TEST === "1";
const name = `mitra_refill_test_${randomUUID().replaceAll("-", "")}`;
let memory: PGlite | undefined, remote: ReturnType<typeof postgres> | undefined;
let database: PgDatabase<PgQueryResultHKT, typeof schema>;
let alice: string, bob: string;

beforeAll(async () => {
  if (hosted) {
    if (!process.env.DIRECT_DATABASE_URL) throw new Error("DIRECT_DATABASE_URL is required for explicit hosted tests.");
    remote = postgres(process.env.DIRECT_DATABASE_URL, { prepare: false, ssl: "require", max: 6,
      connection: { search_path: name, statement_timeout: 15000, lock_timeout: 10000 }, onnotice: () => {} });
    try { await remote.unsafe(`CREATE SCHEMA "${name}"`); }
    catch { throw new Error("Could not create the isolated refill test schema."); }
    database = postgresDb(remote, { schema }) as unknown as typeof database;
  } else { memory = new PGlite(); database = memoryDb(memory, { schema }) as unknown as typeof database; }
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await database.execute(sql.raw(hosted ? statement.replaceAll('"public".', `"${name}".`) : statement));
  }
}, 90_000);

beforeEach(async () => {
  await database.execute(sql.raw(`TRUNCATE TABLE "${hosted ? name : "public"}"."profiles" CASCADE`));
  alice = await account("alice"); bob = await account("bob");
}, 30_000);

afterAll(async () => {
  if (remote) {
    if (!/^mitra_refill_test_[0-9a-f]{32}$/.test(name)) throw new Error("Unsafe cleanup target.");
    await remote.unsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`); await remote.end();
  }
  await memory?.close();
}, 30_000);

async function account(handle: string) {
  const id = randomUUID(); await provisionAccount(database, id, { displayName: handle, handle, adultConfirmed: true }, start); return id;
}
async function balance(user = alice) { return (await database.select().from(wallets).where(eq(wallets.userId, user)))[0].balanceMicro; }
async function refills(user = alice) { return database.select().from(ledgerEntries).where(and(eq(ledgerEntries.userId, user), eq(ledgerEntries.kind, "refill"))); }
async function adjust(amountMicro = -10_000_000, user = alice) {
  // Isolated fixture activity: preserve ledger reconciliation while controlling cash.
  await database.transaction(async (tx) => {
    await tx.select().from(wallets).where(eq(wallets.userId, user)).for("update");
    await tx.update(wallets).set({ balanceMicro: sql`${wallets.balanceMicro} + ${amountMicro}` }).where(eq(wallets.userId, user));
    await tx.insert(ledgerEntries).values({ userId: user, kind: amountMicro < 0 ? "trade_buy" : "trade_sell", amountMicro, memo: "Isolated refill test fixture", createdAt: start });
  });
}
async function reconcile() {
  const balances = await database.select().from(wallets), entries = await database.select().from(ledgerEntries);
  for (const wallet of balances) expect(wallet.balanceMicro).toBe(entries.filter((e) => e.userId === wallet.userId).reduce((sum, e) => sum + e.amountMicro, 0));
}
async function expectError(promise: Promise<unknown>, code: string) { await expect(promise).rejects.toMatchObject({ code }); }
async function openMarket() {
  await database.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, bob));
  const draft = await createGoalDraft(database, bob, { type: "club", club: "Chess", deadline: "2026-10-01" }, start);
  await approveDraft(database, bob, draft.id, 5000, "Clear goal", start); return draft.id;
}
async function buy(marketId: string) {
  const quote = await previewTrade(database, alice, { marketId, side: "YES", action: "buy", amountMicro: 10_000_000 }, at());
  return executeTrade(database, alice, quote, at());
}

describe("refill edge cases", () => {
  it("credits exactly the missing micro-points and returns an immutable receipt", async () => {
    await adjust(-123_456_789); const request = randomUUID();
    const result = await claimRefill(database, alice, request, at());
    expect(result).toEqual({ requestId: request, amountMicro: 123_456_789, creditedAt: start.toISOString() });
    expect(await balance()).toBe(target);
    expect(await readRefillStatus(database, alice, at())).toMatchObject({ remaining: 1, monthLabel: "September 2026", decision: { eligible: false } });
    expect((await refills())[0]).toMatchObject({ id: request, amountMicro: 123_456_789, createdAt: start });
    await reconcile();
  });
  it("requires cash below the target without consuming an allowance on refusal", async () => {
    await expectError(claimRefill(database, alice, randomUUID(), at()), "BALANCE_NOT_BELOW_START");
    await adjust(1);
    await expectError(claimRefill(database, alice, randomUUID(), at()), "BALANCE_NOT_BELOW_START");
    expect(await refills()).toHaveLength(0); expect((await readRefillStatus(database, alice, at())).remaining).toBe(2);
    await adjust(-target - 1); await claimRefill(database, alice, randomUUID(), at());
    expect(await balance()).toBe(target); await reconcile();
  });
  it("limits each user to two successful claims, independent of other users", async () => {
    for (let i = 0; i < 2; i++) { await adjust(); await claimRefill(database, alice, randomUUID(), at()); }
    await adjust();
    await expectError(claimRefill(database, alice, randomUUID(), at()), "MONTHLY_LIMIT_REACHED");
    expect(await readRefillStatus(database, alice, at())).toMatchObject({ remaining: 0, decision: { eligible: false, reason: "MONTHLY_LIMIT_REACHED" } });
    await adjust(-1, bob); await claimRefill(database, bob, randomUUID(), at());
    expect(await refills()).toHaveLength(2); expect(await refills(bob)).toHaveLength(1); await reconcile();
  });
  it.each([
    ["2026-10-01T03:59:59.999Z", "2026-10-01T04:00:00.000Z"],
    ["2027-01-01T04:59:59.999Z", "2027-01-01T05:00:00.000Z"],
    ["2026-04-01T03:59:59.999Z", "2026-04-01T04:00:00.000Z"],
    ["2026-12-01T04:59:59.999Z", "2026-12-01T05:00:00.000Z"],
  ])("resets exactly at the Eastern month boundary %s", async (before, after) => {
    for (let i = 0; i < 2; i++) { await adjust(); await claimRefill(database, alice, randomUUID(), at(new Date(before))); }
    await adjust(); await expectError(claimRefill(database, alice, randomUUID(), at(new Date(before))), "MONTHLY_LIMIT_REACHED");
    expect((await readRefillStatus(database, alice, at(new Date(after)))).remaining).toBe(2);
    await claimRefill(database, alice, randomUUID(), at(new Date(after)));
    expect((await readRefillStatus(database, alice, at(new Date(after)))).remaining).toBe(1); await reconcile();
  });
  it.each([
    ["2026-03-01T05:00:00Z", "2026-03-31T23:00:00Z"],
    ["2026-11-01T04:00:00Z", "2026-11-30T23:00:00Z"],
  ])("counts a full month across the daylight-saving change starting %s", async (first, last) => {
    await adjust(); await claimRefill(database, alice, randomUUID(), at(new Date(first)));
    await adjust(); await claimRefill(database, alice, randomUUID(), at(new Date(last)));
    await adjust(); await expectError(claimRefill(database, alice, randomUUID(), at(new Date(last))), "MONTHLY_LIMIT_REACHED");
    await reconcile();
  });
  it("returns the same receipt after spending or crossing months, without using another allowance", async () => {
    await adjust(); const id = randomUUID(); const original = await claimRefill(database, alice, id, at());
    await adjust(-1);
    expect(await claimRefill(database, alice.toUpperCase(), id.toUpperCase(), at())).toEqual(original);
    const nextMonth = at(new Date("2026-10-02T12:00:00Z"));
    expect(await claimRefill(database, alice, id, nextMonth)).toEqual(original);
    expect(await balance()).toBe(target - 1); expect(await refills()).toHaveLength(1);
    expect((await readRefillStatus(database, alice, nextMonth)).remaining).toBe(2); await reconcile();
  });
  it("requires an active adult profile, even for receipt retries", async () => {
    await adjust(); const id = randomUUID(); await claimRefill(database, alice, id, at());
    await expectError(claimRefill(database, randomUUID(), randomUUID(), at()), "PROFILE_REQUIRED");
    await database.update(profiles).set({ adultConfirmedAt: null }).where(eq(profiles.id, alice));
    await expectError(claimRefill(database, alice, id, at()), "PROFILE_REQUIRED");
    await expectError(readRefillStatus(database, alice, at()), "PROFILE_REQUIRED");
    await database.update(profiles).set({ adultConfirmedAt: start, withdrawnAt: start }).where(eq(profiles.id, alice));
    await expectError(claimRefill(database, alice, id, at()), "PROFILE_REQUIRED");
    expect(await refills()).toHaveLength(1);
  });
  it("rejects malformed identifiers and missing wallets without repairing accounts", async () => {
    for (const id of [null, {}, "not-a-uuid"] as unknown as string[]) {
      await expectError(claimRefill(database, alice, id, at()), "INVALID_REQUEST");
    }
    await expectError(claimRefill(database, "invalid", randomUUID(), at()), "PROFILE_REQUIRED");
    await database.delete(wallets).where(eq(wallets.userId, alice));
    await expectError(claimRefill(database, alice, randomUUID(), at()), "ACCOUNT_UNAVAILABLE");
    await expectError(readRefillStatus(database, alice, at()), "ACCOUNT_UNAVAILABLE");
    expect(await refills()).toHaveLength(0);
  });
  it("rechecks eligibility after a stale account snapshot", async () => {
    await adjust(); expect((await readRefillStatus(database, alice, at())).decision.eligible).toBe(true);
    await adjust(20_000_000);
    await expectError(claimRefill(database, alice, randomUUID(), at()), "BALANCE_NOT_BELOW_START");
    expect(await refills()).toHaveLength(0); await reconcile();
  });
  it("rolls back the cash update when ledger insertion fails, then safely retries", async () => {
    await adjust(); const before = await balance(), id = randomUUID();
    await database.execute(sql.raw("ALTER TABLE ledger_entries ADD CONSTRAINT test_no_refill CHECK (kind <> 'refill')"));
    try { await expectError(claimRefill(database, alice, id, at()), "UNAVAILABLE"); }
    finally { await database.execute(sql.raw("ALTER TABLE ledger_entries DROP CONSTRAINT test_no_refill")); }
    expect(await balance()).toBe(before); expect(await refills()).toHaveLength(0);
    await claimRefill(database, alice, id, at()); expect(await balance()).toBe(target); await reconcile();
  });
});

describe.runIf(hosted)("hosted refill races", () => {
  it("serializes deliberate cross-user request UUID reuse without leaking a receipt", async () => {
    await adjust(); await adjust(-20_000_000, bob); const id = randomUUID();
    const results = await Promise.allSettled([claimRefill(database, alice, id, at()), claimRefill(database, bob, id, at())]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.code).toBe("REQUEST_CONFLICT");
    expect((await refills()).length + (await refills(bob)).length).toBe(1); await reconcile();
  });
  it("preserves a buy racing the refill without losing either ledger entry", async () => {
    const marketId = await openMarket(); await adjust();
    await Promise.all([claimRefill(database, alice, randomUUID(), at()), buy(marketId)]);
    expect(await refills()).toHaveLength(1); expect(await balance()).toBeGreaterThanOrEqual(target - 10_000_000);
    expect(await balance()).toBeLessThanOrEqual(target); await reconcile();
  });
  it("preserves sale proceeds racing the refill", async () => {
    const marketId = await openMarket(); await buy(marketId); await adjust();
    const [position] = await database.select().from(positions).where(eq(positions.userId, alice));
    const quote = await previewTrade(database, alice, { marketId, side: "YES", action: "sell", amountMicro: position.yesSharesMicro }, at());
    await Promise.all([claimRefill(database, alice, randomUUID(), at()), executeTrade(database, alice, quote, at())]);
    expect(await balance()).toBeGreaterThanOrEqual(target); expect(await refills()).toHaveLength(1); await reconcile();
  });
  it("preserves settlement credits racing the refill", async () => {
    const marketId = await openMarket(); await buy(marketId); await adjust(-50_000_000);
    const [market] = await database.select().from(markets).where(eq(markets.id, marketId));
    await applyOwnerCommand(database, bob, { marketId, requestId: randomUUID(), action: "rule", expectedVersion: 0, outcome: "yes", basis: "reviewed_proof", reason: "The admission offer is verified." }, at(market.evidenceDeadlineAt));
    const [ruled] = await database.select().from(markets).where(eq(markets.id, marketId));
    await Promise.all([claimRefill(database, alice, randomUUID(), at(ruled.contestEndsAt!)), advanceMarket(database, marketId, at(ruled.contestEndsAt!))]);
    expect(await balance()).toBeGreaterThanOrEqual(target); expect(await refills()).toHaveLength(1);
    expect((await database.select().from(positions))[0].yesSharesMicro).toBe(0); await reconcile();
  });
  it("uses the month and balance after waiting on a wallet lock", async () => {
    const before = new Date("2026-10-01T03:59:59.999Z"), after = new Date("2026-10-01T04:00:00Z");
    for (let i = 0; i < 2; i++) { await adjust(); await claimRefill(database, alice, randomUUID(), at(before)); }
    let now = before, locked!: () => void, release!: () => void, blockerPid = 0;
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const released = new Promise<void>((resolve) => { release = resolve; });
    const blocker = database.transaction(async (tx) => {
      await tx.select().from(wallets).where(eq(wallets.userId, alice)).for("update");
      const pid = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      blockerPid = (pid as unknown as { pid: number }[])[0].pid;
      locked(); await released;
      await tx.update(wallets).set({ balanceMicro: target - 7 }).where(eq(wallets.userId, alice));
      await tx.insert(ledgerEntries).values({ userId: alice, kind: "trade_buy", amountMicro: -7, createdAt: after });
    });
    await ready;
    const attempt = claimRefill(database, alice, randomUUID(), () => now);
    // Attach a rejection handler immediately while waiting to inspect the lock.
    const result = attempt.then((receipt) => ({ receipt }), (error: unknown) => ({ error }));
    try {
      let observed = false;
      for (let i = 0; i < 50; i++) {
        const waiting = await remote!`select pid from pg_stat_activity where ${blockerPid} = any(pg_blocking_pids(pid))`;
        if (waiting.length) { observed = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(observed).toBe(true); now = after;
    } finally { release(); await blocker; }
    expect(await result).toMatchObject({ receipt: { amountMicro: 7, creditedAt: after.toISOString() } });
    expect((await readRefillStatus(database, alice, at(after))).remaining).toBe(1); await reconcile();
  });
});
