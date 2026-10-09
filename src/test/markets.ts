import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { publishMarket } from "@/modules/events/service";
import { ECONOMY } from "@/modules/market/economy";
import { stateAtProbability } from "@/modules/market/lmsr";
import { MICRO_PER_UNIT } from "@/modules/market/units";

/*
 * Markets for tests. Event markets go through the real publishing service;
 * goal markets from before 2026-10-08 are inserted directly, because no code
 * path creates one any more but the engine still has to handle the ones that
 * exist.
 */

// The helpers are called with both in-memory and hosted databases.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = PgDatabase<any, typeof schema>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type EventMarketOptions = {
  question?: string;
  venueName?: string;
  category?: "nightlife" | "food" | "events" | "entertainment" | "campus";
  campus?: "osu" | "uiuc";
  /** Trading cutoff, which is also when the window starts. Seven days after `now` by default. */
  cutoff?: Date;
  windowEnd?: Date;
  resultsDue?: Date;
  openingBp?: number;
  isSample?: boolean;
  sampleHistory?: { at: Date; yesBp: number }[];
  proposalId?: string;
};

/** Opens an event market as the owner at `now`. */
export async function openEventMarket(database: Database, ownerId: string, now: Date, options: EventMarketOptions = {}) {
  const cutoff = options.cutoff ?? new Date(now.getTime() + 7 * DAY);
  const windowEnd = options.windowEnd ?? new Date(cutoff.getTime() + 5 * HOUR);
  const resultsDue = options.resultsDue ?? new Date(windowEnd.getTime() + 3 * DAY);
  return publishMarket(database, ownerId, {
    proposalId: options.proposalId ?? null,
    campus: options.campus ?? "osu",
    category: options.category ?? "nightlife",
    question: options.question ?? "Will the Test Tavern sell more than 500 drinks on Friday night?",
    venue: { name: options.venueName ?? "Test Tavern", area: "North High Street" },
    eventTitle: "Friday night",
    windowStartAt: cutoff, windowEndAt: windowEnd, timeZone: "America/New_York",
    tradingCutoffAt: cutoff, resultsDueAt: resultsDue,
    yesCondition: "The venue's register count shows more than 500 drinks in the window.",
    noCondition: "The count shows 500 or fewer, or no count arrives by the results deadline.",
    rules: "Voided and refunded items don't count. Times are Eastern.",
    source: { name: "Test Tavern register count", method: "A count of drink items from the venue's register.", operational: false },
    openingProbabilityBp: options.openingBp ?? 5000,
    isSample: options.isSample ?? false,
    sampleHistory: options.sampleHistory,
  }, now);
}

/** A goal market about `subjectId`, open at `openingBp`, as the retired goal flow left them. */
export async function insertGoalMarket(
  database: Database, subjectId: string, ownerId: string, now: Date,
  options: { deadline?: Date; evidenceDeadline?: Date; openingBp?: number; status?: "draft" | "open" } = {},
) {
  const deadline = options.deadline ?? new Date(now.getTime() + 14 * DAY);
  const evidenceDeadline = options.evidenceDeadline ?? new Date(deadline.getTime() + 7 * DAY);
  const openingBp = options.openingBp ?? 5000;
  const liquidityMicro = Math.round(ECONOMY.defaultLiquidity * MICRO_PER_UNIT);
  const draft = options.status === "draft";
  const lmsr = stateAtProbability(ECONOMY.defaultLiquidity, openingBp / 10_000);
  const yes = Math.round(lmsr.yesShares * MICRO_PER_UNIT);
  const no = Math.round(lmsr.noShares * MICRO_PER_UNIT);
  const [market] = await database.insert(schema.markets).values({
    subjectUserId: subjectId, status: draft ? "draft" : "open",
    question: "Will Sam be offered admission to Chess Club?", resolutionCriteria: "The club's admission offer before the deadline.",
    goalType: "club", deadlineAt: deadline, evidenceDeadlineAt: evidenceDeadline, liquidityMicro, createdAt: now,
    ...(draft ? {} : {
      openingProbabilityBp: openingBp, initialYesSharesMicro: yes, initialNoSharesMicro: no, yesSharesMicro: yes, noSharesMicro: no,
      approvedAt: now, approvedBy: ownerId,
    }),
  }).returning();
  if (!draft) await database.insert(schema.priceHistory).values({ marketId: market.id, yesPriceBp: openingBp, recordedAt: now });
  return market;
}
