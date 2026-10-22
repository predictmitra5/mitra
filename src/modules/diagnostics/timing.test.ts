import { describe, expect, it } from "vitest";
import { optional, SLOW_MS, timed, timingEnabled } from "./timing";

function clockFrom(...times: number[]) {
  return () => times.shift() ?? 0;
}

describe("timed", () => {
  it("passes the result through and logs only a slow step by default", async () => {
    const lines: string[] = [];
    expect(await timed("fast", async () => 7, { clock: clockFrom(0, 20), log: (l) => lines.push(l), always: false })).toBe(7);
    await timed("slow", async () => 1, { clock: clockFrom(0, SLOW_MS + 5), log: (l) => lines.push(l), always: false });
    expect(lines).toEqual([`[timing] slow ${SLOW_MS + 5}ms slow`]);
  });

  it("logs every step when enabled, and passes a failure through", async () => {
    const lines: string[] = [];
    await timed("step", async () => 1, { clock: clockFrom(0, 12), log: (l) => lines.push(l), always: true });
    await expect(timed("broken", async () => { throw new Error("no"); }, { clock: clockFrom(0, 3), log: (l) => lines.push(l), always: true })).rejects.toThrow("no");
    expect(lines).toEqual(["[timing] step 12ms", "[timing] broken 3ms failed"]);
  });

  it("is switched on only by MITRA_TIMING=1", () => {
    expect(timingEnabled({})).toBe(false);
    expect(timingEnabled({ MITRA_TIMING: "0" })).toBe(false);
    expect(timingEnabled({ MITRA_TIMING: "1" })).toBe(true);
  });
});

describe("optional", () => {
  it("gives the read's value, or the fallback when it fails", async () => {
    expect(await optional(Promise.resolve([1]), [])).toEqual([1]);
    expect(await optional(Promise.reject(new Error("down")), [] as number[])).toEqual([]);
  });
});
