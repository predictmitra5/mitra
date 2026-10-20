import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { applyOwnerCommand } from "@/modules/market/lifecycle";
import { DEMO_STARTUPS } from "./demo/catalog";
import { seedDemo } from "./demo/seed";

/*
 * The live steps of the 2026-10-19 pivot to founder videos and startup
 * markets, run once on the owner's go-ahead by
 * scripts/startup-pivot-go-live.mjs. Without `apply` nothing is written, and
 * every step is safe to run again:
 *
 *   1. The migration record. Migrations 0014 to 0017 (security bounds, Coins
 *      and QR campaigns) were applied to the live database by hand on
 *      2026-10-12 and 13 and never written to Drizzle's own table, whose last
 *      record is the 2026-10-09 short titles. Drizzle's migrator applies only
 *      what is newer than its last record, so it would skip 0014 and re-run
 *      0015 into tables that already exist. Each of those four is therefore
 *      checked, object by object, and recorded as applied only when everything
 *      it creates is there; if one is missing and the migrator would skip it,
 *      nothing is written and the step stops.
 *   2. Migration 0018 (founders, startups, videos, engagement, follows,
 *      comments, reports, claims, startup markets), through the caller's migrator.
 *   3. Every event market still live (the campus samples) is voided through the
 *      owner's own cancel command, refunding held cost, because the event
 *      interface is retired.
 *   4. The demo catalog (demo/seed.ts) is written once, recorded under the owner.
 */

const { markets, profiles, startups } = schema;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = PgDatabase<any, typeof schema>;

export const RETIRED_EVENT_REASON = "Mitra moved from campus event markets to startup markets on October 19, 2026, so this market was voided and everyone was refunded what they paid.";

const enumHas = (type: string, label: string) => sql`exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = ${type} and e.enumlabel = ${label})`;
const tableExists = (name: string) => sql`(to_regclass(${`public.${name}`}) is not null)`;

/** What each hand-applied migration creates, so it is recorded only when all of it is there. */
export const HAND_APPLIED: Record<string, SQL> = {
  "0014_security_bounds_upload_telemetry": sql`select ${tableExists("feed_event_buckets")} and ${tableExists("upload_intents")} and ${enumHas("upload_intent_kind", "evidence")} as ok`,
  "0015_currency_badges_qr_campaigns": sql`select ${tableExists("silver_wallets")} and ${tableExists("silver_ledger_entries")} and ${tableExists("badge_products")}
    and ${tableExists("purchase_orders")} and ${tableExists("user_badges")} and ${tableExists("campus_qr_campaigns")} and ${tableExists("campus_qr_claims")}
    and ${enumHas("ledger_kind", "purchase_bonus")} and ${enumHas("ledger_kind", "qr_award")} as ok`,
  "0016_qr_campaign_audit_kind": sql`select ${enumHas("admin_action_kind", "create_qr_campaign")}
    and exists (select 1 from pg_constraint where conname = 'silver_ledger_entries_purchase_id_purchase_orders_id_fk') as ok`,
  "0017_qr_campaign_management": sql`select ${enumHas("admin_action_kind", "manage_qr_campaign")}
    and exists (select 1 from information_schema.columns where table_name = 'campus_qr_campaigns' and column_name = 'deleted_at') as ok`,
};
const STARTUP_MIGRATION = "0018_startup_markets";

export interface StartupPivotOptions {
  apply: boolean;
  /** Applies every pending migration; called only with `apply`, after the record is repaired. */
  migrate: () => Promise<void>;
  /** Where the migration files are; the project's `drizzle` folder by default. */
  migrationsFolder?: string;
  /** The owner accounts the steps are recorded under; the first acts. Needed when there is more than one. */
  ownerHandles?: string[];
  /** Skip writing the demo catalog. */
  withoutDemo?: boolean;
  now?: Date;
  log?: (line: string) => void;
}

function rows<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];
}

/** The migration files in journal order, with the tag, hash and timestamp Drizzle records. */
export function migrationFiles(folder = "./drizzle") {
  const journal = JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8")) as { entries: { tag: string; when: number }[] };
  const files = readMigrationFiles({ migrationsFolder: folder });
  return journal.entries.map((entry, index) => ({ tag: entry.tag, hash: files[index].hash, folderMillis: files[index].folderMillis }));
}

export async function runStartupPivot(database: Database, options: StartupPivotOptions) {
  const { apply } = options;
  const log = options.log ?? (() => {});
  const now = options.now ?? new Date();
  log(apply ? "Applying the 2026-10-19 pivot to startup markets." : "Read-only report. Nothing will change; add --apply to run it.");

  // The owners, checked before anything is written.
  const owners = await database.select({ id: profiles.id, handle: profiles.handle }).from(profiles)
    .where(and(eq(profiles.isOwner, 1), isNull(profiles.withdrawnAt), isNull(profiles.bannedAt)));
  const requested = options.ownerHandles?.length ? options.ownerHandles : owners.length === 1 ? [owners[0].handle] : [];
  const chosen = requested.map((handle) => owners.find((row) => row.handle === handle));
  const unknown = requested.filter((_, index) => !chosen[index]);
  const recordedUnder = chosen.filter((row) => row !== undefined);
  if (unknown.length) throw new Error(`Not an active owner account: ${unknown.map((handle) => `@${handle}`).join(", ")}.`);
  if (!recordedUnder.length && (apply || owners.length === 0)) {
    throw new Error(owners.length ? "More than one owner account: name them with --owner=<handle>[,<handle>]." : "No active owner account.");
  }
  log(recordedUnder.length
    ? `   Recorded under ${recordedUnder.map((row) => `@${row.handle}`).join(" and ")}; @${recordedUnder[0].handle} acts.`
    : "   More than one owner account: --apply will need --owner=<handle>[,<handle>].");
  const ownerId = recordedUnder[0]?.id ?? "";
  const authority = recordedUnder.length > 1 ? ` Recorded on the go-ahead of ${recordedUnder.map((row) => `@${row.handle}`).join(" and ")}.` : "";

  // ------------------------------------------------------- 1. the migration record
  const files = migrationFiles(options.migrationsFolder);
  const [{ tracked }] = rows<{ tracked: boolean }>(await database.execute(sql`select to_regclass('drizzle.__drizzle_migrations') is not null as tracked`));
  const recorded = tracked
    ? rows<{ hash: string; created_at: string | number }>(await database.execute(sql`select hash, created_at from drizzle.__drizzle_migrations`))
    : [];
  const recordedHashes = new Set(recorded.map((row) => row.hash));
  const lastRecorded = Math.max(0, ...recorded.map((row) => Number(row.created_at)));
  log(`1. Migration record: ${recorded.length} recorded${tracked ? "" : " (no record table yet)"}.`);
  const toRecord: typeof files = [];
  for (const file of files.filter((f) => f.tag in HAND_APPLIED)) {
    if (recordedHashes.has(file.hash)) { log(`   ${file.tag}: recorded.`); continue; }
    const [{ ok }] = rows<{ ok: boolean }>(await database.execute(HAND_APPLIED[file.tag]));
    if (ok) { toRecord.push(file); log(`   ${file.tag}: applied by hand, ${apply ? "recording it" : "to be recorded"}.`); continue; }
    if (lastRecorded >= file.folderMillis) {
      throw new Error(`${file.tag} is not in the database, and the migrator would skip it because a later migration is recorded. Apply it by hand first; nothing was changed.`);
    }
    log(`   ${file.tag}: not applied; the migrator will apply it.`);
  }
  if (apply && toRecord.length) {
    await database.transaction(async (tx) => {
      for (const file of toRecord) {
        await tx.execute(sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${file.hash}, ${file.folderMillis})`);
      }
    });
  }

  // ---------------------------------------------------------------- 2. migration 0018
  const startupFile = files.find((file) => file.tag === STARTUP_MIGRATION);
  const [{ present }] = rows<{ present: boolean }>(await database.execute(sql`select ${tableExists("startups")} as present`));
  log(`2. Migration ${STARTUP_MIGRATION}: ${present || (startupFile && recordedHashes.has(startupFile.hash)) ? "already applied" : "to be applied"}.`);
  if (apply) {
    await options.migrate();
    log("   Migrations are up to date.");
  }

  // ------------------------------------------------------- 3. retire event markets
  const live = await database.select({ id: markets.id, question: markets.question, status: markets.status, rulingVersion: markets.rulingVersion })
    .from(markets).where(and(isNotNull(markets.venueId), inArray(markets.status, ["open", "closed", "ruled"])));
  log(`3. Event markets still live: ${live.length}${live.length ? "" : " (nothing to void)"}.`);
  for (const market of live) log(`   ${apply ? "Voiding" : "Would void"}: ${market.question}`);
  let voided = 0;
  if (apply) {
    for (const market of live) {
      await applyOwnerCommand(database, ownerId, {
        marketId: market.id, requestId: randomUUID(), action: "cancel", reason: `${RETIRED_EVENT_REASON}${authority}`, expectedVersion: market.rulingVersion,
      }, () => now);
      voided += 1;
    }
  }

  // ---------------------------------------------------------------- 4. demo data
  const seeded = apply || present ? (await database.select({ id: startups.id }).from(startups).where(eq(startups.isDemo, true)).limit(1)).length > 0 : false;
  log(`4. Demo catalog (${DEMO_STARTUPS.length} fictional startups): ${options.withoutDemo ? "skipped (--no-demo)" : seeded ? "already written" : "to be written"}.`);
  let summary: Awaited<ReturnType<typeof seedDemo>> | null = null;
  if (apply && !options.withoutDemo && !seeded) {
    summary = await seedDemo(database, ownerId, { now });
    log(`   Wrote ${summary.startups} startups, ${summary.videos} videos, ${summary.markets} markets, ${summary.trades} simulated trades.`);
  }
  return { recorded: apply ? toRecord.map((file) => file.tag) : [], voided, seeded: !!summary, summary };
}
