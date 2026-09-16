export type AuthIdentity = { id: string; email: string };

type AuthUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
};

/** OSU's primary and student alias domains reach the same mailbox. */
export function canonicalUniversityEmail(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  const match = /^([a-z0-9]+(?:[._-][a-z0-9]+)*)@(osu\.edu|buckeyemail\.osu\.edu)$/.exec(email);
  if (!match || match[1].length > 64) return null;
  return `${match[1]}@osu.edu`;
}

/** Only use with a fresh, server-verified auth.getUser() result. */
export function eligibleIdentity(user: AuthUser | null): AuthIdentity | null {
  if (!user || user.is_anonymous || !user.email_confirmed_at) return null;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(user.id)) return null;
  const email = canonicalUniversityEmail(user.email);
  // Do not silently link a separate alias Auth account to another user's wallet.
  if (!email || email !== user.email?.toLowerCase()) return null;
  return { id: user.id, email };
}

export function passwordError(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return "Use a password between 12 and 128 characters.";
  }
  return null;
}

export type FormState = { error?: string; success?: string };
