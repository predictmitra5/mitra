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
import { RETIRE_REASON, runEventPivot } from "./go-live";

/*
 * The go-live steps against an in-memory copy of the live database as it is on
 * 2026-10-08: migrations 0000 to 0011 recorded, 0012 applied by hand but not
 * recorded, one open goal market with two people holding positions, and an
 * owner. Everything below the old schema is written with raw SQL, because the
 * app's own queries already expect the new columns.
 */

const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-08T22:00:00Z");
const journal = JSON.parse(readFileSync("./drizzle/meta/_journal.json", "utf8"));
const withdrawalMillis: number = journal.entries.find((entry: { tag: string }) => entry.tag === "0012_account_withdrawal").when;
const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
const ids = { owner: randomUUID(), subject: randomUUID(), alice: randomUUID(), bob: randomUUID(), market: randomUUID() };
let folder: string;
const log: string[] = [];

async function run(apply: boolean, ownerHandle?: string) {
  return runEventPivot(db, {
    apply, migrations, withdrawalMillis, now, ownerHandle, log: (line) => log.push(line),
    migrate: () => migrate(db, { migrationsFolder: "./drizzle" }),
  });
}

beforeAll(async () => {
  // Migrations 0000 to 0011, recorded, from a copy of the folder with a trimmed journal.
  folder = mkdtempSync(join(tmpdir(), "mitra-go-live-"));
  cpSync("./drizzle", folder, { recursive: true });
  const trimmed = { ...journal, entries: journal.entries.filter((entry: { when: number }) => entry.when < withdrawalMillis) };
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(trimmed));
  await migrate(db, { migrationsFolder: folder });
  // 0012 by hand, as it was applied on 2026-10-05, without a record.
  for (const statement of migrations.find((file) => file.folderMillis === withdrawalMillis)!.sql) await db.execute(sql.raw(statement));

  for (const [id, handle, isOwner] of [[ids.owner, "owner", 1], [ids.subject, "sam", 0], [ids.alice, "alice", 0], [ids.bob, "bob", 0]] as const) {
    await db.execute(sql`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at) values (${id}, ${handle}, ${handle}, ${isOwner}, ${now})`);
    await db.execute(sql`insert into wallets (user_id, balance_micro) values (${id}, ${isOwner ? 1_000_000_000 : 980_000_000})`);
    await db.execute(sql`insert into ledger_entries (user_id, kind, amount_micro) values (${id}, 'signup_grant', 1000000000)`);
  }
  await db.execute(sql`insert into markets (id, subject_user_id, status, question, resolution_criteria, goal_type, deadline_at, evidence_deadline_at,
    liquidity_micro, opening_probability_bp, initial_yes_shares_micro, initial_no_shares_micro, yes_shares_micro, no_shares_micro, approved_at, approved_by)
    values (${ids.market}, ${ids.subject}, 'open', 'Will Sam be offered admission to Chess Club?', 'The admission offer.', 'club',
    ${new Date("2026-11-01T03:59:59Z")}, ${new Date("2026-11-08T04:59:59Z")}, 150000000, 5000, 0, 0, 38000000, 0, ${now}, ${ids.owner})`);
  for (const [user, side] of [[ids.alice, "yes"], [ids.bob, "no"]] as const) {
    await db.execute(sql`insert into positions (market_id, user_id, yes_shares_micro, no_shares_micro, yes_cost_basis_micro, no_cost_basis_micro)
      values (${ids.market}, ${user}, ${side === "yes" ? 38_000_000 : 0}, ${side === "no" ? 1_000_000 : 0}, ${side === "yes" ? 20_000_000 : 0}, ${side === "no" ? 20_000_000 : 0})`);
    await db.execute(sql`insert into ledger_entries (user_id, market_id, kind, amount_micro) values (${user}, ${ids.market}, 'trade_buy', -20000000)`);
  }
}, 60_000);

afterAll(async () => {
  await memory.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("going live with event markets", () => {
  it("reports without writing anything, even before 0013 exists", async () => {
    const result = await run(false);
    expect(result).toEqual({ recordedWithdrawal: false, voided: 0, published: [] });
    expect(log.join("\n")).toContain("0012 is in the database but not recorded");
    expect(log.join("\n")).toContain("Goal markets to void and refund: 1.");
    expect(log.join("\n")).toContain("Will Midway on High sell more than 1,000 qualifying drinks");
    const recorded = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    expect(recorded.rows[0].n).toBe(12);
    expect((await db.execute<{ name: string | null }>(sql`select to_regclass('venues')::text as name`)).rows[0].name).toBeNull();
  });

  it("records 0012, applies 0013, voids and refunds the goal market, and publishes the samples", async () => {
    const result = await run(true);
    expect(result.recordedWithdrawal).toBe(true);
    expect(result.voided).toBe(1);
    expect(result.published).toHaveLength(3);

    const recorded = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    expect(recorded.rows[0].n).toBe(migrations.length);

    const [goal] = await db.select().from(schema.markets).where(eq(schema.markets.id, ids.market));
    expect(goal).toMatchObject({ status: "cancelled", cancelReason: RETIRE_REASON });
    for (const user of [ids.alice, ids.bob]) {
      const [wallet] = await db.select().from(schema.wallets).where(eq(schema.wallets.userId, user));
      expect(wallet.balanceMicro).toBe(1_000_000_000); // 980 left plus the 20 they paid.
    }
    const feed = await readFeed(db, now, { campus: "osu" });
    expect(feed.cards.map((card) => card.venueSlug).sort()).toEqual(["buckeye-donuts", "gateway-film-center", "midway-on-high"]);
    expect(feed.cards.every((card) => card.isSample && card.tradingOpen)).toBe(true);
  });

  it("does nothing the second time", async () => {
    const result = await run(true);
    expect(result).toEqual({ recordedWithdrawal: false, voided: 0, published: [] });
    expect(await db.select().from(schema.markets)).toHaveLength(4);
  });

  it("never guesses which of two owners acts", async () => {
    await db.execute(sql`insert into profiles (id, handle, display_name, is_owner, adult_confirmed_at) values (${randomUUID()}, 'second_owner', 'Second', 1, ${now})`);
    await expect(run(true)).rejects.toThrow("--owner=<handle>");
    await expect(run(false)).resolves.toMatchObject({ voided: 0 });
    expect(log.join("\n")).toContain("@owner, @second_owner");
    await expect(run(true, "owner")).resolves.toEqual({ recordedWithdrawal: false, voided: 0, published: [] });
  });
});
