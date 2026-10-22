import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { isUuid } from "@/modules/market/input";
import { isInactive } from "@/modules/account/standing";
import { isMilestone, VERIFICATION, type MilestoneKey } from "./labels";
import { removeUploadedImage, uploadedImagePath } from "./media";

/*
 * The owner's tools for startups (2026-10-19): approving founders, startups and
 * videos; drafting markets, editing their rules until they open, opening them
 * at an opening price, pausing and resuming them; reviewing verification
 * claims in the brief's four levels; handling reports and removing comments.
 * Every decision is written to admin_actions with its reason, which the audit
 * page lists. Ruling, settling and voiding stay in market/lifecycle.ts.
 */

const {
  profiles, founders, startups, startupFounders, videos, verificationClaims, reports, comments, markets, resolutionSources,
  adminActions, marketProposals,
} = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type ActionKind = (typeof schema.adminActionKind.enumValues)[number];

export class AdminError extends Error {
  constructor(public readonly code: "NOT_OWNER" | "NOT_FOUND" | "INVALID_INPUT" | "INVALID_STATE", message: string) {
    super(message); this.name = "AdminError";
  }
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
function text(value: unknown, label: string, min: number, max: number): string {
  const clean = typeof value === "string" ? value.trim() : "";
  if (clean.length < min || clean.length > max || CONTROL.test(clean)) throw new AdminError("INVALID_INPUT", `${label}: write ${min} to ${max} characters.`);
  return clean;
}

export async function requireOwner<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  if (!isUuid(userId)) throw new AdminError("NOT_OWNER", "Only the app owner can do this.");
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile || profile.isOwner !== 1 || isInactive(profile)) throw new AdminError("NOT_OWNER", "Only the app owner can do this.");
  return profile;
}

async function audit<Q extends PgQueryResultHKT>(database: Database<Q>, actorUserId: string, kind: ActionKind, reason: string | null, details: Record<string, unknown>, marketId: string | null = null, now = new Date()) {
  await database.insert(adminActions).values({ actorUserId, kind, reason, details, marketId, createdAt: now });
}

// --------------------------------------------------------------- the queue

export async function readReviewQueue<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string) {
  await requireOwner(database, ownerId);
  const pendingFounders = await database.select({ founder: founders, handle: profiles.handle }).from(founders).leftJoin(profiles, eq(profiles.id, founders.userId))
    .where(eq(founders.status, "pending")).orderBy(asc(founders.createdAt));
  const pendingStartups = await database.select({ startup: startups, founderName: founders.name, founderStatus: founders.status }).from(startups)
    .leftJoin(startupFounders, and(eq(startupFounders.startupId, startups.id), eq(startupFounders.isPrimary, true)))
    .leftJoin(founders, eq(founders.id, startupFounders.founderId))
    .where(eq(startups.status, "pending")).orderBy(asc(startups.createdAt));
  const pendingVideos = await database.select({ video: videos, startupName: startups.name, startupStatus: startups.status, startupSlug: startups.slug }).from(videos)
    .innerJoin(startups, eq(startups.id, videos.startupId)).where(eq(videos.status, "pending")).orderBy(asc(videos.createdAt));
  const suggestions = await database.select({ proposal: marketProposals, startupName: startups.name, startupSlug: startups.slug, handle: profiles.handle }).from(marketProposals)
    .innerJoin(startups, eq(startups.id, marketProposals.startupId)).innerJoin(profiles, eq(profiles.id, marketProposals.proposerUserId))
    .where(eq(marketProposals.status, "pending")).orderBy(asc(marketProposals.createdAt));
  const claims = await database.select({ claim: verificationClaims, startupName: startups.name }).from(verificationClaims)
    .innerJoin(startups, eq(startups.id, verificationClaims.startupId))
    .where(and(isNull(verificationClaims.reviewedAt), isNotNull(verificationClaims.submittedBy))).orderBy(asc(verificationClaims.createdAt));
  const openReports = await database.select({ report: reports, handle: profiles.handle }).from(reports).leftJoin(profiles, eq(profiles.id, reports.reporterUserId))
    .where(eq(reports.status, "open")).orderBy(asc(reports.createdAt)).limit(100);
  const drafts = await database.select({ market: markets, startupName: startups.name }).from(markets).innerJoin(startups, eq(startups.id, markets.startupId))
    .where(eq(markets.status, "draft")).orderBy(desc(markets.createdAt));
  return { founders: pendingFounders, startups: pendingStartups, videos: pendingVideos, suggestions, claims, reports: await describeReports(database, openReports), drafts };
}

/** What each report points at, in a few words, with a link where there is a page. */
async function describeReports<Q extends PgQueryResultHKT>(database: Database<Q>, rows: { report: typeof reports.$inferSelect; handle: string | null }[]) {
  const out = [];
  for (const { report, handle } of rows) {
    let label = "Removed or unknown item";
    let href: string | null = null;
    if (report.target === "video") {
      const [v] = await database.select({ title: videos.title, startup: startups.name }).from(videos).innerJoin(startups, eq(startups.id, videos.startupId)).where(eq(videos.id, report.targetId));
      if (v) { label = `Video “${v.title}” · ${v.startup}`; href = `/watch/${report.targetId}`; }
    } else if (report.target === "comment") {
      const [c] = await database.select({ body: comments.body, target: comments.target, targetId: comments.targetId, removedAt: comments.removedAt }).from(comments).where(eq(comments.id, report.targetId));
      if (c) { label = `Comment: “${c.body.slice(0, 140)}”${c.removedAt ? " (removed)" : ""}`; href = c.target === "market" ? `/markets/${c.targetId}` : c.target === "video" ? `/watch/${c.targetId}` : null; }
    } else if (report.target === "startup") {
      const [s] = await database.select({ name: startups.name, slug: startups.slug }).from(startups).where(eq(startups.id, report.targetId));
      if (s) { label = `Startup ${s.name}`; href = `/startups/${s.slug}`; }
    } else if (report.target === "founder") {
      const [f] = await database.select({ name: founders.name, handle: founders.handle }).from(founders).where(eq(founders.id, report.targetId));
      if (f) { label = `Founder ${f.name}`; href = `/founders/${f.handle}`; }
    } else {
      const [m] = await database.select({ question: markets.question }).from(markets).where(eq(markets.id, report.targetId));
      if (m) { label = `Market: ${m.question}`; href = `/markets/${report.targetId}`; }
    }
    out.push({ report, reporter: handle, label, href });
  }
  return out;
}

export async function reviewQueueCount<Q extends PgQueryResultHKT>(database: Database<Q>): Promise<number> {
  const counts = await Promise.all([
    database.$count(founders, eq(founders.status, "pending")),
    database.$count(startups, eq(startups.status, "pending")),
    database.$count(videos, eq(videos.status, "pending")),
    database.$count(marketProposals, and(eq(marketProposals.status, "pending"), isNotNull(marketProposals.startupId))),
    database.$count(verificationClaims, and(isNull(verificationClaims.reviewedAt), isNotNull(verificationClaims.submittedBy))),
    database.$count(reports, eq(reports.status, "open")),
  ]);
  return counts.reduce((a, b) => a + b, 0);
}

// --------------------------------------------------------------- decisions

export type Decision = "approve" | "reject" | "suspend";
const decisions: readonly Decision[] = ["approve", "reject", "suspend"];
const statusFor = { approve: "approved", reject: "rejected", suspend: "suspended" } as const;

function checkDecision(decision: unknown, reason: unknown) {
  if (!decisions.includes(decision as Decision)) throw new AdminError("INVALID_INPUT", "Choose approve, reject or suspend.");
  const why = typeof reason === "string" ? reason.trim() : "";
  if (decision !== "approve" && why.length < 3) throw new AdminError("INVALID_INPUT", "Give a reason the member can read (3 or more characters).");
  if (why.length > 1000 || CONTROL.test(why)) throw new AdminError("INVALID_INPUT", "Keep the reason under 1,000 characters.");
  return { decision: decision as Decision, why: why || null };
}

export async function reviewFounder<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, founderId: unknown, decision: unknown, reason: unknown, now = new Date()) {
  await requireOwner(database, ownerId);
  const { decision: d, why } = checkDecision(decision, reason);
  if (!isUuid(founderId)) throw new AdminError("NOT_FOUND", "That founder isn't here.");
  const [row] = await database.update(founders).set({ status: statusFor[d], reviewReason: why, ...(d === "approve" ? { approvedAt: now, approvedBy: ownerId } : {}) })
    .where(eq(founders.id, founderId)).returning();
  if (!row) throw new AdminError("NOT_FOUND", "That founder isn't here.");
  await audit(database, ownerId, d === "approve" ? "approve_founder" : "reject_founder", why, { target: founderId, decision: d }, null, now);
  return row;
}

/** Approving a startup also approves its founders that are still waiting, so the page is complete. */
export async function reviewStartup<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, startupId: unknown, decision: unknown, reason: unknown, now = new Date()) {
  await requireOwner(database, ownerId);
  const { decision: d, why } = checkDecision(decision, reason);
  if (!isUuid(startupId)) throw new AdminError("NOT_FOUND", "That startup isn't here.");
  return database.transaction(async (tx) => {
    const [row] = await tx.update(startups).set({ status: statusFor[d], reviewReason: why, ...(d === "approve" ? { approvedAt: now, approvedBy: ownerId } : {}) })
      .where(eq(startups.id, startupId)).returning();
    if (!row) throw new AdminError("NOT_FOUND", "That startup isn't here.");
    if (d === "approve") {
      const team = await tx.select({ id: startupFounders.founderId }).from(startupFounders).where(eq(startupFounders.startupId, startupId));
      if (team.length) {
        const waiting = await tx.update(founders).set({ status: "approved", approvedAt: now, approvedBy: ownerId })
          .where(and(inArray(founders.id, team.map((t) => t.id)), eq(founders.status, "pending"))).returning({ id: founders.id });
        for (const f of waiting) await audit(tx as unknown as Database<Q>, ownerId, "approve_founder", "Approved with their startup.", { target: f.id, startup: startupId }, null, now);
      }
    }
    await audit(tx as unknown as Database<Q>, ownerId, d === "approve" ? "approve_startup" : "reject_startup", why, { target: startupId, decision: d }, null, now);
    return row;
  });
}

export async function reviewVideo<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, videoId: unknown, decision: unknown, reason: unknown, now = new Date()) {
  await requireOwner(database, ownerId);
  const { decision: d, why } = checkDecision(decision, reason);
  if (!isUuid(videoId)) throw new AdminError("NOT_FOUND", "That video isn't here.");
  const [row] = await database.update(videos).set({ status: statusFor[d], reviewReason: why, ...(d === "approve" ? { publishedAt: now } : {}) })
    .where(eq(videos.id, videoId)).returning();
  if (!row) throw new AdminError("NOT_FOUND", "That video isn't here.");
  await audit(database, ownerId, d === "approve" ? "approve_video" : "reject_video", why, { target: videoId, decision: d }, null, now);
  // A thumbnail the founder uploaded for a video turned down or suspended is deleted (2026-10-22).
  if (d !== "approve" && uploadedImagePath(row.thumbnailUrl) && await removeUploadedImage(row.thumbnailUrl).catch(() => false)) {
    await database.update(videos).set({ thumbnailUrl: null }).where(eq(videos.id, row.id));
    return { ...row, thumbnailUrl: null };
  }
  return row;
}

export async function reviewClaim<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, claimId: unknown, level: unknown, note: unknown, now = new Date()) {
  await requireOwner(database, ownerId);
  if (!isUuid(claimId)) throw new AdminError("NOT_FOUND", "That claim isn't here.");
  if (typeof level !== "string" || !(level in VERIFICATION)) throw new AdminError("INVALID_INPUT", "Pick a verification level.");
  const why = text(note, "Note", 3, 600);
  const [row] = await database.update(verificationClaims).set({ level: level as keyof typeof VERIFICATION, reviewNote: why, reviewedBy: ownerId, reviewedAt: now })
    .where(eq(verificationClaims.id, claimId)).returning();
  if (!row) throw new AdminError("NOT_FOUND", "That claim isn't here.");
  await audit(database, ownerId, "review_claim", why, { target: claimId, level, startup: row.startupId }, row.marketId, now);
  return row;
}

export async function removeComment<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, commentId: unknown, reason: unknown, now = new Date()) {
  await requireOwner(database, ownerId);
  if (!isUuid(commentId)) throw new AdminError("NOT_FOUND", "That comment isn't here.");
  const why = text(reason, "Reason", 3, 600);
  const [row] = await database.update(comments).set({ removedAt: now, removedBy: ownerId, removedReason: why }).where(and(eq(comments.id, commentId), isNull(comments.removedAt))).returning();
  if (!row) throw new AdminError("NOT_FOUND", "That comment isn't here or is already removed.");
  await audit(database, ownerId, "remove_comment", why, { target: commentId, on: row.target, targetId: row.targetId }, row.target === "market" ? row.targetId : null, now);
  return row;
}

/** Closes a report, optionally acting on it: removing the comment or suspending the video. */
export async function resolveReport<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, reportId: unknown, outcome: unknown, note: unknown, act: unknown, now = new Date()) {
  await requireOwner(database, ownerId);
  if (!isUuid(reportId)) throw new AdminError("NOT_FOUND", "That report isn't here.");
  if (outcome !== "resolved" && outcome !== "dismissed") throw new AdminError("INVALID_INPUT", "Resolve or dismiss the report.");
  const why = text(note, "Note", 3, 600);
  const [report] = await database.select().from(reports).where(eq(reports.id, reportId));
  if (!report || report.status !== "open") throw new AdminError("INVALID_STATE", "That report is already closed.");
  if (outcome === "resolved" && act === "remove" && report.target === "comment") await removeComment(database, ownerId, report.targetId, why, now);
  if (outcome === "resolved" && act === "remove" && report.target === "video") await reviewVideo(database, ownerId, report.targetId, "suspend", why, now);
  await database.update(reports).set({ status: outcome, resolvedBy: ownerId, resolvedAt: now, resolution: why }).where(eq(reports.id, reportId));
  await audit(database, ownerId, "resolve_report", why, { target: reportId, outcome, act: act ?? null, about: report.target, aboutId: report.targetId }, null, now);
}

export async function declineSuggestion<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, proposalId: unknown, reason: unknown, now = new Date()) {
  await requireOwner(database, ownerId);
  if (!isUuid(proposalId)) throw new AdminError("NOT_FOUND", "That suggestion isn't here.");
  const why = text(reason, "Reason", 3, 600);
  const [row] = await database.update(marketProposals).set({ status: "rejected", reviewReason: why, reviewedBy: ownerId, reviewedAt: now })
    .where(and(eq(marketProposals.id, proposalId), eq(marketProposals.status, "pending"))).returning();
  if (!row) throw new AdminError("NOT_FOUND", "That suggestion isn't waiting any more.");
  await audit(database, ownerId, "reject", why, { target: proposalId, suggestion: true }, null, now);
  return row;
}

// ------------------------------------------------------------------ markets

export type MarketDraftInput = {
  startupId: unknown; question: unknown; shortQuestion?: unknown; kind: unknown; yesCondition: unknown; noCondition: unknown;
  rules: unknown; sourceName: unknown; sourceMethod: unknown; sourceUrl?: unknown; closesOn: unknown; resultsDueDays?: unknown;
  /** Ignored: every new market opens at 50/50 (2026-10-13). Accepted so an old form cannot break the draft. */
  openingProbabilityBp?: unknown; isDemo?: unknown; proposalId?: unknown;
};

/** Eastern end of day for a calendar date, the way every startup market's deadline is written. */
export function endOfDayEastern(date: string): Date {
  // Pick the offset in force on that day (EDT -4 from March to November, else EST -5).
  const probe = new Date(`${date}T12:00:00Z`);
  const zoned = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).formatToParts(probe).find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const offset = /GMT([+-]\d+)/.exec(zoned)?.[1] ?? "-5";
  const sign = offset.startsWith("-") ? "-" : "+";
  return new Date(`${date}T23:59:59${sign}${String(Math.abs(Number(offset))).padStart(2, "0")}:00`);
}

function draftValues(input: MarketDraftInput, now: Date) {
  if (!isUuid(input.startupId)) throw new AdminError("INVALID_INPUT", "Pick the startup.");
  if (!isMilestone(input.kind)) throw new AdminError("INVALID_INPUT", "Pick what kind of milestone this measures.");
  if (typeof input.closesOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.closesOn)) throw new AdminError("INVALID_INPUT", "Pick the date trading closes.");
  const deadline = endOfDayEastern(input.closesOn);
  if (!(deadline.getTime() > now.getTime() + 3_600_000)) throw new AdminError("INVALID_INPUT", "Trading must close in the future.");
  const days = input.resultsDueDays === undefined || input.resultsDueDays === "" ? 14 : Number(input.resultsDueDays);
  if (!Number.isInteger(days) || days < 1 || days > 120) throw new AdminError("INVALID_INPUT", "Results due: 1 to 120 days after the close.");
  const short = typeof input.shortQuestion === "string" && input.shortQuestion.trim() ? text(input.shortQuestion, "Short title", 10, 70) : null;
  let sourceUrl: string | null = null;
  if (typeof input.sourceUrl === "string" && input.sourceUrl.trim()) {
    try { const url = new URL(input.sourceUrl.trim()); if (url.protocol !== "https:") throw new Error(); sourceUrl = url.toString(); }
    catch { throw new AdminError("INVALID_INPUT", "Source link: use a full https:// link."); }
  }
  return {
    startupId: input.startupId, kind: input.kind as MilestoneKey, question: text(input.question, "Question", 15, 240), shortQuestion: short,
    yesCondition: text(input.yesCondition, "Resolves Yes if", 15, 800), noCondition: text(input.noCondition, "Resolves No if", 10, 800),
    rules: text(input.rules, "Rules", 30, 4000), sourceName: text(input.sourceName, "Source", 3, 160), sourceMethod: text(input.sourceMethod, "How it is measured", 10, 800),
    sourceUrl, deadline, resultsDue: new Date(deadline.getTime() + days * 86_400_000), opening: 5000, isDemo: input.isDemo === true || input.isDemo === "on",
    proposalId: isUuid(input.proposalId) ? input.proposalId : null,
  };
}

/** Saves a market as a draft: nobody else sees it, and every word can change until it opens. */
export async function saveMarketDraft<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, input: MarketDraftInput, marketId: string | null = null, now = new Date()) {
  await requireOwner(database, ownerId);
  const v = draftValues(input, now);
  const [startup] = await database.select({ id: startups.id, status: startups.status }).from(startups).where(eq(startups.id, v.startupId));
  if (!startup || startup.status !== "approved") throw new AdminError("INVALID_INPUT", "Approve the startup before making markets on it.");
  return database.transaction(async (tx) => {
    const values = {
      startupId: v.startupId, milestoneKind: v.kind, question: v.question, shortQuestion: v.shortQuestion, resolutionCriteria: v.rules,
      yesCondition: v.yesCondition, noCondition: v.noCondition, timeZone: "America/New_York", isSample: v.isDemo,
      deadlineAt: v.deadline, evidenceDeadlineAt: v.resultsDue, openingProbabilityBp: v.opening,
    };
    if (marketId) {
      if (!isUuid(marketId)) throw new AdminError("NOT_FOUND", "That draft isn't here.");
      const [current] = await tx.select().from(markets).where(eq(markets.id, marketId)).for("update");
      if (!current || current.status !== "draft") throw new AdminError("INVALID_STATE", "Only drafts can be edited. An open market's wording is frozen.");
      if (current.resolutionSourceId) await tx.update(resolutionSources).set({ name: v.sourceName, method: v.sourceMethod, url: v.sourceUrl }).where(eq(resolutionSources.id, current.resolutionSourceId));
      const [row] = await tx.update(markets).set(values).where(eq(markets.id, marketId)).returning();
      await audit(tx as unknown as Database<Q>, ownerId, "edit_market", "Draft edited before opening.", { question: v.question, yes: v.yesCondition, no: v.noCondition }, marketId, now);
      return row;
    }
    const [source] = await tx.insert(resolutionSources).values({ name: v.sourceName, method: v.sourceMethod, url: v.sourceUrl, operational: false, createdAt: now }).returning();
    const [row] = await tx.insert(markets).values({
      ...values, status: "draft", resolutionSourceId: source.id, liquidityMicro: Math.round(0 * MICRO_PER_UNIT), createdAt: now,
    }).returning();
    if (v.proposalId) await tx.update(marketProposals).set({ marketId: row.id }).where(eq(marketProposals.id, v.proposalId));
    await audit(tx as unknown as Database<Q>, ownerId, "edit_market", "Draft created.", { question: v.question, proposalId: v.proposalId }, row.id, now);
    return row;
  });
}

/** Opens a draft at its opening price: the wording freezes and trading starts. */
export async function openMarket<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, marketId: unknown, now = new Date()) {
  await requireOwner(database, ownerId);
  if (!isUuid(marketId)) throw new AdminError("NOT_FOUND", "That draft isn't here.");
  return database.transaction(async (tx) => {
    const [draft] = await tx.select().from(markets).where(eq(markets.id, marketId)).for("update");
    if (!draft || draft.status !== "draft") throw new AdminError("INVALID_STATE", "Only a draft can be opened.");
    if (!draft.startupId) throw new AdminError("INVALID_STATE", "This draft is missing its startup.");
    if (draft.deadlineAt.getTime() <= now.getTime()) throw new AdminError("INVALID_STATE", "Its close date has passed. Edit the draft first.");
    // Neutral whatever the draft says (2026-10-13): the price moves only through trading.
    const yes = 0, no = 0;
    const [row] = await tx.update(markets).set({
      status: "open", openingProbabilityBp: 5000,
      initialYesSharesMicro: yes, initialNoSharesMicro: no, yesSharesMicro: yes, noSharesMicro: no, approvedAt: now, approvedBy: ownerId,
    }).where(eq(markets.id, marketId)).returning();
    await tx.update(marketProposals).set({ status: "approved", reviewedBy: ownerId, reviewedAt: now }).where(and(eq(marketProposals.marketId, row.id), eq(marketProposals.status, "pending")));
    await audit(tx as unknown as Database<Q>, ownerId, "approve", "Market opened.", {
      question: row.question, yesCondition: row.yesCondition, noCondition: row.noCondition, rules: row.resolutionCriteria,
      deadlineAt: row.deadlineAt.toISOString(), resultsDueAt: row.evidenceDeadlineAt.toISOString(), openingProbabilityBp: row.openingProbabilityBp, isDemo: row.isSample,
    }, row.id, now);
    return row;
  });
}

export async function setPaused<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, marketId: unknown, paused: boolean, reason: unknown, now = new Date()) {
  await requireOwner(database, ownerId);
  if (!isUuid(marketId)) throw new AdminError("NOT_FOUND", "That market isn't here.");
  const why = text(reason, "Reason", 3, 600);
  const [current] = await database.select().from(markets).where(eq(markets.id, marketId));
  if (!current || current.status !== "open") throw new AdminError("INVALID_STATE", "Only an open market can be paused or resumed.");
  if (!!current.pausedAt === paused) throw new AdminError("INVALID_STATE", paused ? "It is already paused." : "It is not paused.");
  await database.update(markets).set(paused ? { pausedAt: now, pausedReason: why } : { pausedAt: null, pausedReason: null }).where(eq(markets.id, marketId));
  await audit(database, ownerId, paused ? "pause" : "resume", why, { target: marketId }, marketId, now);
}

export async function listStartupsForMarkets<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string) {
  await requireOwner(database, ownerId);
  return database.select({ id: startups.id, name: startups.name, isDemo: startups.isDemo }).from(startups).where(eq(startups.status, "approved")).orderBy(asc(startups.name));
}

export async function readDraft<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, marketId: string) {
  await requireOwner(database, ownerId);
  if (!isUuid(marketId)) return null;
  const [row] = await database.select({ market: markets, source: resolutionSources }).from(markets).leftJoin(resolutionSources, eq(resolutionSources.id, markets.resolutionSourceId))
    .where(and(eq(markets.id, marketId), eq(markets.status, "draft")));
  return row ?? null;
}

export async function readSuggestion<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, proposalId: string) {
  await requireOwner(database, ownerId);
  if (!isUuid(proposalId)) return null;
  const [row] = await database.select().from(marketProposals).where(and(eq(marketProposals.id, proposalId), eq(marketProposals.status, "pending")));
  return row ?? null;
}

// -------------------------------------------------------------------- audit

export async function readAudit<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, limit = 150) {
  await requireOwner(database, ownerId);
  return database.select({
    id: adminActions.id, kind: adminActions.kind, reason: adminActions.reason, details: adminActions.details, createdAt: adminActions.createdAt,
    marketId: adminActions.marketId, actor: profiles.handle, question: markets.question,
  }).from(adminActions).leftJoin(profiles, eq(profiles.id, adminActions.actorUserId)).leftJoin(markets, eq(markets.id, adminActions.marketId))
    .orderBy(desc(adminActions.createdAt)).limit(Math.min(500, Math.max(1, limit)));
}

/** Open startup markets with their pause state, for the owner's market list. */
export async function listOpenStartupMarkets<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string) {
  await requireOwner(database, ownerId);
  return database.select({ id: markets.id, question: markets.question, shortQuestion: markets.shortQuestion, deadlineAt: markets.deadlineAt, pausedAt: markets.pausedAt, pausedReason: markets.pausedReason, isSample: markets.isSample, startupName: startups.name })
    .from(markets).innerJoin(startups, eq(startups.id, markets.startupId)).where(eq(markets.status, "open")).orderBy(asc(markets.deadlineAt)).limit(200);
}

