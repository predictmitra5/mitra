import { tradeBlockReason, type MarketParticipants, type TradeBlockReason } from "./eligibility";
import type { Side } from "./lmsr";
import { applyBuy, applySell, remainingAllowance, sharesHeld, type Position } from "./position";
import { quoteBuy, quoteSell, type BuyQuote, type MarketMakerState, type SellQuote } from "./quote";
import { assertNonNegativeMicro, assertPositiveMicro } from "./units";

/*
 * Trade rules shared by every entry point. These functions only decide what a
 * trade would do. The caller must apply the result atomically and check that
 * trading is open and before its deadline. See service.ts for that boundary.
 */

export interface TradeContext {
  traderUserId: string;
  participants: MarketParticipants;
  marketMaker: MarketMakerState;
  position: Position;
  balanceMicro: number;
  side: Side;
}

export type TradeRejection =
  | { ok: false; reason: TradeBlockReason }
  | { ok: false; reason: "OVER_MARKET_LIMIT"; remainingAllowanceMicro: number }
  | { ok: false; reason: "INSUFFICIENT_BALANCE"; balanceMicro: number }
  | { ok: false; reason: "INSUFFICIENT_SHARES"; sharesHeldMicro: number };

export type BuyPlan =
  | { ok: true; quote: BuyQuote; positionAfter: Position; balanceAfterMicro: number }
  | TradeRejection;

export type SellPlan =
  | { ok: true; quote: SellQuote; positionAfter: Position; balanceAfterMicro: number }
  | TradeRejection;

export function planBuy(context: TradeContext & { spendMicro: number; perMarketLimitMicro: number }): BuyPlan {
  assertPositiveMicro(context.spendMicro, "spendMicro");
  assertNonNegativeMicro(context.balanceMicro, "balanceMicro");
  const blocked = tradeBlockReason(context.traderUserId, context.participants);
  if (blocked) return { ok: false, reason: blocked };

  // Checked against the full spend; the actual cost can only be lower.
  const allowance = remainingAllowance(context.position, context.perMarketLimitMicro);
  if (context.spendMicro > allowance) {
    return { ok: false, reason: "OVER_MARKET_LIMIT", remainingAllowanceMicro: allowance };
  }
  if (context.spendMicro > context.balanceMicro) {
    return { ok: false, reason: "INSUFFICIENT_BALANCE", balanceMicro: context.balanceMicro };
  }

  const quote = quoteBuy(context.marketMaker, context.side, context.spendMicro);
  return {
    ok: true,
    quote,
    positionAfter: applyBuy(context.position, context.side, quote.sharesMicro, quote.costMicro),
    balanceAfterMicro: context.balanceMicro - quote.costMicro,
  };
}

export function planSell(context: TradeContext & { sharesMicro: number }): SellPlan {
  assertPositiveMicro(context.sharesMicro, "sharesMicro");
  assertNonNegativeMicro(context.balanceMicro, "balanceMicro");
  // Kalshi prohibits entering any trade, so the influence rule covers sells too.
  const blocked = tradeBlockReason(context.traderUserId, context.participants);
  if (blocked) return { ok: false, reason: blocked };

  const held = sharesHeld(context.position, context.side);
  if (context.sharesMicro > held) {
    return { ok: false, reason: "INSUFFICIENT_SHARES", sharesHeldMicro: held };
  }

  const quote = quoteSell(context.marketMaker, context.side, context.sharesMicro);
  return {
    ok: true,
    quote,
    positionAfter: applySell(context.position, context.side, context.sharesMicro),
    balanceAfterMicro: context.balanceMicro + quote.proceedsMicro,
  };
}
