import { describe, expect, it } from "vitest";
import { formatMicro, parseTradeAmount } from "./input";

describe("trade decimal input", () => {
  it.each([["0.000001", 1], [" 10.123456 ", 10123456], ["00100.10", 100100000], ["9007199254.740991", Number.MAX_SAFE_INTEGER]])("parses %s exactly", (text, expected) => {
    expect(parseTradeAmount(text)).toBe(expected);
  });
  it.each(["", "0", "0.000000", "0.0000001", "-1", "+1", "1e2", "NaN", "Infinity", "1,000", "1.", ".1", "9007199254.740992", "9".repeat(31), null, 1])("rejects ambiguous or unsafe amounts: %s", (text) => {
    expect(parseTradeAmount(text)).toBeNull();
  });
  it("shows the last micro-share instead of rounding it away", () => {
    expect(formatMicro(1)).toBe("0.000001");
    expect(formatMicro(100_000_001)).toBe("100.000001");
  });
});
