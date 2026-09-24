import { price, sellProceeds, sharesForSpend, stateAtProbability, type Side } from "./lmsr";

/*
 * The trade panel's estimate (decided 2026-09-24: "To win" and quick amounts).
 * In a binary LMSR the cost of a trade depends only on the current price and
 * the liquidity, so both are enough to estimate one exactly, price impact
 * included, without the market maker's private share counts. It is still an
 * estimate: other trades can move the price first, and the server's preview,
 * which rounds in the market maker's favour, is the figure a trader confirms.
 * Pure, so the browser can run it as someone types.
 */

export type BuyEstimate = { shares: number; averagePrice: number; toWin: number; priceAfter: number };
export type SellEstimate = { proceeds: number; averagePrice: number; priceAfter: number };

function stateAt(yesPrice: number, liquidity: number) {
  if (!(yesPrice > 0 && yesPrice < 1) || !(liquidity > 0)) return null;
  return stateAtProbability(liquidity, yesPrice);
}

/** Spending `points` on `side`: the shares it buys, their average price, and the payout if that side wins. */
export function estimateBuy(yesPrice: number, liquidity: number, side: Side, points: number): BuyEstimate | null {
  const state = stateAt(yesPrice, liquidity);
  if (!state || !(points > 0) || !Number.isFinite(points)) return null;
  try {
    const shares = sharesForSpend(state, side, points);
    if (!(shares > 0)) return null;
    const after = side === "YES" ? { ...state, yesShares: state.yesShares + shares } : { ...state, noShares: state.noShares + shares };
    // Each share pays one point if its side wins.
    return { shares, averagePrice: points / shares, toWin: shares, priceAfter: price(after, side) };
  } catch {
    return null;
  }
}

/** Selling `shares` of `side` back: what it returns and at what average price. */
export function estimateSell(yesPrice: number, liquidity: number, side: Side, shares: number): SellEstimate | null {
  const state = stateAt(yesPrice, liquidity);
  if (!state || !(shares > 0) || !Number.isFinite(shares)) return null;
  // The opening state issues shares on one side only. Adding the same number to
  // both sides leaves the price, and so every cost, unchanged, and keeps the
  // counts positive after the sale.
  const lifted = { ...state, yesShares: state.yesShares + shares, noShares: state.noShares + shares };
  try {
    const proceeds = sellProceeds(lifted, side, shares);
    const after = side === "YES" ? { ...lifted, yesShares: lifted.yesShares - shares } : { ...lifted, noShares: lifted.noShares - shares };
    return { proceeds, averagePrice: proceeds / shares, priceAfter: price(after, side) };
  } catch {
    return null;
  }
}
