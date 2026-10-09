import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { applyOwnerCommand } from "@/modules/market/lifecycle";
import { publishMarket } from "./service";
import { osuSampleMarkets } from "./samples";

/*
 * The live steps of the 2026-10-08 pivot to campus event markets, run once on
 * the owner's go-ahead by scripts/event-pivot-go-live.mjs (DECISIONS.md,
 * 2026-10-08). Every step is safe to run again, and without `apply` nothing is
 * written:
 *
 *   1. Migrations. 0012 (account withdrawal) was applied by hand on 2026-10-05
 *      and never recorded, so it is recorded first, after checking that its
 *      changes are really there; then the caller's migrator applies 0013.
 *   2. Every goal market still open, closed or ruled is voided through the
 *      owner's own cancel command, refunding held cost ("Cancel + refund").
 *   3. The three hypothetical Ohio State samples are published through the
 *      real publishing service as the owner ("Live + tradeable"), unless a
 *      sample at that venue is already live.
 */

const { markets, profiles, venues, positions } = schema;
// Called with the hosted postgres-js database and, in tests, PGlite.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = PgDatabase<any, typeof schema>;

export const RETIRE_REASON = "Mitra moved to campus event markets on October 8, 2026, so this goal market was voided and everyone was refunded what they paid.";

export type MigrationFile = { folderMillis: number; hash: string };

export interface GoLiveOptions {
  apply: boolean;
  /** The repository's migrations, as drizzle-orm/migrator reads them. */
  migrations: MigrationFile[];
  /** When 0012_account_withdrawal was generated, from the journal. */
  withdrawalMillis: number;
  /** Applies every pending migration; called only with `apply`. */
  migrate: () => Promise<void>;
  /**
   * The owner accounts the steps are recorded under. An audit record names one
   * acting account, so the first acts and every record's reason names them all.
   * Needed when there is more than one owner account.
   */
  ownerHandles?: string[];
  now?: Date;
  log?: (line: string) => void;
}

/** Rows from a raw query, whichever driver ran it. */
function rows<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];
}

export async function runEventPivot(database: Database, options: GoLiveOptions) {
  const { apply } = options;
  const log = options.log ?? (() => {});
  const now = options.now ?? new Date();
  log(apply ? "Applying the event-market pivot." : "Read-only report. Nothing will change; add --apply to run it.");

  // ---------------------------------------------------------------- the owners
  // Voiding and publishing are recorded as the owners' decisions. Checked before
  // anything is written, so a wrong --owner never leaves a half-done run.
  const owners = await database.select({ id: profiles.id, handle: profiles.handle }).from(profiles)
    .where(and(eq(profiles.isOwner, 1), isNull(profiles.withdrawnAt), isNull(profiles.bannedAt)));
  const requested = options.ownerHandles?.length ? options.ownerHandles : owners.length === 1 ? [owners[0].handle] : [];
  const chosen = requested.map((handle) => owners.find((row) => row.handle === handle));
  const unknown = requested.filter((_, index) => !chosen[index]);
  const recordedUnder = chosen.filter((row) => row !== undefined);
  log(`   Owner accounts: ${owners.map((row) => `@${row.handle}`).join(", ") || "none"}.`);
  if (unknown.length) throw new Error(`Not an active owner account: ${unknown.map((handle) => `@${handle}`).join(", ")}.`);
  if (!recordedUnder.length) {
    if (apply || owners.length === 0) throw new Error(owners.length ? "More than one owner account: name them with --owner=<handle>[,<handle>]." : "No active owner account.");
    log("   More than one owner account: --apply will need --owner=<handle>[,<handle>].");
  } else {
    log(`   Recorded under ${recordedUnder.map((row) => `@${row.handle}`).join(" and ")}; @${recordedUnder[0].handle} acts.`);
  }
  const ownerId = recordedUnder[0]?.id ?? "";
  const authority = recordedUnder.length > 1 ? ` Recorded on the go-ahead of ${recordedUnder.map((row) => `@${row.handle}`).join(" and ")}.` : "";

  // ---------------------------------------------------------------- 1. migrations
  const recorded = new Set(rows<{ created_at: string | number }>(await database.execute(sql`select created_at from drizzle.__drizzle_migrations`))
    .map((row) => String(row.created_at)));
  const pending = options.migrations.filter((file) => !recorded.has(String(file.folderMillis)));
  log(`1. Migrations: ${recorded.size} recorded, ${options.migrations.length} in the repository; not recorded: ${pending.map((file) => file.folderMillis).join(", ") || "none"}.`);
  const withdrawal = options.migrations.find((file) => file.folderMillis === options.withdrawalMillis);
  if (!withdrawal) throw new Error("Migration 0012 is missing from the repository.");
  let recordedWithdrawal = false;
  if (!recorded.has(String(withdrawal.folderMillis))) {
    const [{ applied }] = rows<{ applied: boolean }>(await database.execute(sql`select
      exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'evidence' and column_name = 'removed_at')
      and exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'admin_action_kind' and e.enumlabel = 'withdraw_account')
      as applied`));
    if (!applied) throw new Error("Migration 0012 is neither recorded nor applied. Stop and look before going further.");
    log(`   0012 is in the database but not recorded; it ${apply ? "is now" : "will be"} recorded as applied.`);
    if (apply) {
      await database.execute(sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${withdrawal.hash}, ${withdrawal.folderMillis})`);
      recordedWithdrawal = true;
    }
  }
  const [{ name }] = rows<{ name: string | null }>(await database.execute(sql`select to_regclass('venues')::text as name`));
  const hadEvents = name !== null;
  log(`   0013 (event markets): ${hadEvents ? "already applied" : "to be applied"}.`);
  if (apply) {
    await options.migrate();
    log("   Migrations are up to date.");
  } else if (!hadEvents) {
    log("Steps 2 and 3 need migration 0013; they are reported as they would run once it is applied.");
  }
  const eventsReady = hadEvents || apply;

  // ---------------------------------------------------------------- 2. retire goal markets
  const goals = await database.select({ id: markets.id, question: markets.question, status: markets.status, rulingVersion: markets.rulingVersion })
    .from(markets)
    .where(and(isNotNull(markets.subjectUserId), isNotNull(markets.approvedAt), inArray(markets.status, ["open", "closed", "ruled"])));
  log(`2. Goal markets to void and refund: ${goals.length}.`);
  let voided = 0;
  for (const goal of goals) {
    const holders = await database.select({ userId: positions.userId }).from(positions)
      .where(and(eq(positions.marketId, goal.id), or(gt(positions.yesSharesMicro, 0), gt(positions.noSharesMicro, 0))));
    log(`   ${goal.status}, ${holders.length} holder${holders.length === 1 ? "" : "s"}: ${goal.question}`);
    if (!apply) continue;
    await applyOwnerCommand(database, ownerId, {
      marketId: goal.id, requestId: randomUUID(), action: "cancel", reason: `${RETIRE_REASON}${authority}`, expectedVersion: goal.rulingVersion,
    }, () => now);
    voided += 1;
    log("   Voided; held cost refunded.");
  }

  // ---------------------------------------------------------------- 3. samples
  log("3. Ohio State sample markets:");
  const published: string[] = [];
  for (const { slug, ...input } of osuSampleMarkets(now)) {
    const live = eventsReady
      ? await database.select({ id: markets.id }).from(markets).innerJoin(venues, eq(venues.id, markets.venueId))
        .where(and(eq(venues.slug, slug), eq(markets.isSample, true), inArray(markets.status, ["open", "closed", "ruled"])))
      : [];
    if (live.length) { log(`   ${slug}: a sample is already live; skipped.`); continue; }
    log(`   ${input.question}`);
    log(`     opens at ${input.openingProbabilityBp / 100}%, trading until ${input.tradingCutoffAt?.toISOString()}, results due ${input.resultsDueAt?.toISOString()}`);
    if (!apply) continue;
    const market = await publishMarket(database, ownerId, { ...input, note: `Sample market for the 2026-10-08 pivot.${authority}` }, now);
    published.push(market.id);
    log(`     Published: /markets/${market.id}`);
  }
  return { recordedWithdrawal, voided, published };
}
