import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { executeTrade, previewTrade } from "@/modules/market/service";
import { openEventMarket } from "@/test/markets";
import { withFixtureGold } from "@/test/photo-fixture";
import { DEMO_STARTUPS } from "./demo/catalog";
import { migrationFiles, RETIRED_EVENT_REASON, runStartupPivot } from "./go-live";

/*
 * The go-live steps against an in-memory copy of the live database as it was
 * found on 2026-10-19: migrations 0000 to 0013 and the 2026-10-09 short titles
 * applied and recorded by Drizzle; 0014 to 0017 applied by hand and not
 * recorded; two owners. Written in plain SQL, because the app's schema already
 * expects 0018. The steps then run the real Drizzle migrator.
 */

const files = migrationFiles();
const statements = readMigrationFiles({ migrationsFolder: "./drizzle" });
const SHORT_TITLES_RECORDED_AT = 1791593346278;
const now = new Date("2026-10-19T16:00:00Z");

async function liveAsFound(memory: PGlite, options: { handApplied: boolean }) {
  const db = drizzle(memory, { schema });
  const handTags = ["0014_security_bounds_upload_telemetry", "0015_currency_badges_qr_campaigns", "0016_qr_campaign_audit_kind", "0017_qr_campaign_management"];
  await db.execute(sql`create schema if not exists drizzle`);
  await db.execute(sql`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`);
  for (const [index, file] of files.entries()) {
    if (file.tag === "0018_startup_markets") continue;
    const hand = handTags.includes(file.tag);
    if (hand && !options.handApplied) continue;
    for (const statement of statements[index].sql) await db.execute(sql.raw(statement));
    if (!hand) await db.execute(sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${file.hash}, ${file.folderMillis})`);
    if (file.tag === "0013_event_markets") {
      await db.execute(sql`alter table markets add column short_question text`);
      await db.execute(sql`insert into drizzle.__drizzle_migrations (hash, created_at) values ('short-titles', ${SHORT_TITLES_RECORDED_AT})`);
    }
  }
  return db;
}

describe("the 2026-10-19 go-live steps", () => {
  const memory = new PGlite();
  let db: Awaited<ReturnType<typeof liveAsFound>>;
  const owner = randomUUID(), second = randomUUID();
  const run = (apply: boolean, ownerHandles?: string[], lines?: string[]) =>
    runStartupPivot(db, { apply, ownerHandles, now, migrate: () => migrate(db, { migrationsFolder: "./drizzle" }), log: lines ? (line) => lines.push(line) : undefined });
  const ledgerDrift = async () => (await db.execute<{ drift: number }>(sql`select count(*)::int as drift from wallets w
    where w.balance_micro <> (select coalesce(sum(amount_micro), 0) from ledger_entries l where l.user_id = w.user_id)`)).rows[0].drift;

  beforeAll(async () => {
    db = await liveAsFound(memory, { handApplied: true });
    await db.execute(sql`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at) values
      (${owner}, 'owner', 'Owner', 1, now()), (${second}, 'second_owner', 'Second owner', 1, now())`);
  }, 60_000);
  afterAll(async () => { await memory.close(); });

  it("report what they would do, change nothing, and need the owner named when there are two", async () => {
    const lines: string[] = [];
    await run(false, undefined, lines);
    const report = lines.join("\n");
    expect(report).toMatch(/0015_currency_badges_qr_campaigns: applied by hand, to be recorded/);
    expect(report).toMatch(/0018_startup_markets: to be applied/);
    await expect(run(true)).rejects.toThrow(/More than one owner/);
    await expect(run(true, ["nobody"])).rejects.toThrow(/@nobody/);
    const recorded = (await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)).rows[0].n;
    expect(recorded).toBe(15);
  });

  it("record the hand-applied migrations, apply only 0018, and write the demo catalog", async () => {
    const result = await run(true, ["owner", "second_owner"]);
    expect(result.recorded).toEqual(["0014_security_bounds_upload_telemetry", "0015_currency_badges_qr_campaigns", "0016_qr_campaign_audit_kind", "0017_qr_campaign_management"]);
    expect(result.summary?.startups).toBe(DEMO_STARTUPS.length);
    const hashes = (await db.execute<{ hash: string }>(sql`select hash from drizzle.__drizzle_migrations`)).rows.map((row) => row.hash);
    for (const file of files) expect(hashes).toContain(file.hash);
    expect(await db.$count(schema.startups, eq(schema.startups.isDemo, true))).toBe(DEMO_STARTUPS.length);
    expect(await ledgerDrift()).toBe(0);
  });

  it("void a live event sample with refunds, and leave the demo alone the second time", async () => {
    const alice = randomUUID();
    await provisionAccount(db, alice, { displayName: "Alice", handle: "alice", adultConfirmed: true }, new Date("2026-10-01T00:00:00Z"));
    await withFixtureGold(db, alice);
    const sample = (await openEventMarket(db, owner, new Date("2026-10-10T00:00:00Z"), { isSample: true, cutoff: new Date("2026-11-01T21:00:00-04:00") })).id;
    const at = () => new Date("2026-10-11T00:00:00Z");
    await executeTrade(db, alice, await previewTrade(db, alice, { marketId: sample, side: "YES", action: "buy", amountMicro: 20_000_000 }, at), at);

    const result = await run(true, ["owner", "second_owner"]);
    expect(result).toMatchObject({ recorded: [], voided: 1, seeded: false });
    const [market] = await db.select().from(schema.markets).where(eq(schema.markets.id, sample));
    expect(market.status).toBe("cancelled");
    expect(market.cancelReason).toBe(`${RETIRED_EVENT_REASON} Recorded on the go-ahead of @owner and @second_owner.`);
    const [wallet] = await db.select().from(schema.wallets).where(eq(schema.wallets.userId, alice));
    expect(wallet.balanceMicro).toBe(1_000_000_000);
    expect(await ledgerDrift()).toBe(0);
    expect(await db.$count(schema.startups)).toBe(DEMO_STARTUPS.length);
  });

  it("do nothing the third time", async () => {
    expect(await run(true, ["owner"])).toMatchObject({ recorded: [], voided: 0, seeded: false });
  });
});

describe("a hand-applied migration that is missing", () => {
  it("stops before writing anything, because the migrator would skip it", async () => {
    const memory = new PGlite();
    const db = await liveAsFound(memory, { handApplied: false });
    await db.execute(sql`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at) values (${randomUUID()}, 'owner', 'Owner', 1, now())`);
    await expect(runStartupPivot(db, { apply: true, now, migrate: () => migrate(db, { migrationsFolder: "./drizzle" }) }))
      .rejects.toThrow(/0014_security_bounds_upload_telemetry is not in the database/);
    expect((await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)).rows[0].n).toBe(15);
    await memory.close();
  }, 60_000);
});
