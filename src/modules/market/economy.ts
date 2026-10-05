import { MICRO_PER_UNIT } from "./units";

/**
 * Points economy decided by the owner on 2026-09-15. The owner called these
 * values "subject to change", so code reads them from here instead of repeating
 * the numbers. See docs/MARKETS.md.
 */
export interface EconomySettings {
  startingBalanceMicro: number;
  refillsPerMonth: number;
  /** IANA time zone whose calendar months limit refills. */
  refillTimeZone: string;
  /** Maximum cost basis one person may hold in a single market. */
  perMarketLimitMicro: number;
  /** LMSR liquidity parameter b, in points, for new markets. */
  defaultLiquidity: number;
}

export const ECONOMY: EconomySettings = {
  startingBalanceMicro: 1_000 * MICRO_PER_UNIT,
  refillsPerMonth: 2,
  refillTimeZone: "America/New_York",
  perMarketLimitMicro: 100 * MICRO_PER_UNIT,
  defaultLiquidity: 150,
};
