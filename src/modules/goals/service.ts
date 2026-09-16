import { asc, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { ECONOMY } from "@/modules/market/economy";
import { stateAtProbability } from "@/modules/market/lmsr";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { buildGoalDraft, GoalInputError, type GoalInput } from "./templates";

const { profiles, markets, adminActions, priceHistory } = schema;

type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export type GoalErrorCode =
  | "INVALID_INPUT"
  | "PROFILE_REQUIRED"
  | "NOT_OWNER"
  | "NOT_FOUND"
  | "NOT_A_DRAFT"
  | "DEADLINE_PASSED"
  | "SUBJECT_WITHDRAWN"
  | "UNAVAILABLE";

/** Safe to show to users; database errors never become UI text. */
export class GoalError extends Error {
  constructor(public readonly code: GoalErrorCode, message: string) {
    super(message);
    this.name = "GoalError";
  }
}

/** Opening prices are whole percentages from 1% to 99%, stored as basis points. */
export const MIN_OPENING_BP = 100;
export const MAX_OPENING_BP = 9900;

/**
 * Creates a draft market about the signed-in subject. `subjectUserId` must be the
 * server-verified identity, never a form field. Pricing stays empty until the
 * owner approves the draft and sets the opening price.
 */
export async function createGoalDraft<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  subjectUserId: string,
  input: GoalInput,
  now: Date = new Date(),
) {
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, subjectUserId)).limit(1);
  if (!profile || profile.withdrawnAt || !profile.adultConfirmedAt) {
    throw new GoalError("PROFILE_REQUIRED", "Finish setting up your profile before creating a goal.");
  }

  let draft;
  try {
    draft = buildGoalDraft(profile.displayName, input, now);
  } catch (error) {
    if (error instanceof GoalInputError) throw new GoalError("INVALID_INPUT", error.message);
    throw error;
  }

  const [market] = await database.insert(markets).values({
    subjectUserId,
    status: "draft",
    question: draft.question,
    resolutionCriteria: draft.resolutionCriteria,
    goalType: draft.goalType,
    deadlineAt: draft.deadlineAt,
    evidenceDeadlineAt: draft.evidenceDeadlineAt,
    liquidityMicro: Math.round(ECONOMY.defaultLiquidity * MICRO_PER_UNIT),
    createdAt: now,
  }).returning();
  return market;
}

/** Drafts waiting for the owner, oldest first. Owner only. */
export async function listPendingDrafts<Q extends PgQueryResultHKT>(database: Database<Q>, actorUserId: string) {
  await requireOwner(database, actorUserId);
  return database
    .select({ market: markets, subject: { handle: profiles.handle, displayName: profiles.displayName } })
    .from(markets)
    .innerJoin(profiles, eq(profiles.id, markets.subjectUserId))
    .where(eq(markets.status, "draft"))
    .orderBy(asc(markets.createdAt));
}

/** A subject's own goals, newest first, for their account page. */
export async function listGoalsForSubject<Q extends PgQueryResultHKT>(database: Database<Q>, subjectUserId: string) {
  return database.select().from(markets).where(eq(markets.subjectUserId, subjectUserId)).orderBy(desc(markets.createdAt));
}

/**
 * Opens a draft at the owner's opening price. Writes the market-maker state, the
 * first price point and the owner's decision in one transaction.
 */
export async function approveDraft<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  actorUserId: string,
  marketId: string,
  openingProbabilityBp: number,
  note: string | null,
  now: Date = new Date(),
) {
  if (!Number.isInteger(openingProbabilityBp) || openingProbabilityBp < MIN_OPENING_BP || openingProbabilityBp > MAX_OPENING_BP) {
    throw new GoalError("INVALID_INPUT", "Set an opening price between 1% and 99%.");
  }
  const reason = optionalNote(note);

  return runInTransaction(database, async (tx) => {
    await requireOwner(tx, actorUserId);
    const market = await lockDraft(tx, marketId);
    if (market.deadlineAt.getTime() <= now.getTime()) {
      throw new GoalError("DEADLINE_PASSED", "This goal's deadline has already passed. Reject it instead.");
    }
    const [subject] = await tx.select().from(profiles).where(eq(profiles.id, market.subjectUserId)).limit(1);
    if (!subject || subject.withdrawnAt) {
      throw new GoalError("SUBJECT_WITHDRAWN", "The person behind this goal has left the app.");
    }

    const lmsr = stateAtProbability(market.liquidityMicro / MICRO_PER_UNIT, openingProbabilityBp / 10_000);
    const initialYesSharesMicro = Math.round(lmsr.yesShares * MICRO_PER_UNIT);
    const initialNoSharesMicro = Math.round(lmsr.noShares * MICRO_PER_UNIT);

    const [opened] = await tx.update(markets).set({
      status: "open",
      openingProbabilityBp,
      initialYesSharesMicro,
      initialNoSharesMicro,
      yesSharesMicro: initialYesSharesMicro,
      noSharesMicro: initialNoSharesMicro,
      approvedAt: now,
      approvedBy: actorUserId,
    }).where(eq(markets.id, marketId)).returning();

    await tx.insert(priceHistory).values({ marketId, yesPriceBp: openingProbabilityBp, recordedAt: now });
    await tx.insert(adminActions).values({
      marketId,
      actorUserId,
      kind: "approve",
      reason,
      details: decisionContext(market, { openingProbabilityBp }),
      createdAt: now,
    });
    return opened;
  });
}

/** Rejects a draft with a reason the subject can read. */
export async function rejectDraft<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  actorUserId: string,
  marketId: string,
  reasonInput: string,
  now: Date = new Date(),
) {
  const reason = typeof reasonInput === "string" ? reasonInput.replace(/\s+/g, " ").trim() : "";
  if (reason.length < 3 || reason.length > 500) {
    throw new GoalError("INVALID_INPUT", "Give a reason of 3 to 500 characters so the person knows what to fix.");
  }

  return runInTransaction(database, async (tx) => {
    await requireOwner(tx, actorUserId);
    const market = await lockDraft(tx, marketId);
    const [rejected] = await tx.update(markets).set({ status: "rejected" }).where(eq(markets.id, marketId)).returning();
    await tx.insert(adminActions).values({
      marketId,
      actorUserId,
      kind: "reject",
      reason,
      details: decisionContext(market, {}),
      createdAt: now,
    });
    return rejected;
  });
}

async function requireOwner<Q extends PgQueryResultHKT>(database: Database<Q>, actorUserId: string) {
  const [actor] = await database.select().from(profiles).where(eq(profiles.id, actorUserId)).limit(1);
  if (!actor || actor.isOwner !== 1 || actor.withdrawnAt) {
    throw new GoalError("NOT_OWNER", "Only the app owner can review goals.");
  }
  return actor;
}

async function lockDraft<Q extends PgQueryResultHKT>(database: Database<Q>, marketId: string) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(marketId)) {
    throw new GoalError("NOT_FOUND", "That goal no longer exists.");
  }
  const [market] = await database.select().from(markets).where(eq(markets.id, marketId)).for("update");
  if (!market) throw new GoalError("NOT_FOUND", "That goal no longer exists.");
  if (market.status !== "draft") {
    throw new GoalError("NOT_A_DRAFT", "This goal has already been reviewed.");
  }
  return market;
}

/** What the owner saw when deciding: the record a future AI reviewer would learn from. */
function decisionContext(market: typeof markets.$inferSelect, extra: Record<string, unknown>) {
  return {
    question: market.question,
    resolutionCriteria: market.resolutionCriteria,
    goalType: market.goalType,
    deadlineAt: market.deadlineAt.toISOString(),
    draftCreatedAt: market.createdAt.toISOString(),
    ...extra,
  };
}

function optionalNote(note: string | null): string | null {
  if (note === null || note === undefined) return null;
  const text = String(note).replace(/\s+/g, " ").trim();
  if (text.length === 0) return null;
  if (text.length > 500) throw new GoalError("INVALID_INPUT", "Keep the note under 500 characters.");
  return text;
}

async function runInTransaction<Q extends PgQueryResultHKT, T>(
  database: Database<Q>,
  work: (tx: Database<Q>) => Promise<T>,
): Promise<T> {
  try {
    return await database.transaction((tx) => work(tx as unknown as Database<Q>), { isolationLevel: "read committed" });
  } catch (error) {
    if (error instanceof GoalError) throw error;
    throw new GoalError("UNAVAILABLE", "Goal review is temporarily unavailable. Please try again.");
  }
}
