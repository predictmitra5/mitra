import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { readViewer } from "@/modules/account/viewer";
import { readTrader } from "@/modules/market/service";
import { insertStartup, openStartupMarket } from "@/test/markets";
import { readFounderPage, readMarketStartup, readStartupPage } from "./read";

/*
 * The page reads that were made to run side by side (2026-10-22). Each query
 * to this in-memory database waits LATENCY_MS first, standing in for the trip
 * to the real one, so a read that waits on its queries one after another takes
 * about (queries x LATENCY_MS) and one that runs them together takes far less.
 * The results, the approval checks and the failure handling must not change.
 */

const LATENCY_MS = 15;
const memory = new PGlite();
const probe = { queries: 0, fail: null as RegExp | null, seen: [] as string[] };
const slow = new Proxy(memory, {
  get(target, key, receiver) {
    if (key === "query") {
      return async (text: string, ...rest: unknown[]) => {
        probe.queries += 1;
        probe.seen.push(text);
        await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
        if (probe.fail?.test(text)) throw new Error("simulated outage");
        return (target.query as (...args: unknown[]) => unknown).call(target, text, ...rest);
      };
    }
    const value = Reflect.get(target, key, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
const db = drizzle(memory, { schema });
const measured = drizzle(slow as PGlite, { schema });
const now = new Date("2026-10-22T16:00:00Z");
let owner: string, member: string, startupSlug: string, founderHandle: string, startupId: string, marketId: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles, startups, founders CASCADE`);
  owner = await account("owner");
  await db.update(schema.profiles).set({ isOwner: 1 }).where(eq(schema.profiles.id, owner));
  member = await account("member");
  const made = await insertStartup(db, now, { name: "Speed Co" });
  startupId = made.startup.id; startupSlug = made.startup.slug; founderHandle = made.founder.handle;
  await db.insert(schema.videos).values({ startupId, founderId: made.founder.id, title: "Pitch", description: "A pitch.", durationSeconds: 60, status: "approved", publishedAt: now });
  marketId = (await openStartupMarket(db, owner, now, { startupId })).id;
  probe.queries = 0; probe.fail = null; probe.seen = [];
});
afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  return id;
}

async function measure<T>(read: () => Promise<T>) {
  probe.queries = 0;
  const started = performance.now();
  const value = await read();
  const ms = performance.now() - started;
  return { value, ms, queries: probe.queries, serialMs: probe.queries * LATENCY_MS };
}

describe("page reads run their independent queries side by side", () => {
  it("the startup page", async () => {
    const run = await measure(() => readStartupPage(measured, startupSlug, member, now));
    expect(run.value?.startup.name).toBe("Speed Co");
    expect(run.value?.videos).toHaveLength(1);
    expect(run.value?.open.map((card) => card.id)).toContain(marketId);
    expect(run.value).toMatchObject({ preview: false, followers: 0, following: false });
    expect(run.ms).toBeLessThan(run.serialMs * 0.75);
  });

  it("the founder page", async () => {
    const run = await measure(() => readFounderPage(measured, founderHandle, null, now));
    expect(run.value?.companies.map((c) => c.id)).toEqual([startupId]);
    expect(run.value?.markets.map((m) => m.id)).toEqual([marketId]);
    expect(run.value?.videos).toHaveLength(1);
    expect(run.ms).toBeLessThan(run.serialMs * 0.75);
  });

  it("the market page's startup panel", async () => {
    const run = await measure(() => readMarketStartup(measured, startupId));
    expect(run.value?.startup.name).toBe("Speed Co");
    expect(run.value?.team).toHaveLength(1);
    expect(run.value?.video?.title).toBe("Pitch");
    expect(run.ms).toBeLessThan(run.serialMs * 0.75);
  });

  it("the trader panel", async () => {
    const run = await measure(() => readTrader(measured, member, marketId));
    expect(run.value).toMatchObject({ blocked: null, position: { yesSharesMicro: 0, noSharesMicro: 0 } });
    expect(run.ms).toBeLessThan(run.serialMs * 0.75);
    // The owner is still barred from trading.
    expect((await readTrader(measured, owner, marketId))?.blocked).toMatch(/cannot trade/);
  });

  it("the top bar", async () => {
    const run = await measure(() => readViewer(measured, owner));
    expect(run.value).toMatchObject({ displayName: "owner", balanceMicro: 0, ownerQueue: 0 });
    expect(run.ms).toBeLessThan(run.serialMs * 0.75);
  });
});

describe("the approval checks still come first", () => {
  it("a stranger learns nothing about a startup waiting for review, and nothing more is read", async () => {
    await db.update(schema.startups).set({ status: "pending" }).where(eq(schema.startups.id, startupId));
    probe.seen = [];
    expect(await readStartupPage(measured, startupSlug, member, now)).toBeNull();
    // The startup, its team and the owner check; no videos, updates, claims or markets.
    expect(probe.seen.some((q) => /from "videos"|from "startup_updates"|from "verification_claims"/.test(q))).toBe(false);
    expect((await readStartupPage(measured, startupSlug, owner, now))?.preview).toBe(true);
  });

  it("a stranger learns nothing about a founder waiting for review", async () => {
    await db.update(schema.founders).set({ status: "pending" }).where(eq(schema.founders.handle, founderHandle));
    probe.seen = [];
    expect(await readFounderPage(measured, founderHandle, member, now)).toBeNull();
    expect(probe.seen.some((q) => /from "videos"|from "startup_founders"/.test(q))).toBe(false);
  });

  it("a market's unapproved startup shows no panel", async () => {
    await db.update(schema.startups).set({ status: "suspended" }).where(eq(schema.startups.id, startupId));
    expect(await readMarketStartup(measured, startupId)).toBeNull();
  });

  it("the top bar shows nothing for a profile that isn't set up", async () => {
    expect(await readViewer(measured, randomUUID())).toEqual({ displayName: null, photo: null, balanceMicro: null, ownerQueue: null });
  });
});

describe("a failed extra stays on its own", () => {
  it("a failed balance shows no balance, not zero, and keeps the name and owner count", async () => {
    probe.fail = /"exchange_snapshot"/;
    expect(await readViewer(measured, owner)).toMatchObject({ displayName: "owner", balanceMicro: null, ownerQueue: 0 });
  });

  it("a failed owner count hides the badge and keeps the balance", async () => {
    probe.fail = /count\(\*\)/;
    expect(await readViewer(measured, owner)).toMatchObject({ displayName: "owner", balanceMicro: 0, ownerQueue: null });
  });

  it("a failed profile read still fails the top bar, so pages fall back as before", async () => {
    probe.fail = /from "profiles"/;
    await expect(readViewer(measured, owner)).rejects.toThrow();
  });
});

describe("each query runs once", () => {
  it("the founder page asks for its companies a single time", async () => {
    probe.seen = [];
    await readFounderPage(measured, founderHandle, null, now);
    expect(probe.seen.filter((q) => /from "startup_founders" inner join "startups"/.test(q))).toHaveLength(1);
  });
});
