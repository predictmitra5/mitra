import { describe, expect, it } from "vitest";
import { ECONOMY } from "./economy";
import { EMPTY_POSITION, amountInMarket, remainingAllowance } from "./position";
import { planBuy, planSell, type TradeContext } from "./trade";
import { MICRO_PER_UNIT } from "./units";

const points = (n: number) => n * MICRO_PER_UNIT;
const limit = ECONOMY.perMarketLimitMicro;
const base: TradeContext = {
  traderUserId: "friend",
  participants: { subjectUserId: "jake", outcomeDeciderUserIds: ["club-president"] },
  marketMaker: { liquidity: ECONOMY.defaultLiquidity, yesSharesMicro: 0, noSharesMicro: 0 },
  position: EMPTY_POSITION,
  balanceMicro: ECONOMY.startingBalanceMicro,
  side: "YES",
};

describe("planBuy", () => {
  it("blocks the subject and people who decide the outcome", () => {
    expect(planBuy({ ...base, traderUserId: "jake", spendMicro: points(10), perMarketLimitMicro: limit })).toEqual({
      ok: false,
      reason: "SUBJECT_OF_MARKET",
    });
    expect(
      planBuy({ ...base, traderUserId: "club-president", spendMicro: points(10), perMarketLimitMicro: limit }),
    ).toEqual({ ok: false, reason: "DECIDES_OUTCOME" });
  });

  it("limits the money a trader currently has in the market", () => {
    const first = planBuy({ ...base, spendMicro: points(80), perMarketLimitMicro: limit });
    if (!first.ok) throw new Error("expected the first buy to succeed");
    const second = planBuy({
      ...base,
      marketMaker: first.quote.stateAfter,
      position: first.positionAfter,
      spendMicro: points(30),
      perMarketLimitMicro: limit,
    });
    expect(second).toEqual({
      ok: false,
      reason: "OVER_MARKET_LIMIT",
      remainingAllowanceMicro: limit - first.quote.costMicro,
    });
  });

  it("rejects spending more than the balance", () => {
    expect(planBuy({ ...base, balanceMicro: points(5), spendMicro: points(10), perMarketLimitMicro: limit })).toEqual({
      ok: false,
      reason: "INSUFFICIENT_BALANCE",
      balanceMicro: points(5),
    });
  });

  it("charges the balance and records the cost basis", () => {
    const plan = planBuy({ ...base, side: "NO", spendMicro: points(100), perMarketLimitMicro: limit });
    if (!plan.ok) throw new Error("expected the buy to succeed");
    expect(plan.balanceAfterMicro).toBe(base.balanceMicro - plan.quote.costMicro);
    expect(plan.positionAfter.noSharesMicro).toBe(plan.quote.sharesMicro);
    expect(amountInMarket(plan.positionAfter)).toBeLessThanOrEqual(limit);
  });
});

describe("planSell", () => {
  it("credits the proceeds and frees allowance", () => {
    const bought = planBuy({ ...base, spendMicro: points(100), perMarketLimitMicro: limit });
    if (!bought.ok) throw new Error("expected the buy to succeed");
    const sold = planSell({
      ...base,
      marketMaker: bought.quote.stateAfter,
      position: bought.positionAfter,
      balanceMicro: bought.balanceAfterMicro,
      sharesMicro: Math.floor(bought.quote.sharesMicro / 2),
    });
    if (!sold.ok) throw new Error("expected the sale to succeed");
    expect(sold.balanceAfterMicro).toBe(bought.balanceAfterMicro + sold.quote.proceedsMicro);
    expect(remainingAllowance(sold.positionAfter, limit)).toBeGreaterThan(
      remainingAllowance(bought.positionAfter, limit),
    );
  });

  it("rejects selling shares the trader does not hold", () => {
    expect(planSell({ ...base, sharesMicro: 1 })).toEqual({
      ok: false,
      reason: "INSUFFICIENT_SHARES",
      sharesHeldMicro: 0,
    });
  });

  it("blocks the subject from selling as well as buying", () => {
    expect(planSell({ ...base, traderUserId: "jake", sharesMicro: 1 })).toEqual({
      ok: false,
      reason: "SUBJECT_OF_MARKET",
    });
  });
});
