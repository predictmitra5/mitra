import { describe, expect, it } from "vitest";
import { EMPTY_POSITION, amountInMarket, applyBuy, applySell, remainingAllowance } from "./position";
import { MICRO_PER_UNIT } from "./units";

const points = (n: number) => n * MICRO_PER_UNIT;

describe("per-market allowance", () => {
  it("counts the cost basis held on both sides", () => {
    const position = applyBuy(applyBuy(EMPTY_POSITION, "YES", points(50), points(30)), "NO", points(20), points(12));
    expect(amountInMarket(position)).toBe(points(42));
    expect(remainingAllowance(position, points(100))).toBe(points(58));
  });

  it("never goes below zero", () => {
    const position = applyBuy(EMPTY_POSITION, "YES", points(200), points(120));
    expect(remainingAllowance(position, points(100))).toBe(0);
  });
});

describe("applySell", () => {
  it("releases cost basis at average cost", () => {
    const after = applySell(applyBuy(EMPTY_POSITION, "YES", points(100), points(60)), "YES", points(25));
    expect(after.yesSharesMicro).toBe(points(75));
    expect(after.yesCostBasisMicro).toBe(points(45));
  });

  it("clears the basis when a whole side is sold", () => {
    const position = applyBuy(EMPTY_POSITION, "NO", 333_333, 123_457);
    expect(applySell(position, "NO", 333_333)).toEqual(EMPTY_POSITION);
  });

  it("rounds the kept basis up so rounding never frees extra allowance", () => {
    const position = applyBuy(EMPTY_POSITION, "YES", 3, 10);
    // 10 × 2/3 = 6.67 is kept as 7.
    expect(applySell(position, "YES", 1).yesCostBasisMicro).toBe(7);
  });

  it("stays exact when basis × shares exceeds 2^53", () => {
    const position = applyBuy(EMPTY_POSITION, "YES", points(5_000), points(100));
    expect(applySell(position, "YES", points(1_000)).yesCostBasisMicro).toBe(points(80));
  });

  it("rejects selling more than is held", () => {
    expect(() => applySell(EMPTY_POSITION, "YES", 1)).toThrow(RangeError);
  });
});
