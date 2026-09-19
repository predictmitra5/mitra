import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { ECONOMY } from "@/modules/market/economy";
import { isUuid } from "@/modules/market/input";
import { calendarMonth, refillDecision, type RefillDecision } from "@/modules/market/refill";

const { profiles, wallets, ledgerEntries } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type Clock = () => Date;

export class RefillError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message); this.name = "RefillError";
  }
}

export interface RefillStatus {
  balanceMicro: number;
  targetMicro: number;
  remaining: number;
  monthlyLimit: number;
  monthLabel: string;
  decision: RefillDecision;
}

export interface RefillReceipt {
  requestId: string;
  amountMicro: number;
  creditedAt: string;
}

function unavailable(error: unknown): never {
  if (error instanceof RefillError) throw error;
  throw new RefillError("UNAVAILABLE", "Your refill could not be confirmed. Retry the same refill safely.");
}

async function activeProfile<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, lock = false) {
  if (!isUuid(userId)) throw new RefillError("PROFILE_REQUIRED", "Sign in and complete your active profile first.");
  const query = database.select().from(profiles).where(eq(profiles.id, userId));
  const [profile] = await (lock ? query.for("share") : query);
  if (!profile || !profile.adultConfirmedAt || profile.withdrawnAt) {
    throw new RefillError("PROFILE_REQUIRED", "Sign in and complete your active profile first.");
  }
}

function validBalance(wallet: typeof wallets.$inferSelect | undefined) {
  if (!wallet || !Number.isSafeInteger(wallet.balanceMicro) || wallet.balanceMicro < 0) {
    throw new RefillError("ACCOUNT_UNAVAILABLE", "Your points need review. Please contact the app owner.");
  }
  return wallet.balanceMicro;
}

async function monthRefills<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, now: Date) {
  const firstDay = `${calendarMonth(now, ECONOMY.refillTimeZone)}-01`;
  // Convert local month boundaries independently: their UTC offsets can differ
  // across daylight-saving changes. The user/date index bounds this query.
  return database.select({ at: ledgerEntries.createdAt }).from(ledgerEntries).where(and(
    eq(ledgerEntries.userId, userId), eq(ledgerEntries.kind, "refill"),
    sql`${ledgerEntries.createdAt} >= (${firstDay}::date::timestamp AT TIME ZONE ${ECONOMY.refillTimeZone})`,
    sql`${ledgerEntries.createdAt} < ((${firstDay}::date + interval '1 month') AT TIME ZONE ${ECONOMY.refillTimeZone})`,
  ));
}

function status(balanceMicro: number, previousRefillsAt: Date[], now: Date): RefillStatus {
  return {
    balanceMicro, targetMicro: ECONOMY.startingBalanceMicro, monthlyLimit: ECONOMY.refillsPerMonth,
    remaining: Math.max(0, ECONOMY.refillsPerMonth - previousRefillsAt.length),
    monthLabel: new Intl.DateTimeFormat("en-US", { timeZone: ECONOMY.refillTimeZone, month: "long", year: "numeric" }).format(now),
    decision: refillDecision({ balanceMicro, previousRefillsAt, now, settings: ECONOMY }),
  };
}

/** Private account snapshot. The caller must verify the current OSU identity. */
export async function readRefillStatus<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, clock: Clock = () => new Date()): Promise<RefillStatus> {
  try {
    return await database.transaction(async (transaction) => {
      const tx = transaction as unknown as Database<Q>;
      await activeProfile(tx, userId);
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId));
      const balanceMicro = validBalance(wallet), now = clock();
      const refills = await monthRefills(tx, userId, now);
      return status(balanceMicro, refills.map((row) => row.at), now);
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  } catch (error) { unavailable(error); }
}

/**
 * userId comes from the verified server identity. No client amount or month is
 * accepted. The wallet lock serializes with buys, sells, payouts and refunds.
 * Never acquire market locks here: market writers already lock market -> wallet.
 */
export async function claimRefill<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, requestId: string, clock: Clock = () => new Date()): Promise<RefillReceipt> {
  if (!isUuid(requestId)) throw new RefillError("INVALID_REQUEST", "Reload your account before requesting a refill.");
  requestId = requestId.toLowerCase();
  userId = typeof userId === "string" ? userId.toLowerCase() : userId;
  try {
    return await database.transaction(async (transaction) => {
      const tx = transaction as unknown as Database<Q>;
      await activeProfile(tx, userId, true);
      // Global to the request UUID, including deliberate reuse by another user.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`refill:${requestId}`}, 0))`);
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for("update");
      const balanceMicro = validBalance(wallet);
      const [previous] = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.id, requestId));
      if (previous) {
        if (previous.userId !== userId || previous.kind !== "refill") {
          throw new RefillError("REQUEST_CONFLICT", "This refill request cannot be used. Reload your account and try again.");
        }
        return { requestId, amountMicro: previous.amountMicro, creditedAt: previous.createdAt.toISOString() };
      }
      // Read both the clock and quota after waiting for every lock.
      const now = clock();
      const refills = await monthRefills(tx, userId, now);
      const decision = status(balanceMicro, refills.map((row) => row.at), now).decision;
      if (!decision.eligible) {
        throw new RefillError(decision.reason, decision.reason === "BALANCE_NOT_BELOW_START"
          ? "A refill is available when your cash is below 1,000 points."
          : "You have used both refills this month. Refills reset at midnight Eastern time on the first of each month.");
      }
      await tx.update(wallets).set({ balanceMicro: balanceMicro + decision.amountMicro, updatedAt: now }).where(eq(wallets.userId, userId));
      await tx.insert(ledgerEntries).values({
        id: requestId, userId, kind: "refill", amountMicro: decision.amountMicro,
        memo: "Claimed cash refill", createdAt: now,
      });
      return { requestId, amountMicro: decision.amountMicro, creditedAt: now.toISOString() };
    }, { isolationLevel: "read committed" });
  } catch (error) { unavailable(error); }
}
