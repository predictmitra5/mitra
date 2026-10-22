export type AuthIdentity = { id: string; email: string };
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null;
}
export function safeReturnTo(value: unknown): string | null {
  // A co-founder invite (2026-10-22) returns to /join/ and its 43-character code.
  return typeof value === "string" &&
    /^\/(?:markets(?:\/[0-9a-f-]{36}(?:\?side=(?:yes|no))?)?|portfolio|account|join\/[A-Za-z0-9_-]{43})$/.test(
      value,
    )
    ? value
    : null;
}
export function eligibleIdentity(
  user: {
    id: string;
    email?: string;
    email_confirmed_at?: string;
    is_anonymous?: boolean;
  } | null,
): AuthIdentity | null {
  if (
    !user ||
    user.is_anonymous ||
    !user.email_confirmed_at ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(user.id)
  )
    return null;
  const email = normalizeEmail(user.email);
  return email ? { id: user.id, email } : null;
}
export function passwordError(password: unknown): string | null {
  return typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
    ? "Use a password between 12 and 128 characters."
    : null;
}
export type FormState = {
  error?: string;
  success?: string;
  verification?: { email: string };
  verified?: boolean;
};
