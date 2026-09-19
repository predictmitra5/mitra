import "server-only";

export function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Authentication is not configured.");
  return { url, key };
}

/**
 * Whether a confirmed mailbox is required to use the app. The owner turns this
 * off while custom SMTP is unconfigured. Only the exact string "false" disables
 * it, so an unset, empty or misspelled variable keeps the protection.
 */
export function emailConfirmationRequired(): boolean {
  return process.env.AUTH_REQUIRE_EMAIL_CONFIRMATION !== "false";
}

/** Email callbacks use configured origins, never an untrusted Host header. */
export function appOrigin(): string {
  const value = process.env.APP_URL ??
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");
  if (!value) throw new Error("APP_URL is required in production.");
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("APP_URL must be an application origin.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("APP_URL must use HTTPS outside localhost.");
  }
  return url.origin;
}
