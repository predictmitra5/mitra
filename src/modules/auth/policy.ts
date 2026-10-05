import { universityEmail, type CampusKey } from "@/config/campus";

export type AuthIdentity = { id: string; email: string; campus: CampusKey };

type AuthUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
};

/**
 * Only use with a fresh, server-verified auth.getUser() result.
 * Campus and confirmation come from the provider's verified user, not editable
 * user metadata, a cookie or the campus picker.
 */
export function eligibleIdentity(user: AuthUser | null): AuthIdentity | null {
  if (!user || user.is_anonymous) return null;
  if (!user.email_confirmed_at) return null;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(user.id)) return null;
  const identity = universityEmail(user.email);
  // Do not silently link a separate alias Auth account to another user's wallet.
  if (!identity || identity.email !== user.email?.toLowerCase()) return null;
  return { id: user.id, ...identity };
}

export function passwordError(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return "Use a password between 12 and 128 characters.";
  }
  return null;
}

export type FormState = {
  error?: string;
  success?: string;
  verification?: { email: string; campus: CampusKey };
  /** Sign-up: the email code was accepted and a new member may now set a password. */
  verified?: boolean;
};
