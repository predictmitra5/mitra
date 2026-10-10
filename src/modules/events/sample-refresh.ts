import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { applyOwnerCommand } from "@/modules/market/lifecycle";
import { publishMarket } from "./service";
import { osuSampleMarkets } from "./samples";

/*
 * The live steps of the 2026-10-09 change (DECISIONS.md, 2026-10-09), run once
 * on the owner's go-ahead by scripts/sample-refresh-go-live.mjs. Without
 * `apply` nothing is written, and every step is safe to run again:
 *
 *   1. Migration 0014 (markets.short_question), through the caller's migrator.
 *   2. Each live sample that has no short title gets the one in samples.ts.
 *      Display only: its question, rules and conditions are untouched.
 *   3. Live samples at venues no longer in samples.ts (Gateway Film Center)
 *      are voided through the owner's own cancel command, refunding held cost.
 *   4. Samples in samples.ts with no live market at their venue (Smith-Steeb
 *      Hall) are published through the real publishing service as the owner.
 */

const { markets, profiles, venues, positions } = schema;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = PgDatabase<any, typeof schema>;

export const REPLACED_REASON = "This sample market was replaced by another sample on October 9, 2026, so it was voided and everyone was refunded what they paid.";
const LIVE = ["open", "closed", "ruled"] as const;

export interface SampleRefreshOptions {
  apply: boolean;
  /** Applies every pending migration; called only with `apply`. */
  migrate: () => Promise<void>;
  /** The owner accounts the steps are recorded under; the first acts. Needed when there is more than one. */
  ownerHandles?: string[];
  now?: Date;
  log?: (line: string) => void;
}

function rows<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];
}

export async function runSampleRefresh(database: Database, options: SampleRefreshOptions) {
  const { apply } = options;
  const log = options.log ?? (() => {});
  const now = options.now ?? new Date();
  log(apply ? "Applying the 2026-10-09 sample refresh." : "Read-only report. Nothing will change; add --apply to run it.");

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

  // ---------------------------------------------------------------- 1. migration
  const [{ present }] = rows<{ present: boolean }>(await database.execute(sql`select exists (select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'markets' and column_name = 'short_question') as present`));
  log(`1. Migration 0014 (short titles): ${present ? "already applied" : "to be applied"}.`);
  if (apply) {
    await options.migrate();
    log("   Migrations are up to date.");
  }

  // The live samples, by venue. Read without short_question, which may not exist yet.
  const live = await database.select({ id: markets.id, question: markets.question, status: markets.status, rulingVersion: markets.rulingVersion, slug: venues.slug })
    .from(markets).innerJoin(venues, eq(venues.id, markets.venueId))
    .where(and(eq(markets.isSample, true), inArray(markets.status, [...LIVE])));
  const fixtures = osuSampleMarkets(now);
  const bySlug = new Map(fixtures.map((fixture) => [fixture.slug, fixture]));

  // ---------------------------------------------------------------- 2. short titles
  log("2. Short titles on live samples:");
  let titled = 0;
  for (const market of live) {
    const short = bySlug.get(market.slug)?.shortQuestion;
    if (!short) continue;
    const [current] = present
      ? rows<{ short_question: string | null }>(await database.execute(sql`select short_question from markets where id = ${market.id}`))
      : [{ short_question: null }];
    if (current?.short_question) { log(`   ${market.slug}: already “${current.short_question}”.`); continue; }
    log(`   ${market.slug}: “${short}” (the full question stays: ${market.question})`);
    if (!apply) continue;
    await database.update(markets).set({ shortQuestion: short }).where(and(eq(markets.id, market.id), isNull(markets.shortQuestion)));
    titled += 1;
  }

  // ---------------------------------------------------------------- 3. retire replaced samples
  const retired = live.filter((market) => !bySlug.has(market.slug));
  log(`3. Samples to void and refund: ${retired.length}.`);
  let voided = 0;
  for (const market of retired) {
    const holders = await database.select({ userId: positions.userId }).from(positions)
      .where(and(eq(positions.marketId, market.id), sql`(${positions.yesSharesMicro} > 0 or ${positions.noSharesMicro} > 0)`));
    log(`   ${market.status}, ${holders.length} holder${holders.length === 1 ? "" : "s"}: ${market.question}`);
    if (!apply) continue;
    await applyOwnerCommand(database, ownerId, {
      marketId: market.id, requestId: randomUUID(), action: "cancel", reason: `${REPLACED_REASON}${authority}`, expectedVersion: market.rulingVersion,
    }, () => now);
    voided += 1;
    log("   Voided; held cost refunded.");
  }

  // ---------------------------------------------------------------- 4. new samples
  log("4. New samples:");
  const liveSlugs = new Set(live.map((market) => market.slug));
  const published: string[] = [];
  for (const { slug, ...input } of fixtures) {
    if (liveSlugs.has(slug)) continue;
    log(`   ${input.shortQuestion ?? input.question}`);
    log(`     ${input.question}`);
    log(`     opens at ${input.openingProbabilityBp / 100}%, trading until ${input.tradingCutoffAt?.toISOString()}, results due ${input.resultsDueAt?.toISOString()}`);
    if (!apply) continue;
    const market = await publishMarket(database, ownerId, { ...input, note: `Sample market added on 2026-10-09.${authority}` }, now);
    published.push(market.id);
    log(`     Published: /markets/${market.id}`);
  }
  if (published.length === 0 && !fixtures.some((fixture) => !liveSlugs.has(fixture.slug))) log("   none; every sample is already live.");
  return { titled, voided, published };
}
