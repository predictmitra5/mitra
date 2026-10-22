import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { isInactive } from "@/modules/account/standing";
import { managedStartupIds } from "./creator";

/*
 * Co-founder invites (decided 2026-10-22). A founder makes a private link and
 * chooses a join password, and tells the co-founder the password separately.
 * Whoever opens the link, signs in and types the password joins the startup's
 * team (at once if they have a founder profile, otherwise when they make one).
 *
 * - The link's code is 32 random bytes; only its SHA-256 is stored, so the
 *   database alone can't rebuild a link, and the code is shown once.
 * - The password is stored only as a salted scrypt hash and compared in
 *   constant time.
 * - An invite is for one person, works for 7 days, locks after 5 wrong
 *   passwords, and can be cancelled. Checking it holds a row lock, so two
 *   tries can't race past the count.
 */

const { profiles, founders, startups, startupFounders, startupInvites } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export const INVITE_DAYS = 7;
export const MAX_PASSWORD_TRIES = 5;
export const MAX_WAITING_INVITES = 5;
export const MIN_JOIN_PASSWORD = 8;
const MAX_JOIN_PASSWORD = 72;
export const INVITE_CODE = /^[A-Za-z0-9_-]{43}$/;

export class InviteError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "EXPIRED" | "LOCKED" | "USED" | "WRONG_PASSWORD" | "NOT_ALLOWED" | "INVALID_INPUT" | "LIMIT" | "PROFILE_REQUIRED" | "ALREADY",
    message: string,
    public readonly field?: string,
  ) { super(message); this.name = "InviteError"; }
}

// --------------------------------------------------------------- secrets

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password.normalize("NFKC"), salt, 32, SCRYPT, (error, key) => error ? reject(error) : resolve(key)));
}

export async function hashJoinPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64url")}$${(await scrypt(password, salt)).toString("base64url")}`;
}

export async function joinPasswordMatches(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || Number(n) !== SCRYPT.N || Number(r) !== SCRYPT.r || Number(p) !== SCRYPT.p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function inviteCodeHash(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// -------------------------------------------------------------- founders' side

async function activeMember<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  if (!isUuid(userId)) throw new InviteError("PROFILE_REQUIRED", "Log in first.");
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile || !profile.adultConfirmedAt || isInactive(profile)) throw new InviteError("PROFILE_REQUIRED", "Finish setting up your account first.");
  return profile;
}

async function requireTeam<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: unknown) {
  await activeMember(database, userId);
  if (!isUuid(startupId) || !(await managedStartupIds(database, userId)).includes(startupId)) throw new InviteError("NOT_ALLOWED", "That startup isn't yours to invite to.");
  const [startup] = await database.select().from(startups).where(eq(startups.id, startupId));
  if (!startup || startup.status === "rejected" || startup.status === "suspended") throw new InviteError("NOT_ALLOWED", "That startup can't take new co-founders right now.");
  const [founder] = await database.select({ status: founders.status }).from(founders).where(eq(founders.userId, userId)).limit(1);
  if (!founder || founder.status === "rejected" || founder.status === "suspended") throw new InviteError("NOT_ALLOWED", "Your founder profile can't invite co-founders right now.");
  return startup;
}

const waiting = (now: Date) => and(isNull(startupInvites.claimedBy), isNull(startupInvites.revokedAt), isNull(startupInvites.lockedAt), gt(startupInvites.expiresAt, now));

/** Makes an invite and returns its link code, which is shown once and never stored. */
export async function createInvite<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: unknown, input: { role: unknown; password: unknown }, now: Date = new Date()) {
  const startup = await requireTeam(database, userId, startupId);
  const role = typeof input.role === "string" ? input.role.trim() : "";
  if (role.length < 2 || role.length > 60 || /[\u0000-\u001f]/.test(role)) throw new InviteError("INVALID_INPUT", "Their role: 2 to 60 characters, like Co-founder / CTO.", "role");
  const password = typeof input.password === "string" ? input.password : "";
  if (password.trim().length < MIN_JOIN_PASSWORD || password.length > MAX_JOIN_PASSWORD) {
    throw new InviteError("INVALID_INPUT", `Choose a join password of ${MIN_JOIN_PASSWORD} to ${MAX_JOIN_PASSWORD} characters.`, "password");
  }
  const open = await database.$count(startupInvites, and(eq(startupInvites.startupId, startup.id), waiting(now)));
  if (open >= MAX_WAITING_INVITES) throw new InviteError("LIMIT", `${startup.name} has ${MAX_WAITING_INVITES} invites waiting. Cancel one first.`);
  const code = randomBytes(32).toString("base64url");
  const [row] = await database.insert(startupInvites).values({
    startupId: startup.id, invitedBy: userId, role, tokenHash: inviteCodeHash(code), passwordHash: await hashJoinPassword(password),
    expiresAt: new Date(now.getTime() + INVITE_DAYS * 86_400_000), createdAt: now,
  }).returning({ id: startupInvites.id, expiresAt: startupInvites.expiresAt });
  return { id: row.id, code, expiresAt: row.expiresAt, startupName: startup.name };
}

export type InviteState = "waiting" | "unlocked" | "joined" | "expired" | "locked" | "cancelled";

function stateOf(invite: typeof startupInvites.$inferSelect, now: Date): InviteState {
  if (invite.acceptedAt) return "joined";
  if (invite.revokedAt) return "cancelled";
  if (invite.claimedBy) return "unlocked";
  if (invite.lockedAt) return "locked";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "waiting";
}

/** A startup's invites, for its team, newest first. */
export async function listInvites<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: unknown, now: Date = new Date()) {
  if (!isUuid(startupId) || !(await managedStartupIds(database, userId)).includes(startupId)) return [];
  const rows = await database.select({ invite: startupInvites, joinedHandle: profiles.handle }).from(startupInvites)
    .leftJoin(profiles, eq(profiles.id, startupInvites.claimedBy))
    .where(eq(startupInvites.startupId, startupId)).orderBy(desc(startupInvites.createdAt)).limit(20);
  return rows.map(({ invite, joinedHandle }) => ({
    id: invite.id, role: invite.role, state: stateOf(invite, now), createdAt: invite.createdAt, expiresAt: invite.expiresAt, joinedHandle: invite.claimedBy ? joinedHandle : null,
  }));
}

export async function revokeInvite<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, inviteId: unknown, now: Date = new Date()) {
  if (!isUuid(inviteId)) throw new InviteError("NOT_FOUND", "That invite isn't here.");
  const [invite] = await database.select().from(startupInvites).where(eq(startupInvites.id, inviteId));
  if (!invite) throw new InviteError("NOT_FOUND", "That invite isn't here.");
  await activeMember(database, userId);
  if (!(await managedStartupIds(database, userId)).includes(invite.startupId)) throw new InviteError("NOT_ALLOWED", "That invite isn't yours to cancel.");
  if (invite.acceptedAt) throw new InviteError("USED", "They've already joined.");
  await database.update(startupInvites).set({ revokedAt: now }).where(and(eq(startupInvites.id, invite.id), isNull(startupInvites.revokedAt)));
}

// ------------------------------------------------------------- invitee's side

/** What the join page shows about an invite: who asked, for which startup and role, and whether it still works. */
export async function readInvite<Q extends PgQueryResultHKT>(database: Database<Q>, code: unknown, viewerUserId: string | null, now: Date = new Date()) {
  if (typeof code !== "string" || !INVITE_CODE.test(code)) return null;
  const [row] = await database.select({
    invite: startupInvites, startupName: startups.name, startupSlug: startups.slug, startupStatus: startups.status, inviterName: founders.name,
  }).from(startupInvites)
    .innerJoin(startups, eq(startups.id, startupInvites.startupId))
    .leftJoin(founders, eq(founders.userId, startupInvites.invitedBy))
    .where(eq(startupInvites.tokenHash, inviteCodeHash(code))).limit(1);
  if (!row) return null;
  const state = stateOf(row.invite, now);
  return {
    startupName: row.startupName,
    startupSlug: row.startupStatus === "approved" ? row.startupSlug : null,
    inviterName: row.inviterName ?? "Your co-founder",
    role: row.invite.role,
    state: state === "unlocked" && row.invite.claimedBy !== viewerUserId ? "used" as const : state,
    mine: !!viewerUserId && row.invite.claimedBy === viewerUserId,
    ownInvite: !!viewerUserId && row.invite.invitedBy === viewerUserId,
  };
}

type Outcome =
  | { kind: "joined"; startupId: string }
  | { kind: "needs_profile"; startupId: string }
  | { kind: "wrong"; left: number }
  | { kind: "error"; error: InviteError };

/**
 * Unlocks an invite with its join password for this member. With a founder
 * profile they join the team now; without one they join when they make it.
 * A wrong password counts against the invite even though the attempt fails.
 */
export async function claimInvite<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, code: unknown, password: unknown, now: Date = new Date()) {
  await activeMember(database, userId);
  if (typeof code !== "string" || !INVITE_CODE.test(code)) throw new InviteError("NOT_FOUND", "This invite link isn't valid.");
  const typed = typeof password === "string" ? password : "";
  if (!typed || typed.length > MAX_JOIN_PASSWORD) throw new InviteError("WRONG_PASSWORD", "Type the join password your co-founder gave you.", "password");

  const outcome: Outcome = await database.transaction(async (tx) => {
    const db = tx as unknown as Database<Q>;
    const [invite] = await db.select().from(startupInvites).where(eq(startupInvites.tokenHash, inviteCodeHash(code))).for("update").limit(1);
    if (!invite || invite.revokedAt) return { kind: "error", error: new InviteError("NOT_FOUND", "This invite was cancelled or isn't valid. Ask your co-founder for a new one.") };
    if (invite.acceptedAt || (invite.claimedBy && invite.claimedBy !== userId)) return { kind: "error", error: new InviteError("USED", "This invite has already been used. Ask your co-founder for a new one.") };
    if (invite.invitedBy === userId) return { kind: "error", error: new InviteError("NOT_ALLOWED", "This is your own invite. Send the link to your co-founder.") };
    if (!invite.claimedBy) {
      if (invite.lockedAt) return { kind: "error", error: new InviteError("LOCKED", "Too many wrong passwords, so this invite is locked. Ask your co-founder for a new one.") };
      if (invite.expiresAt.getTime() <= now.getTime()) return { kind: "error", error: new InviteError("EXPIRED", "This invite has expired. Ask your co-founder for a new one.") };
      if (!(await joinPasswordMatches(typed, invite.passwordHash))) {
        const tries = invite.failedAttempts + 1;
        await db.update(startupInvites).set({ failedAttempts: tries, ...(tries >= MAX_PASSWORD_TRIES ? { lockedAt: now } : {}) }).where(eq(startupInvites.id, invite.id));
        return tries >= MAX_PASSWORD_TRIES
          ? { kind: "error", error: new InviteError("LOCKED", "Too many wrong passwords, so this invite is locked. Ask your co-founder for a new one.") }
          : { kind: "wrong", left: MAX_PASSWORD_TRIES - tries };
      }
      await db.update(startupInvites).set({ claimedBy: userId, claimedAt: now }).where(eq(startupInvites.id, invite.id));
    }
    const [founder] = await db.select({ id: founders.id, status: founders.status }).from(founders).where(eq(founders.userId, userId)).limit(1);
    if (!founder) return { kind: "needs_profile", startupId: invite.startupId };
    if (founder.status === "suspended" || founder.status === "rejected") return { kind: "error", error: new InviteError("NOT_ALLOWED", "Your founder profile can't join startups right now.") };
    await db.insert(startupFounders).values({ startupId: invite.startupId, founderId: founder.id, role: invite.role, isPrimary: false, createdAt: now }).onConflictDoNothing();
    await db.update(startupInvites).set({ acceptedAt: now }).where(eq(startupInvites.id, invite.id));
    return { kind: "joined", startupId: invite.startupId };
  });

  if (outcome.kind === "error") throw outcome.error;
  if (outcome.kind === "wrong") {
    throw new InviteError("WRONG_PASSWORD", `That password doesn't match. ${outcome.left} ${outcome.left === 1 ? "try" : "tries"} left before this invite locks.`, "password");
  }
  return outcome;
}

/** Whether this member is already on the startup's team (for the join page). */
export async function onTeam<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: string) {
  const rows = await database.select({ n: sql<number>`1` }).from(startupFounders).innerJoin(founders, eq(founders.id, startupFounders.founderId))
    .where(and(eq(startupFounders.startupId, startupId), eq(founders.userId, userId))).limit(1);
  return rows.length > 0;
}
