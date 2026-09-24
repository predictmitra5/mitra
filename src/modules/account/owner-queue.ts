import { count, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { isInactive } from "./standing";

const { profiles, markets, evidence } = schema;

/**
 * What is waiting for the owner: goals to approve and proof to read. Null for
 * anyone else, so the top bar shows the owner link to the owner alone. Nothing
 * notifies the owner otherwise (decided 2026-09-24: no email or push).
 */
export async function ownerQueue<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>,
  userId: string,
): Promise<number | null> {
  if (!isUuid(userId)) return null;
  const [me] = await database.select({ isOwner: profiles.isOwner, withdrawnAt: profiles.withdrawnAt, bannedAt: profiles.bannedAt })
    .from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!me || me.isOwner !== 1 || isInactive(me)) return null;
  const [drafts] = await database.select({ n: count() }).from(markets).where(eq(markets.status, "draft"));
  const [proof] = await database.select({ n: count() }).from(evidence).where(eq(evidence.status, "submitted"));
  return Number(drafts.n) + Number(proof.n);
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
