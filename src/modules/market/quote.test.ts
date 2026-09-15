import { describe, expect, it } from "vitest";
import { buyCost, sellProceeds } from "./lmsr";
import { quoteBuy, quoteSell, toLmsr, type MarketMakerState } from "./quote";
import { MICRO_PER_UNIT } from "./units";

const market: MarketMakerState = { liquidity: 100, yesSharesMicro: 0, noSharesMicro: 0 };
const sides = ["YES", "NO"] as const;
const spends = [1, 1_000, 999_999, 7_654_321, 100 * MICRO_PER_UNIT];

describe("quoteBuy", () => {
  it("never charges more than the spend or less than the exact cost", () => {
    for (const side of sides) {
      for (const spendMicro of spends) {
        const quote = quoteBuy(market, side, spendMicro);
        const exactMicro = buyCost(toLmsr(market), side, quote.sharesMicro / MICRO_PER_UNIT) * MICRO_PER_UNIT;
        expect(Number.isSafeInteger(quote.sharesMicro)).toBe(true);
        expect(Number.isSafeInteger(quote.costMicro)).toBe(true);
        expect(quote.costMicro).toBeLessThanOrEqual(spendMicro);
        expect(quote.costMicro).toBeGreaterThanOrEqual(exactMicro);
      }
    }
  });

  it("issues the quoted shares and moves the price toward the side bought", () => {
    const quote = quoteBuy(market, "YES", 25 * MICRO_PER_UNIT);
    expect(quote.stateAfter.yesSharesMicro).toBe(quote.sharesMicro);
    expect(quote.stateAfter.noSharesMicro).toBe(0);
    expect(quote.priceAfter).toBeGreaterThan(quote.priceBefore);
  });

  it("rejects spends that are not positive integers", () => {
    for (const spendMicro of [0, -5, 1.5, Number.NaN]) {
      expect(() => quoteBuy(market, "YES", spendMicro)).toThrow(RangeError);
    }
  });
});

describe("quoteSell", () => {
  it("never pays more than the exact proceeds", () => {
    const bought = quoteBuy(market, "NO", 40 * MICRO_PER_UNIT);
    const sale = quoteSell(bought.stateAfter, "NO", bought.sharesMicro);
    const exactMicro = sellProceeds(toLmsr(bought.stateAfter), "NO", bought.sharesMicro / MICRO_PER_UNIT) * MICRO_PER_UNIT;
    expect(sale.proceedsMicro).toBeLessThanOrEqual(exactMicro);
  });

  it("does not let an immediate buy and sell make money", () => {
    for (const side of sides) {
      for (const spendMicro of spends) {
        const bought = quoteBuy(market, side, spendMicro);
        const sale = quoteSell(bought.stateAfter, side, bought.sharesMicro);
        expect(sale.proceedsMicro).toBeLessThanOrEqual(bought.costMicro);
        expect(sale.stateAfter).toEqual(market);
      }
    }
  });

  it("rejects selling more shares than have been issued", () => {
    expect(() => quoteSell(market, "YES", 1)).toThrow(RangeError);
  });
});
