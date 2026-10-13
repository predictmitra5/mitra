import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { ECONOMY } from "@/modules/market/economy";

/**
 * Posting a goal requires a profile photo (decided 2026-09-24). Tests about
 * other things give their fictional accounts one, so goal creation works.
 * The path points at nothing: no test here reads the image itself.
 */
export async function withFixturePhoto<Q extends PgQueryResultHKT>(database: PgDatabase<Q, typeof schema>, userId: string) {
  await database.update(schema.profiles)
    .set({ photoPath: `${userId}/fixture.webp`, photoUpdatedAt: new Date("2026-09-01T12:00:00Z") })
    .where(eq(schema.profiles.id, userId));
}

/** Fund a fictional market-service test account; production onboarding starts at zero. */
export async function withFixtureGold<Q extends PgQueryResultHKT>(database: PgDatabase<Q, typeof schema>, userId: string) {
  await database.transaction(async (tx) => {
    await tx.update(schema.wallets).set({ balanceMicro: ECONOMY.startingBalanceMicro })
      .where(eq(schema.wallets.userId, userId));
    await tx.insert(schema.ledgerEntries).values({
      userId, kind: "signup_grant", amountMicro: ECONOMY.startingBalanceMicro,
      memo: "Test fixture only", createdAt: new Date("2026-09-01T12:00:00Z"),
    });
  });
}
