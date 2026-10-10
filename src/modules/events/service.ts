import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isCampusKey, type CampusKey } from "@/config/campus";
import { ECONOMY } from "@/modules/market/economy";
import { isUuid } from "@/modules/market/input";
import { stateAtProbability } from "@/modules/market/lmsr";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { isInactive } from "@/modules/account/standing";
import { isCategory, type Category } from "./categories";
import { SHORT_QUESTION_MAX } from "./limits";

/*
 * Event markets, decided 2026-10-08 (DECISIONS.md): students suggest, the owner
 * publishes. A suggestion is private to its author and the owner and is never
 * published by itself. Publishing writes the venue, the event, the source, the
 * market at the owner's opening price, its first price point and the owner's
 * decision in one transaction.
 */

const { profiles, markets, venues, events, resolutionSources, marketProposals, adminActions, priceHistory } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export type EventErrorCode =
  | "INVALID_INPUT" | "PROFILE_REQUIRED" | "NOT_OWNER" | "NOT_FOUND" | "ALREADY_REVIEWED" | "TOO_MANY_PENDING" | "UNAVAILABLE";

/** Safe to show to people; database errors never become UI text. */
export class EventError extends Error {
  constructor(public readonly code: EventErrorCode, message: string) {
    super(message);
    this.name = "EventError";
  }
}

/** Opening prices are whole percentages from 1% to 99%, stored as basis points. */
export const MIN_OPENING_BP = 100;
export const MAX_OPENING_BP = 9900;
/** One person's suggestions waiting at once: enough to be useful, too few to flood the queue. */
export const MAX_PENDING_PROPOSALS = 10;
const MAX_AHEAD_MS = 366 * 24 * 3_600_000;
const MAX_WINDOW_MS = 7 * 24 * 3_600_000;

/** Collapses whitespace and checks the length; control characters are refused. */
function cleanText(value: unknown, min: number, max: number, what: string, { multiline = false } = {}): string {
  const raw = typeof value === "string" ? value : "";
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw)) throw new EventError("INVALID_INPUT", `${what} contains characters that can’t be used.`);
  const text = multiline
    ? raw.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : raw.replace(/\s+/g, " ").trim();
  if (text.length < min || text.length > max) throw new EventError("INVALID_INPUT", `${what} must be ${min} to ${max.toLocaleString("en-US")} characters.`);
  return text;
}

function optionalText(value: unknown, max: number, what: string): string | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  return cleanText(value, 1, max, what);
}

function optionalUrl(value: unknown): string | null {
  const text = optionalText(value, 500, "The source link");
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString();
  } catch {
    throw new EventError("INVALID_INPUT", "The source link must be a full web address starting with https://.");
  }
}

function validDate(value: unknown, what: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new EventError("INVALID_INPUT", `Pick ${what}.`);
  return value;
}

/** "Midway on High" becomes "midway-on-high". */
export function slugify(name: string): string {
  const slug = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return slug || "venue";
}

async function activeProfile<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  if (!isUuid(userId)) throw new EventError("PROFILE_REQUIRED", "Finish setting up your profile first.");
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile || isInactive(profile) || !profile.adultConfirmedAt) {
    throw new EventError("PROFILE_REQUIRED", "Finish setting up your profile first.");
  }
  return profile;
}

async function requireOwner<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  const notOwner = new EventError("NOT_OWNER", "Only the app owner can review and publish markets.");
  const profile = await activeProfile(database, userId).catch((error) => {
    throw error instanceof EventError ? notOwner : error;
  });
  if (profile.isOwner !== 1) throw notOwner;
  return profile;
}

async function runInTransaction<Q extends PgQueryResultHKT, T>(database: Database<Q>, work: (tx: Database<Q>) => Promise<T>): Promise<T> {
  try {
    return await database.transaction((tx) => work(tx as unknown as Database<Q>), { isolationLevel: "read committed" });
  } catch (error) {
    if (error instanceof EventError) throw error;
    throw new EventError("UNAVAILABLE", "That couldn’t be saved right now. Please try again shortly.");
  }
}

// ------------------------------------------------------------------ suggestions

export interface ProposalInput {
  question: string;
  category: string;
  /** As typed; ignored when venueId names a known venue on the same campus. */
  venueName: string;
  venueId?: string | null;
  windowStartAt: Date | null;
  windowEndAt?: Date | null;
  resolutionNote: string;
}

/**
 * Saves a pending suggestion. `proposerUserId` and `campus` must come from the
 * server-verified identity, never from the form.
 */
export async function submitProposal<Q extends PgQueryResultHKT>(
  database: Database<Q>, proposerUserId: string, campus: CampusKey, input: ProposalInput, now: Date = new Date(),
) {
  if (!isCampusKey(campus)) throw new EventError("INVALID_INPUT", "Your campus isn’t recognised.");
  await activeProfile(database, proposerUserId);
  const question = cleanText(input.question, 10, 200, "The question");
  if (!isCategory(input.category)) throw new EventError("INVALID_INPUT", "Choose a category.");
  const start = input.windowStartAt ? validDate(input.windowStartAt, "when it happens") : null;
  if (!start) throw new EventError("INVALID_INPUT", "Pick when it happens.");
  if (start.getTime() <= now.getTime()) throw new EventError("INVALID_INPUT", "Pick a time in the future.");
  if (start.getTime() > now.getTime() + MAX_AHEAD_MS) throw new EventError("INVALID_INPUT", "That’s more than a year away. Check the date.");
  const end = input.windowEndAt ? validDate(input.windowEndAt, "when it ends") : null;
  if (end && (end <= start || end.getTime() - start.getTime() > MAX_WINDOW_MS)) {
    throw new EventError("INVALID_INPUT", "The end must be after the start and within a week of it.");
  }
  const resolutionNote = cleanText(input.resolutionNote, 10, 500, "How it could be checked", { multiline: true });

  let venueId: string | null = null;
  let venueName = cleanText(input.venueName, 2, 80, "The venue");
  // A known venue on the same campus, picked from the list or typed by its exact name.
  const [venue] = await database.select().from(venues).where(and(eq(venues.campus, campus),
    input.venueId && isUuid(input.venueId) ? eq(venues.id, input.venueId) : sql`lower(${venues.name}) = lower(${venueName})`)).limit(1);
  if (venue) { venueId = venue.id; venueName = venue.name; }

  return runInTransaction(database, async (tx) => {
    // Serialize one person's submissions so the pending limit holds under double clicks.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`proposal:${proposerUserId}`}, 0))`);
    const [{ pending }] = await tx.select({ pending: count() }).from(marketProposals)
      .where(and(eq(marketProposals.proposerUserId, proposerUserId), eq(marketProposals.status, "pending")));
    if (Number(pending) >= MAX_PENDING_PROPOSALS) {
      throw new EventError("TOO_MANY_PENDING", `You have ${MAX_PENDING_PROPOSALS} suggestions waiting. Wait for the owner to review some first.`);
    }
    const [proposal] = await tx.insert(marketProposals).values({
      proposerUserId, campus, question, category: input.category as Category, venueName, venueId,
      windowStartAt: start, windowEndAt: end, resolutionNote, createdAt: now,
    }).returning();
    return proposal;
  });
}

/** A person's own suggestions, newest first, with the owner's reason on any turned down. */
export async function listProposalsFor<Q extends PgQueryResultHKT>(database: Database<Q>, proposerUserId: string) {
  if (!isUuid(proposerUserId)) return [];
  return database.select({
    id: marketProposals.id, question: marketProposals.question, category: marketProposals.category,
    venueName: marketProposals.venueName, status: marketProposals.status, reviewReason: marketProposals.reviewReason,
    marketId: marketProposals.marketId, createdAt: marketProposals.createdAt,
  }).from(marketProposals).where(eq(marketProposals.proposerUserId, proposerUserId)).orderBy(desc(marketProposals.createdAt)).limit(50);
}

/** Suggestions waiting for the owner, oldest first. Owner only. */
export async function listPendingProposals<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string) {
  await requireOwner(database, ownerId);
  return database.select({
    proposal: marketProposals,
    proposer: { handle: profiles.handle, displayName: profiles.displayName },
  }).from(marketProposals).innerJoin(profiles, eq(profiles.id, marketProposals.proposerUserId))
    .where(eq(marketProposals.status, "pending")).orderBy(asc(marketProposals.createdAt));
}

export async function countPendingProposals<Q extends PgQueryResultHKT>(database: Database<Q>): Promise<number> {
  const [{ n }] = await database.select({ n: count() }).from(marketProposals).where(eq(marketProposals.status, "pending"));
  return Number(n);
}

async function lockPendingProposal<Q extends PgQueryResultHKT>(tx: Database<Q>, proposalId: string) {
  if (!isUuid(proposalId)) throw new EventError("NOT_FOUND", "That suggestion no longer exists.");
  const [proposal] = await tx.select().from(marketProposals).where(eq(marketProposals.id, proposalId)).for("update");
  if (!proposal) throw new EventError("NOT_FOUND", "That suggestion no longer exists.");
  if (proposal.status !== "pending") throw new EventError("ALREADY_REVIEWED", "This suggestion has already been reviewed.");
  return proposal;
}

/** Turns a suggestion down with a reason its author can read. */
export async function rejectProposal<Q extends PgQueryResultHKT>(
  database: Database<Q>, ownerId: string, proposalId: string, reasonInput: string, now: Date = new Date(),
) {
  const reason = cleanText(reasonInput, 3, 500, "The reason");
  return runInTransaction(database, async (tx) => {
    await requireOwner(tx, ownerId);
    const proposal = await lockPendingProposal(tx, proposalId);
    const [rejected] = await tx.update(marketProposals).set({ status: "rejected", reviewReason: reason, reviewedBy: ownerId, reviewedAt: now })
      .where(eq(marketProposals.id, proposal.id)).returning();
    await tx.insert(adminActions).values({ marketId: null, actorUserId: ownerId, kind: "reject", reason,
      details: { proposalId: proposal.id, question: proposal.question, venueName: proposal.venueName, category: proposal.category }, createdAt: now });
    return rejected;
  });
}

// ------------------------------------------------------------------ publishing

export type VenueChoice = { id: string } | { name: string; area?: string | null; description?: string | null };
export type SourceChoice = { id: string } | { name: string; method: string; url?: string | null; operational: boolean };

export interface PublishInput {
  /** Set when publishing a student's suggestion; it becomes approved in the same transaction. */
  proposalId?: string | null;
  campus: CampusKey;
  question: string;
  /**
   * The card's few words (2026-10-09), e.g. "Will Midway on High sell more than
   * 1,000 drinks?". Optional: without it, cards show the full question.
   */
  shortQuestion?: string | null;
  category: string;
  venue: VenueChoice;
  eventTitle: string;
  windowStartAt: Date | null;
  windowEndAt: Date | null;
  /** IANA zone the window is written in; the campus's own. */
  timeZone: string;
  tradingCutoffAt: Date | null;
  resultsDueAt: Date | null;
  yesCondition: string;
  noCondition: string;
  /** The full rules, frozen once trading opens. */
  rules: string;
  source: SourceChoice;
  openingProbabilityBp: number;
  isSample: boolean;
  note?: string | null;
  /**
   * Sample markets only: demonstration price points before opening, oldest
   * first. The market page labels a sample's chart as demonstration data.
   */
  sampleHistory?: { at: Date; yesBp: number }[];
}

type CleanPublish = ReturnType<typeof validatePublish>;

function validatePublish(input: PublishInput, now: Date) {
  if (!isCampusKey(input.campus)) throw new EventError("INVALID_INPUT", "Choose a campus.");
  if (!isCategory(input.category)) throw new EventError("INVALID_INPUT", "Choose a category.");
  const question = cleanText(input.question, 10, 200, "The question");
  const shortQuestion = typeof input.shortQuestion === "string" && input.shortQuestion.trim()
    ? cleanText(input.shortQuestion, 10, SHORT_QUESTION_MAX, "The short title") : null;
  const eventTitle = cleanText(input.eventTitle, 2, 120, "The event name");
  const windowStartAt = validDate(input.windowStartAt, "when the window starts");
  const windowEndAt = validDate(input.windowEndAt, "when the window ends");
  const tradingCutoffAt = validDate(input.tradingCutoffAt, "the trading cutoff");
  const resultsDueAt = validDate(input.resultsDueAt, "when results are due");
  if (windowEndAt <= windowStartAt) throw new EventError("INVALID_INPUT", "The window must end after it starts.");
  if (windowEndAt.getTime() - windowStartAt.getTime() > MAX_WINDOW_MS) throw new EventError("INVALID_INPUT", "Keep the window to a week or less.");
  if (tradingCutoffAt <= now) throw new EventError("INVALID_INPUT", "The trading cutoff must be in the future.");
  if (tradingCutoffAt > windowEndAt) throw new EventError("INVALID_INPUT", "Trading must close by the end of the window.");
  if (resultsDueAt < windowEndAt) throw new EventError("INVALID_INPUT", "Results can’t be due before the window ends.");
  if (resultsDueAt.getTime() - windowEndAt.getTime() > 30 * 24 * 3_600_000) throw new EventError("INVALID_INPUT", "Results must be due within 30 days of the window.");
  if (windowStartAt.getTime() > now.getTime() + MAX_AHEAD_MS) throw new EventError("INVALID_INPUT", "That’s more than a year away. Check the date.");
  try { new Intl.DateTimeFormat("en-US", { timeZone: input.timeZone }); } catch { throw new EventError("INVALID_INPUT", "Unknown time zone."); }
  if (!Number.isInteger(input.openingProbabilityBp) || input.openingProbabilityBp < MIN_OPENING_BP || input.openingProbabilityBp > MAX_OPENING_BP) {
    throw new EventError("INVALID_INPUT", "Set opening odds between 1% and 99%.");
  }
  const venue: VenueChoice = "id" in input.venue
    ? { id: input.venue.id }
    : { name: cleanText(input.venue.name, 2, 80, "The venue name"), area: optionalText(input.venue.area, 80, "The area"),
      description: optionalText(input.venue.description, 300, "The venue description") };
  const source: SourceChoice = "id" in input.source
    ? { id: input.source.id }
    : { name: cleanText(input.source.name, 3, 120, "The source name"), method: cleanText(input.source.method, 10, 600, "How the source counts", { multiline: true }),
      url: optionalUrl(input.source.url), operational: input.source.operational === true };
  const history = input.isSample ? (input.sampleHistory ?? []) : [];
  if (!input.isSample && input.sampleHistory?.length) throw new EventError("INVALID_INPUT", "Only sample markets carry demonstration prices.");
  let previous = -Infinity;
  for (const point of history) {
    validDate(point.at, "a demonstration price time");
    if (point.at.getTime() >= now.getTime() || point.at.getTime() <= previous) throw new EventError("INVALID_INPUT", "Demonstration prices must be in the past, oldest first.");
    if (!Number.isInteger(point.yesBp) || point.yesBp < MIN_OPENING_BP || point.yesBp > MAX_OPENING_BP) throw new EventError("INVALID_INPUT", "Demonstration prices must be between 1% and 99%.");
    previous = point.at.getTime();
  }
  return {
    proposalId: input.proposalId ?? null, campus: input.campus, category: input.category as Category, question, shortQuestion, eventTitle,
    windowStartAt, windowEndAt, tradingCutoffAt, resultsDueAt, timeZone: input.timeZone,
    yesCondition: cleanText(input.yesCondition, 10, 500, "The Yes condition", { multiline: true }),
    noCondition: cleanText(input.noCondition, 10, 500, "The No condition", { multiline: true }),
    rules: cleanText(input.rules, 20, 2000, "The rules", { multiline: true }),
    venue, source, openingProbabilityBp: input.openingProbabilityBp, isSample: input.isSample === true,
    note: optionalText(input.note, 500, "The note"), history,
  };
}

async function resolveVenue<Q extends PgQueryResultHKT>(tx: Database<Q>, input: CleanPublish, now: Date) {
  if ("id" in input.venue) {
    if (!isUuid(input.venue.id)) throw new EventError("NOT_FOUND", "That venue no longer exists.");
    const [venue] = await tx.select().from(venues).where(eq(venues.id, input.venue.id)).limit(1);
    if (!venue) throw new EventError("NOT_FOUND", "That venue no longer exists.");
    if (venue.campus !== input.campus) throw new EventError("INVALID_INPUT", "That venue belongs to another campus.");
    return venue;
  }
  // The same name on the same campus is the same place.
  const [existing] = await tx.select().from(venues)
    .where(and(eq(venues.campus, input.campus), sql`lower(${venues.name}) = lower(${input.venue.name})`)).limit(1);
  if (existing) return existing;
  const base = slugify(input.venue.name);
  const taken = new Set((await tx.select({ slug: venues.slug }).from(venues).where(sql`${venues.slug} like ${`${base}%`}`)).map((row) => row.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  const [created] = await tx.insert(venues).values({
    campus: input.campus, slug, name: input.venue.name, category: input.category,
    area: input.venue.area ?? null, description: input.venue.description ?? null, createdAt: now,
  }).returning();
  return created;
}

async function resolveSource<Q extends PgQueryResultHKT>(tx: Database<Q>, input: CleanPublish, now: Date) {
  if ("id" in input.source) {
    if (!isUuid(input.source.id)) throw new EventError("NOT_FOUND", "That source no longer exists.");
    const [source] = await tx.select().from(resolutionSources).where(eq(resolutionSources.id, input.source.id)).limit(1);
    if (!source) throw new EventError("NOT_FOUND", "That source no longer exists.");
    return source;
  }
  const [created] = await tx.insert(resolutionSources).values({
    name: input.source.name, method: input.source.method, url: input.source.url ?? null, operational: input.source.operational, createdAt: now,
  }).returning();
  return created;
}

/** Owner only: open an event market at the owner's price, from a suggestion or from scratch. */
export async function publishMarket<Q extends PgQueryResultHKT>(
  database: Database<Q>, ownerId: string, input: PublishInput, now: Date = new Date(),
) {
  const clean = validatePublish(input, now);
  return runInTransaction(database, async (tx) => {
    await requireOwner(tx, ownerId);
    const proposal = clean.proposalId ? await lockPendingProposal(tx, clean.proposalId) : null;
    const venue = await resolveVenue(tx, clean, now);
    const source = await resolveSource(tx, clean, now);
    const [event] = await tx.insert(events).values({
      venueId: venue.id, title: clean.eventTitle, startsAt: clean.windowStartAt, endsAt: clean.windowEndAt, timeZone: clean.timeZone, createdAt: now,
    }).returning();

    const liquidityMicro = Math.round(ECONOMY.defaultLiquidity * MICRO_PER_UNIT);
    const lmsr = stateAtProbability(ECONOMY.defaultLiquidity, clean.openingProbabilityBp / 10_000);
    const initialYesSharesMicro = Math.round(lmsr.yesShares * MICRO_PER_UNIT);
    const initialNoSharesMicro = Math.round(lmsr.noShares * MICRO_PER_UNIT);
    const [market] = await tx.insert(markets).values({
      subjectUserId: null, status: "open", question: clean.question, shortQuestion: clean.shortQuestion, resolutionCriteria: clean.rules,
      campus: clean.campus, category: clean.category, venueId: venue.id, eventId: event.id, resolutionSourceId: source.id,
      windowStartAt: clean.windowStartAt, windowEndAt: clean.windowEndAt, timeZone: clean.timeZone,
      yesCondition: clean.yesCondition, noCondition: clean.noCondition, isSample: clean.isSample,
      deadlineAt: clean.tradingCutoffAt, evidenceDeadlineAt: clean.resultsDueAt,
      liquidityMicro, openingProbabilityBp: clean.openingProbabilityBp, initialYesSharesMicro, initialNoSharesMicro,
      yesSharesMicro: initialYesSharesMicro, noSharesMicro: initialNoSharesMicro,
      approvedAt: now, approvedBy: ownerId, createdAt: now,
    }).returning();

    if (clean.history.length) {
      await tx.insert(priceHistory).values(clean.history.map((point) => ({ marketId: market.id, yesPriceBp: point.yesBp, recordedAt: point.at })));
    }
    await tx.insert(priceHistory).values({ marketId: market.id, yesPriceBp: clean.openingProbabilityBp, recordedAt: now });
    if (proposal) {
      await tx.update(marketProposals).set({ status: "approved", marketId: market.id, reviewedBy: ownerId, reviewedAt: now, reviewReason: clean.note })
        .where(eq(marketProposals.id, proposal.id));
    }
    await tx.insert(adminActions).values({
      marketId: market.id, actorUserId: ownerId, kind: "approve", reason: clean.note,
      details: {
        question: clean.question, shortQuestion: clean.shortQuestion, rules: clean.rules, yesCondition: clean.yesCondition, noCondition: clean.noCondition,
        venue: venue.name, category: clean.category, campus: clean.campus, event: clean.eventTitle,
        windowStartAt: clean.windowStartAt.toISOString(), windowEndAt: clean.windowEndAt.toISOString(), timeZone: clean.timeZone,
        tradingCutoffAt: clean.tradingCutoffAt.toISOString(), resultsDueAt: clean.resultsDueAt.toISOString(),
        source: source.name, sourceOperational: source.operational, openingProbabilityBp: clean.openingProbabilityBp,
        isSample: clean.isSample, proposalId: proposal?.id ?? null,
      },
      createdAt: now,
    });
    return market;
  });
}

// ------------------------------------------------------------------ catalog

/** Venues on a campus, for the filters, the suggestion form and the owner's form. Public. */
export async function listVenues<Q extends PgQueryResultHKT>(database: Database<Q>, campus: CampusKey) {
  return database.select({ id: venues.id, slug: venues.slug, name: venues.name, category: venues.category, area: venues.area })
    .from(venues).where(eq(venues.campus, campus)).orderBy(asc(venues.name));
}

/** Sources the owner can reuse when publishing. Public facts, but only the owner's form lists them. */
export async function listSources<Q extends PgQueryResultHKT>(database: Database<Q>) {
  return database.select({ id: resolutionSources.id, name: resolutionSources.name, operational: resolutionSources.operational })
    .from(resolutionSources).orderBy(asc(resolutionSources.name));
}

/** One venue by its address, for its own page. Public. */
export async function readVenue<Q extends PgQueryResultHKT>(database: Database<Q>, slug: string) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,70}$/.test(slug)) return null;
  const [venue] = await database.select({
    id: venues.id, slug: venues.slug, name: venues.name, campus: venues.campus, category: venues.category,
    area: venues.area, description: venues.description,
  }).from(venues).where(eq(venues.slug, slug)).limit(1);
  return venue ?? null;
}
