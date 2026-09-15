import { describe, expect, it } from "vitest";
import { ECONOMY } from "./economy";
import { calendarMonth, refillDecision } from "./refill";
import { MICRO_PER_UNIT } from "./units";

const points = (n: number) => n * MICRO_PER_UNIT;

describe("calendarMonth", () => {
  it("uses Eastern time rather than UTC", () => {
    // 11:30 pm on 30 September in New York is already October in UTC.
    expect(calendarMonth(new Date("2026-10-01T03:30:00Z"), "America/New_York")).toBe("2026-09");
    expect(calendarMonth(new Date("2026-10-01T04:30:00Z"), "America/New_York")).toBe("2026-10");
  });
});

describe("refillDecision", () => {
  const now = new Date("2026-09-20T15:00:00Z");

  it("tops the balance back up to the starting balance", () => {
    expect(refillDecision({ balanceMicro: points(275), previousRefillsAt: [], now, settings: ECONOMY })).toEqual({
      eligible: true,
      amountMicro: points(725),
    });
  });

  it("refuses when the balance is not below the starting balance", () => {
    expect(refillDecision({ balanceMicro: points(1_000), previousRefillsAt: [], now, settings: ECONOMY })).toEqual({
      eligible: false,
      reason: "BALANCE_NOT_BELOW_START",
    });
  });

  it("allows only two refills per Eastern calendar month", () => {
    const earlier = [new Date("2026-09-02T12:00:00Z"), new Date("2026-09-10T12:00:00Z")];
    expect(refillDecision({ balanceMicro: 0, previousRefillsAt: earlier, now, settings: ECONOMY })).toEqual({
      eligible: false,
      reason: "MONTHLY_LIMIT_REACHED",
    });
  });

  it("does not count a refill from the previous Eastern month", () => {
    // 1 September 02:00 UTC is still 31 August in New York.
    const earlier = [new Date("2026-09-01T02:00:00Z"), new Date("2026-09-10T12:00:00Z")];
    expect(refillDecision({ balanceMicro: 0, previousRefillsAt: earlier, now, settings: ECONOMY })).toEqual({
      eligible: true,
      amountMicro: points(1_000),
    });
  });
});
