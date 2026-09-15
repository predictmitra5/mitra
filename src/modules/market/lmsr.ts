/**
 * Binary logarithmic market scoring rule (Hanson, 2002).
 *
 * The market maker's cost function is C(q) = b * ln(e^(qYes/b) + e^(qNo/b)),
 * and every trade costs the change in C. Values here are floating-point
 * points and shares. Anything that touches the ledger must go through
 * quote.ts, which converts to integers and rounds in the market maker's favour.
 */

export type Side = "YES" | "NO";

export interface LmsrState {
  /** Liquidity parameter b, in points. Larger b means smaller price moves and a larger subsidy. */
  liquidity: number;
  /** Shares the market maker has issued on each side, including any opening offset. */
  yesShares: number;
  noShares: number;
}

export function price(state: LmsrState, side: Side): number {
  assertState(state);
  const { liquidity: b, yesShares, noShares } = state;
  const exponent = side === "YES" ? (noShares - yesShares) / b : (yesShares - noShares) / b;
  return 1 / (1 + Math.exp(exponent));
}

/** C(q), computed with log-sum-exp so large share counts do not overflow. */
export function cost(state: LmsrState): number {
  assertState(state);
  const b = state.liquidity;
  const yes = state.yesShares / b;
  const no = state.noShares / b;
  const max = Math.max(yes, no);
  return b * (max + Math.log(Math.exp(yes - max) + Math.exp(no - max)));
}

/** Points needed to buy `shares` of `side`: C(q + shares) - C(q). */
export function buyCost(state: LmsrState, side: Side, shares: number): number {
  assertQuantity(shares, "shares");
  const b = state.liquidity;
  return b * Math.log1p(price(state, side) * Math.expm1(shares / b));
}

/** Shares of `side` that `spend` points buys; the inverse of buyCost. */
export function sharesForSpend(state: LmsrState, side: Side, spend: number): number {
  assertQuantity(spend, "spend");
  const b = state.liquidity;
  const shares = b * Math.log1p(Math.expm1(spend / b) / price(state, side));
  if (!Number.isFinite(shares)) {
    throw new RangeError("spend is too large for this market's liquidity");
  }
  return shares;
}

/** Points paid out for returning `shares` of `side`: C(q) - C(q - shares). */
export function sellProceeds(state: LmsrState, side: Side, shares: number): number {
  assertQuantity(shares, "shares");
  const b = state.liquidity;
  return -b * Math.log1p(price(state, side) * Math.expm1(-shares / b));
}

export function applyTrade(state: LmsrState, side: Side, shareDelta: number): LmsrState {
  return side === "YES"
    ? { ...state, yesShares: state.yesShares + shareDelta }
    : { ...state, noShares: state.noShares + shareDelta };
}

/** Opening state whose YES price equals `probability`, with no shares on the cheaper side. */
export function stateAtProbability(liquidity: number, probability: number): LmsrState {
  if (!(probability > 0 && probability < 1)) {
    throw new RangeError("probability must be strictly between 0 and 1");
  }
  const offset = liquidity * Math.log(probability / (1 - probability));
  const state = offset >= 0
    ? { liquidity, yesShares: offset, noShares: 0 }
    : { liquidity, yesShares: 0, noShares: -offset };
  assertState(state);
  return state;
}

/**
 * Worst-case market-maker loss for a market that opens at 50%: b * ln 2.
 * A market opened at another price can lose up to -b * ln(opening price of the side that wins).
 */
export function maxSubsidy(liquidity: number): number {
  return liquidity * Math.LN2;
}

function assertState(state: LmsrState): void {
  if (!(Number.isFinite(state.liquidity) && state.liquidity > 0)) {
    throw new RangeError("liquidity must be a positive finite number");
  }
  if (!Number.isFinite(state.yesShares) || !Number.isFinite(state.noShares)) {
    throw new RangeError("share counts must be finite");
  }
}

function assertQuantity(value: number, name: string): void {
  if (!(Number.isFinite(value) && value >= 0)) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
