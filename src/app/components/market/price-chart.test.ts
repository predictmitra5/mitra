import { describe, expect, it } from "vitest";
import { windowed } from "./price-chart";

const H = 3_600_000;
const series = [
  { t: 0, v: 5000 },
  { t: 10 * 24 * H, v: 6000 },
  { t: 20 * 24 * H, v: 5500 },
  { t: 20 * 24 * H + 2 * H, v: 5800 },
];

describe("chart ranges", () => {
  it("shows everything for All, or when the history is shorter than the range", () => {
    expect(windowed(series, Infinity)).toBe(series);
    expect(windowed(series.slice(2), 7 * 24 * H)).toEqual(series.slice(2));
  });

  it("carries the price in force to the left edge of the range", () => {
    // A week back from the last point starts after the 10-day trade, at 6000.
    const week = windowed(series, 7 * 24 * H);
    expect(week[0]).toEqual({ t: series[3].t - 7 * 24 * H, v: 6000 });
    expect(week.slice(1)).toEqual(series.slice(2));
  });

  it("draws a flat line across a range with no trades in it", () => {
    const quiet = [{ t: 0, v: 4000 }, { t: 30 * 24 * H, v: 4200 }];
    const day = windowed(quiet, 24 * H);
    expect(day).toEqual([{ t: 29 * 24 * H, v: 4000 }, { t: 30 * 24 * H, v: 4200 }]);
    expect(windowed([{ t: 0, v: 4000 }], 24 * H)).toHaveLength(1);
  });
});
