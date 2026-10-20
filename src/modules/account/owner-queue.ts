import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { reviewQueueCount } from "@/modules/startups/admin";
import { isInactive } from "./standing";

const { profiles } = schema;

/**
 * What is waiting for the owner (2026-10-19): founders, startups and videos to
 * approve, market suggestions, claims to verify and open reports.
 * Null for anyone else, so the top bar shows the owner link to the owner alone.
 * Nothing notifies the owner otherwise (decided 2026-09-24: no email or push).
 */
export async function ownerQueue<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>,
  userId: string,
): Promise<number | null> {
  if (!isUuid(userId)) return null;
  const [me] = await database.select({ isOwner: profiles.isOwner, withdrawnAt: profiles.withdrawnAt, bannedAt: profiles.bannedAt })
    .from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!me || me.isOwner !== 1 || isInactive(me)) return null;
  return reviewQueueCount(database);
}

/** For pages: never let the badge take a page down. */
export async function ownerQueueOrNull<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>,
  userId: string | undefined | null,
): Promise<number | null> {
  if (!userId) return null;
  try {
    return await ownerQueue(database, userId);
  } catch {
    return null;
  }
}
