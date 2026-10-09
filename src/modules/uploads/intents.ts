import { and, count, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

const { uploadIntents } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export const UPLOAD_INTENT_TTL_HOURS = 48;
const MAX_PENDING_PHOTOS = 2;
const MAX_PENDING_EVIDENCE_PER_USER = 5;
const MAX_PENDING_EVIDENCE_PER_MARKET = 10;

export type UploadIntent = {
  id: string;
  userId: string;
  marketId: string | null;
  kind: "photo" | "evidence";
  objectPath: string;
  createdAt: Date;
  expiresAt: Date;
  cleaningAt: Date | null;
};

/** Serialize reservations per person so parallel starts cannot bypass quotas. */
export async function reserveUploadIntent<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  input: { id: string; userId: string; marketId?: string; marketUsed?: number; kind: UploadIntent["kind"]; objectPath: string },
  now: Date,
): Promise<boolean> {
  return database.transaction(async (tx) => {
    const db = tx as unknown as Database<Q>;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`upload-intents:${input.userId}`}, 0))`);
    const pending = and(gt(uploadIntents.expiresAt, now), isNull(uploadIntents.cleaningAt));
    const userCount = await db.select({ total: count() }).from(uploadIntents)
      .where(and(eq(uploadIntents.userId, input.userId), eq(uploadIntents.kind, input.kind), pending));
    const limit = input.kind === "photo" ? MAX_PENDING_PHOTOS : MAX_PENDING_EVIDENCE_PER_USER;
    if (Number(userCount[0]?.total ?? 0) >= limit) return false;

    if (input.kind === "evidence" && input.marketId) {
      if ((input.marketUsed ?? 0) >= MAX_PENDING_EVIDENCE_PER_MARKET) return false;
      const marketCount = await db.select({ total: count() }).from(uploadIntents)
        .where(and(eq(uploadIntents.marketId, input.marketId), eq(uploadIntents.kind, "evidence"), pending));
      if ((input.marketUsed ?? 0) + Number(marketCount[0]?.total ?? 0) >= MAX_PENDING_EVIDENCE_PER_MARKET) return false;
    }

    const expiresAt = new Date(now.getTime() + UPLOAD_INTENT_TTL_HOURS * 3_600_000);
    await db.insert(uploadIntents).values({
      id: input.id,
      userId: input.userId,
      marketId: input.marketId ?? null,
      kind: input.kind,
      objectPath: input.objectPath,
      createdAt: now,
      expiresAt,
    });
    return true;
  });
}

export async function releaseUploadIntent<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  input: { id: string; userId: string; kind: UploadIntent["kind"] },
) {
  await database.delete(uploadIntents).where(and(
    eq(uploadIntents.id, input.id), eq(uploadIntents.userId, input.userId), eq(uploadIntents.kind, input.kind),
  ));
}

/** Lock and mark expired reservations before storage deletion, so finish cannot race the sweep. */
export async function claimExpiredUploadIntents<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now: Date,
  limit = 100,
): Promise<UploadIntent[]> {
  return database.transaction(async (tx) => {
    const db = tx as unknown as Database<Q>;
    const rows = await db.select().from(uploadIntents)
      .where(lte(uploadIntents.expiresAt, now))
      .orderBy(uploadIntents.expiresAt)
      .limit(limit)
      .for("update", { skipLocked: true });
    if (!rows.length) return [];
    await db.update(uploadIntents).set({ cleaningAt: now })
      .where(and(inArray(uploadIntents.id, rows.map((row) => row.id)), lte(uploadIntents.expiresAt, now), isNull(uploadIntents.cleaningAt)));
    return rows;
  });
}
