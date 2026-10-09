import { describe, expect, it } from "vitest";
import { formatMoment, formatWindow, parseLocalDateTime, toLocalInput, zonedTimeToUtc } from "./time";
import { proposalStatusLine, publicStatus, statusLine } from "./status";

const ET = "America/New_York";

describe("event times", () => {
  it("reads a form's local time in the campus's zone, across daylight saving", () => {
    expect(parseLocalDateTime("2026-10-16T21:00", ET)).toEqual(new Date("2026-10-17T01:00:00Z"));
    expect(parseLocalDateTime("2026-12-04T21:00", ET)).toEqual(new Date("2026-12-05T02:00:00Z"));
    expect(parseLocalDateTime("2026-10-16T21:00", "America/Chicago")).toEqual(new Date("2026-10-17T02:00:00Z"));
    expect(zonedTimeToUtc(2026, 11, 1, 1, 30, 0, ET).getTime()).toBeGreaterThan(0);
  });

  it("refuses anything that is not a real date and time", () => {
    for (const value of ["", "2026-02-30T10:00", "2026-10-16 21:00", "2026-10-16T25:00", null, 7]) {
      expect(parseLocalDateTime(value, ET)).toBeNull();
    }
  });

  it("writes an instant back as a form value", () => {
    expect(toLocalInput(new Date("2026-10-17T01:00:00Z"), ET)).toBe("2026-10-16T21:00");
  });

  it("formats an overnight window on one line, and a long one in full", () => {
    expect(formatWindow(new Date("2026-10-17T01:00:00Z"), new Date("2026-10-17T06:00:00Z"), ET)).toBe("Fri, Oct 16, 9:00 PM – 2:00 AM EDT");
    expect(formatWindow(new Date("2026-10-17T01:00:00Z"), new Date("2026-10-19T01:00:00Z"), ET))
      .toBe("Fri, Oct 16, 9:00 PM EDT – Sun, Oct 18, 9:00 PM EDT");
    expect(formatMoment(new Date("2026-12-05T02:00:00Z"), ET)).toBe("Fri, Dec 4, 9:00 PM EST");
  });
});

describe("status words", () => {
  it("map the engine's states onto the brief's words", () => {
    expect(publicStatus({ status: "open", tradingOpen: true })).toBe("open");
    expect(publicStatus({ status: "open", tradingOpen: false })).toBe("closed");
    expect(publicStatus({ status: "closed", tradingOpen: false })).toBe("closed");
    expect(publicStatus({ status: "ruled", tradingOpen: false })).toBe("resolved");
    expect(publicStatus({ status: "settled", tradingOpen: false })).toBe("resolved");
    expect(publicStatus({ status: "cancelled", tradingOpen: false })).toBe("void");
  });

  it("say where a market stands in one line", () => {
    expect(statusLine({ status: "open", tradingOpen: true, ruledOutcome: null })).toBe("Open");
    expect(statusLine({ status: "closed", tradingOpen: false, ruledOutcome: null })).toBe("Trading closed · awaiting result");
    expect(statusLine({ status: "ruled", tradingOpen: false, ruledOutcome: "no", contestOpen: true })).toBe("Resolved: No · objections open");
    expect(statusLine({ status: "settled", tradingOpen: false, ruledOutcome: "yes" })).toBe("Resolved: Yes");
    expect(statusLine({ status: "cancelled", tradingOpen: false, ruledOutcome: null })).toBe("Void · refunded");
    expect(proposalStatusLine("pending")).toContain("Nothing is published");
  });
});
