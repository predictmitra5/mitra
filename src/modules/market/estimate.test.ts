import { describe, expect, it } from "vitest";
import { estimateBuy, estimateSell } from "./estimate";
import { price } from "./lmsr";
import { quoteBuy, quoteSell, toLmsr, type MarketMakerState } from "./quote";

// A market that has traded away from its opening, as the server holds it.
const market: MarketMakerState = { liquidity: 150, yesSharesMicro: 212_400_000, noSharesMicro: 71_900_000 };
const yesPrice = price(toLmsr(market), "YES");

describe("the trade panel's estimate", () => {
  it("matches the server's buy quote from the price alone, price impact included", () => {
    for (const side of ["YES", "NO"] as const) {
      const estimate = estimateBuy(yesPrice, 150, side, 25)!;
      const quote = quoteBuy(market, side, 25_000_000);
      // The server rounds shares down to the micro-share, in the market maker's favour.
      expect(Math.abs(estimate.shares * 1e6 - quote.sharesMicro)).toBeLessThanOrEqual(2);
      expect(estimate.priceAfter).toBeCloseTo(quote.priceAfter, 6);
      expect(estimate.toWin).toBe(estimate.shares);
      // Buying moves the price, so the average is above the price you started at.
      const start = side === "YES" ? yesPrice : 1 - yesPrice;
      expect(estimate.averagePrice).toBeGreaterThan(start);
    }
  });

  it("matches the server's sell quote", () => {
    const estimate = estimateSell(yesPrice, 150, "YES", 30)!;
    const quote = quoteSell(market, "YES", 30_000_000);
    expect(Math.abs(estimate.proceeds * 1e6 - quote.proceedsMicro)).toBeLessThanOrEqual(2);
    expect(estimate.averagePrice).toBeLessThan(yesPrice);
  });

  it("estimates a sale larger than the opening state's shares on that side", () => {
    // At 40% the opening state issues NO shares only; selling YES still prices correctly.
    const estimate = estimateSell(0.4, 150, "YES", 10);
    expect(estimate?.proceeds).toBeGreaterThan(3.5);
    expect(estimate?.proceeds).toBeLessThan(4);
  });

  it("gives nothing for an empty, negative or impossible input", () => {
    expect(estimateBuy(yesPrice, 150, "YES", 0)).toBeNull();
    expect(estimateBuy(yesPrice, 150, "YES", -5)).toBeNull();
    expect(estimateBuy(yesPrice, 150, "YES", Number.NaN)).toBeNull();
    expect(estimateBuy(0, 150, "YES", 10)).toBeNull();
    expect(estimateBuy(1, 150, "YES", 10)).toBeNull();
    expect(estimateSell(yesPrice, 0, "NO", 10)).toBeNull();
  });
});
