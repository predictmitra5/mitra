import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { price } from "@/modules/market/lmsr";
import { toLmsr } from "@/modules/market/quote";
import { ECONOMY } from "@/modules/market/economy";
import { DEMO_STARTUPS, demoMarkets } from "./catalog";
import { demoLedgerMismatches, demoPeople, DemoSeedError, seedDemo, suspendDemoProfiles } from "./seed";
import { seeded, simulateMarket } from "./simulate";

const { profiles, markets, priceHistory, trades, positions, startups, videos, founders, wallets } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-19T16:00:00Z");
let owner: string;
let summary: Awaited<ReturnType<typeof seedDemo>>;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
  owner = randomUUID();
  await provisionAccount(db, owner, { displayName: "Owner", handle: "owner", adultConfirmed: true }, now);
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
  summary = await seedDemo(db, owner, { now });
}, 120_000);
afterAll(async () => { await memory.close(); });

describe("the demo catalog", () => {
  it("has the brief's 15 to 20 startups and 30 to 40 markets, every industry, unique keys", () => {
    expect(DEMO_STARTUPS.length).toBeGreaterThanOrEqual(15);
    expect(DEMO_STARTUPS.length).toBeLessThanOrEqual(20);
    const all = demoMarkets();
    expect(all.length).toBeGreaterThanOrEqual(30);
    expect(all.length).toBeLessThanOrEqual(40);
    expect(new Set(all.map((m) => m.market.key)).size).toBe(all.length);
    expect(new Set(DEMO_STARTUPS.map((s) => s.slug)).size).toBe(DEMO_STARTUPS.length);
    const industries = new Set(DEMO_STARTUPS.map((s) => s.industry));
    for (const key of ["ai", "robotics", "edtech", "healthcare", "devtools", "gaming", "climate", "consumer", "fintech", "hardware"]) expect(industries).toContain(key);
    for (const { market } of all) {
      expect(market.short.length).toBeLessThanOrEqual(70);
      expect(market.yes.length).toBeGreaterThan(20);
      expect(market.no.length).toBeGreaterThan(10);
    }
  });

  it("names fictional traders with valid, unique handles", () => {
    const people = demoPeople();
    expect(new Set(people.map((p) => p.handle)).size).toBe(people.length);
    for (const p of people) expect(p.handle).toMatch(/^demo_[a-z0-9_]{3,19}$/);
  });
});

describe("simulated trading", () => {
  it("lands on the target price and never lets anyone overspend or pass the per-market limit", () => {
    const traders = Array.from({ length: 12 }, (_, i) => `trader-${i}`);
    const balances = new Map(traders.map((id) => [id, 1_000_000_000]));
    let n = 0;
    const result = simulateMarket({
      liquidity: 150, openingBp: 3000, finalBp: 4200, count: 40, openedAt: new Date(now.getTime() - 100 * 86_400_000),
      endAt: now, settleFrom: new Date(now.getTime() - 30 * 3_600_000), traders, balances, random: seeded(7), newId: () => `t${n++}`,
    });
    const end = price(toLmsr(result.state), "YES") * 10_000;
    expect(Math.abs(end - 4200)).toBeLessThanOrEqual(60);
    for (const [, position] of result.positions) {
      expect(position.yesCostBasisMicro + position.noCostBasisMicro).toBeLessThanOrEqual(ECONOMY.perMarketLimitMicro);
    }
    for (const balance of balances.values()) expect(balance).toBeGreaterThanOrEqual(0);
    // Each trade starts where the one before it ended.
    for (let i = 1; i < result.trades.length; i += 1) expect(result.trades[i].yesPriceBeforeBp).toBe(result.trades[i - 1].yesPriceAfterBp);
  });
});

describe("seedDemo", () => {
  it("writes the whole catalog", async () => {
    expect(summary.startups).toBe(DEMO_STARTUPS.length);
    expect(summary.markets).toBe(demoMarkets().length);
    expect(await db.$count(startups, eq(startups.isDemo, true))).toBe(DEMO_STARTUPS.length);
    expect(await db.$count(founders, eq(founders.status, "approved"))).toBe(summary.founders);
    expect(await db.$count(videos, eq(videos.status, "approved"))).toBe(summary.videos);
    expect(summary.trades).toBeGreaterThan(500);
  });

  it("keeps every demo wallet equal to its ledger", async () => {
    expect(await demoLedgerMismatches(db)).toBe(0);
    const negative = await db.select().from(wallets).where(sql`${wallets.balanceMicro} < 0`);
    expect(negative).toHaveLength(0);
  });

  it("ends each open market's price history at its current price, made of its own trades", async () => {
    const open = await db.select().from(markets).where(and(eq(markets.isSample, true), eq(markets.status, "open")));
    expect(open.length).toBeGreaterThan(25);
    for (const market of open) {
      const [last] = await db.select().from(priceHistory).where(eq(priceHistory.marketId, market.id)).orderBy(desc(priceHistory.recordedAt)).limit(1);
      const current = Math.round(price(toLmsr({ liquidity: market.liquidityMicro / 1e6, yesSharesMicro: market.yesSharesMicro!, noSharesMicro: market.noSharesMicro! }), "YES") * 10_000);
      expect(last.yesPriceBp).toBe(current);
      const [lastTrade] = await db.select().from(trades).where(eq(trades.marketId, market.id)).orderBy(desc(trades.createdAt)).limit(1);
      expect(lastTrade.yesPriceAfterBp).toBe(current);
      const [first] = await db.select().from(priceHistory).where(eq(priceHistory.marketId, market.id)).orderBy(asc(priceHistory.recordedAt)).limit(1);
      expect(first.yesPriceBp).toBe(market.openingProbabilityBp);
    }
  });

  it("leaves open demo markets at the catalog's prices", async () => {
    const open = await db.select({ question: markets.question, liquidityMicro: markets.liquidityMicro, yes: markets.yesSharesMicro, no: markets.noSharesMicro })
      .from(markets).where(and(eq(markets.isSample, true), eq(markets.status, "open")));
    const wanted = new Map(demoMarkets().map(({ market }) => [market.question, market.finalBp]));
    const off = open.filter((m) => Math.abs(price(toLmsr({ liquidity: m.liquidityMicro / 1e6, yesSharesMicro: m.yes!, noSharesMicro: m.no! }), "YES") * 10_000 - wanted.get(m.question)!) > 100);
    expect(off.map((m) => m.question)).toEqual([]);
  });

  it("pays out finished demo markets and clears their positions", async () => {
    const settled = await db.select().from(markets).where(eq(markets.status, "settled"));
    expect(settled.length).toBeGreaterThanOrEqual(2);
    for (const market of settled) {
      const held = await db.select().from(positions).where(eq(positions.marketId, market.id));
      for (const p of held) expect(p.yesSharesMicro + p.noSharesMicro).toBe(0);
    }
  });

  it("marks every demo trader as demo, and refuses to seed twice", async () => {
    const demo = await db.$count(profiles, eq(profiles.isDemo, true));
    expect(demo).toBe(summary.traders);
    await expect(seedDemo(db, owner, { now })).rejects.toBeInstanceOf(DemoSeedError);
  });

  it("can suspend the demo profiles so they leave every page", async () => {
    const changed = await suspendDemoProfiles(db, owner, now);
    expect(changed).toBe(DEMO_STARTUPS.length);
    expect(await db.$count(startups, eq(startups.status, "approved"))).toBe(0);
  });
});
