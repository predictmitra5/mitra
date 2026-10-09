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
import { provisionAccount } from "@/modules/account/provision";
import { openEventMarket } from "@/test/markets";
import { executeTrade, previewTrade, readPublicMarket } from "./service";
import { advanceDueMarkets, advanceMarket, applyOwnerCommand, CONTEST_WINDOW_MS, readObjections, submitObjection, type OwnerCommand } from "./lifecycle";
import { withFixturePhoto } from "@/test/photo-fixture";

const { profiles, wallets, markets, positions, trades, ledgerEntries, adminActions, contests, priceHistory } = schema;
const start = new Date("2026-09-18T12:00:00Z");
const hosted = process.env.MITRA_HOSTED_TEST === "1";
const name = `mitra_lifecycle_test_${randomUUID().replaceAll("-", "")}`;
let memory: PGlite | undefined, remote: ReturnType<typeof postgres> | undefined;
let database: PgDatabase<PgQueryResultHKT, typeof schema>;
let owner: string, carol: string, alice: string, bob: string, marketId: string, rulingAt: Date, resultsDue: Date;

beforeAll(async () => {
  if (hosted) {
    if (!process.env.DIRECT_DATABASE_URL) throw new Error("DIRECT_DATABASE_URL is required for explicit hosted tests.");
    remote = postgres(process.env.DIRECT_DATABASE_URL, { prepare: false, ssl: "require", max: 6,
      connection: { search_path: name, statement_timeout: 15000, lock_timeout: 10000 }, onnotice: () => {} });
    try { await remote.unsafe(`CREATE SCHEMA "${name}"`); }
    catch { throw new Error("Could not create the isolated lifecycle test schema."); }
    database = postgresDb(remote, { schema }) as unknown as typeof database;
  } else { memory = new PGlite(); database = memoryDb(memory, { schema }) as unknown as typeof database; }
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await database.execute(sql.raw(hosted ? statement.replaceAll('"public".', `"${name}".`) : statement));
  }
}, 90_000);

beforeEach(async () => {
  await database.execute(sql.raw(`TRUNCATE TABLE "${hosted ? name : "public"}"."profiles" CASCADE`));
  owner = await account("owner"); carol = await account("carol"); alice = await account("alice"); bob = await account("bob");
  await database.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
  marketId = await open(); rulingAt = (await market()).windowEndAt!; resultsDue = (await market()).evidenceDeadlineAt;
}, 30_000);

afterAll(async () => {
  if (remote) {
    if (!/^mitra_lifecycle_test_[0-9a-f]{32}$/.test(name)) throw new Error("Unsafe cleanup target.");
    await remote.unsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`); await remote.end();
  }
  await memory?.close();
}, 30_000);

async function account(handle: string) {
  const id = randomUUID(); await provisionAccount(database, id, { displayName: handle, handle, adultConfirmed: true }, start); await withFixturePhoto(database, id); return id;
}
/** Trading cuts off at 9 PM Eastern on October 1; the window ends at 2 AM; results are due three days later. */
async function open() {
  const cutoff = new Date("2026-10-02T01:00:00Z");
  return (await openEventMarket(database, owner, start, { cutoff, windowEnd: new Date("2026-10-02T06:00:00Z") })).id;
}
async function market(id = marketId) { return (await database.select().from(markets).where(eq(markets.id, id)))[0]; }
function command(extra: Partial<OwnerCommand> = {}): OwnerCommand {
  return { marketId, requestId: randomUUID(), expectedVersion: 0, action: "rule", outcome: "yes", basis: "checked_source", reason: "The register count showed 612 drinks in the window.", ...extra };
}
const at = (date: Date) => () => date;
async function rule(extra: Partial<OwnerCommand> = {}, when = rulingAt) { return applyOwnerCommand(database, owner, command(extra), at(when)); }
async function trade(userId = alice, side: "YES" | "NO" = "YES", action: "buy" | "sell" = "buy", amountMicro = 10_000_000, id = marketId) {
  return executeTrade(database, userId, await previewTrade(database, userId, { marketId: id, side, action, amountMicro }, at(start)), at(start));
}
async function expectError(promise: Promise<unknown>, code: string) { await expect(promise).rejects.toMatchObject({ code }); }
async function reconcile() {
  const balances = await database.select().from(wallets), ledger = await database.select().from(ledgerEntries);
  for (const wallet of balances) expect(wallet.balanceMicro).toBe(ledger.filter((e) => e.userId === wallet.userId).reduce((sum, e) => sum + e.amountMicro, 0));
}
async function snapshot() { return {
  markets: await database.select().from(markets), wallets: await database.select().from(wallets),
  positions: await database.select().from(positions), ledger: await database.select().from(ledgerEntries),
  audits: await database.select().from(adminActions), history: await database.select().from(priceHistory),
}; }
function objection(extra: Partial<{ id: string; marketId: string; rulingVersion: number; reason: string }> = {}) {
  return { id: randomUUID(), marketId, rulingVersion: 1, reason: "Please check whether comped drinks were counted.", ...extra };
}

describe("market lifecycle", () => {
  it("closes exactly at the deadline once and attributes it to the system", async () => {
    const opened = await market();
    await advanceMarket(database, marketId, at(new Date(opened.deadlineAt.getTime() - 1)));
    expect((await market()).status).toBe("open");
    await advanceMarket(database, marketId, at(opened.deadlineAt));
    await advanceMarket(database, marketId, at(resultsDue));
    expect((await market()).tradingClosedAt).toEqual(opened.deadlineAt);
    const audit = await database.select().from(adminActions).where(eq(adminActions.kind, "close_deadline"));
    expect(audit).toHaveLength(1); expect(audit[0].actorUserId).toBeNull();
    expect((await market()).status).toBe("closed"); // No automatic missing-data ruling.
  });
  it("requires an active owner and explicit public-outcome confirmation to close early", async () => {
    const close = command({ action: "close", publicOutcomeConfirmed: true });
    await expectError(applyOwnerCommand(database, alice, close, at(start)), "NOT_OWNER");
    await expectError(applyOwnerCommand(database, owner, { ...close, publicOutcomeConfirmed: false }, at(start)), "CONFIRM_PUBLIC");
    await applyOwnerCommand(database, owner, close, at(start));
    await applyOwnerCommand(database, owner, close, at(start));
    expect((await market()).tradingClosedAt).toEqual(start);
    expect(await database.select().from(adminActions).where(eq(adminActions.kind, "close_early"))).toHaveLength(1);
    await expectError(trade(), "CLOSED");
    await database.update(profiles).set({ withdrawnAt: start }).where(eq(profiles.id, owner));
    await expectError(rule(), "PROFILE_REQUIRED");
  });
  it("rules from the source once the window ends, with an exact 24-hour window and a public explanation", async () => {
    await expectError(rule({}, new Date(rulingAt.getTime() - 1)), "RESULTS_PENDING");
    const input = command(); await applyOwnerCommand(database, owner, input, at(rulingAt));
    const opened = await market();
    expect(opened.status).toBe("ruled"); expect(opened.rulingVersion).toBe(1);
    expect(opened.contestEndsAt?.getTime()).toBe(rulingAt.getTime() + CONTEST_WINDOW_MS);
    expect((await readPublicMarket(database, marketId))?.rulingReason).toBe(input.reason);
    await applyOwnerCommand(database, owner, input, at(new Date(rulingAt.getTime() + 60000)));
    expect((await market()).contestEndsAt).toEqual(opened.contestEndsAt);
  });
  it("a source that never reported can only produce NO, only after the results deadline, and still gets a contest window", async () => {
    await expectError(rule({ basis: "missing_data" }, resultsDue), "MISSING_DATA_NO");
    await expectError(rule({ basis: "missing_data", outcome: "no" }, new Date(resultsDue.getTime() - 1)), "RESULTS_PENDING");
    await rule({ basis: "missing_data", outcome: "no", reason: "The venue never sent its count." }, resultsDue);
    expect((await market()).ruledOutcome).toBe("no"); expect((await market()).status).toBe("ruled");
  });
  it("restarts the full window on revision and rejects stale forms and no-op edits", async () => {
    const first = command(); await applyOwnerCommand(database, owner, first, at(rulingAt));
    const revisedAt = new Date(rulingAt.getTime() + 60_000);
    await expectError(rule({ expectedVersion: 0, outcome: "no" }, revisedAt), "STALE_RULING");
    await expectError(rule({ expectedVersion: 1 }, revisedAt), "NO_CHANGE");
    const revision = command({ expectedVersion: 1, outcome: "no", reason: "The corrected count was 488 drinks." });
    await applyOwnerCommand(database, owner, revision, at(revisedAt));
    expect((await market()).contestEndsAt?.getTime()).toBe(revisedAt.getTime() + CONTEST_WINDOW_MS);
    expect((await market()).rulingVersion).toBe(2);
    await expectError(submitObjection(database, alice, objection(), at(revisedAt)), "STALE_RULING");
    await applyOwnerCommand(database, owner, revision, at(new Date(revisedAt.getTime() + 60000)));
    expect((await market()).contestEndsAt?.getTime()).toBe(revisedAt.getTime() + CONTEST_WINDOW_MS);
    expect(await database.select().from(adminActions).where(eq(adminActions.kind, "change_ruling"))).toHaveLength(1);
  });
  it("rejects changed commands under a used retry key", async () => {
    const input = command(); await applyOwnerCommand(database, owner, input, at(rulingAt));
    await expectError(applyOwnerCommand(database, owner, { ...input, outcome: "no" }, at(rulingAt)), "RETRY_MISMATCH");
    await expectError(applyOwnerCommand(database, owner, { ...input, marketId: await open() }, at(rulingAt)), "RETRY_MISMATCH");
  });
  it("accepts objections from traders and nontraders, deduplicates retries, and limits text visibility", async () => {
    await rule(); const a = objection(), b = objection({ reason: "Private note from someone who never traded." });
    await submitObjection(database, alice, a, at(rulingAt));
    await submitObjection(database, carol, b, at(rulingAt));
    await submitObjection(database, alice, a, at(rulingAt));
    expect(await database.select().from(contests)).toHaveLength(2);
    expect((await readObjections(database, alice, marketId)).map((r) => r.reason)).toEqual([a.reason]);
    expect(await readObjections(database, bob, marketId)).toHaveLength(0);
    expect(await readObjections(database, owner, marketId)).toHaveLength(2);
    expect(JSON.stringify(await readPublicMarket(database, marketId))).not.toContain(b.reason);
    await expectError(submitObjection(database, bob, a, at(rulingAt)), "RETRY_MISMATCH");
    await expectError(readObjections(database, randomUUID(), marketId), "PROFILE_REQUIRED");
    await database.update(profiles).set({ adultConfirmedAt: null }).where(eq(profiles.id, bob));
    await expectError(submitObjection(database, bob, objection(), at(rulingAt)), "PROFILE_REQUIRED");
  });
  it("forbids objections before ruling and at the exact cutoff without blocking safe receipt retries", async () => {
    const input = objection();
    await expectError(submitObjection(database, alice, input, at(start)), "CONTEST_CLOSED");
    await rule(); const ends = (await market()).contestEndsAt!;
    await submitObjection(database, alice, input, at(new Date(ends.getTime() - 1)));
    await expectError(submitObjection(database, bob, objection(), at(ends)), "CONTEST_CLOSED");
    await submitObjection(database, alice, input, at(ends));
    expect((await market()).contestEndsAt).toEqual(ends);
  });
  it.each(["yes", "no"] as const)("settles %s once, credits only winning shares and reconciles the ledger", async (outcome) => {
    const yes = await trade(alice), no = await trade(bob, "NO");
    await rule({ outcome }); const ends = (await market()).contestEndsAt!;
    const before = await snapshot();
    await advanceMarket(database, marketId, at(new Date(ends.getTime() - 1)));
    expect(await snapshot()).toEqual(before);
    await advanceMarket(database, marketId, at(ends)); await advanceMarket(database, marketId, at(ends));
    const payouts = await database.select().from(ledgerEntries).where(eq(ledgerEntries.kind, "settlement"));
    expect(payouts).toHaveLength(2);
    expect(payouts.find((r) => r.userId === alice)?.amountMicro).toBe(outcome === "yes" ? yes.sharesMicro : 0);
    expect(payouts.find((r) => r.userId === bob)?.amountMicro).toBe(outcome === "no" ? no.sharesMicro : 0);
    expect((await market()).status).toBe("settled");
    for (const row of await database.select().from(positions)) expect(row.yesSharesMicro + row.noSharesMicro + row.yesCostBasisMicro + row.noCostBasisMicro).toBe(0);
    const [audit] = await database.select().from(adminActions).where(eq(adminActions.kind, "settle"));
    expect(audit.actorUserId).toBeNull();
    await reconcile();
  });
  it("makes the result final at the cutoff even before a delayed settlement runs", async () => {
    await rule(); const ends = (await market()).contestEndsAt!;
    await expectError(rule({ expectedVersion: 1, outcome: "no" }, ends), "FINAL");
    await expectError(rule({ expectedVersion: 1, action: "cancel" }, ends), "FINAL");
    await advanceMarket(database, marketId, at(ends));
    await expectError(rule({ expectedVersion: 1, outcome: "no" }, ends), "FINAL");
  });
  it("refunds both held costs after a partial sale, rather than original spend or nominal share value", async () => {
    const yes = await trade(); await trade(alice, "NO"); await trade(bob, "NO");
    await trade(alice, "YES", "sell", Math.floor(yes.sharesMicro / 2));
    const held = await database.select().from(positions);
    const input = command({ action: "cancel", reason: "The market wording is ambiguous." });
    await applyOwnerCommand(database, owner, input, at(start)); await applyOwnerCommand(database, owner, input, at(start));
    const refunds = await database.select().from(ledgerEntries).where(eq(ledgerEntries.kind, "cancellation_refund"));
    expect(refunds).toHaveLength(2);
    for (const p of held) expect(refunds.find((r) => r.userId === p.userId)?.amountMicro).toBe(p.yesCostBasisMicro + p.noCostBasisMicro);
    expect((await market()).status).toBe("cancelled"); await reconcile();
    await expectError(trade(), "CLOSED");
  });
  it("rolls back all participants and status if a later ledger credit fails", async () => {
    await trade(); await trade(bob, "NO"); await rule(); const ends = (await market()).contestEndsAt!;
    const before = await snapshot();
    const lastPaid = [alice, bob].sort()[1];
    await database.execute(sql.raw(`ALTER TABLE ledger_entries ADD CONSTRAINT test_fail_payout CHECK (kind != 'settlement' OR user_id != '${lastPaid}')`));
    try { await expectError(advanceMarket(database, marketId, at(ends)), "UNAVAILABLE"); }
    finally { await database.execute(sql.raw("ALTER TABLE ledger_entries DROP CONSTRAINT test_fail_payout")); }
    expect(await snapshot()).toEqual(before);
  });
  it("fails closed on missing wallets and unsafe balances without partial payments", async () => {
    await trade(); await rule(); const ends = (await market()).contestEndsAt!;
    await database.update(wallets).set({ balanceMicro: Number.MAX_SAFE_INTEGER }).where(eq(wallets.userId, alice));
    await expectError(advanceMarket(database, marketId, at(ends)), "ACCOUNTING_ERROR");
    await database.delete(wallets).where(eq(wallets.userId, alice));
    await expectError(advanceMarket(database, marketId, at(ends)), "ACCOUNTING_ERROR");
    expect((await market()).status).toBe("ruled");
    expect(await database.select().from(ledgerEntries).where(eq(ledgerEntries.kind, "settlement"))).toHaveLength(0);
  });
  it("advances only a viewer's related due markets when their account loads", async () => {
    await trade(); await rule(); const ends = (await market()).contestEndsAt!;
    await advanceDueMarkets(database, bob, at(ends)); expect((await market()).status).toBe("ruled");
    await advanceDueMarkets(database, alice, at(ends)); expect((await market()).status).toBe("settled");
    await reconcile();
  });
  it("cancels during a contest window with refunds and prevents later settlement", async () => {
    await trade(); await trade(bob, "NO"); await rule(); const ends = (await market()).contestEndsAt!;
    await rule({ action: "cancel", expectedVersion: 1, reason: "Frozen terms were found to be ambiguous." }, new Date(ends.getTime() - 1));
    await advanceMarket(database, marketId, at(ends));
    expect((await market()).status).toBe("cancelled");
    expect(await database.select().from(ledgerEntries).where(eq(ledgerEntries.kind, "settlement"))).toHaveLength(0);
    expect(await database.select().from(ledgerEntries).where(eq(ledgerEntries.kind, "cancellation_refund"))).toHaveLength(2);
    await reconcile();
  });
});

describe.runIf(hosted)("lifecycle races on hosted connections", () => {
  it("pays once under simultaneous settlement requests", async () => {
    await trade(); await trade(bob, "NO"); await rule(); const ends = (await market()).contestEndsAt!;
    await Promise.all(Array.from({ length: 4 }, () => advanceMarket(database, marketId, at(ends))));
    expect(await database.select().from(ledgerEntries).where(eq(ledgerEntries.kind, "settlement"))).toHaveLength(2); await reconcile();
  });
  it("serializes a cancellation racing a buy, leaving no unrefunded position", async () => {
    const quote = await previewTrade(database, alice, { marketId, side: "YES", action: "buy", amountMicro: 10_000_000 }, at(start));
    const results = await Promise.allSettled([executeTrade(database, alice, quote, at(start)), rule({ action: "cancel" }, start)]);
    expect(results[1].status).toBe("fulfilled");
    if (results[0].status === "rejected") expect(results[0].reason.code).toBe("CLOSED");
    expect((await market()).status).toBe("cancelled");
    const [wallet] = await database.select().from(wallets).where(eq(wallets.userId, alice));
    expect(wallet.balanceMicro).toBe(1_000_000_000); await reconcile();
  });
  it("settles two markets sharing wallets without lost credits or deadlocks", async () => {
    const second = await open();
    await trade(alice); await trade(bob, "NO"); await trade(alice, "YES", "buy", 10_000_000, second); await trade(bob, "NO", "buy", 10_000_000, second);
    await rule(); await rule({ marketId: second }); const ends = (await market()).contestEndsAt!;
    await Promise.all([advanceMarket(database, marketId, at(ends)), advanceMarket(database, second, at(ends))]);
    expect(await database.select().from(ledgerEntries).where(eq(ledgerEntries.kind, "settlement"))).toHaveLength(4); await reconcile();
  });
  it("allows only one ruling revision from the same version", async () => {
    await rule();
    const results = await Promise.allSettled([
      rule({ expectedVersion: 1, outcome: "no", reason: "A recount found 488 drinks." }),
      rule({ expectedVersion: 1, outcome: "no", reason: "The venue corrected its count to 497." }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason.code).toBe("STALE_RULING");
    expect((await market()).rulingVersion).toBe(2);
  });
  it("deduplicates concurrent objections and owner requests", async () => {
    const input = command(); await Promise.all([applyOwnerCommand(database, owner, input, at(rulingAt)), applyOwnerCommand(database, owner, input, at(rulingAt))]);
    const appeal = objection(); await Promise.all([submitObjection(database, alice, appeal, at(rulingAt)), submitObjection(database, alice, appeal, at(rulingAt))]);
    expect(await database.select().from(contests)).toHaveLength(1);
    expect(await database.select().from(adminActions).where(eq(adminActions.kind, "rule"))).toHaveLength(1);
  });
  it("keeps final payouts and trade receipts distinct", async () => {
    const quote = await previewTrade(database, alice, { marketId, side: "YES", action: "buy", amountMicro: 10_000_000 }, at(start));
    const receipt = await executeTrade(database, alice, quote, at(start));
    await rule(); const ends = (await market()).contestEndsAt!;
    const results = await Promise.all([advanceMarket(database, marketId, at(ends)), executeTrade(database, alice, quote, at(ends))]);
    expect(results[1]).toEqual(receipt);
    expect(await database.select().from(trades)).toHaveLength(1);
    expect(await database.select().from(ledgerEntries).where(and(eq(ledgerEntries.marketId, marketId), eq(ledgerEntries.kind, "settlement")))).toHaveLength(1);
    await reconcile();
  });
});
