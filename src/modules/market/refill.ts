import type { EconomySettings } from "./economy";
import { assertNonNegativeMicro } from "./units";

export type RefillDecision =
  | { eligible: true; amountMicro: number }
  | { eligible: false; reason: "BALANCE_NOT_BELOW_START" | "MONTHLY_LIMIT_REACHED" };

/** Calendar month such as "2026-09" for an instant in an IANA time zone. */
export function calendarMonth(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(at);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) {
    throw new RangeError("could not determine the calendar month");
  }
  return `${year}-${month}`;
}

/**
 * A refill restores the balance to the starting balance when it is below it,
 * at most `refillsPerMonth` times per calendar month. `balanceMicro` is the
 * available balance; whether open positions should count is awaiting the
 * owner's confirmation (docs/MARKETS.md).
 */
export function refillDecision(input: {
  balanceMicro: number;
  previousRefillsAt: readonly Date[];
  now: Date;
  settings: Pick<EconomySettings, "startingBalanceMicro" | "refillsPerMonth" | "refillTimeZone">;
}): RefillDecision {
  const { balanceMicro, previousRefillsAt, now, settings } = input;
  assertNonNegativeMicro(balanceMicro, "balanceMicro");
  if (balanceMicro >= settings.startingBalanceMicro) {
    return { eligible: false, reason: "BALANCE_NOT_BELOW_START" };
  }
  const month = calendarMonth(now, settings.refillTimeZone);
  const usedThisMonth = previousRefillsAt.filter(
    (at) => calendarMonth(at, settings.refillTimeZone) === month,
  ).length;
  if (usedThisMonth >= settings.refillsPerMonth) {
    return { eligible: false, reason: "MONTHLY_LIMIT_REACHED" };
  }
  return { eligible: true, amountMicro: settings.startingBalanceMicro - balanceMicro };
}
