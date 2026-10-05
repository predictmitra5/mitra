import { describe, expect, it } from "vitest";
import {
  cardTitle,
  categoryLabel,
  changeLabel,
  closesInWords,
  initials,
  percent,
  pointsText,
  stakeText,
  tickerLabel,
  timeLeft,
  volumeLabel,
} from "./present";

const now = new Date("2026-09-22T16:00:00Z");
const hour = 3_600_000;

describe("the stake, in as few words as possible", () => {
  it("pulls the GPA out of a grades goal, without a trailing zero", () => {
    expect(stakeText("gpa", "Will Maya earn at least a 3.80 GPA for Fall 2026?")).toBe("3.8 GPA");
    expect(stakeText("gpa", "Will Maya earn at least an 4.00 GPA for Spring 2027?")).toBe("4 GPA");
  });

  it("pulls the club out of a club goal", () => {
    expect(stakeText("club", "Will Andre be offered admission to Chess Club by November 1, 2026?")).toBe("Chess Club");
  });

  it("names the company for an internship goal", () => {
    expect(stakeText("internship", "Will Priya receive a written internship offer from Google by March 1, 2027?"))
      .toBe("Google offer");
  });

  it("keeps the achievement for a gym goal, as written", () => {
    expect(stakeText("gym", "Will Luis deadlift 315 pounds by December 15, 2026?")).toBe("deadlift 315 pounds");
    expect(stakeText("gym", "Will Luis run a sub-25-minute 5K by December 15, 2026?")).toBe("run a sub-25-minute 5K");
  });

  it("never takes a surname as part of the achievement", () => {
    // Real display names have two words; the template writes the full name.
    expect(stakeText("gym", "Will Sam Rivera bench press 225 lb by September 14, 2026?", "Sam Rivera")).toBe("bench press 225 lb");
    expect(stakeText("gym", "Will Sam Rivera hold a 3-minute plank by May 1, 2027?", "Sam Rivera")).toBe("hold a 3-minute plank");
    expect(stakeText("gym", "Will Maya Chen Lopez deadlift 315 pounds by May 1, 2027?", "Maya Chen Lopez")).toBe("deadlift 315 pounds");
  });

  it("names the race distance and any target time for a running goal", () => {
    expect(stakeText("running", "Will Jordan Patel run a half marathon in under 1:59:00 by April 30, 2027?", "Jordan Patel"))
      .toBe("half marathon under 1:59:00");
    expect(stakeText("running", "Will Jordan Patel run a 5K by October 30, 2026?", "Jordan Patel")).toBe("5K");
    expect(stakeText("running", "Will Jo Lee run an 8-mile race in under 1:05:00 by May 1, 2027?")).toBe("8-mile race under 1:05:00");
  });

  it("falls back to the verb phrase for a goal in the person's own words", () => {
    expect(stakeText("own_words", "Will Sam launch the app?", "Sam")).toBe("launch the app");
    expect(stakeText("own_words", "Will I run a half marathon?")).toBe("run a half marathon");
  });

  it("strips a two-word name exactly when it is known, instead of guessing its length", () => {
    expect(stakeText("own_words", "Will Sam Lee launch the app?", "Sam Lee")).toBe("launch the app");
  });

  it("keeps a trailing 'by' phrase in the person's own words", () => {
    expect(stakeText("own_words", "Will Sam be accepted by Stanford?", "Sam")).toBe("be accepted by Stanford");
  });

  it("survives wording it does not recognise", () => {
    expect(stakeText("gpa", "Something unexpected")).toBe("Something unexpected");
    expect(stakeText(null, "")).toBe("");
  });
});

describe("ticker labels", () => {
  it("pairs the first name with the stake", () => {
    expect(tickerLabel("gpa", "Will Maya Chen earn at least a 3.80 GPA for Fall 2026?", "Maya Chen")).toBe("Maya 3.8 GPA");
    expect(tickerLabel("gym", "Will Luis Ortega deadlift 315 lb by May 1, 2027?", "Luis Ortega")).toBe("Luis deadlift 315 lb");
    expect(tickerLabel("internship", "Will Priya receive a written internship offer from Google by March 1, 2027?", "Priya"))
      .toBe("Priya Google offer");
  });

  it("stays short, cutting on a word", () => {
    const long = tickerLabel("own_words", "Will Sam publish a working version of their very ambitious side project?", "Sam");
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });

  it("survives names and questions it cannot use", () => {
    expect(tickerLabel(null, "", "")).toBe("Goal");
  });
});

describe("card titles", () => {
  it("drops the trailing deadline from template goals, since the card says how long is left", () => {
    expect(cardTitle("club", "Will Andre be offered admission to Chess Club by November 1, 2026?"))
      .toBe("Will Andre be offered admission to Chess Club?");
    expect(cardTitle("running", "Will Jo run a 5K by May 1, 2027?")).toBe("Will Jo run a 5K?");
  });

  it("keeps every word of a goal in the person's own words", () => {
    // "by Stanford" is the point of this goal, not a deadline.
    expect(cardTitle("own_words", "Will Sam be accepted by Stanford?")).toBe("Will Sam be accepted by Stanford?");
  });

  it("leaves a question without a trailing deadline alone", () => {
    expect(cardTitle("gpa", "Will Maya earn at least a 3.8 GPA for Fall 2026?"))
      .toBe("Will Maya earn at least a 3.8 GPA for Fall 2026?");
  });
});

describe("categories", () => {
  it("names each template, and treats anything else as a goal", () => {
    expect(categoryLabel("gpa")).toBe("Grades");
    expect(categoryLabel("internship")).toBe("Internships");
    expect(categoryLabel("running")).toBe("Running");
    expect(categoryLabel("own_words")).toBe("Anything");
    expect(categoryLabel(null)).toBe("Goal");
    expect(categoryLabel("something-new")).toBe("Goal");
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

  it("says when a goal page closes", () => {
    expect(closesInWords(new Date(now.getTime() + 12 * 24 * hour), now)).toBe("closes in 12 days");
    expect(closesInWords(new Date(now.getTime() - hour), now)).toBe("trading closed");
  });
});
