/**
 * Points and share quantities are stored as integers so ledger sums are
 * exact. One point is 1,000,000 micro-points and one share is 1,000,000
 * micro-shares; a winning micro-share pays one micro-point.
 */
export const MICRO_PER_UNIT = 1_000_000;

export function toMicro(units: number): number {
  const micro = Math.round(units * MICRO_PER_UNIT);
  if (!Number.isSafeInteger(micro)) {
    throw new RangeError("amount is outside the supported range");
  }
  return micro;
}

export function fromMicro(micro: number): number {
  return micro / MICRO_PER_UNIT;
}

export function assertPositiveMicro(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

export function assertNonNegativeMicro(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}
