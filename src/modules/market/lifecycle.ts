import { and, asc, desc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "./input";
import { EMPTY_POSITION } from "./position";
import { isInactive } from "@/modules/account/standing";

const { profiles, markets, positions, wallets, ledgerEntries, adminActions, contests, priceHistory } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type Market = typeof markets.$inferSelect;
type Clock = () => Date;
export const CONTEST_WINDOW_MS = 24 * 60 * 60 * 1000;

export class LifecycleError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message); this.name = "LifecycleError";
  }
}

export interface OwnerCommand {
  marketId: string;
  requestId: string;
  action: "close" | "rule" | "cancel";
  reason: string;
  expectedVersion: number;
  outcome?: "yes" | "no";
  basis?: "reviewed_proof" | "missing_proof";
  publicOutcomeConfirmed?: boolean;
}

function textReason(value: unknown) {
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new LifecycleError("INVALID_INPUT", "Write an explanation of 3 to 2,000 characters.");
  }
  return value.trim();
}

function normalize(command: OwnerCommand) {
  if (!command || !isUuid(command.marketId) || !isUuid(command.requestId) ||
    !["close", "rule", "cancel"].includes(command.action) || !Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0) {
    throw new LifecycleError("INVALID_INPUT", "Reload this goal before trying again.");
  }
  const reason = textReason(command.reason);
  if (command.action === "rule" && (!["yes", "no"].includes(command.outcome ?? "") || !["reviewed_proof", "missing_proof"].includes(command.basis ?? ""))) {
    throw new LifecycleError("INVALID_INPUT", "Choose an outcome and state whether you reviewed proof.");
  }
  if (command.action === "rule" && command.basis === "missing_proof" && command.outcome !== "no") {
    throw new LifecycleError("MISSING_PROOF_NO", "A goal without proof must be ruled NO.");
  }
  if (command.action === "close" && command.publicOutcomeConfirmed !== true) {
    throw new LifecycleError("CONFIRM_PUBLIC", "Confirm that the outcome is already public before closing early.");
  }
  return { marketId: command.marketId.toLowerCase(), requestId: command.requestId.toLowerCase(),
    action: command.action, reason, expectedVersion: command.expectedVersion,
    outcome: command.action === "rule" ? command.outcome! : null,
    basis: command.action === "rule" ? command.basis! : null,
    publicOutcomeConfirmed: command.action === "close" };
}

async function atomic<Q extends PgQueryResultHKT, T>(database: Database<Q>, work: (tx: Database<Q>) => Promise<T>) {
  try { return await database.transaction((tx) => work(tx as unknown as Database<Q>), { isolationLevel: "read committed" }); }
  catch (error) {
    if (error instanceof LifecycleError) throw error;
    throw new LifecycleError("UNAVAILABLE", "This update is temporarily unavailable. Retry the same request safely.");
  }
}

async function activeProfile<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, lock = false) {
  if (!isUuid(userId)) throw new LifecycleError("PROFILE_REQUIRED", "Sign in and complete your active profile first.");
  const query = database.select().from(profiles).where(eq(profiles.id, userId));
  const [profile] = await (lock ? query.for("share") : query);
  if (!profile || isInactive(profile) || !profile.adultConfirmedAt) {
    throw new LifecycleError("PROFILE_REQUIRED", "Sign in and complete your active profile first.");
  }
  return profile;
}

export async function requireLifecycleOwner<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, lock = false) {
  const profile = await activeProfile(database, userId, lock);
  if (profile.isOwner !== 1) throw new LifecycleError("NOT_OWNER", "Only the app owner can manage outcomes.");
}

async function lockMarket<Q extends PgQueryResultHKT>(database: Database<Q>, marketId: string) {
  if (!isUuid(marketId)) throw new LifecycleError("NOT_FOUND", "This goal is not available.");
  const [market] = await database.select().from(markets).where(eq(markets.id, marketId)).for("update");
  if (!market || !market.approvedAt) throw new LifecycleError("NOT_FOUND", "This goal is not available.");
  return market;
}

function final(market: Market, now: Date) {
  return market.status === "settled" || market.status === "cancelled" ||
    (market.status === "ruled" && !!market.contestEndsAt && market.contestEndsAt <= now);
}

function safeAmount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new LifecycleError("ACCOUNTING_ERROR", "Accounting needs review before this goal can be finalized.");
  return value;
}

/** Caller holds the market lock. Wallets are locked by user id across all markets. */
async function creditPositions<Q extends PgQueryResultHKT>(tx: Database<Q>, market: Market, kind: "settlement" | "cancellation_refund", now: Date) {
  const held = await tx.select().from(positions).where(eq(positions.marketId, market.id)).orderBy(asc(positions.userId));
  if (kind === "settlement" && !market.ruledOutcome) throw new LifecycleError("INVALID_STATE", "This goal has no ruling to settle.");
  let totalMicro = 0;
  const accountRows = held.length ? await tx.select().from(wallets).where(inArray(wallets.userId, held.map((p) => p.userId)))
    .orderBy(asc(wallets.userId)).for("update") : [];
  const balances = new Map(accountRows.map((w) => [w.userId, w.balanceMicro]));
  for (const position of held) {
    [position.yesSharesMicro, position.noSharesMicro, position.yesCostBasisMicro, position.noCostBasisMicro].forEach(safeAmount);
    const cash = balances.get(position.userId);
    if (cash === undefined) throw new LifecycleError("ACCOUNTING_ERROR", "A participant's wallet needs review before finalization.");
    const credit = safeAmount(kind === "cancellation_refund"
      ? position.yesCostBasisMicro + position.noCostBasisMicro
      : market.ruledOutcome === "yes" ? position.yesSharesMicro : position.noSharesMicro);
    const balanceMicro = safeAmount(safeAmount(cash) + credit);
    totalMicro = safeAmount(totalMicro + credit);
    await tx.update(wallets).set({ balanceMicro, updatedAt: now }).where(eq(wallets.userId, position.userId));
    // Include zero payouts: the ledger records losing outcomes too.
    await tx.insert(ledgerEntries).values({ userId: position.userId, marketId: market.id, kind,
      amountMicro: credit, createdAt: now, memo: kind === "settlement" ? `${market.ruledOutcome!.toUpperCase()} final payout` : "Held-cost refund" });
  }
  await tx.update(positions).set({ ...EMPTY_POSITION, updatedAt: now }).where(eq(positions.marketId, market.id));
  return { participants: held.length, totalMicro };
}

async function closeAtDeadline<Q extends PgQueryResultHKT>(tx: Database<Q>, market: Market, now: Date): Promise<Market> {
  if (market.status !== "open" || market.deadlineAt > now) return market;
  const [closed] = await tx.update(markets).set({ status: "closed", tradingClosedAt: market.deadlineAt }).where(eq(markets.id, market.id)).returning();
  await tx.insert(adminActions).values({ marketId: market.id, actorUserId: null, kind: "close_deadline",
    reason: "Trading deadline reached", details: { deadlineAt: market.deadlineAt.toISOString() }, createdAt: now });
  return closed;
}

/** System-only transition service. No ruling is inferred from missing uploads. */
export async function advanceMarket<Q extends PgQueryResultHKT>(database: Database<Q>, marketId: string, clock: Clock = () => new Date()) {
  if (!isUuid(marketId)) return;
  return atomic(database, async (tx) => {
    const [existing] = await tx.select().from(markets).where(eq(markets.id, marketId)).for("update");
    if (!existing?.approvedAt) return;
    const now = clock();
    const market = await closeAtDeadline(tx, existing, now);
    if (market.status !== "ruled" || !market.contestEndsAt || market.contestEndsAt > now) return;
    const result = await creditPositions(tx, market, "settlement", now);
    await tx.update(markets).set({ status: "settled", settledAt: now }).where(eq(markets.id, market.id));
    await tx.insert(priceHistory).values({ marketId: market.id, yesPriceBp: market.ruledOutcome === "yes" ? 10_000 : 0, recordedAt: now });
    await tx.insert(adminActions).values({ marketId: market.id, actorUserId: null, kind: "settle",
      reason: "Contest window completed", details: { ...result, outcome: market.ruledOutcome, rulingVersion: market.rulingVersion }, createdAt: now });
  });
}

/** Each owner command has a retry key and a version from the screen they reviewed. */
export async function applyOwnerCommand<Q extends PgQueryResultHKT>(database: Database<Q>, actorId: string, input: OwnerCommand, clock: Clock = () => new Date()) {
  const command = normalize(input);
  return atomic(database, async (tx) => {
    await requireLifecycleOwner(tx, actorId, true);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`lifecycle:${actorId}:${command.requestId}`}, 0))`);
    const [prior] = await tx.select().from(adminActions).where(and(eq(adminActions.actorUserId, actorId), eq(adminActions.requestId, command.requestId)));
    if (prior) {
      const previousRequest = (prior.details as { request?: unknown } | null)?.request;
      // JSONB key ordering is not significant. Compare normalized fields by name.
      if (!previousRequest || Object.entries(command).some(([key, value]) => (previousRequest as Record<string, unknown>)[key] !== value)) {
        throw new LifecycleError("RETRY_MISMATCH", "This request was already used for a different update. Reload the goal.");
      }
      return { marketId: command.marketId };
    }
    let market = await lockMarket(tx, command.marketId);
    const now = clock();
    if (final(market, now)) throw new LifecycleError("FINAL", "This outcome is final. Its points cannot be changed or clawed back.");
    if (market.rulingVersion !== command.expectedVersion) throw new LifecycleError("STALE_RULING", "The ruling changed since you opened this form. Reload and review it first.");
    const before = { status: market.status, outcome: market.ruledOutcome, rulingVersion: market.rulingVersion };
    let kind: typeof adminActions.$inferInsert.kind;
    let totals: { participants: number; totalMicro: number } | undefined;
    if (command.action === "close") {
      if (market.status !== "open" || market.deadlineAt <= now) throw new LifecycleError("CLOSED", "Trading is already closed. Reload the goal.");
      await tx.update(markets).set({ status: "closed", tradingClosedAt: now }).where(eq(markets.id, market.id));
      kind = "close_early";
    } else if (command.action === "cancel") {
      if (!["open", "closed", "ruled"].includes(market.status)) throw new LifecycleError("INVALID_STATE", "This goal cannot be cancelled here.");
      totals = await creditPositions(tx, market, "cancellation_refund", now);
      await tx.update(markets).set({ status: "cancelled", cancelledAt: now, cancelReason: command.reason,
        tradingClosedAt: market.tradingClosedAt ?? (market.deadlineAt < now ? market.deadlineAt : now) }).where(eq(markets.id, market.id));
      kind = "cancel";
    } else {
      if (market.evidenceDeadlineAt > now) throw new LifecycleError("PROOF_WINDOW", "Wait until the seven-day proof period ends before recording the ruling.");
      market = await closeAtDeadline(tx, market, now);
      if (!["closed", "ruled"].includes(market.status)) throw new LifecycleError("INVALID_STATE", "Close trading before ruling on this goal.");
      if (market.status === "ruled" && market.ruledOutcome === command.outcome && market.rulingReason === command.reason) {
        throw new LifecycleError("NO_CHANGE", "The outcome and explanation are unchanged.");
      }
      kind = market.status === "ruled" ? "change_ruling" : "rule";
      await tx.update(markets).set({ status: "ruled", ruledOutcome: command.outcome!, rulingReason: command.reason, ruledAt: now,
        rulingVersion: market.rulingVersion + 1, contestEndsAt: new Date(now.getTime() + CONTEST_WINDOW_MS) }).where(eq(markets.id, market.id));
    }
    await tx.insert(adminActions).values({ marketId: market.id, actorUserId: actorId, requestId: command.requestId,
      kind, reason: command.reason, details: { request: command, before, ...(totals ?? {}) }, createdAt: now });
    return { marketId: market.id };
  });
}

export interface ObjectionInput { id: string; marketId: string; rulingVersion: number; reason: string }

export async function submitObjection<Q extends PgQueryResultHKT>(database: Database<Q>, authorId: string, input: ObjectionInput, clock: Clock = () => new Date()) {
  if (!input || !isUuid(input.id) || !isUuid(input.marketId) || !Number.isSafeInteger(input.rulingVersion) || input.rulingVersion < 1) {
    throw new LifecycleError("INVALID_INPUT", "Reload the current ruling before objecting.");
  }
  const reason = textReason(input.reason);
  return atomic(database, async (tx) => {
    await activeProfile(tx, authorId, true);
    // One lock per submitted id also prevents collisions across different markets.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`objection:${input.id.toLowerCase()}`}, 0))`);
    const [prior] = await tx.select().from(contests).where(eq(contests.id, input.id));
    if (prior) {
      if (prior.userId !== authorId || prior.marketId !== input.marketId || prior.reason !== reason || prior.rulingVersion !== input.rulingVersion) {
        throw new LifecycleError("RETRY_MISMATCH", "This submission id was already used. Reload the current ruling.");
      }
      return { marketId: input.marketId };
    }
    const market = await lockMarket(tx, input.marketId);
    const now = clock();
    if (market.status !== "ruled" || !market.contestEndsAt || market.contestEndsAt <= now) {
      throw new LifecycleError("CONTEST_CLOSED", "This goal's objection window has ended or has not opened yet.");
    }
    if (market.rulingVersion !== input.rulingVersion) throw new LifecycleError("STALE_RULING", "The ruling changed. Read it again before submitting your objection.");
    await tx.insert(contests).values({ id: input.id, marketId: input.marketId, userId: authorId, reason, rulingVersion: market.rulingVersion, createdAt: now });
    return { marketId: input.marketId };
  });
}

/** Private text never enters the public projection, even after settlement. */
export async function readObjections<Q extends PgQueryResultHKT>(database: Database<Q>, readerId: string, marketId: string) {
  const reader = await activeProfile(database, readerId);
  if (!isUuid(marketId)) return [];
  return database.select({ id: contests.id, reason: contests.reason, rulingVersion: contests.rulingVersion, createdAt: contests.createdAt })
    .from(contests).where(and(eq(contests.marketId, marketId), reader.isOwner === 1 ? undefined : eq(contests.userId, readerId)))
    .orderBy(desc(contests.createdAt));
}

/** Process a bounded batch on access; future periodic runners can reuse this. */
export async function advanceDueMarkets<Q extends PgQueryResultHKT>(database: Database<Q>, userId?: string, clock: Clock = () => new Date()) {
  const now = clock();
  const due = and(isNotNull(markets.approvedAt), or(and(eq(markets.status, "open"), lte(markets.deadlineAt, now)),
    and(eq(markets.status, "ruled"), lte(markets.contestEndsAt, now))));
  const rows = userId
    ? await database.selectDistinct({ id: markets.id }).from(markets).leftJoin(positions, eq(positions.marketId, markets.id))
      .where(and(due, or(eq(markets.subjectUserId, userId), eq(positions.userId, userId)))).limit(100)
    : await database.select({ id: markets.id }).from(markets).where(due).orderBy(asc(markets.deadlineAt)).limit(100);
  for (const row of rows) await advanceMarket(database, row.id, clock);
}

export async function listLifecycleMarkets<Q extends PgQueryResultHKT>(database: Database<Q>, actorId: string) {
  await requireLifecycleOwner(database, actorId);
  await advanceDueMarkets(database);
  const rows = await database.select({ market: markets, displayName: profiles.displayName, handle: profiles.handle }).from(markets)
    .innerJoin(profiles, eq(profiles.id, markets.subjectUserId)).where(and(isNotNull(markets.approvedAt), inArray(markets.status, ["open", "closed", "ruled"])))
    .orderBy(asc(markets.deadlineAt));
  const now = new Date();
  return rows.map((row) => ({ ...row, market: { ...row.market, rulingAvailable: row.market.evidenceDeadlineAt <= now } }));
}
