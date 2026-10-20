import { ECONOMY } from "@/modules/market/economy";
import { buyCost, price, stateAtProbability, type Side } from "@/modules/market/lmsr";
import { EMPTY_POSITION, remainingAllowance, type Position } from "@/modules/market/position";
import { toLmsr, type MarketMakerState } from "@/modules/market/quote";
import { planBuy, planSell } from "@/modules/market/trade";
import { MICRO_PER_UNIT } from "@/modules/market/units";

/*
 * Demo trading (2026-10-19). A demo market's price history is made of trades,
 * not drawn: fictional traders buy and sell through the same planning code the
 * live engine uses (planBuy, planSell, the 100-Trade-Coin limit, wallet balances),
 * so every point on a chart is the price after a recorded trade, and volume,
 * trader counts, positions and wallets all agree with each other. Pure and
 * deterministic for a given random source, so it can be tested.
 */

export type Random = () => number;

/** A small, fast, seeded generator (mulberry32). Same seed, same world. */
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SimTrade = {
  id: string;
  userId: string;
  side: Side;
  action: "buy" | "sell";
  sharesMicro: number;
  amountMicro: number;
  requestAmountMicro: number;
  yesPriceBeforeBp: number;
  yesPriceAfterBp: number;
  at: Date;
};

export type SimResult = {
  trades: SimTrade[];
  state: MarketMakerState;
  /** Positions left in this market, by trader. */
  positions: Map<string, Position>;
};

export type SimInput = {
  liquidity: number;
  openingBp: number;
  finalBp: number;
  count: number;
  openedAt: Date;
  /** The last moment trades may happen: now for an open market, before the deadline for a finished one. */
  endAt: Date;
  /** When the steering trades that land the price on finalBp start. */
  settleFrom: Date;
  traders: string[];
  /** Shared across markets: each trader's spendable balance, updated in place. */
  balances: Map<string, number>;
  random: Random;
  newId: () => string;
};

const bp = (state: MarketMakerState) => Math.round(price(toLmsr(state), "YES") * 10_000);

/** Opening market-maker state, as publishing a market sets it. */
export function openingState(liquidity: number, openingBp: number): MarketMakerState {
  const lmsr = stateAtProbability(liquidity, openingBp / 10_000);
  return { liquidity, yesSharesMicro: Math.round(lmsr.yesShares * MICRO_PER_UNIT), noSharesMicro: Math.round(lmsr.noShares * MICRO_PER_UNIT) };
}

/** Shares of `side` that would move the YES price to `targetBp`. */
function sharesToReach(state: MarketMakerState, side: Side, targetBp: number): number {
  const lmsr = toLmsr(state);
  const t = Math.min(0.99, Math.max(0.01, targetBp / 10_000));
  const b = lmsr.liquidity;
  const shares = side === "YES"
    ? lmsr.noShares + b * Math.log(t / (1 - t)) - lmsr.yesShares
    : lmsr.yesShares + b * Math.log((1 - t) / t) - lmsr.noShares;
  return Math.max(0, shares);
}

export function simulateMarket(input: SimInput): SimResult {
  const { random, traders, balances } = input;
  let state = openingState(input.liquidity, input.openingBp);
  const positions = new Map<string, Position>();
  const trades: SimTrade[] = [];
  const limit = ECONOMY.perMarketLimitMicro;

  const startMs = input.openedAt.getTime() + 3_600_000;
  const steerMs = Math.max(startMs + 3_600_000, input.settleFrom.getTime());
  const endMs = Math.max(steerMs + 3_600_000, input.endAt.getTime());
  // Activity picks up over a market's life, as it does on real markets.
  const times = Array.from({ length: input.count }, () => startMs + (steerMs - startMs) * (1 - (1 - random()) ** 1.5)).sort((a, b) => a - b);

  const position = (userId: string) => positions.get(userId) ?? EMPTY_POSITION;
  const record = (userId: string, side: Side, action: "buy" | "sell", sharesMicro: number, amountMicro: number, request: number, before: number, at: number) => {
    trades.push({ id: input.newId(), userId, side, action, sharesMicro, amountMicro, requestAmountMicro: request, yesPriceBeforeBp: before, yesPriceAfterBp: bp(state), at: new Date(at) });
  };

  function buy(userId: string, side: Side, spendMicro: number, at: number): boolean {
    const balance = balances.get(userId) ?? 0;
    const spend = Math.floor(Math.min(spendMicro, balance, remainingAllowance(position(userId), limit)) / 10_000) * 10_000;
    if (spend < MICRO_PER_UNIT) return false;
    const before = bp(state);
    const plan = planBuy({
      traderUserId: userId, participants: { subjectUserId: null, outcomeDeciderUserIds: [] }, marketMaker: state,
      position: position(userId), balanceMicro: balance, side, spendMicro: spend, perMarketLimitMicro: limit,
    });
    if (!plan.ok) return false;
    state = plan.quote.stateAfter;
    positions.set(userId, plan.positionAfter);
    balances.set(userId, plan.balanceAfterMicro);
    record(userId, side, "buy", plan.quote.sharesMicro, plan.quote.costMicro, spend, before, at);
    return true;
  }

  function sell(userId: string, at: number): boolean {
    const held = position(userId);
    const side: Side = held.yesSharesMicro >= held.noSharesMicro ? "YES" : "NO";
    const shares = side === "YES" ? held.yesSharesMicro : held.noSharesMicro;
    if (shares < MICRO_PER_UNIT) return false;
    const amount = Math.max(MICRO_PER_UNIT, Math.floor(shares * (0.4 + random() * 0.6)));
    const before = bp(state);
    const plan = planSell({
      traderUserId: userId, participants: { subjectUserId: null, outcomeDeciderUserIds: [] }, marketMaker: state,
      position: held, balanceMicro: balances.get(userId) ?? 0, side, sharesMicro: Math.min(amount, shares),
    });
    if (!plan.ok || plan.quote.proceedsMicro <= 0) return false;
    state = plan.quote.stateAfter;
    positions.set(userId, plan.positionAfter);
    balances.set(userId, plan.balanceAfterMicro);
    record(userId, side, "sell", plan.quote.sharesMicro, plan.quote.proceedsMicro, plan.quote.sharesMicro, before, at);
    return true;
  }

  const pick = () => traders[Math.floor(random() * traders.length)];
  const span = Math.max(1, steerMs - startMs);
  for (const at of times) {
    // Drift from the opening price towards today's, with slow waves on top.
    const f = (at - startMs) / span;
    const eased = f * f * (3 - 2 * f);
    const wave = Math.sin(f * Math.PI * (2 + random())) * 600;
    const target = input.openingBp + (input.finalBp - input.openingBp) * eased + wave;
    const gap = target - bp(state);
    const holders = [...positions.entries()].filter(([, p]) => p.yesSharesMicro + p.noSharesMicro > MICRO_PER_UNIT);
    if (holders.length > 2 && random() < 0.13) {
      const [userId] = holders[Math.floor(random() * holders.length)];
      if (sell(userId, at)) continue;
    }
    const yesChance = 0.5 + Math.max(-0.38, Math.min(0.38, gap / 2500));
    const side: Side = random() < yesChance ? "YES" : "NO";
    const spend = Math.round((3 + random() * (Math.abs(gap) > 800 ? 22 : 12)) * MICRO_PER_UNIT);
    for (let attempt = 0; attempt < 4; attempt += 1) if (buy(pick(), side, spend, at)) break;
  }

  // Land on today's price with a few trades near the end, which also gives the
  // market a move in the last day.
  const steerSpan = endMs - steerMs;
  for (let step = 0; step < 10; step += 1) {
    const now = bp(state);
    if (Math.abs(now - input.finalBp) <= 40) break;
    const side: Side = now < input.finalBp ? "YES" : "NO";
    const shares = sharesToReach(state, side, input.finalBp);
    const cost = Math.ceil(buyCost(toLmsr(state), side, shares) * MICRO_PER_UNIT);
    const at = steerMs + steerSpan * ((step + 1 + random()) / 12);
    let done = false;
    for (let attempt = 0; attempt < 12 && !done; attempt += 1) done = buy(pick(), side, Math.min(cost, 60 * MICRO_PER_UNIT), at);
    if (!done) break;
  }

  return { trades: trades.sort((a, b) => a.at.getTime() - b.at.getTime()), state, positions };
}
