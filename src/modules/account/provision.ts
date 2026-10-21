import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

const { profiles } = schema;
const NEW_ACCOUNT_BALANCE_MICRO = 0;

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
  return { displayName, handle };
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
 * The caller must first verify the current Supabase user and confirmed email.
 * userId is that verified user's id, never a form field. This function has no
 * network identity lookup and deliberately accepts both production and test DBs.
 *
 * Accounts begin at zero. No grants or currency conversion exist.
 */
export async function provisionAccount<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>,
  userId: string,
  input: AccountInput,
  now: Date = new Date(),
): Promise<ProvisionedAccount> {
  const { displayName, handle } = validateInput(userId, input);
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
          isOwner: 0,
          adultConfirmedAt: now,
        }).onConflictDoNothing({ target: profiles.id }).returning();

        if (created) {
          return { profile: created, balanceMicro: NEW_ACCOUNT_BALANCE_MICRO, created: true };
        }

        // A concurrent creator won. A separate READ COMMITTED statement sees
        // its committed account, including the profile, after waiting.
        [profile] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
      }

      if (!profile) throw inconsistentAccount();
      if (profile.withdrawnAt) {
        throw new AccountError("ACCOUNT_WITHDRAWN", "This account has been withdrawn. Contact the app owner for help.");
      }
      if (profile.bannedAt) {
        throw new AccountError("ACCOUNT_BANNED", "This account has been banned.");
      }

      if (profile.adultConfirmedAt === null) {
        [profile] = await tx.update(profiles).set({ adultConfirmedAt: now }).where(eq(profiles.id, userId)).returning();
      }
      return { profile, balanceMicro: 0, created: false };
    }, { isolationLevel: "read committed" });
  } catch (error) {
    if (error instanceof AccountError) throw error;
    if (isHandleConflict(error)) {
      throw new AccountError("HANDLE_TAKEN", "That handle is already taken. Choose another one.");
    }
    throw new AccountError("ACCOUNT_UNAVAILABLE", "Account setup is temporarily unavailable. Please try again.");
  }
}
