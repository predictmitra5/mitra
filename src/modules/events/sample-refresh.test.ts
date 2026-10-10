import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { readFeed } from "@/modules/discovery/feed";
import { REPLACED_REASON, runSampleRefresh } from "./sample-refresh";

/*
 * The 2026-10-09 steps against an in-memory copy of the live database as it is
 * that day: migrations up to 0013 recorded, the three samples of 2026-10-08
 * open (Gateway Film Center among them, with one person holding a position),
 * and two owner accounts. Rows are written with raw SQL, because the app's own
 * queries already expect the 0014 column.
 */

const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-09T22:00:00Z");
const journal = JSON.parse(readFileSync("./drizzle/meta/_journal.json", "utf8"));
const shortTitlesMillis: number = journal.entries.find((entry: { tag: string }) => entry.tag === "0014_short_titles").when;
const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
const ids = { owner: randomUUID(), second: randomUUID(), alice: randomUUID() };
const samples: Record<string, string> = {};
let folder: string;
const log: string[] = [];

async function run(apply: boolean, ownerHandles?: string[]) {
  return runSampleRefresh(db, { apply, now, ownerHandles, log: (line) => log.push(line), migrate: () => migrate(db, { migrationsFolder: "./drizzle" }) });
}

async function recordedMigrations() {
  return (await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)).rows[0].n;
}

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "mitra-sample-refresh-"));
  cpSync("./drizzle", folder, { recursive: true });
  const trimmed = { ...journal, entries: journal.entries.filter((entry: { when: number }) => entry.when < shortTitlesMillis) };
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(trimmed));
  await migrate(db, { migrationsFolder: folder });

  for (const [id, handle, isOwner] of [[ids.owner, "owner", 1], [ids.second, "second_owner", 1], [ids.alice, "alice", 0]] as const) {
    await db.execute(sql`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at) values (${id}, ${handle}, ${handle}, ${isOwner}, ${now})`);
    await db.execute(sql`insert into wallets (user_id, balance_micro) values (${id}, ${isOwner ? 1_000_000_000 : 995_000_000})`);
    await db.execute(sql`insert into ledger_entries (user_id, kind, amount_micro) values (${id}, 'signup_grant', 1000000000)`);
  }
  const start = new Date("2026-10-17T01:00:00Z"), end = new Date("2026-10-17T06:00:00Z");
  for (const [slug, name, category, question] of [
    ["midway-on-high", "Midway on High", "nightlife", "Will Midway on High sell more than 1,000 qualifying drinks between 9 PM and 2 AM on Friday, Oct 16?"],
    ["buckeye-donuts", "Buckeye Donuts", "food", "Will Buckeye Donuts sell more than 1,200 donuts between 10 PM Friday, Oct 16 and 4 AM Saturday?"],
    ["gateway-film-center", "Gateway Film Center", "entertainment", "Will Gateway Film Center’s 7:00 PM screening on Saturday, Oct 17 sell more than 120 paid admissions?"],
  ] as const) {
    const venue = randomUUID(), event = randomUUID(), source = randomUUID(), market = randomUUID();
    samples[slug] = market;
    await db.execute(sql`insert into venues (id, campus, slug, name, category) values (${venue}, 'osu', ${slug}, ${name}, ${category})`);
    await db.execute(sql`insert into events (id, venue_id, title, starts_at, ends_at, time_zone) values (${event}, ${venue}, 'Friday night', ${start}, ${end}, 'America/New_York')`);
    await db.execute(sql`insert into resolution_sources (id, name, method) values (${source}, ${`${name} report (placeholder)`}, 'A placeholder count.')`);
    await db.execute(sql`insert into markets (id, status, question, resolution_criteria, campus, category, venue_id, event_id, resolution_source_id,
      window_start_at, window_end_at, time_zone, yes_condition, no_condition, is_sample, deadline_at, evidence_deadline_at,
      liquidity_micro, opening_probability_bp, initial_yes_shares_micro, initial_no_shares_micro, yes_shares_micro, no_shares_micro, approved_at, approved_by)
      values (${market}, 'open', ${question}, 'Sample rules.', 'osu', ${category}, ${venue}, ${event}, ${source},
      ${start}, ${end}, 'America/New_York', 'The count is above the number.', 'It is not, or no count arrives.', true, ${start}, ${new Date(end.getTime() + 3 * 86_400_000)},
      150000000, 5000, 0, 0, 0, 0, ${new Date("2026-10-08T22:00:00Z")}, ${ids.owner})`);
  }
  // Alice paid 5 points for 10 Yes shares of the screening.
  await db.execute(sql`update markets set yes_shares_micro = 10000000 where id = ${samples["gateway-film-center"]}`);
  await db.execute(sql`insert into positions (market_id, user_id, yes_shares_micro, no_shares_micro, yes_cost_basis_micro, no_cost_basis_micro)
    values (${samples["gateway-film-center"]}, ${ids.alice}, 10000000, 0, 5000000, 0)`);
  await db.execute(sql`insert into ledger_entries (user_id, market_id, kind, amount_micro) values (${ids.alice}, ${samples["gateway-film-center"]}, 'trade_buy', -5000000)`);
}, 60_000);

afterAll(async () => {
  await memory.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("the 2026-10-09 sample refresh", () => {
  it("reports without writing anything", async () => {
    const before = await recordedMigrations();
    const result = await run(false);
    expect(result).toEqual({ titled: 0, voided: 0, published: [] });
    const text = log.join("\n");
    expect(text).toContain("Migration 0014 (short titles): to be applied");
    expect(text).toContain("midway-on-high: “Will Midway on High sell more than 1,000 drinks?”");
    expect(text).toContain("buckeye-donuts: “Will Buckeye Donuts sell more than 1,200 donuts?”");
    expect(text).toContain("Samples to void and refund: 1.");
    expect(text).toContain("open, 1 holder: Will Gateway Film Center’s 7:00 PM screening");
    expect(text).toContain("Will Brutus visit Smith-Steeb Hall?");
    expect(text).toContain("--apply will need --owner=<handle>[,<handle>]");
    expect(await recordedMigrations()).toBe(before);
    const [{ present }] = (await db.execute<{ present: boolean }>(sql`select exists (select 1 from information_schema.columns
      where table_name = 'markets' and column_name = 'short_question') as present`)).rows;
    expect(present).toBe(false);
  });

  it("refuses to apply, before writing anything, without naming the owners", async () => {
    const before = await recordedMigrations();
    await expect(run(true)).rejects.toThrow("--owner=<handle>");
    await expect(run(true, ["owner", "alice"])).rejects.toThrow("Not an active owner account: @alice.");
    expect(await recordedMigrations()).toBe(before);
  });

  it("applies 0014, titles the two samples, voids the screening with a refund and publishes Brutus at Smith-Steeb Hall", async () => {
    const result = await run(true, ["owner", "second_owner"]);
    expect(result.titled).toBe(2);
    expect(result.voided).toBe(1);
    expect(result.published).toHaveLength(1);
    expect(await recordedMigrations()).toBe(migrations.length);

    const [film] = await db.select().from(schema.markets).where(eq(schema.markets.id, samples["gateway-film-center"]));
    expect(film).toMatchObject({ status: "cancelled", cancelReason: `${REPLACED_REASON} Recorded on the go-ahead of @owner and @second_owner.` });
    const [wallet] = await db.select().from(schema.wallets).where(eq(schema.wallets.userId, ids.alice));
    expect(wallet.balanceMicro).toBe(1_000_000_000); // 995 left plus the 5 she paid.

    const [midway] = await db.select().from(schema.markets).where(eq(schema.markets.id, samples["midway-on-high"]));
    expect(midway.shortQuestion).toBe("Will Midway on High sell more than 1,000 drinks?");
    expect(midway.question).toBe("Will Midway on High sell more than 1,000 qualifying drinks between 9 PM and 2 AM on Friday, Oct 16?");

    const feed = await readFeed(db, now, { campus: "osu" });
    expect(feed.cards.map((card) => card.venueSlug).sort()).toEqual(["buckeye-donuts", "midway-on-high", "smith-steeb-hall"]);
    const brutus = feed.cards.find((card) => card.venueSlug === "smith-steeb-hall")!;
    expect(brutus).toMatchObject({ shortQuestion: "Will Brutus visit Smith-Steeb Hall?", isSample: true, tradingOpen: true, category: "campus" });
    expect(brutus.question).toMatch(/^Will Brutus Buckeye visit Smith-Steeb Hall between 8 AM and midnight on Saturday, Oct 17\?$/);

    const [{ drift }] = (await db.execute<{ drift: number }>(sql`select count(*)::int as drift from wallets w
      where w.balance_micro <> (select coalesce(sum(amount_micro), 0) from ledger_entries l where l.user_id = w.user_id)`)).rows;
    expect(drift).toBe(0);
  });

  it("does nothing the second time", async () => {
    const result = await run(true, ["owner", "second_owner"]);
    expect(result).toEqual({ titled: 0, voided: 0, published: [] });
    expect(await db.select().from(schema.markets)).toHaveLength(4);
  });
});
