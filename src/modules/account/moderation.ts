import { and, asc, count, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { declineSuggestion } from "@/modules/startups/admin";
import { isInactive } from "./standing";

/** Bans remove write access and reject pending startup suggestions; financial history is preserved. */

const { profiles, adminActions, marketProposals } = schema;
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
/** Shown to the banned person on their turned-down suggestions. */
export const BAN_REJECT_REASON = "Removed because this account was banned.";

export interface BanResult {
  /** Retired goal markets cancelled with refunds by this run. */
  cancelled: number;
  /** Suggestions turned down by this run. */
  rejected: number;
  /** Steps that still need doing because one failed; run the ban again. */
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

  const waiting = await database.select({ id: marketProposals.id }).from(marketProposals)
    .where(and(eq(marketProposals.proposerUserId, targetId), eq(marketProposals.status, "pending")));
  for (const proposal of waiting) {
    try {
      await declineSuggestion(database, ownerId, proposal.id, BAN_REJECT_REASON, clock());
      result.rejected += 1;
    } catch {
      result.remaining += 1;
    }
  }

  return result;
}

/** Lifts a ban. Anything cancelled or turned down by it stays that way; refunds are final. */
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
  /** Their market suggestions waiting for review. */
  pendingSuggestions: number;
  /** Retired goal markets that a ban still has to cancel. */
  pendingCancellations: number;
}

/** Everyone with a profile, newest first. Owner only. */
export async function listPeople<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string): Promise<Person[]> {
  await requireOwner(database, ownerId);
  const rows = await database.select().from(profiles).orderBy(sql`${profiles.createdAt} desc`, asc(profiles.handle)).limit(1000);
  const suggestions = await database.select({ proposer: marketProposals.proposerUserId, total: count() }).from(marketProposals)
    .where(eq(marketProposals.status, "pending")).groupBy(marketProposals.proposerUserId);
  const suggestionsBy = new Map(suggestions.map((row) => [row.proposer, row.total]));
  return rows.map((row) => ({
    id: row.id, displayName: row.displayName, handle: row.handle, joinedAt: row.createdAt, isOwner: row.isOwner === 1,
    photoUpdatedAt: row.photoUpdatedAt, bannedAt: row.bannedAt, banReason: row.banReason, withdrawn: !!row.withdrawnAt,
    pendingSuggestions: suggestionsBy.get(row.id) ?? 0,
    pendingCancellations: 0,
  }));
}
