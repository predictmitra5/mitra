import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { ECONOMY } from "@/modules/market/economy";

const { profiles, wallets, ledgerEntries } = schema;

export type AccountErrorCode =
  | "INVALID_IDENTITY"
  | "INVALID_PROFILE"
  | "ADULT_CONFIRMATION_REQUIRED"
  | "HANDLE_TAKEN"
  | "ACCOUNT_WITHDRAWN"
  | "ACCOUNT_BANNED"
  | "ACCOUNT_INCONSISTENT"
  | "ACCOUNT_UNAVAILABLE";

/** Safe to display; database errors and their parameters never become UI text. */
export class AccountError extends Error {
  constructor(public readonly code: AccountErrorCode, message: string) {
    super(message);
    this.name = "AccountError";
  }
}

export interface AccountInput {
  displayName: string;
  handle: string;
  adultConfirmed: boolean;
  /** Set only by the server after matching the verified owner mailbox. */
  isOwner?: boolean;
}

export interface ProvisionedAccount {
  profile: typeof profiles.$inferSelect;
  balanceMicro: number;
  created: boolean;
}

function validateInput(userId: string, input: AccountInput) {
  if (
    typeof userId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
  ) {
    throw new AccountError("INVALID_IDENTITY", "Please sign in again before setting up your profile.");
  }
  if (!input || input.adultConfirmed !== true) {
    throw new AccountError("ADULT_CONFIRMATION_REQUIRED", "Confirm that you are 18 or older to continue.");
  }
  if (typeof input.displayName !== "string" || typeof input.handle !== "string") {
    throw new AccountError("INVALID_PROFILE", "Enter a display name and a handle.");
  }
  const displayName = input.displayName.trim();
  const handle = input.handle.trim().toLowerCase();
  if (
    displayName.length < 2 ||
    displayName.length > 80 ||
    /\p{Cc}/u.test(displayName)
  ) {
    throw new AccountError("INVALID_PROFILE", "Use a display name with 2 to 80 characters and no control characters.");
  }
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) {
    throw new AccountError("INVALID_PROFILE", "Use 3 to 24 letters, numbers or underscores for your handle.");
  }
  return { displayName, handle, isOwner: input.isOwner === true };
}

function isHandleConflict(error: unknown): boolean {
  // Drizzle wraps the driver error in `cause`; never copy its SQL or details.
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const candidate = current as Record<string, unknown>;
    if (
      candidate.code === "23505" &&
      (candidate.constraint_name === "profiles_handle_key" || candidate.constraint === "profiles_handle_key")
    ) return true;
    current = candidate.cause;
  }
  return false;
}

function inconsistentAccount(): AccountError {
  return new AccountError("ACCOUNT_INCONSISTENT", "Your account needs review before setup can continue. Please contact the app owner.");
}

/**
 * The caller must first verify the current Supabase user and canonical OSU email.
 * userId is that verified user's id, never a form field. This function has no
 * network identity lookup and deliberately accepts both production and test DBs.
 *
 * Successful insertion of the unique profile id is the only grant gate. A
 * missing wallet or ledger entry on an existing profile never authorizes a grant.
 */
export async function provisionAccount<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>,
  userId: string,
  input: AccountInput,
  now: Date = new Date(),
): Promise<ProvisionedAccount> {
  const { displayName, handle, isOwner } = validateInput(userId, input);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new AccountError("ACCOUNT_UNAVAILABLE", "Account setup is temporarily unavailable. Please try again.");
  }

  try {
    return await database.transaction(async (tx) => {
      let [profile] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");

      if (!profile) {
        const [created] = await tx.insert(profiles).values({
          id: userId,
          displayName,
          handle,
          isOwner: isOwner ? 1 : 0,
          adultConfirmedAt: now,
        }).onConflictDoNothing({ target: profiles.id }).returning();

        if (created) {
          await tx.insert(wallets).values({
            userId,
            balanceMicro: ECONOMY.startingBalanceMicro,
            updatedAt: now,
          });
          await tx.insert(ledgerEntries).values({
            userId,
            kind: "signup_grant",
            amountMicro: ECONOMY.startingBalanceMicro,
            memo: "One-time signup grant",
            createdAt: now,
          });
          return { profile: created, balanceMicro: ECONOMY.startingBalanceMicro, created: true };
        }

        // A concurrent creator won. A separate READ COMMITTED statement sees
        // its committed account, including the wallet and grant, after waiting.
        [profile] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
      }

      if (!profile) throw inconsistentAccount();
      if (profile.withdrawnAt) {
        throw new AccountError("ACCOUNT_WITHDRAWN", "This account has been withdrawn. Contact the app owner for help.");
      }
      if (profile.bannedAt) {
        throw new AccountError("ACCOUNT_BANNED", "This account has been banned.");
      }

      if (isOwner && profile.isOwner !== 1) {
        [profile] = await tx.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, userId)).returning();
      }

      // Keep the order profile -> wallet for future withdrawal/trading writers.
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for("update");
      const grants = await tx.select().from(ledgerEntries).where(and(
        eq(ledgerEntries.userId, userId),
        eq(ledgerEntries.kind, "signup_grant"),
      )).limit(2);
      const [ledger] = await tx.select({
        total: sql<string>`coalesce(sum(${ledgerEntries.amountMicro}), 0)::text`,
      }).from(ledgerEntries).where(eq(ledgerEntries.userId, userId));
      const ledgerTotal = Number(ledger?.total);

      if (
        !wallet || !Number.isSafeInteger(wallet.balanceMicro) || wallet.balanceMicro < 0 ||
        grants.length !== 1 || !Number.isSafeInteger(grants[0].amountMicro) || grants[0].amountMicro <= 0 ||
        grants[0].marketId !== null || grants[0].tradeId !== null ||
        !Number.isSafeInteger(ledgerTotal) || ledgerTotal !== wallet.balanceMicro
      ) throw inconsistentAccount();

      if (profile.adultConfirmedAt === null) {
        [profile] = await tx.update(profiles).set({ adultConfirmedAt: now }).where(eq(profiles.id, userId)).returning();
      }
      return { profile, balanceMicro: wallet.balanceMicro, created: false };
    }, { isolationLevel: "read committed" });
  } catch (error) {
    if (error instanceof AccountError) throw error;
    if (isHandleConflict(error)) {
      throw new AccountError("HANDLE_TAKEN", "That handle is already taken. Choose another one.");
    }
    throw new AccountError("ACCOUNT_UNAVAILABLE", "Account setup is temporarily unavailable. Please try again.");
  }
}
