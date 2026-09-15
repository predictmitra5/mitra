import { describe, expect, it } from "vitest";
import {
  applyTrade,
  buyCost,
  cost,
  maxSubsidy,
  price,
  sellProceeds,
  sharesForSpend,
  stateAtProbability,
  type LmsrState,
} from "./lmsr";

const fresh = (liquidity = 100): LmsrState => ({ liquidity, yesShares: 0, noShares: 0 });
const sides = ["YES", "NO"] as const;

describe("price", () => {
  it("opens at 50% when both sides are equal", () => {
    expect(price(fresh(), "YES")).toBeCloseTo(0.5, 12);
  });

  it("keeps YES and NO prices summing to 1", () => {
    const state = { liquidity: 150, yesShares: 240, noShares: 35 };
    expect(price(state, "YES") + price(state, "NO")).toBeCloseTo(1, 12);
  });

  it("rises for the side that is bought", () => {
    for (const side of sides) {
      const before = fresh();
      const after = applyTrade(before, side, 20);
      expect(price(after, side)).toBeGreaterThan(price(before, side));
    }
  });
});

describe("buyCost", () => {
  it("equals the change in the cost function", () => {
    const state = { liquidity: 80, yesShares: 30, noShares: 55 };
    for (const side of sides) {
      const expected = cost(applyTrade(state, side, 42.5)) - cost(state);
      expect(buyCost(state, side, 42.5)).toBeCloseTo(expected, 9);
    }
  });

  it("charges exactly n points for n YES shares plus n NO shares", () => {
    const state = fresh(120);
    const yesCost = buyCost(state, "YES", 75);
    const noCost = buyCost(applyTrade(state, "YES", 75), "NO", 75);
    expect(yesCost + noCost).toBeCloseTo(75, 9);
  });
});

describe("sharesForSpend", () => {
  it("inverts buyCost", () => {
    const state = { liquidity: 200, yesShares: 10, noShares: 90 };
    for (const side of sides) {
      for (const spend of [0.01, 1, 100, 1000]) {
        expect(buyCost(state, side, sharesForSpend(state, side, spend))).toBeCloseTo(spend, 7);
      }
    }
  });
});

describe("sellProceeds", () => {
  it("refunds the purchase cost when shares are sold straight back", () => {
    const state = fresh();
    const shares = sharesForSpend(state, "NO", 60);
    expect(sellProceeds(applyTrade(state, "NO", shares), "NO", shares)).toBeCloseTo(60, 9);
  });
});

describe("maxSubsidy", () => {
  it("bounds the market maker's loss for a market opened at 50%", () => {
    const liquidity = 100;
    let state = fresh(liquidity);
    let collected = 0;
    for (let i = 0; i < 50; i++) {
      state = applyTrade(state, "YES", sharesForSpend(state, "YES", 100));
      collected += 100;
    }
    const lossIfYesWins = state.yesShares - collected;
    expect(lossIfYesWins).toBeGreaterThan(0);
    expect(lossIfYesWins).toBeLessThanOrEqual(maxSubsidy(liquidity) + 1e-9);
  });
});

describe("stateAtProbability", () => {
  it("opens the market at the requested YES price", () => {
    for (const probability of [0.05, 0.3, 0.5, 0.82]) {
      expect(price(stateAtProbability(90, probability), "YES")).toBeCloseTo(probability, 12);
    }
  });

  it("rejects certain outcomes", () => {
    expect(() => stateAtProbability(90, 0)).toThrow(RangeError);
    expect(() => stateAtProbability(90, 1)).toThrow(RangeError);
  });
});
