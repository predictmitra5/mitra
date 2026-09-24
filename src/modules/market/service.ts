import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { ECONOMY } from "./economy";
import { tradeBlockReason } from "./eligibility";
import { isUuid } from "./input";
import { price, type Side } from "./lmsr";
import { EMPTY_POSITION, remainingAllowance } from "./position";
import { toLmsr, type MarketMakerState } from "./quote";
import { planBuy, planSell } from "./trade";
import { MICRO_PER_UNIT } from "./units";
import { isInactive } from "@/modules/account/standing";

const { markets, profiles, wallets, positions, trades, ledgerEntries, priceHistory, marketOutcomeDeciders } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type Market = typeof markets.$inferSelect;
type Clock = () => Date;
const publicStatuses = ["open", "closed", "ruled", "settled", "cancelled"] as const;

export class TradingError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "TradingError";
  }
}

export interface TradeRequest {
  marketId: string;
  action: "buy" | "sell";
  side: Side;
  /** Buy: maximum spend in micro-points. Sell: micro-shares. */
  amountMicro: number;
}

export interface TradeConfirmation extends TradeRequest {
  requestId: string;
  expectedYesSharesMicro: number;
  expectedNoSharesMicro: number;
}

export interface TradePreview extends TradeConfirmation {
  sharesMicro: number;
  totalMicro: number;
  balanceAfterMicro: number;
  priceBefore: number;
  priceAfter: number;
}

export interface TradeReceipt {
  id: string;
  marketId: string;
  action: "buy" | "sell";
  side: Side;
  sharesMicro: number;
  totalMicro: number;
}

function validateRequest(input: TradeRequest) {
  if (!input || !isUuid(input.marketId) || !["buy", "sell"].includes(input.action) ||
    !["YES", "NO"].includes(input.side) || !Number.isSafeInteger(input.amountMicro) || input.amountMicro <= 0) {
    throw new TradingError("INVALID_INPUT", "Enter a positive amount with at most six decimal places.");
  }
}

export function marketMaker(market: Market): MarketMakerState {
  if (!market.approvedAt || market.yesSharesMicro === null || market.noSharesMicro === null) {
    throw new TradingError("NOT_FOUND", "This goal is not available.");
  }
  return { liquidity: market.liquidityMicro / MICRO_PER_UNIT, yesSharesMicro: market.yesSharesMicro, noSharesMicro: market.noSharesMicro };
}

/** Explicit public projection: never pass an entire market, profile, or admin record to the browser. */
export async function readPublicMarket<Q extends PgQueryResultHKT>(database: Database<Q>, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await database.select({
    id: markets.id, question: markets.question, resolutionCriteria: markets.resolutionCriteria,
    goalType: markets.goalType, status: markets.status, deadlineAt: markets.deadlineAt,
    evidenceDeadlineAt: markets.evidenceDeadlineAt, tradingClosedAt: markets.tradingClosedAt,
    ruledOutcome: markets.ruledOutcome, rulingReason: markets.rulingReason, rulingVersion: markets.rulingVersion,
    ruledAt: markets.ruledAt, contestEndsAt: markets.contestEndsAt, settledAt: markets.settledAt, cancelledAt: markets.cancelledAt,
    approvedAt: markets.approvedAt, openingProbabilityBp: markets.openingProbabilityBp,
    displayName: profiles.displayName, handle: profiles.handle, photoUpdatedAt: profiles.photoUpdatedAt,
    subjectWithdrawnAt: profiles.withdrawnAt, subjectBannedAt: profiles.bannedAt,
    liquidityMicro: markets.liquidityMicro, yesSharesMicro: markets.yesSharesMicro, noSharesMicro: markets.noSharesMicro,
  }).from(markets).innerJoin(profiles, eq(profiles.id, markets.subjectUserId))
    .where(and(eq(markets.id, id), isNotNull(markets.approvedAt), inArray(markets.status, [...publicStatuses]))).limit(1);
  if (!row || row.yesSharesMicro === null || row.noSharesMicro === null) return null;
  const { liquidityMicro, yesSharesMicro, noSharesMicro, subjectWithdrawnAt, subjectBannedAt, ...publicFields } = row;
  return { ...publicFields,
    // The market maker's liquidity is a published constant (b = 150), shown so the
    // trade panel can estimate price impact; the share counts stay private.
    liquidity: liquidityMicro / MICRO_PER_UNIT,
    // The photo route refuses a banned or withdrawn person, so never link to it.
    photoUpdatedAt: isInactive({ withdrawnAt: subjectWithdrawnAt, bannedAt: subjectBannedAt }) ? null : row.photoUpdatedAt,
    tradingOpen: row.status === "open" && !row.tradingClosedAt && row.deadlineAt.getTime() > Date.now(),
    contestOpen: row.status === "ruled" && !!row.contestEndsAt && row.contestEndsAt.getTime() > Date.now(),
    yesPrice: price(toLmsr({ liquidity: liquidityMicro / MICRO_PER_UNIT, yesSharesMicro, noSharesMicro }), "YES") };
}

const rejectionMessages: Record<string, string> = {
  SUBJECT_OF_MARKET: "You can follow your goal, but you cannot trade it.",
  DECIDES_OUTCOME: "You cannot trade this goal because you help decide its outcome.",
  OVER_MARKET_LIMIT: "This would exceed your 100-point held-cost limit for this goal. Reduce the amount.",
  INSUFFICIENT_BALANCE: "You do not have enough available play points.",
  INSUFFICIENT_SHARES: "You cannot sell more shares than you hold.",
};

/** The caller supplies a freshly verified identity; never accept a user id from form data. */
export async function readTrader<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, marketId: string) {
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, userId));
  const [wallet] = await database.select().from(wallets).where(eq(wallets.userId, userId));
  if (!profile || isInactive(profile) || !profile.adultConfirmedAt || !wallet) return null;
  const [market] = await database.select().from(markets).where(eq(markets.id, marketId));
  if (!market) return null;
  const deciders = await database.select({ userId: marketOutcomeDeciders.userId }).from(marketOutcomeDeciders).where(eq(marketOutcomeDeciders.marketId, marketId));
  const [held] = await database.select().from(positions).where(and(eq(positions.userId, userId), eq(positions.marketId, marketId)));
  const position = held ?? EMPTY_POSITION;
  const blocked = tradeBlockReason(userId, { subjectUserId: market.subjectUserId, outcomeDeciderUserIds: deciders.map((p) => p.userId) });
  return { balanceMicro: wallet.balanceMicro, position: {
    yesSharesMicro: position.yesSharesMicro, noSharesMicro: position.noSharesMicro,
    yesCostBasisMicro: position.yesCostBasisMicro, noCostBasisMicro: position.noCostBasisMicro,
  }, allowanceMicro: remainingAllowance(position, ECONOMY.perMarketLimitMicro), blocked: blocked ? rejectionMessages[blocked] : null };
}

async function transaction<Q extends PgQueryResultHKT, T>(database: Database<Q>, work: (tx: Database<Q>) => Promise<T>) {
  try {
    return await database.transaction((tx) => work(tx as unknown as Database<Q>), { isolationLevel: "read committed" });
  } catch (error) {
    if (error instanceof TradingError) throw error;
    throw new TradingError("UNAVAILABLE", "Trading is temporarily unavailable. Retry the same confirmation safely.");
  }
}

async function lockAccount<Q extends PgQueryResultHKT>(tx: Database<Q>, userId: string) {
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("share");
  if (!profile || isInactive(profile) || !profile.adultConfirmedAt) {
    throw new TradingError("PROFILE_REQUIRED", "Complete your active profile and 18+ confirmation before trading.");
  }
}

async function loadContext<Q extends PgQueryResultHKT>(tx: Database<Q>, userId: string, input: TradeRequest, clock: Clock) {
  const [market] = await tx.select().from(markets).where(eq(markets.id, input.marketId)).for("update");
  if (!market || !market.approvedAt) throw new TradingError("NOT_FOUND", "This goal is not available.");
  const [subject] = await tx.select().from(profiles).where(eq(profiles.id, market.subjectUserId)).for("share");
  if (!subject || isInactive(subject)) throw new TradingError("CLOSED", "This goal is no longer open for trading.");
  const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for("update");
  if (!wallet) throw new TradingError("PROFILE_REQUIRED", "Your account needs review before you can trade.");
  // Read the clock after waiting for locks. A request queued before the deadline
  // is not entitled to execute after it. No scheduler is needed to enforce this.
  const now = clock();
  if (!Number.isFinite(now.getTime()) || market.status !== "open" || market.tradingClosedAt || market.deadlineAt <= now) {
    throw new TradingError("CLOSED", "Trading has closed for this goal.");
  }
  const deciders = await tx.select({ userId: marketOutcomeDeciders.userId }).from(marketOutcomeDeciders).where(eq(marketOutcomeDeciders.marketId, input.marketId));
  const [position] = await tx.select({
    yesSharesMicro: positions.yesSharesMicro, noSharesMicro: positions.noSharesMicro,
    yesCostBasisMicro: positions.yesCostBasisMicro, noCostBasisMicro: positions.noCostBasisMicro,
  }).from(positions).where(and(eq(positions.marketId, input.marketId), eq(positions.userId, userId)));
  return { market, now, context: {
    traderUserId: userId, side: input.side, balanceMicro: wallet.balanceMicro,
    position: position ?? EMPTY_POSITION, marketMaker: marketMaker(market),
    participants: { subjectUserId: market.subjectUserId, outcomeDeciderUserIds: deciders.map((p) => p.userId) },
  } };
}

function calculate(input: TradeRequest, context: Awaited<ReturnType<typeof loadContext>>["context"]) {
  try {
    const plan = input.action === "buy"
      ? planBuy({ ...context, spendMicro: input.amountMicro, perMarketLimitMicro: ECONOMY.perMarketLimitMicro })
      : planSell({ ...context, sharesMicro: input.amountMicro });
    if (!plan.ok) throw new TradingError(plan.reason, rejectionMessages[plan.reason]);
    const totalMicro = "costMicro" in plan.quote ? plan.quote.costMicro : plan.quote.proceedsMicro;
    // Zero proceeds on a tiny sale are an explicit preview, not a hidden fee.
    const numbers = [totalMicro, plan.quote.sharesMicro, plan.balanceAfterMicro, ...Object.values(plan.positionAfter),
      plan.quote.stateAfter.yesSharesMicro, plan.quote.stateAfter.noSharesMicro];
    if (numbers.some((n) => !Number.isSafeInteger(n) || n < 0) || plan.quote.sharesMicro === 0 || (input.action === "buy" && totalMicro === 0)) {
      throw new RangeError("unrepresentable trade");
    }
    return { ...plan, totalMicro };
  } catch (error) {
    if (error instanceof TradingError) throw error;
    throw new TradingError("INVALID_AMOUNT", "That amount cannot be quoted at this price. Try a different amount.");
  }
}

export async function previewTrade<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, input: TradeRequest, clock: Clock = () => new Date()): Promise<TradePreview> {
  validateRequest(input);
  return transaction(database, async (tx) => {
    await lockAccount(tx, userId);
    const { context } = await loadContext(tx, userId, input, clock);
    const plan = calculate(input, context);
    return { ...input, requestId: crypto.randomUUID(),
      expectedYesSharesMicro: context.marketMaker.yesSharesMicro, expectedNoSharesMicro: context.marketMaker.noSharesMicro,
      sharesMicro: plan.quote.sharesMicro, totalMicro: plan.totalMicro, balanceAfterMicro: plan.balanceAfterMicro,
      priceBefore: plan.quote.priceBefore, priceAfter: plan.quote.priceAfter };
  });
}

function receipt(trade: typeof trades.$inferSelect): TradeReceipt {
  return { id: trade.id, marketId: trade.marketId, action: trade.action, side: trade.side === "yes" ? "YES" : "NO", sharesMicro: trade.sharesMicro, totalMicro: trade.amountMicro };
}

export async function executeTrade<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, input: TradeConfirmation, clock: Clock = () => new Date()): Promise<TradeReceipt> {
  validateRequest(input);
  if (!isUuid(input.requestId) || ![input.expectedYesSharesMicro, input.expectedNoSharesMicro].every((n) => Number.isSafeInteger(n) && n >= 0)) {
    throw new TradingError("INVALID_INPUT", "Preview this trade again before confirming.");
  }
  return transaction(database, async (tx) => {
    await lockAccount(tx, userId);
    const key = `${userId.toLowerCase()}:${input.requestId.toLowerCase()}`;
    // This transaction-scoped lock serializes a retry even if it changes the
    // market id. Hash collisions only serialize unrelated requests, never merge them.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
    const [prior] = await tx.select().from(trades).where(eq(trades.idempotencyKey, key));
    if (prior) {
      if (prior.userId !== userId || prior.marketId !== input.marketId || prior.action !== input.action ||
        prior.side !== input.side.toLowerCase() || prior.requestAmountMicro !== input.amountMicro) {
        throw new TradingError("RETRY_MISMATCH", "This confirmation was already used for a different trade. Make a new preview.");
      }
      return receipt(prior);
    }
    const { context, market, now } = await loadContext(tx, userId, input, clock);
    if (context.marketMaker.yesSharesMicro !== input.expectedYesSharesMicro || context.marketMaker.noSharesMicro !== input.expectedNoSharesMicro) {
      throw new TradingError("PRICE_CHANGED", "The price changed. Preview the trade again before confirming.");
    }
    const plan = calculate(input, context);
    const yesPriceBeforeBp = Math.round(price(toLmsr(context.marketMaker), "YES") * 10_000);
    const yesPriceAfterBp = Math.round(price(toLmsr(plan.quote.stateAfter), "YES") * 10_000);
    const [trade] = await tx.insert(trades).values({
      marketId: market.id, userId, side: input.side === "YES" ? "yes" : "no", action: input.action,
      sharesMicro: plan.quote.sharesMicro, amountMicro: plan.totalMicro, requestAmountMicro: input.amountMicro,
      yesPriceBeforeBp, yesPriceAfterBp, idempotencyKey: key, createdAt: now,
    }).returning();
    await tx.update(wallets).set({ balanceMicro: plan.balanceAfterMicro, updatedAt: now }).where(eq(wallets.userId, userId));
    await tx.insert(ledgerEntries).values({ userId, marketId: market.id, tradeId: trade.id,
      kind: input.action === "buy" ? "trade_buy" : "trade_sell",
      amountMicro: input.action === "buy" ? -plan.totalMicro : plan.totalMicro, createdAt: now });
    await tx.insert(positions).values({ marketId: market.id, userId, ...plan.positionAfter, updatedAt: now })
      .onConflictDoUpdate({ target: [positions.marketId, positions.userId], set: { ...plan.positionAfter, updatedAt: now } });
    await tx.update(markets).set({ yesSharesMicro: plan.quote.stateAfter.yesSharesMicro, noSharesMicro: plan.quote.stateAfter.noSharesMicro }).where(eq(markets.id, market.id));
    await tx.insert(priceHistory).values({ marketId: market.id, tradeId: trade.id, yesPriceBp: yesPriceAfterBp, recordedAt: now });
    return receipt(trade);
  });
}
