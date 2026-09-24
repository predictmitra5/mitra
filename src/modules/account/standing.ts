import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

const { profiles } = schema;

/**
 * Withdrawn or banned: either way the account can no longer act. Every check
 * that once looked only at withdrawal goes through this, so a ban (decided
 * 2026-09-24) cannot be missed by one path.
 */
export function isInactive(profile: { withdrawnAt: Date | null; bannedAt: Date | null }): boolean {
  return profile.withdrawnAt !== null || profile.bannedAt !== null;
}

/** Whether this person is banned. Someone without a profile yet is not. */
export async function isBanned<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>,
  userId: string,
): Promise<boolean> {
  const [profile] = await database.select({ bannedAt: profiles.bannedAt }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return !!profile?.bannedAt;
}
