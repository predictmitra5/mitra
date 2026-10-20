import { describe, expect, it } from "vitest";
import { browse, DEFAULT_FILTERS, filtersToSearch, isNarrowed, matchesSearch, queryWords, readFilters, type Browsable } from "./browse";

const now = new Date("2026-10-19T12:00:00Z");
const DAY = 86_400_000;

const card = (over: Partial<Browsable> & { id?: string } = {}): Browsable & { id: string } => ({
  id: "m", question: "Will Lumenly reach 100,000 verified monthly active users by December 31, 2027?", shortQuestion: "Will Lumenly reach 100K users?",
  startupName: "Lumenly", startupTagline: "AI Study Companion", founderName: "Ari Vale", industry: "edtech", milestoneKind: "adoption",
  deadlineAt: new Date(now.getTime() + 400 * DAY).toISOString(), approvedAt: new Date(now.getTime() - 30 * DAY).toISOString(),
  volumeMicro: 1_000_000_000, tradingOpen: true, status: "open", ...over,
});

const params = (query: string) => new URLSearchParams(query);

describe("filters in the address", () => {
  it("reads known values and falls back for unknown ones", () => {
    expect(readFilters(params(""))).toEqual(DEFAULT_FILTERS);
    expect(readFilters(params("sort=closing&industry=ai&status=resolved&q=robots"))).toEqual({ sort: "closing", industry: "ai", query: "robots", status: "resolved" });
    expect(readFilters(params("sort=random&industry=nightlife&status=nope"))).toEqual(DEFAULT_FILTERS);
  });
  it("writes only what differs from the default", () => {
    expect(filtersToSearch(DEFAULT_FILTERS)).toBe("");
    expect(isNarrowed(DEFAULT_FILTERS)).toBe(false);
    expect(filtersToSearch({ ...DEFAULT_FILTERS, sort: "new", industry: "gaming" })).toBe("sort=new&industry=gaming");
  });
});

describe("search", () => {
  it("matches the startup, founder, tagline, industry and milestone", () => {
    expect(matchesSearch(card(), "ari")).toBe(true);
    expect(matchesSearch(card(), "study companion")).toBe(true);
    expect(matchesSearch(card(), "#EdTech")).toBe(true);
    expect(matchesSearch(card(), "adoption lumenly")).toBe(true);
    expect(matchesSearch(card(), "robotics")).toBe(false);
  });
  it("drops # and caps the words", () => {
    expect(queryWords("#AI  robots")).toEqual(["ai", "robots"]);
    expect(queryWords("a b c d e f g h i j")).toHaveLength(8);
  });
});

describe("browse", () => {
  const a = card({ id: "a", industry: "ai", volumeMicro: 5, approvedAt: new Date(now.getTime() - 50 * DAY).toISOString(), deadlineAt: new Date(now.getTime() + 20 * DAY).toISOString() });
  const b = card({ id: "b", industry: "gaming", volumeMicro: 50, approvedAt: new Date(now.getTime() - 5 * DAY).toISOString(), deadlineAt: new Date(now.getTime() + 2 * DAY).toISOString() });
  const c = card({ id: "c", industry: "ai", volumeMicro: 20, approvedAt: new Date(now.getTime() - 10 * DAY).toISOString(), status: "settled", tradingOpen: false });
  const all = [a, b, c];
  const ids = (list: { id: string }[]) => list.map((x) => x.id);

  it("keeps the server's order for Trending and shows open markets by default", () => {
    expect(ids(browse(all, DEFAULT_FILTERS, now))).toEqual(["a", "b"]);
  });
  it("orders New, Most active and Closing soon", () => {
    expect(ids(browse(all, { ...DEFAULT_FILTERS, sort: "new", status: "all" }, now))).toEqual(["b", "c", "a"]);
    expect(ids(browse(all, { ...DEFAULT_FILTERS, sort: "active", status: "all" }, now))).toEqual(["b", "c", "a"]);
    expect(ids(browse(all, { ...DEFAULT_FILTERS, sort: "closing" }, now))).toEqual(["b", "a"]);
  });
  it("narrows by industry and status", () => {
    expect(ids(browse(all, { ...DEFAULT_FILTERS, industry: "ai", status: "all" }, now))).toEqual(["a", "c"]);
    expect(ids(browse(all, { ...DEFAULT_FILTERS, status: "resolved" }, now))).toEqual(["c"]);
  });
});
