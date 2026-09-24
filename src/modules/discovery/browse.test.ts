import { describe, expect, it } from "vitest";
import { browse, FEED_TABS, isFeedTab, matchesSearch, queryWords, type Browsable } from "./browse";

const card = (over: Partial<Browsable> & { id: string }): Browsable & { id: string } => ({
  question: "Will someone do something?", goalType: "own_words", displayName: "Someone", handle: "someone",
  deadlineAt: "2026-12-01T04:59:59Z", tradingOpen: true, ...over,
});

const cards = [
  card({ id: "gym", goalType: "gym", question: "Will Luis Ortega deadlift 315 lb by October 6, 2026?", displayName: "Luis Ortega", handle: "luis_lifts", deadlineAt: "2026-10-07T03:59:59Z" }),
  card({ id: "gpa", goalType: "gpa", question: "Will Maya Chen earn at least a 3.80 GPA for Fall 2026?", displayName: "Maya Chen", handle: "maya_c", deadlineAt: "2026-12-20T04:59:59Z" }),
  card({ id: "run", goalType: "running", question: "Will Zoë Park run a 5K by November 1, 2026?", displayName: "Zoë Park", handle: "zoe_runs", deadlineAt: "2026-11-02T04:59:59Z" }),
  card({ id: "own", goalType: "own_words", question: "Will I launch my app?", displayName: "Maya Chen", handle: "maya_c", deadlineAt: "2027-01-10T04:59:59Z" }),
  card({ id: "late", goalType: "club", question: "Will Ben join Chess Club by September 1, 2026?", displayName: "Ben K", handle: "ben_k", deadlineAt: "2026-09-02T03:59:59Z", tradingOpen: false }),
];
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("feed tabs", () => {
  it("are the owner's list, without Music until it has a template", () => {
    expect(FEED_TABS.map((tab) => tab.label)).toEqual(["Anything", "Gym", "Grades", "Internships", "Clubs", "Running", "Closing soon"]);
    expect(isFeedTab("music")).toBe(false);
    expect(isFeedTab("running")).toBe(true);
    expect(isFeedTab(undefined)).toBe(false);
  });

  it("show every goal under Anything, in the order given", () => {
    expect(ids(browse(cards, "anything", ""))).toEqual(["gym", "gpa", "run", "own", "late"]);
  });

  it("show one template per category tab", () => {
    expect(ids(browse(cards, "gym", ""))).toEqual(["gym"]);
    expect(ids(browse(cards, "grades", ""))).toEqual(["gpa"]);
    expect(ids(browse(cards, "running", ""))).toEqual(["run"]);
    expect(ids(browse(cards, "clubs", ""))).toEqual(["late"]);
    expect(ids(browse(cards, "internships", ""))).toEqual([]);
  });

  it("show every open goal under Closing soon, soonest close first", () => {
    expect(ids(browse(cards, "closing", ""))).toEqual(["gym", "run", "gpa", "own"]);
  });
});

describe("search", () => {
  it("matches the question, the name, the handle and the category", () => {
    expect(ids(browse(cards, "anything", "deadlift"))).toEqual(["gym"]);
    expect(ids(browse(cards, "anything", "maya"))).toEqual(["gpa", "own"]);
    expect(ids(browse(cards, "anything", "@luis_lifts"))).toEqual(["gym"]);
    expect(ids(browse(cards, "anything", "running"))).toEqual(["run"]);
  });

  it("needs every word, in any order, and ignores case and accents", () => {
    expect(ids(browse(cards, "anything", "APP maya"))).toEqual(["own"]);
    expect(ids(browse(cards, "anything", "zoe"))).toEqual(["run"]);
    expect(ids(browse(cards, "anything", "maya deadlift"))).toEqual([]);
  });

  it("combines with a tab", () => {
    expect(ids(browse(cards, "grades", "maya"))).toEqual(["gpa"]);
  });

  it("treats a blank query as no search", () => {
    expect(matchesSearch(cards[0], "   ")).toBe(true);
    expect(queryWords("  @@maya   chen ")).toEqual(["maya", "chen"]);
  });
});
