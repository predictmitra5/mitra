import { describe, expect, it } from "vitest";
import {
  ago,
  cardTitle,
  categoryLabel,
  changeLabel,
  closesIn,
  initials,
  percent,
  shortDate,
  thumbnailText,
  volumeLabel,
} from "./present";

const now = new Date("2026-09-22T16:00:00Z");
const hour = 3_600_000;

describe("thumbnail text, the stake in as few words as possible", () => {
  it("pulls the GPA out of a grades goal", () => {
    expect(thumbnailText("gpa", "Will Maya earn at least a 3.8 GPA for Fall 2026?")).toBe("3.8 GPA");
    expect(thumbnailText("gpa", "Will Maya earn at least an 4.0 GPA for Spring 2027?")).toBe("4.0 GPA");
  });

  it("pulls the club out of a club goal", () => {
    expect(thumbnailText("club", "Will Andre be offered admission to Chess Club by November 1, 2026?"))
      .toBe("Chess Club");
  });

  it("names the company for an internship goal", () => {
    expect(thumbnailText("internship", "Will Priya receive a written internship offer from Google by March 1, 2027?"))
      .toBe("Google internship");
  });

  it("keeps the achievement for a gym goal", () => {
    expect(thumbnailText("gym", "Will Luis deadlift 315 pounds by December 15, 2026?")).toBe("Deadlift 315 pounds");
    expect(thumbnailText("gym", "Will Luis run a sub-25-minute 5K by December 15, 2026?")).toBe("Run a sub-25-minute 5K");
  });

  it("never takes a surname as part of the achievement", () => {
    // Real display names have two words; the template writes the full name.
    expect(thumbnailText("gym", "Will Sam Rivera bench press 225 lb by September 14, 2026?", "Sam Rivera")).toBe("Bench press 225 lb");
    expect(thumbnailText("gym", "Will Sam Rivera hold a 3-minute plank by May 1, 2027?", "Sam Rivera")).toBe("Hold a 3-minute plank");
    expect(thumbnailText("gym", "Will Maya Chen Lopez deadlift 315 pounds by May 1, 2027?", "Maya Chen Lopez")).toBe("Deadlift 315 pounds");
  });

  it("falls back to the verb phrase for a goal in the person's own words", () => {
    expect(thumbnailText("own_words", "Will Sam launch the app?", "Sam")).toBe("Launch the app");
    expect(thumbnailText("own_words", "Will Sam launch the app?")).toBe("Launch the app");
  });

  it("strips a two-word name exactly when it is known, instead of guessing its length", () => {
    expect(thumbnailText("own_words", "Will Sam Lee launch the app?", "Sam Lee")).toBe("Launch the app");
  });

  it("keeps a trailing 'by' phrase in the person's own words", () => {
    expect(thumbnailText("own_words", "Will Sam be accepted by Stanford?", "Sam")).toBe("Be accepted by Stanford");
  });

  it("never runs longer than a thumbnail can hold, and cuts on a word", () => {
    const long = thumbnailText("own_words", "Will Sam publish a working version of their very ambitious side project?");
    expect(long.length).toBeLessThanOrEqual(34);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });

  it("survives wording it does not recognise", () => {
    expect(thumbnailText("gpa", "Something unexpected")).toBe("Something unexpected");
    expect(thumbnailText(null, "")).toBe("");
  });
});

describe("card titles", () => {
  it("drops the trailing deadline from template goals, since the badge shows it", () => {
    expect(cardTitle("club", "Will Andre be offered admission to Chess Club by November 1, 2026?"))
      .toBe("Will Andre be offered admission to Chess Club?");
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
    expect(categoryLabel("own_words")).toBe("Goal");
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

describe("volume", () => {
  it("reads micro-units as compact play points", () => {
    expect(volumeLabel(0)).toBe("No trades yet");
    expect(volumeLabel(400_000)).toBe("<1 pt traded");
    expect(volumeLabel(45_000_000)).toBe("45 pts traded");
    expect(volumeLabel(12_400_000_000)).toBe("12.4K pts traded");
  });
});

describe("percent", () => {
  it("never shows a binary market as certain", () => {
    expect(percent(0.5)).toBe(50);
    expect(percent(0.001)).toBe(1);
    expect(percent(0.999)).toBe(99);
  });
});

describe("the day's change", () => {
  it("rounds to whole points and carries direction separately from colour", () => {
    expect(changeLabel(420)).toEqual({ text: "4", direction: "up" });
    expect(changeLabel(-1150)).toEqual({ text: "12", direction: "down" });
    expect(changeLabel(40)).toEqual({ text: "0", direction: "flat" });
    expect(changeLabel(0)).toEqual({ text: "0", direction: "flat" });
  });

  it("rounds equal moves up and down to the same size", () => {
    // Math.round(-11.5) is -11 but Math.round(11.5) is 12; the label must not be lopsided.
    expect(changeLabel(1150).text).toBe(changeLabel(-1150).text);
    expect(changeLabel(50).text).toBe(changeLabel(-50).text);
  });
});

describe("time labels", () => {
  it("counts down to a deadline", () => {
    expect(closesIn(new Date(now.getTime() - hour), now)).toBe("Closed");
    expect(closesIn(new Date(now.getTime() + 30 * 60_000), now)).toBe("< 1h left");
    expect(closesIn(new Date(now.getTime() + 20 * hour), now)).toBe("20h left");
    expect(closesIn(new Date(now.getTime() + 5 * 24 * hour), now)).toBe("5d left");
    expect(closesIn(new Date(now.getTime() + 120 * 24 * hour), now)).toBe("4mo left");
  });

  it("says how long ago a goal went live", () => {
    expect(ago(now, now)).toBe("just now");
    expect(ago(new Date(now.getTime() - 5 * hour), now)).toBe("5h ago");
    expect(ago(new Date(now.getTime() - 3 * 24 * hour), now)).toBe("3d ago");
    expect(ago(new Date(now.getTime() + hour), now)).toBe("just now");
  });

  it("gives a short date in Eastern time", () => {
    expect(shortDate(new Date("2026-09-24T12:00:00Z"))).toBe("SEP 24");
    // 02:00 UTC on 1 October is still 30 September in New York.
    expect(shortDate(new Date("2026-10-01T02:00:00Z"))).toBe("SEP 30");
  });
});
