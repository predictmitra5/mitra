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
  isSample?: boolean;
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
    isSample: options.isSample ?? false,
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

let startupCount = 0;

/** An approved startup with an approved primary founder (2026-10-19), inserted directly. */
export async function insertStartup(database: Database, now: Date, options: { name?: string; industry?: (typeof schema.industry.enumValues)[number]; founderUserId?: string | null; createdBy?: string | null } = {}) {
  startupCount += 1;
  const name = options.name ?? `Test Startup ${startupCount}`;
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${startupCount}`;
  const [founder] = await database.insert(schema.founders).values({
    handle: `founder_${startupCount}_${Math.floor(Math.random() * 1e6)}`.slice(0, 24), name: `Founder ${startupCount}`, headline: "Building something people want",
    bio: "A founder in a test.", userId: options.founderUserId ?? null, status: "approved", approvedAt: now, createdAt: now,
  }).returning();
  const [startup] = await database.insert(schema.startups).values({
    slug, name, tagline: "A test product", headline: "Testing the future", description: "A startup that exists only in tests.",
    industry: options.industry ?? "ai", stage: "Seed", productDetails: "It does test things.", productFeatures: ["check:One", "book:Two", "bot:Three"],
    status: "approved", createdBy: options.createdBy ?? null, approvedAt: now, createdAt: now,
  }).returning();
  await database.insert(schema.startupFounders).values({ startupId: startup.id, founderId: founder.id, role: "Founder / CEO", isPrimary: true, createdAt: now });
  return { startup, founder };
}

export type StartupMarketOptions = { startupId: string; question?: string; closesOn?: string; openingBp?: number; isDemo?: boolean; kind?: string };

/** Opens a startup market as the owner at `now`, through the owner's own draft-and-open service. */
export async function openStartupMarket(database: Database, ownerId: string, now: Date, options: StartupMarketOptions) {
  const { saveMarketDraft, openMarket } = await import("@/modules/startups/admin");
  const draft = await saveMarketDraft(database, ownerId, {
    startupId: options.startupId, question: options.question ?? "Will this test startup reach 1,000 verified users by the close date?",
    kind: options.kind ?? "adoption", yesCondition: "An independent audit shows at least 1,000 verified users by the close date.",
    noCondition: "Fewer than 1,000, or it cannot be verified.", rules: "Users are distinct accounts active in the month. If the audit is unavailable, the market resolves No.",
    sourceName: "Independent audit", sourceMethod: "A count of distinct active accounts.", closesOn: options.closesOn ?? "2027-12-31",
    openingProbabilityBp: options.openingBp ?? 5000, isDemo: options.isDemo ?? false,
  }, null, now);
  return openMarket(database, ownerId, draft.id, now);
}
