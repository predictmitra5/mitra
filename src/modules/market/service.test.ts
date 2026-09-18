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
import { provisionAccount } from "@/modules/account/provision";
import { approveDraft, createGoalDraft, rejectDraft } from "@/modules/goals/service";
import { executeTrade, previewTrade, readPublicMarket, readTrader, type TradePreview, type TradeRequest } from "./service";

const { profiles, markets, wallets, ledgerEntries, positions, trades, priceHistory, marketOutcomeDeciders } = schema;
const hosted = process.env.MITRA_HOSTED_TEST === "1";
const now = new Date("2026-09-18T12:00:00Z");
const clock = () => now;
const testSchema = `mitra_trade_test_${randomUUID().replaceAll("-", "")}`;
let memory: PGlite | undefined;
let remote: ReturnType<typeof postgres> | undefined;
let database: PgDatabase<PgQueryResultHKT, typeof schema>;
let owner: string, subject: string, trader: string, other: string, marketId: string;

beforeAll(async () => {
  if (hosted) {
    if (!process.env.DIRECT_DATABASE_URL) throw new Error("Hosted checks require DIRECT_DATABASE_URL in the process environment.");
    remote = postgres(process.env.DIRECT_DATABASE_URL, { prepare: false, ssl: "require", max: 6,
      connection: { search_path: testSchema, application_name: testSchema, statement_timeout: 15000, lock_timeout: 10000 }, onnotice: () => {} });
    try {
      await remote.unsafe(`CREATE SCHEMA "${testSchema}"`);
      database = postgresDb(remote, { schema }) as unknown as typeof database;
    } catch { throw new Error("Could not initialize the isolated hosted test schema."); }
  } else {
    memory = new PGlite();
    database = memoryDb(memory, { schema }) as unknown as typeof database;
  }
  // The hosted run redirects every explicit public-schema reference and all
  // unqualified names into this generated schema. No public rows are touched.
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) {
      const isolated = hosted ? statement.replaceAll('"public".', `"${testSchema}".`) : statement;
      await database.execute(sql.raw(isolated));
    }
  }
}, 90_000);

beforeEach(async () => {
  await database.execute(sql.raw(`TRUNCATE TABLE "${hosted ? testSchema : "public"}"."profiles" CASCADE`));
  owner = await account("owner");
  await database.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
  subject = await account("subject"); trader = await account("trader"); other = await account("other");
  marketId = await openMarket();
}, 30_000);

afterAll(async () => {
  if (remote) {
    // Never drop a caller-supplied name or a schema outside this generated prefix.
    if (!/^mitra_trade_test_[0-9a-f]{32}$/.test(testSchema)) throw new Error("Unsafe test cleanup target.");
    await remote.unsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
    await remote.end();
  }
  await memory?.close();
}, 30_000);

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(database, id, { displayName: handle, handle, adultConfirmed: true }, now);
  return id;
}
async function openMarket() {
  const goal = await createGoalDraft(database, subject, { type: "internship", company: "Example Company", deadline: "2027-03-01" }, now);
  await approveDraft(database, owner, goal.id, 3000, "Clear written offer", now);
  return goal.id;
}
function request(extra: Partial<TradeRequest> = {}): TradeRequest { return { marketId, action: "buy", side: "YES", amountMicro: 10_000_000, ...extra }; }
async function preview(user = trader, extra: Partial<TradeRequest> = {}) { return previewTrade(database, user, request(extra), clock); }
async function buy(user = trader, extra: Partial<TradeRequest> = {}) { return executeTrade(database, user, await preview(user, extra), clock); }
async function error(promise: Promise<unknown>, code: string) { await expect(promise).rejects.toMatchObject({ code }); }
async function state() {
  return { wallets: await database.select().from(wallets), trades: await database.select().from(trades),
    ledger: await database.select().from(ledgerEntries), positions: await database.select().from(positions),
    history: await database.select().from(priceHistory), markets: await database.select().from(markets) };
}
async function reconcile() {
  const all = await state();
  for (const wallet of all.wallets) {
    expect(wallet.balanceMicro).toBeGreaterThanOrEqual(0);
    expect(wallet.balanceMicro).toBe(all.ledger.filter((e) => e.userId === wallet.userId).reduce((sum, e) => sum + e.amountMicro, 0));
  }
  for (const market of all.markets) {
    const held = all.positions.filter((p) => p.marketId === market.id);
    expect(market.yesSharesMicro).toBe(market.initialYesSharesMicro! + held.reduce((sum, p) => sum + p.yesSharesMicro, 0));
    expect(market.noSharesMicro).toBe(market.initialNoSharesMicro! + held.reduce((sum, p) => sum + p.noSharesMicro, 0));
  }
  for (const trade of all.trades) {
    expect(all.ledger.filter((e) => e.tradeId === trade.id)).toHaveLength(1);
    expect(all.history.filter((p) => p.tradeId === trade.id)).toHaveLength(1);
  }
}

describe("public market and private trader views", () => {
  it("exposes only approved public terms, and hides drafts, rejections and never-approved cancellations", async () => {
    const publicGoal = await readPublicMarket(database, marketId);
    expect(publicGoal?.yesPrice).toBeCloseTo(0.3, 7);
    expect(publicGoal).not.toHaveProperty("approvedBy");
    expect(publicGoal).not.toHaveProperty("subjectUserId");
    expect(publicGoal).not.toHaveProperty("yesSharesMicro");
    expect(await readPublicMarket(database, "bad-id")).toBeNull();
    const draft = await createGoalDraft(database, subject, { type: "club", club: "Chess", deadline: "2027-01-01" }, now);
    expect(await readPublicMarket(database, draft.id)).toBeNull();
    await rejectDraft(database, owner, draft.id, "Private rejection", now);
    expect(await readPublicMarket(database, draft.id)).toBeNull();
    await database.update(markets).set({ status: "cancelled" }).where(eq(markets.id, draft.id));
    expect(await readPublicMarket(database, draft.id)).toBeNull();
  });
  it("returns only the verified trader's holdings and reports the subject ban", async () => {
    await buy();
    expect((await readTrader(database, other, marketId))?.position.yesSharesMicro).toBe(0);
    expect((await readTrader(database, trader, marketId))?.position.yesSharesMicro).toBeGreaterThan(0);
    expect((await readTrader(database, subject, marketId))?.blocked).toContain("cannot trade");
    expect(await readTrader(database, randomUUID(), marketId)).toBeNull();
  });
});

describe("transactional trading", () => {
  it("previews without writes and commits all accounting together", async () => {
    const before = await state();
    const quote = await preview();
    expect(await state()).toEqual(before);
    const receipt = await executeTrade(database, trader, quote, clock);
    expect(receipt.totalMicro).toBe(quote.totalMicro);
    expect(receipt.sharesMicro).toBe(quote.sharesMicro);
    expect((await readTrader(database, trader, marketId))?.balanceMicro).toBe(1_000_000_000 - receipt.totalMicro);
    await reconcile();
  });
  it("buys both sides, sells a partial holding, then sells the rest and releases all basis", async () => {
    const yes = await buy();
    const no = await buy(trader, { side: "NO" });
    const half = Math.floor(yes.sharesMicro / 2);
    await buy(trader, { action: "sell", amountMicro: half });
    const partial = (await readTrader(database, trader, marketId))!;
    expect(partial.position.yesCostBasisMicro).toBeGreaterThan(0);
    expect(partial.position.yesCostBasisMicro).toBeLessThan(yes.totalMicro);
    await buy(trader, { action: "sell", amountMicro: yes.sharesMicro - half });
    await buy(trader, { action: "sell", side: "NO", amountMicro: no.sharesMicro });
    expect((await readTrader(database, trader, marketId))?.allowanceMicro).toBe(100_000_000);
    await reconcile();
  });
  it("returns one receipt after retries, even after the deadline", async () => {
    const quote = await preview();
    const first = await executeTrade(database, trader, quote, clock);
    expect(await executeTrade(database, trader, quote, () => new Date("2028-01-01"))).toEqual(first);
    expect((await state()).trades).toHaveLength(1);
    await reconcile();
  });
  it("rejects reusing a confirmation for another amount, side, action or market", async () => {
    const quote = await preview(); await executeTrade(database, trader, quote, clock);
    for (const extra of [{ amountMicro: 11_000_000 }, { side: "NO" as const }, { action: "sell" as const }, { marketId: await openMarket() }]) {
      await error(executeTrade(database, trader, { ...quote, ...extra }, clock), "RETRY_MISMATCH");
    }
    expect((await state()).trades).toHaveLength(1);
  });
  it("binds retry ids to the trader so another account cannot receive their receipt", async () => {
    const quote = await preview(); const first = await executeTrade(database, trader, quote, clock);
    const another = { ...await preview(other), requestId: quote.requestId };
    const second = await executeTrade(database, other, another, clock);
    expect(second.id).not.toBe(first.id);
    await reconcile();
  });
  it("rejects a stale price without writing anything", async () => {
    const quote = await preview(); await buy(other);
    const before = await state();
    await error(executeTrade(database, trader, quote, clock), "PRICE_CHANGED");
    expect(await state()).toEqual(before);
  });
  it("enforces the combined 100-point held-cost limit", async () => {
    await buy(trader, { amountMicro: 60_000_000 });
    await buy(trader, { side: "NO", amountMicro: 40_000_000 });
    await error(preview(trader, { amountMicro: 1_000_000 }), "OVER_MARKET_LIMIT");
    await reconcile();
  });
  it("checks the wallet again at confirmation, including trades in another goal", async () => {
    // An isolated fixture with exactly 15 points and a matching ledger.
    await database.update(wallets).set({ balanceMicro: 15_000_000 }).where(eq(wallets.userId, trader));
    await database.update(ledgerEntries).set({ amountMicro: 15_000_000 }).where(eq(ledgerEntries.userId, trader));
    const quote = await preview();
    await buy(trader, { marketId: await openMarket() });
    await error(executeTrade(database, trader, quote, clock), "INSUFFICIENT_BALANCE");
    await reconcile();
  });
  it("blocks own-goal trades and outcome deciders on both buys and sells", async () => {
    await error(preview(subject), "SUBJECT_OF_MARKET");
    await error(preview(subject, { action: "sell" }), "SUBJECT_OF_MARKET");
    await buy(); const quote = await preview();
    await database.insert(marketOutcomeDeciders).values({ marketId, userId: trader });
    await error(executeTrade(database, trader, quote, clock), "DECIDES_OUTCOME");
    await error(preview(trader, { action: "sell", amountMicro: 1_000_000 }), "DECIDES_OUTCOME");
  });
  it("blocks incomplete, missing, and withdrawn accounts", async () => {
    const quote = await preview();
    await error(preview(randomUUID()), "PROFILE_REQUIRED");
    await database.update(profiles).set({ adultConfirmedAt: null }).where(eq(profiles.id, trader));
    await error(executeTrade(database, trader, quote, clock), "PROFILE_REQUIRED");
    await database.update(profiles).set({ adultConfirmedAt: now, withdrawnAt: now }).where(eq(profiles.id, trader));
    await error(preview(), "PROFILE_REQUIRED");
  });
  it("blocks withdrawal of the subject and cannot trade an unapproved goal", async () => {
    const quote = await preview();
    await database.update(profiles).set({ withdrawnAt: now }).where(eq(profiles.id, subject));
    await error(executeTrade(database, trader, quote, clock), "CLOSED");
    const draft = await createGoalDraft(database, other, { type: "club", club: "Chess", deadline: "2027-01-01" }, now);
    await error(preview(trader, { marketId: draft.id }), "NOT_FOUND");
  });
  it.each(["closed", "ruled", "settled", "cancelled"] as const)("blocks %s markets", async (status) => {
    const quote = await preview();
    await database.update(markets).set({ status }).where(eq(markets.id, marketId));
    await error(executeTrade(database, trader, quote, clock), "CLOSED");
  });
  it("enforces the exact deadline and an early-close timestamp even if status says open", async () => {
    const quote = await preview();
    const [market] = await database.select().from(markets).where(eq(markets.id, marketId));
    await error(executeTrade(database, trader, quote, () => market.deadlineAt), "CLOSED");
    await database.update(markets).set({ tradingClosedAt: now }).where(eq(markets.id, marketId));
    await error(preview(), "CLOSED");
  });
  it("does not oversell or accept malformed requests", async () => {
    await error(preview(trader, { action: "sell" }), "INSUFFICIENT_SHARES");
    for (const amountMicro of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await error(preview(trader, { amountMicro }), "INVALID_INPUT");
    }
    await error(preview(trader, { side: "MAYBE" as "YES" }), "INVALID_INPUT");
    await error(executeTrade(database, trader, { ...await preview(), requestId: "forged" }, clock), "INVALID_INPUT");
  });
  it("rolls back every write if the final price-history insert fails", async () => {
    const quote = await preview(); const before = await state();
    await database.execute(sql.raw("ALTER TABLE price_history ADD CONSTRAINT test_fail_trade CHECK (trade_id IS NULL)"));
    try { await error(executeTrade(database, trader, quote, clock), "UNAVAILABLE"); }
    finally { await database.execute(sql.raw("ALTER TABLE price_history DROP CONSTRAINT test_fail_trade")); }
    expect(await state()).toEqual(before);
  });
});

describe.runIf(hosted)("hosted multi-connection concurrency", () => {
  it("deduplicates simultaneous confirmations", async () => {
    const quote = await preview();
    const results = await Promise.all(Array.from({ length: 4 }, () => executeTrade(database, trader, quote, clock)));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect((await state()).trades).toHaveLength(1);
    await reconcile();
  });
  it("serializes the market when different users confirm the same price", async () => {
    const quotes = await Promise.all([preview(), preview(other)]);
    const results = await Promise.allSettled(quotes.map((quote, i) => executeTrade(database, i ? other : trader, quote, clock)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason.code).toBe("PRICE_CHANGED");
    await reconcile();
  });
  it("serializes one wallet across two markets so concurrent buys cannot overspend", async () => {
    await database.update(wallets).set({ balanceMicro: 15_000_000 }).where(eq(wallets.userId, trader));
    await database.update(ledgerEntries).set({ amountMicro: 15_000_000 }).where(eq(ledgerEntries.userId, trader));
    const quotes = await Promise.all([preview(), preview(trader, { marketId: await openMarket() })]);
    const results = await Promise.allSettled(quotes.map((quote) => executeTrade(database, trader, quote, clock)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason.code).toBe("INSUFFICIENT_BALANCE");
    await reconcile();
  });
  it("checks the deadline after waiting on a held market lock", async () => {
    const quote: TradePreview = await preview();
    let locked!: () => void, release!: () => void;
    let blockerPid = 0;
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const released = new Promise<void>((resolve) => { release = resolve; });
    const blocker = database.transaction(async (tx) => {
      await tx.select().from(markets).where(eq(markets.id, marketId)).for("update");
      const pid = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      blockerPid = (pid as unknown as { pid: number }[])[0].pid;
      locked(); await released;
      await tx.update(markets).set({ deadlineAt: now }).where(eq(markets.id, marketId));
    });
    await ready;
    const attempt = executeTrade(database, trader, quote, clock);
    const assertion = error(attempt, "CLOSED");
    try {
      let observedWait = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const waiting = await remote!`select pid from pg_stat_activity where ${blockerPid} = any(pg_blocking_pids(pid))`;
        if (waiting.length) { observedWait = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(observedWait).toBe(true);
    } finally { release(); await blocker; await assertion; }
    expect((await state()).trades).toHaveLength(0);
  });
});
