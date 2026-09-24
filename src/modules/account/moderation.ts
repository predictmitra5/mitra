import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { applyOwnerCommand } from "@/modules/market/lifecycle";
import { rejectDraft } from "@/modules/goals/service";
import { isInactive } from "./standing";

/*
 * The owner's people tools, decided 2026-09-24 (DECISIONS.md).
 *
 * A ban locks the person out of everything. Goals about them that still need
 * their proof are cancelled with refunds, because they can no longer send it;
 * their drafts are rejected. A goal already ruled no longer needs their proof,
 * so it finishes and settles normally, as do their bets on other people's goals.
 *
 * Cancelling reuses the owner's own cancel command, so refunds go through the
 * same locked, retry-safe path as any other cancellation. Each goal is its own
 * transaction: if one fails, the ban still stands and running the ban again
 * finishes the rest.
 */

const { profiles, markets, adminActions } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type Clock = () => Date;

export type ModerationErrorCode = "NOT_OWNER" | "NOT_FOUND" | "OWNER_ACCOUNT" | "INVALID_INPUT" | "UNAVAILABLE";

export class ModerationError extends Error {
  constructor(public readonly code: ModerationErrorCode, message: string) {
    super(message);
    this.name = "ModerationError";
  }
}

/** Shown to traders as the cancellation reason on each refunded goal. */
export const BAN_CANCEL_REASON = "The person behind this goal was removed from Mitra, so it cannot be decided. Everyone has been refunded.";
/** Shown to the banned person on their rejected drafts. */
export const BAN_REJECT_REASON = "Removed because this account was banned.";

export interface BanResult {
  /** Goals cancelled with refunds by this run. */
  cancelled: number;
  /** Drafts rejected by this run. */
  rejected: number;
  /** Goals that still need cancelling because one step failed; run the ban again. */
  remaining: number;
}

async function requireOwner<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  if (!isUuid(userId)) throw new ModerationError("NOT_OWNER", "This is not available.");
  const [actor] = await database.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!actor || actor.isOwner !== 1 || isInactive(actor)) throw new ModerationError("NOT_OWNER", "This is not available.");
  return actor;
}

function cleanReason(value: unknown): string {
  const reason = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (reason.length < 3 || reason.length > 500) {
    throw new ModerationError("INVALID_INPUT", "Write a private reason of 3 to 500 characters.");
  }
  return reason;
}

/** Goals about this person that still need their proof: open, or closed and not yet ruled. */
async function goalsToCancel<Q extends PgQueryResultHKT>(database: Database<Q>, subjectUserId: string) {
  return database.select({ id: markets.id, version: markets.rulingVersion }).from(markets)
    .where(and(eq(markets.subjectUserId, subjectUserId), inArray(markets.status, ["open", "closed"]), isNull(markets.ruledOutcome)));
}

export async function banPerson<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  ownerId: string,
  targetId: string,
  reasonInput: string,
  clock: Clock = () => new Date(),
): Promise<BanResult> {
  const reason = cleanReason(reasonInput);
  if (!isUuid(targetId)) throw new ModerationError("NOT_FOUND", "That person was not found.");

  try {
    await database.transaction(async (tx) => {
      const db = tx as unknown as Database<Q>;
      await requireOwner(db, ownerId);
      const [target] = await db.select().from(profiles).where(eq(profiles.id, targetId)).for("update");
      if (!target) throw new ModerationError("NOT_FOUND", "That person was not found.");
      if (target.isOwner === 1) throw new ModerationError("OWNER_ACCOUNT", "The owner account cannot be banned.");
      if (target.bannedAt) return; // Already banned: only the clean-up below runs again.
      const now = clock();
      await db.update(profiles).set({ bannedAt: now, bannedBy: ownerId, banReason: reason }).where(eq(profiles.id, targetId));
      await db.insert(adminActions).values({ actorUserId: ownerId, kind: "ban", reason, details: { targetUserId: targetId }, createdAt: now });
    });
  } catch (error) {
    if (error instanceof ModerationError) throw error;
    throw new ModerationError("UNAVAILABLE", "The ban could not be saved. Please try again.");
  }

  const result: BanResult = { cancelled: 0, rejected: 0, remaining: 0 };

  const drafts = await database.select({ id: markets.id }).from(markets)
    .where(and(eq(markets.subjectUserId, targetId), eq(markets.status, "draft")));
  for (const draft of drafts) {
    try {
      await rejectDraft(database, ownerId, draft.id, BAN_REJECT_REASON, clock());
      result.rejected += 1;
    } catch {
      result.remaining += 1;
    }
  }

  for (const goal of await goalsToCancel(database, targetId)) {
    try {
      await applyOwnerCommand(database, ownerId, {
        marketId: goal.id, requestId: randomUUID(), action: "cancel", reason: BAN_CANCEL_REASON, expectedVersion: goal.version,
      }, clock);
      result.cancelled += 1;
    } catch {
      result.remaining += 1;
    }
  }
  return result;
}

/** Lifts a ban. Goals cancelled by it stay cancelled; refunds are final. */
export async function unbanPerson<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  ownerId: string,
  targetId: string,
  clock: Clock = () => new Date(),
): Promise<void> {
  if (!isUuid(targetId)) throw new ModerationError("NOT_FOUND", "That person was not found.");
  try {
    await database.transaction(async (tx) => {
      const db = tx as unknown as Database<Q>;
      await requireOwner(db, ownerId);
      const [target] = await db.select().from(profiles).where(eq(profiles.id, targetId)).for("update");
      if (!target) throw new ModerationError("NOT_FOUND", "That person was not found.");
      if (!target.bannedAt) return;
      const now = clock();
      await db.update(profiles).set({ bannedAt: null, bannedBy: null, banReason: null }).where(eq(profiles.id, targetId));
      await db.insert(adminActions).values({
        actorUserId: ownerId, kind: "unban", reason: "Ban lifted.",
        details: { targetUserId: targetId, bannedAt: target.bannedAt.toISOString(), banReason: target.banReason }, createdAt: now,
      });
    });
  } catch (error) {
    if (error instanceof ModerationError) throw error;
    throw new ModerationError("UNAVAILABLE", "The ban could not be lifted. Please try again.");
  }
}

export interface Person {
  id: string;
  displayName: string;
  handle: string;
  joinedAt: Date;
  isOwner: boolean;
  photoUpdatedAt: Date | null;
  bannedAt: Date | null;
  banReason: string | null;
  withdrawn: boolean;
  /** Goals about them that are live or waiting: draft, open, closed or ruled. */
  activeGoals: number;
  /** Goals that a ban, or a finished ban, still has to cancel. */
  pendingCancellations: number;
}

/** Everyone with a profile, newest first. Owner only. */
export async function listPeople<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string): Promise<Person[]> {
  await requireOwner(database, ownerId);
  const rows = await database.select().from(profiles).orderBy(sql`${profiles.createdAt} desc`, asc(profiles.handle)).limit(1000);
  const active = await database.select({ subject: markets.subjectUserId, total: count() }).from(markets)
    .where(inArray(markets.status, ["draft", "open", "closed", "ruled"])).groupBy(markets.subjectUserId);
  const pending = await database.select({ subject: markets.subjectUserId, total: count() }).from(markets)
    .where(and(inArray(markets.status, ["open", "closed"]), isNull(markets.ruledOutcome))).groupBy(markets.subjectUserId);
  const activeBy = new Map(active.map((row) => [row.subject, row.total]));
  const pendingBy = new Map(pending.map((row) => [row.subject, row.total]));
  return rows.map((row) => ({
    id: row.id, displayName: row.displayName, handle: row.handle, joinedAt: row.createdAt, isOwner: row.isOwner === 1,
    photoUpdatedAt: row.photoUpdatedAt, bannedAt: row.bannedAt, banReason: row.banReason, withdrawn: !!row.withdrawnAt,
    activeGoals: activeBy.get(row.id) ?? 0,
    pendingCancellations: row.bannedAt ? (pendingBy.get(row.id) ?? 0) : 0,
  }));
}
