import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { readExchange } from "@/modules/exchange/store";
import { funds } from "@/modules/exchange/engine";
import type { UploadIntentKind } from "@/modules/uploads/intents";

const {
  profiles, adminActions, evidence, uploadIntents, marketProposals,
  founders, startups, videos, videoEvents, videoLikes, videoSaves, founderFollows, startupFollows, viewerInterests,
} = schema;
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
  uploadPaths: { kind: UploadIntentKind; path: string }[];
};

/** External object deletion is injected so the database behavior can be tested independently. */
export type WithdrawalStorage = {
  remove: (userId: string, objects: WithdrawalObjects) => Promise<void>;
};

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
    // Suggestions are private to their author and the owner (2026-10-08). Ones
    // never published go; a published one is the public market's history and
    // stays, pointing at the anonymized profile.
    await db.delete(marketProposals)
      .where(and(eq(marketProposals.proposerUserId, userId), inArray(marketProposals.status, ["pending", "rejected"])));
    // Founder content (2026-10-19): the member's founder profile leaves every
    // page, and anything they submitted that was never approved goes with it.
    // An approved startup is company information with markets other people
    // hold, so it stays until the owner decides; it is no longer theirs to manage.
    await db.update(founders).set({ status: "suspended", reviewReason: "The member deleted their account.", userId: null, portraitUrl: null })
      .where(eq(founders.userId, userId));
    await db.update(startups).set({ status: "suspended", reviewReason: "The member deleted their account." })
      .where(and(eq(startups.createdBy, userId), inArray(startups.status, ["pending", "rejected"])));
    await db.update(startups).set({ createdBy: null }).where(eq(startups.createdBy, userId));
    await db.update(videos).set({ status: "suspended", reviewReason: "The member deleted their account." })
      .where(and(eq(videos.uploadedBy, userId), inArray(videos.status, ["pending", "rejected"])));
    // What they liked, saved, followed and watched is personal; counts of
    // views stay, without anything tying them to the person.
    await db.delete(videoLikes).where(eq(videoLikes.userId, userId));
    await db.delete(videoSaves).where(eq(videoSaves.userId, userId));
    await db.delete(founderFollows).where(eq(founderFollows.userId, userId));
    await db.delete(startupFollows).where(eq(startupFollows.userId, userId));
    await db.delete(viewerInterests).where(eq(viewerInterests.viewerKey, `u:${userId}`));
    await db.update(videoEvents).set({ userId: null, viewerKey: "deleted" }).where(eq(videoEvents.userId, userId));
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
  const exchange=await readExchange(database),cash=funds(exchange,userId);
  if(cash.available||cash.reserved||exchange.orders.some(o=>o.userId===userId&&o.status==="open")||exchange.holdings.some(p=>p.userId===userId&&p.available+p.reserved>0))throw new WithdrawalError("NOT_ALLOWED","Close orders, resolve positions and withdraw funds before deleting this account.");
  try {
    const profile = await beginWithdrawal(database, userId, now);
    if (!profile) return; // Auth-only account: the caller still removes the identity.

    const objects = await objectsFor(database, userId);
    await storage.remove(userId, objects);
    await finishWithdrawal(database, userId, now);
  } catch (error) {
    if (error instanceof WithdrawalError) throw error;
    throw new WithdrawalError("UNAVAILABLE", "Your account could not be deleted completely. Please try again.");
  }
}
