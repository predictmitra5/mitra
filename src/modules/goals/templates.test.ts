import { describe, expect, it } from "vitest";
import { buildGoalDraft, deadlines, GoalInputError, zonedTimeToUtc } from "./templates";

const now = new Date("2026-09-16T12:00:00.000Z");

describe("deadlines", () => {
  it("closes at 23:59:59 Eastern daylight time", () => {
    expect(deadlines("2026-10-01", now).deadlineAt.toISOString()).toBe("2026-10-02T03:59:59.000Z");
  });

  it("closes at 23:59:59 Eastern standard time after the clocks change", () => {
    expect(deadlines("2026-12-15", now).deadlineAt.toISOString()).toBe("2026-12-16T04:59:59.000Z");
  });

  it("gives seven calendar days for proof, even across a daylight-saving change", () => {
    // 2026-10-30 is EDT; seven days later, 2026-11-06, is EST.
    const { deadlineAt, evidenceDeadlineAt } = deadlines("2026-10-30", now);
    expect(deadlineAt.toISOString()).toBe("2026-10-31T03:59:59.000Z");
    expect(evidenceDeadlineAt.toISOString()).toBe("2026-11-07T04:59:59.000Z");
  });

  it("rejects past, impossible and far-future dates", () => {
    expect(() => deadlines("2026-09-15", now)).toThrow(GoalInputError);
    expect(() => deadlines("2026-02-30", now)).toThrow(GoalInputError);
    expect(() => deadlines("2040-01-01", now)).toThrow(GoalInputError);
    expect(() => deadlines("next friday", now)).toThrow(GoalInputError);
  });

  it("allows a deadline later today in Eastern time", () => {
    expect(deadlines("2026-09-16", now).deadlineAt.toISOString()).toBe("2026-09-17T03:59:59.000Z");
  });
});

describe("zonedTimeToUtc", () => {
  it("handles the spring-forward day", () => {
    expect(zonedTimeToUtc(2027, 3, 14, 23, 59, 59, "America/New_York").toISOString()).toBe("2027-03-15T03:59:59.000Z");
  });
});

describe("buildGoalDraft", () => {
  it("counts only the semester's final GPA", () => {
    const draft = buildGoalDraft("Jake", { type: "gpa", gpa: "3.5", semester: "Autumn 2026", deadline: "2026-12-20" }, now);
    expect(draft.question).toBe("Will Jake earn at least a 3.50 GPA for Autumn 2026?");
    expect(draft.resolutionCriteria).toContain("once final grades post on the official record");
    expect(draft.resolutionCriteria).toContain("not cumulative GPA");
    expect(draft.resolutionCriteria).toContain("resolves NO");
  });

  it("counts a written internship offer even if declined", () => {
    const draft = buildGoalDraft("Jake", { type: "internship", company: "Google", deadline: "2027-03-01" }, now);
    expect(draft.question).toBe("Will Jake receive a written internship offer from Google by March 1, 2027?");
    expect(draft.resolutionCriteria).toContain("even if they decline it");
  });

  it("counts a club admission offer whether or not they join", () => {
    const draft = buildGoalDraft("Jake", { type: "club", club: "Consulting Club", deadline: "2026-11-01" }, now);
    expect(draft.resolutionCriteria).toContain("whether or not they then join");
  });

  it("proves gym goals with a public video link and stores no video", () => {
    const draft = buildGoalDraft("Jake", { type: "gym", achievement: "bench press 225 lb", deadline: "2026-12-01" }, now);
    expect(draft.question).toBe("Will Jake bench press 225 lb by December 1, 2026?");
    expect(draft.resolutionCriteria).toContain("one uncut video");
    expect(draft.resolutionCriteria).toContain("the app stores no video");
  });

  it("counts only an official race result for running goals, with chip time when listed", () => {
    const timed = buildGoalDraft("Jordan Patel", { type: "running", distance: "half", time: "1:59:00", deadline: "2027-04-30" }, now);
    expect(timed.goalType).toBe("running");
    expect(timed.question).toBe("Will Jordan Patel run a half marathon in under 1:59:00 by April 30, 2027?");
    expect(timed.resolutionCriteria).toContain("race's official published results");
    expect(timed.resolutionCriteria).toContain("chip time counts; otherwise the official finish time");
    expect(timed.resolutionCriteria).toContain("logged only in an app or on a watch does not count");
    expect(timed.resolutionCriteria).toMatch(/If no proof reaches the owner/);

    const untimed = buildGoalDraft("Jo", { type: "running", distance: "5k", time: "  ", deadline: "2026-11-01" }, now);
    expect(untimed.question).toBe("Will Jo run a 5K by November 1, 2026?");
    expect(untimed.resolutionCriteria).not.toContain("chip time");
  });

  it("writes race distances and target times the way people say them", () => {
    const draft = (distance: string, extra: { miles?: string; time?: string } = {}) =>
      buildGoalDraft("Jo", { type: "running", distance, deadline: "2026-11-01", ...extra }, now).question;
    expect(draft("10k")).toBe("Will Jo run a 10K by November 1, 2026?");
    expect(draft("marathon", { time: "4:05:00" })).toBe("Will Jo run a marathon in under 4:05:00 by November 1, 2026?");
    expect(draft("miles", { miles: "10" })).toBe("Will Jo run a 10-mile race by November 1, 2026?");
    expect(draft("miles", { miles: "8" })).toBe("Will Jo run an 8-mile race by November 1, 2026?");
    expect(draft("miles", { miles: "13.1", time: "25:00" })).toBe("Will Jo run a 13.1-mile race in under 25:00 by November 1, 2026?");
    expect(draft("5k", { time: "0:24:30" })).toBe("Will Jo run a 5K in under 24:30 by November 1, 2026?");
  });

  it("rejects running goals without a real distance or time", () => {
    const base = { type: "running" as const, deadline: "2026-11-01" };
    expect(() => buildGoalDraft("Jo", { ...base, distance: "ultra" }, now)).toThrow(GoalInputError);
    for (const miles of ["", "0", "0.5", "101", "ten", "5.25"]) {
      expect(() => buildGoalDraft("Jo", { ...base, distance: "miles", miles }, now)).toThrow(GoalInputError);
    }
    for (const time of ["25", "25:60", "1:60:00", "0:00", "24:00:00", "fast"]) {
      expect(() => buildGoalDraft("Jo", { ...base, distance: "5k", time }, now)).toThrow(GoalInputError);
    }
  });

  it("keeps own-words goals but always appends the no-proof rule", () => {
    const draft = buildGoalDraft("Jake", {
      type: "own_words",
      question: "Will Jake launch his study app?",
      criteria: "YES if the app is live on the App Store before the deadline.",
      deadline: "2027-01-15",
    }, now);
    expect(draft.goalType).toBe("own_words");
    expect(draft.resolutionCriteria).toMatch(/App Store before the deadline\. If no proof/);
  });

  it("rejects bad GPAs and empty or oversized text", () => {
    const base = { type: "gpa" as const, semester: "Autumn 2026", deadline: "2026-12-20" };
    for (const gpa of ["0", "4.5", "3.555", "abc", ""]) {
      expect(() => buildGoalDraft("Jake", { ...base, gpa }, now)).toThrow(GoalInputError);
    }
    expect(() => buildGoalDraft("Jake", { type: "club", club: " ", deadline: "2026-11-01" }, now)).toThrow(GoalInputError);
    expect(() => buildGoalDraft("Jake", { type: "club", club: "x".repeat(81), deadline: "2026-11-01" }, now)).toThrow(GoalInputError);
  });

  it("rejects an unknown goal type", () => {
    const input = { type: "crypto", deadline: "2026-11-01" } as unknown as Parameters<typeof buildGoalDraft>[1];
    expect(() => buildGoalDraft("Jake", input, now)).toThrow(GoalInputError);
  });
});
