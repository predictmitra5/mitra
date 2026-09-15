import type { Side } from "./lmsr";
import { assertNonNegativeMicro, assertPositiveMicro } from "./units";

/** One trader's holdings in one market, in micro-shares and micro-points. */
export interface Position {
  yesSharesMicro: number;
  noSharesMicro: number;
  /** What the trader paid for the YES shares they still hold. */
  yesCostBasisMicro: number;
  noCostBasisMicro: number;
}

export const EMPTY_POSITION: Position = {
  yesSharesMicro: 0,
  noSharesMicro: 0,
  yesCostBasisMicro: 0,
  noCostBasisMicro: 0,
};

/** Points a trader currently has in the market: the cost basis of every share still held. */
export function amountInMarket(position: Position): number {
  return position.yesCostBasisMicro + position.noCostBasisMicro;
}

/** How much more the per-market limit lets this trader spend. */
export function remainingAllowance(position: Position, limitMicro: number): number {
  assertNonNegativeMicro(limitMicro, "limitMicro");
  return Math.max(0, limitMicro - amountInMarket(position));
}

export function sharesHeld(position: Position, side: Side): number {
  return side === "YES" ? position.yesSharesMicro : position.noSharesMicro;
}

export function applyBuy(position: Position, side: Side, sharesMicro: number, costMicro: number): Position {
  assertPositiveMicro(sharesMicro, "sharesMicro");
  assertPositiveMicro(costMicro, "costMicro");
  return side === "YES"
    ? {
        ...position,
        yesSharesMicro: position.yesSharesMicro + sharesMicro,
        yesCostBasisMicro: position.yesCostBasisMicro + costMicro,
      }
    : {
        ...position,
        noSharesMicro: position.noSharesMicro + sharesMicro,
        noCostBasisMicro: position.noCostBasisMicro + costMicro,
      };
}

/**
 * Selling releases cost basis at average cost. The basis kept for the remaining
 * shares rounds up, so rounding never frees more per-market allowance than was paid.
 */
export function applySell(position: Position, side: Side, sharesMicro: number): Position {
  assertPositiveMicro(sharesMicro, "sharesMicro");
  const held = sharesHeld(position, side);
  if (sharesMicro > held) {
    throw new RangeError("cannot sell more shares than the position holds");
  }
  const basis = side === "YES" ? position.yesCostBasisMicro : position.noCostBasisMicro;
  const remainingShares = held - sharesMicro;
  // BigInt keeps basis × shares exact when the product passes 2^53.
  const remainingBasis = Number(
    (BigInt(basis) * BigInt(remainingShares) + BigInt(held) - BigInt(1)) / BigInt(held),
  );
  return side === "YES"
    ? { ...position, yesSharesMicro: remainingShares, yesCostBasisMicro: remainingBasis }
    : { ...position, noSharesMicro: remainingShares, noCostBasisMicro: remainingBasis };
}
