import { createHmac } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

/*
 * Request limits (2026-10-21). Each rule allows a number of requests per
 * subject (an address or an account) in a fixed window, counted in Postgres so
 * every server instance shares the count. Subjects are stored only as a keyed
 * one-way hash, and windows older than a day are deleted by the daily
 * maintenance route. A database error lets the request through: limits protect
 * the site from floods, and must never be the reason it is down.
 */

const { rateLimits } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export type Rule = { name: string; max: number; windowSeconds: number };

const minutes = (n: number) => n * 60;

/** Every limit in one place, so they can be read and tuned together. */
export const LIMITS = {
  // Counted by address and by email address.
  signIn: { name: "sign-in", max: 10, windowSeconds: minutes(10) },
  sendCode: { name: "send-code", max: 5, windowSeconds: minutes(60) },
  verifyCode: { name: "verify-code", max: 12, windowSeconds: minutes(10) },
  passwordReset: { name: "password-reset", max: 5, windowSeconds: minutes(60) },
  // Counted by address (and account, where there is one).
  setPassword: { name: "set-password", max: 10, windowSeconds: minutes(10) },
  onboarding: { name: "onboarding", max: 30, windowSeconds: minutes(60) },
  creatorWrite: { name: "creator-write", max: 40, windowSeconds: minutes(60) },
  handleCheck: { name: "handle-check", max: 120, windowSeconds: minutes(10) },
  // Join passwords for co-founder invites (2026-10-22), on top of each invite's own five tries.
  join: { name: "join", max: 10, windowSeconds: minutes(10) },
  upload: { name: "upload", max: 30, windowSeconds: minutes(60) },
  social: { name: "social", max: 300, windowSeconds: minutes(60) },
  report: { name: "report", max: 20, windowSeconds: minutes(60) },
  account: { name: "account", max: 20, windowSeconds: minutes(60) },
  events: { name: "events", max: 600, windowSeconds: minutes(10) },
  quotes: { name: "quotes", max: 400, windowSeconds: minutes(10) },
  feed: { name: "feed", max: 200, windowSeconds: minutes(10) },
} satisfies Record<string, Rule>;

export class RateLimited extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests. Please wait a few minutes and try again.");
    this.name = "RateLimited";
  }
}

export const RATE_LIMITED_MESSAGE = "Too many tries. Please wait a few minutes and try again.";

/** A keyed hash, so a stored subject can't be turned back into an address by trying every address. */
export function subjectKey(subject: string): string {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SECRET_KEY || "mitra-local-rate-limits";
  return createHmac("sha256", secret).update(subject).digest("base64url").slice(0, 32);
}

function windowStart(rule: Rule, now: Date): Date {
  const span = rule.windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / span) * span);
}

/**
 * Counts one request against the rule for each subject and says whether all of
 * them are still within it; the seconds until the window turns over otherwise.
 */
export async function hit<Q extends PgQueryResultHKT>(database: Database<Q>, rule: Rule, subjects: readonly string[], now: Date = new Date()): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const start = windowStart(rule, now);
  const retryAfterSeconds = Math.max(1, Math.ceil((start.getTime() + rule.windowSeconds * 1000 - now.getTime()) / 1000));
  try {
    let allowed = true;
    for (const subject of new Set(subjects)) {
      const [row] = await database.insert(rateLimits)
        .values({ bucket: rule.name, subject: subjectKey(subject), windowStart: start, hits: 1 })
        .onConflictDoUpdate({ target: [rateLimits.bucket, rateLimits.subject, rateLimits.windowStart], set: { hits: sql`${rateLimits.hits} + 1` } })
        .returning({ hits: rateLimits.hits });
      if ((row?.hits ?? 0) > rule.max) allowed = false;
    }
    return { allowed, retryAfterSeconds };
  } catch {
    return { allowed: true, retryAfterSeconds };
  }
}

/** Deletes windows that ended more than a day ago. */
export async function pruneRateLimits<Q extends PgQueryResultHKT>(database: Database<Q>, now: Date = new Date()): Promise<void> {
  await database.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 86_400_000)));
}
