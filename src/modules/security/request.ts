import "server-only";
import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { hit, RateLimited, type Rule } from "./rate-limit";

/*
 * Request limits for server actions and route handlers (2026-10-21). The
 * address is the first entry of `x-forwarded-for`, which Vercel overwrites with
 * the connecting client's address, so a browser cannot choose it.
 */

export async function clientAddress(source?: Headers): Promise<string> {
  const list = source ?? await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip")?.trim() || "unknown";
}

/** Counts this request by address (and any other subjects, such as an account or an email); throws RateLimited when over. */
export async function limit(rule: Rule, ...others: (string | null | undefined)[]): Promise<void> {
  const subjects = [`ip:${await clientAddress()}`, ...others.filter((s): s is string => !!s)];
  const result = await hit(getDb(), rule, subjects);
  if (!result.allowed) throw new RateLimited(result.retryAfterSeconds);
}

/** The same, returning false instead of throwing. */
export async function within(rule: Rule, ...others: (string | null | undefined)[]): Promise<boolean> {
  try { await limit(rule, ...others); return true; } catch (error) {
    if (error instanceof RateLimited) return false;
    return true;
  }
}

/** For a route handler: a 429 response when over the limit, otherwise null. */
export async function limitResponse(request: Request, rule: Rule, ...others: (string | null | undefined)[]): Promise<Response | null> {
  const subjects = [`ip:${await clientAddress(request.headers)}`, ...others.filter((s): s is string => !!s)];
  const result = await hit(getDb(), rule, subjects);
  if (result.allowed) return null;
  return Response.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" } });
}
