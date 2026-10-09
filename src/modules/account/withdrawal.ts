import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { EMPTY_POSITION } from "@/modules/market/position";

const { profiles, markets, positions, wallets, ledgerEntries, adminActions, evidence, uploadIntents } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type Clock = () => Date;

export const WITHDRAWAL_CANCEL_REASON = "The person behind this goal deleted their Mitra account. Everyone has been refunded.";

export class WithdrawalError extends Error {
  constructor(public readonly code: "NOT_ALLOWED" | "OWNER_ACCOUNT" | "CLEANUP_REQUIRED" | "UNAVAILABLE", message: string) {
    super(message);
    this.name = "WithdrawalError";
  }
}

export type WithdrawalObjects = {
  photoPath: string | null;
  evidencePaths: string[];
  uploadPaths: { kind: "photo" | "evidence"; path: string }[];
};

/** External object deletion is injected so the database behavior can be tested independently. */
export type WithdrawalStorage = {
  remove: (userId: string, objects: WithdrawalObjects) => Promise<void>;
};

function safeAmount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new WithdrawalError("UNAVAILABLE", "Account balances need review before this account can be deleted.");
  }
  return value;
}

async function beginWithdrawal<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, now: Date) {
  return database.transaction(async (tx) => {
    const db = tx as unknown as Database<Q>;
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`withdraw:${userId}`}, 0))`);
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!profile) return null;
    if (profile.isOwner === 1) {
      throw new WithdrawalError("OWNER_ACCOUNT", "The owner account cannot be deleted until ownership is transferred.");
    }
    if (!profile.withdrawnAt) {
      await db.update(profiles).set({ withdrawnAt: now }).where(eq(profiles.id, userId));
      await db.insert(adminActions).values({
        actorUserId: userId,
        kind: "withdraw_account",
        reason: "Account deletion requested by the signed-in person.",
        details: { targetUserId: userId },
        createdAt: now,
      });
    }
    return profile;
  });
}

/** Cancels one not-yet-ruled goal and refunds every held position at cost. */
async function cancelGoal<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, marketId: string, now: Date) {
  return database.transaction(async (tx) => {
    const db = tx as unknown as Database<Q>;
    const [profile] = await db.select({ withdrawnAt: profiles.withdrawnAt }).from(profiles)
      .where(eq(profiles.id, userId)).for("share");
    if (!profile?.withdrawnAt) throw new WithdrawalError("NOT_ALLOWED", "This account cannot be deleted.");
    const [market] = await db.select().from(markets).where(eq(markets.id, marketId)).for("update");
    if (!market || market.subjectUserId !== userId || !["draft", "open", "closed"].includes(market.status)) return false;

    const held = await db.select().from(positions).where(eq(positions.marketId, market.id)).orderBy(asc(positions.userId));
    const accountRows = held.length
      ? await db.select().from(wallets).where(inArray(wallets.userId, held.map((position) => position.userId)))
        .orderBy(asc(wallets.userId)).for("update")
      : [];
    const balances = new Map(accountRows.map((wallet) => [wallet.userId, wallet.balanceMicro]));
    let totalMicro = 0;
    for (const position of held) {
      const balance = balances.get(position.userId);
      if (balance === undefined) throw new WithdrawalError("UNAVAILABLE", "A participant balance needs review before this account can be deleted.");
      const credit = safeAmount(position.yesCostBasisMicro + position.noCostBasisMicro);
      const balanceMicro = safeAmount(safeAmount(balance) + credit);
      totalMicro = safeAmount(totalMicro + credit);
      await db.update(wallets).set({ balanceMicro, updatedAt: now }).where(eq(wallets.userId, position.userId));
      await db.insert(ledgerEntries).values({
        userId: position.userId,
        marketId: market.id,
        kind: "cancellation_refund",
        amountMicro: credit,
        createdAt: now,
        memo: "Held-cost refund",
      });
    }
    if (held.length) await db.update(positions).set({ ...EMPTY_POSITION, updatedAt: now }).where(eq(positions.marketId, market.id));
    await db.update(markets).set({
      status: "cancelled",
      cancelledAt: now,
      cancelReason: WITHDRAWAL_CANCEL_REASON,
      tradingClosedAt: market.tradingClosedAt ?? (market.status === "open" ? now : null),
    }).where(eq(markets.id, market.id));
    await db.insert(adminActions).values({
      marketId: market.id,
      actorUserId: userId,
      kind: "cancel",
      reason: WITHDRAWAL_CANCEL_REASON,
      details: { participants: held.length, totalMicro, accountWithdrawal: true },
      createdAt: now,
    });
    return true;
  });
}

async function cancelGoals<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, now: Date) {
  const pending = await database.select({ id: markets.id }).from(markets)
    .where(and(eq(markets.subjectUserId, userId), inArray(markets.status, ["draft", "open", "closed"])));
  let failed = 0;
  for (const market of pending) {
    try { await cancelGoal(database, userId, market.id, now); }
    catch { failed += 1; }
  }
  if (failed) throw new WithdrawalError("CLEANUP_REQUIRED", "Some goals still need to be refunded. Please retry account deletion.");
}

async function objectsFor<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string): Promise<WithdrawalObjects> {
  const [profile] = await database.select({ photoPath: profiles.photoPath }).from(profiles).where(eq(profiles.id, userId));
  const files = await database.select({ path: evidence.originalPath }).from(evidence)
    .where(and(eq(evidence.submittedBy, userId), isNotNull(evidence.originalPath)));
  const pending = await database.select({ kind: uploadIntents.kind, path: uploadIntents.objectPath }).from(uploadIntents)
    .where(eq(uploadIntents.userId, userId));
  return {
    photoPath: profile?.photoPath ?? null,
    evidencePaths: files.flatMap((row) => row.path ? [row.path] : []),
    uploadPaths: pending,
  };
}

async function finishWithdrawal<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, now: Date) {
  await database.transaction(async (tx) => {
    const db = tx as unknown as Database<Q>;
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`withdraw:${userId}`}, 0))`);
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!profile?.withdrawnAt) throw new WithdrawalError("NOT_ALLOWED", "This account cannot be deleted.");
    await db.update(evidence).set({
      originalPath: null,
      originalContentType: null,
      originalBytes: null,
      linkUrl: null,
      verifiedStatement: null,
      caption: null,
      reviewNote: null,
      removedAt: now,
    }).where(eq(evidence.submittedBy, userId));
    await db.delete(uploadIntents).where(eq(uploadIntents.userId, userId));
    await db.update(profiles).set({
      handle: `deleted_${userId.replaceAll("-", "").slice(0, 12)}`,
      displayName: "Deleted member",
      adultConfirmedAt: null,
      photoPath: null,
      photoUpdatedAt: null,
      bannedAt: null,
      bannedBy: null,
      banReason: null,
    }).where(eq(profiles.id, userId));
  });
}

/**
 * Withdraws the application account. Historical trades and ledger entries stay
 * for accounting; personal profile fields and proof content are removed.
 */
export async function withdrawAccount<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  storage: WithdrawalStorage,
  clock: Clock = () => new Date(),
): Promise<void> {
  if (!isUuid(userId)) throw new WithdrawalError("NOT_ALLOWED", "This account cannot be deleted.");
  const now = clock();
  try {
    const profile = await beginWithdrawal(database, userId, now);
    if (!profile) return; // Auth-only account: the caller still removes the identity.
    await cancelGoals(database, userId, now);
    const objects = await objectsFor(database, userId);
    await storage.remove(userId, objects);
    await finishWithdrawal(database, userId, now);
  } catch (error) {
    if (error instanceof WithdrawalError) throw error;
    throw new WithdrawalError("UNAVAILABLE", "Your account could not be deleted completely. Please try again.");
  }
}
