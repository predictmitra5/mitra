import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { ownerQueue } from "./owner-queue";
import { photoUrl } from "./photo-url";
import { isInactive } from "./standing";

const { profiles, wallets } = schema;

/**
 * What the top bar shows a signed-in person about themselves (2026-09-24): their
 * available points, their photo, and, for the owner alone, how much is waiting.
 * Read only for the freshly verified identity; never for anyone else.
 */
export type Viewer = {
  /** Null until profile setup is complete. */
  displayName: string | null;
  photo: string | null;
  /** Available cash, in micro-points; null without a wallet. */
  balanceMicro: number | null;
  /** Goals and proof waiting for the owner; null for everyone else. */
  ownerQueue: number | null;
};

export async function readViewer<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>,
  userId: string,
): Promise<Viewer> {
  const empty: Viewer = { displayName: null, photo: null, balanceMicro: null, ownerQueue: null };
  if (!isUuid(userId)) return empty;
  const [row] = await database.select({ profile: profiles, balanceMicro: wallets.balanceMicro })
    .from(profiles).leftJoin(wallets, eq(wallets.userId, profiles.id))
    .where(eq(profiles.id, userId)).limit(1);
  if (!row || !row.profile.adultConfirmedAt || isInactive(row.profile)) return empty;
  return {
    displayName: row.profile.displayName,
    photo: photoUrl(row.profile.handle, row.profile.photoUpdatedAt),
    balanceMicro: row.balanceMicro ?? null,
    ownerQueue: await ownerQueue(database, userId),
  };
}

/**
 * For pages: null when signed out, and never let the top bar take a page down.
 * A signed-in person whose details cannot load still gets a signed-in bar.
 */
export async function readViewerOrNull<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>,
  userId: string | undefined | null,
): Promise<Viewer | null> {
  if (!userId) return null;
  try {
    return await readViewer(database, userId);
  } catch {
    return { displayName: null, photo: null, balanceMicro: null, ownerQueue: null };
  }
}
