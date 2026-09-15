import { buyCost, price, sellProceeds, sharesForSpend, type LmsrState, type Side } from "./lmsr";
import { MICRO_PER_UNIT, assertNonNegativeMicro, assertPositiveMicro } from "./units";

/**
 * Ledger-facing market-maker state. Share counts are integer micro-shares.
 * Rounding always favours the market maker: traders receive whole micro-shares
 * rounded down, pay costs rounded up, and receive sale proceeds rounded down.
 */
export interface MarketMakerState {
  liquidity: number;
  yesSharesMicro: number;
  noSharesMicro: number;
}

export interface BuyQuote {
  side: Side;
  sharesMicro: number;
  costMicro: number;
  priceBefore: number;
  priceAfter: number;
  stateAfter: MarketMakerState;
}

export interface SellQuote {
  side: Side;
  sharesMicro: number;
  proceedsMicro: number;
  priceBefore: number;
  priceAfter: number;
  stateAfter: MarketMakerState;
}

/** Quote spending at most `spendMicro` micro-points on `side`. */
export function quoteBuy(state: MarketMakerState, side: Side, spendMicro: number): BuyQuote {
  assertMarketMakerState(state);
  assertPositiveMicro(spendMicro, "spendMicro");
  const lmsr = toLmsr(state);

  let sharesMicro = Math.floor(sharesForSpend(lmsr, side, spendMicro / MICRO_PER_UNIT) * MICRO_PER_UNIT);
  let costMicro = roundedBuyCost(lmsr, side, sharesMicro);
  // Floating-point error can push the rounded-up cost one micro-point past the
  // spend. Give the trader fewer shares rather than charging more than asked.
  while (sharesMicro > 0 && costMicro > spendMicro) {
    sharesMicro -= 1;
    costMicro = roundedBuyCost(lmsr, side, sharesMicro);
  }
  if (sharesMicro <= 0) {
    throw new RangeError("spend is too small to buy any shares");
  }

  const stateAfter = withShares(state, side, sharesMicro);
  return {
    side,
    sharesMicro,
    costMicro,
    priceBefore: price(lmsr, side),
    priceAfter: price(toLmsr(stateAfter), side),
    stateAfter,
  };
}

/** Quote returning `sharesMicro` micro-shares of `side` to the market maker. */
export function quoteSell(state: MarketMakerState, side: Side, sharesMicro: number): SellQuote {
  assertMarketMakerState(state);
  assertPositiveMicro(sharesMicro, "sharesMicro");
  const issued = side === "YES" ? state.yesSharesMicro : state.noSharesMicro;
  if (sharesMicro > issued) {
    throw new RangeError("cannot sell more shares than the market maker has issued");
  }
  const lmsr = toLmsr(state);
  const proceedsMicro = Math.floor(sellProceeds(lmsr, side, sharesMicro / MICRO_PER_UNIT) * MICRO_PER_UNIT);
  const stateAfter = withShares(state, side, -sharesMicro);
  return {
    side,
    sharesMicro,
    proceedsMicro,
    priceBefore: price(lmsr, side),
    priceAfter: price(toLmsr(stateAfter), side),
    stateAfter,
  };
}

export function toLmsr(state: MarketMakerState): LmsrState {
  return {
    liquidity: state.liquidity,
    yesShares: state.yesSharesMicro / MICRO_PER_UNIT,
    noShares: state.noSharesMicro / MICRO_PER_UNIT,
  };
}

function roundedBuyCost(lmsr: LmsrState, side: Side, sharesMicro: number): number {
  return Math.ceil(buyCost(lmsr, side, sharesMicro / MICRO_PER_UNIT) * MICRO_PER_UNIT);
}

function withShares(state: MarketMakerState, side: Side, deltaMicro: number): MarketMakerState {
  return side === "YES"
    ? { ...state, yesSharesMicro: state.yesSharesMicro + deltaMicro }
    : { ...state, noSharesMicro: state.noSharesMicro + deltaMicro };
}

function assertMarketMakerState(state: MarketMakerState): void {
  if (!(Number.isFinite(state.liquidity) && state.liquidity > 0)) {
    throw new RangeError("liquidity must be a positive finite number");
  }
  assertNonNegativeMicro(state.yesSharesMicro, "yesSharesMicro");
  assertNonNegativeMicro(state.noSharesMicro, "noSharesMicro");
}
