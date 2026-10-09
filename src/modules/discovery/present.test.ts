import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  changeLabel,
  closesInWords,
  initials,
  percent,
  pointsText,
  tickerLabel,
  timeLeft,
  volumeLabel,
} from "./present";

const now = new Date("2026-09-22T16:00:00Z");
const hour = 3_600_000;

describe("ticker labels", () => {
  it("names the venue", () => {
    expect(tickerLabel("Will Midway on High sell more than 1,000 drinks?", "Midway on High")).toBe("Midway on High");
  });

  it("stays short, cutting on a word", () => {
    const long = tickerLabel("Will it happen?", "The Very Long Name of a Campus Coffee House and Bakery");
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });

  it("falls back to the question, then to a word, when there is no venue", () => {
    expect(tickerLabel("Will Sam be offered admission to Chess Club?", null)).toMatch(/^Will Sam be offered.*…$/);
    expect(tickerLabel("", null)).toBe("Market");
  });
});

describe("categories", () => {
  it("names each event category, and calls anything else a market", () => {
    expect(categoryLabel("nightlife")).toBe("Nightlife");
    expect(categoryLabel("entertainment")).toBe("Entertainment");
    expect(categoryLabel("campus")).toBe("Campus");
    expect(categoryLabel(null)).toBe("Market");
    expect(categoryLabel("gpa")).toBe("Market");
  });
});

describe("initials", () => {
  it("takes the first and last initial", () => {
    expect(initials("Maya")).toBe("M");
    expect(initials("Jordan Fictional Rivera")).toBe("JR");
    expect(initials("  priya  sharma ")).toBe("PS");
    expect(initials("")).toBe("?");
  });
});

describe("points", () => {
  it("reads volume as whole points traded", () => {
    expect(volumeLabel(0)).toBe("No trades yet");
    expect(volumeLabel(400_000)).toBe("<1 pt traded");
    expect(volumeLabel(45_000_000)).toBe("45 pts traded");
    expect(volumeLabel(4_138_400_000)).toBe("4,138 pts traded");
  });

  it("shows other amounts to one decimal", () => {
    expect(pointsText(47_060_000)).toBe("47.1");
    expect(pointsText(1_000_000_000)).toBe("1,000.0");
    expect(pointsText(1_000_000_000, 0)).toBe("1,000");
  });
});

describe("percent", () => {
  it("never shows a binary market as certain", () => {
    expect(percent(0.5)).toBe(50);
    expect(percent(0.001)).toBe(1);
    expect(percent(0.999)).toBe(99);
  });
});

describe("price changes", () => {
  it("reads basis points as percentage points to one decimal, with direction apart from colour", () => {
    expect(changeLabel(620)).toEqual({ text: "6.2", direction: "up" });
    expect(changeLabel(-1150)).toEqual({ text: "11.5", direction: "down" });
    expect(changeLabel(4)).toEqual({ text: "0.0", direction: "flat" });
    expect(changeLabel(0)).toEqual({ text: "0.0", direction: "flat" });
  });

  it("rounds equal moves up and down to the same size", () => {
    // Math.round(-0.5) is -0 but Math.round(0.5) is 1; the label must not be lopsided.
    expect(changeLabel(625).text).toBe(changeLabel(-625).text);
    expect(changeLabel(5).text).toBe(changeLabel(-5).text);
  });
});

describe("time labels", () => {
  it("counts down to a deadline in words", () => {
    expect(timeLeft(new Date(now.getTime() - hour), now)).toBe("Closed");
    expect(timeLeft(new Date(now.getTime() + 30 * 60_000), now)).toBe("Under an hour left");
    expect(timeLeft(new Date(now.getTime() + 1.5 * hour), now)).toBe("1 hour left");
    expect(timeLeft(new Date(now.getTime() + 20 * hour), now)).toBe("20 hours left");
    expect(timeLeft(new Date(now.getTime() + 12 * 24 * hour), now)).toBe("12 days left");
    expect(timeLeft(new Date(now.getTime() + 120 * 24 * hour), now)).toBe("4 months left");
  });

  it("says when a market page closes", () => {
    expect(closesInWords(new Date(now.getTime() + 12 * 24 * hour), now)).toBe("closes in 12 days");
    expect(closesInWords(new Date(now.getTime() - hour), now)).toBe("trading closed");
  });
});
