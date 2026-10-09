import { describe, expect, it } from "vitest";
import {
  browse, DEFAULT_FILTERS, FEED_TABS, filtersToSearch, isFeedTab, isNarrowed, matchesSearch, queryWords, readFilters,
  type Browsable, type BrowseFilters,
} from "./browse";

const now = new Date("2026-10-08T16:00:00Z");
const card = (over: Partial<Browsable> & { id: string }): Browsable & { id: string } => ({
  question: "Will something happen?", category: "events", venueName: "The Oval", venueSlug: "the-oval", eventTitle: null,
  deadlineAt: "2026-12-01T04:59:59Z", tradingOpen: true, status: "open", ...over,
});

const cards = [
  card({ id: "bar", category: "nightlife", question: "Will Midway on High sell more than 1,000 qualifying drinks?", venueName: "Midway on High", venueSlug: "midway-on-high", eventTitle: "Friday night", deadlineAt: "2026-10-09T01:00:00Z" }),
  card({ id: "donuts", category: "food", question: "Will Buckeye Donuts sell more than 1,200 donuts?", venueName: "Buckeye Donuts", venueSlug: "buckeye-donuts", deadlineAt: "2026-10-14T02:00:00Z" }),
  card({ id: "film", category: "entertainment", question: "Will the 7 PM screening sell more than 120 paid admissions?", venueName: "Gateway Film Center", venueSlug: "gateway-film-center", deadlineAt: "2026-11-01T23:00:00Z" }),
  card({ id: "café", category: "food", question: "Will the café run out of croissants?", venueName: "Café Zoë", venueSlug: "cafe-zoe", deadlineAt: "2026-12-20T04:59:59Z" }),
  card({ id: "closed", category: "nightlife", question: "Will Midway on High fill up?", venueName: "Midway on High", venueSlug: "midway-on-high", deadlineAt: "2026-10-01T01:00:00Z", tradingOpen: false, status: "closed" }),
  card({ id: "resolved", category: "food", deadlineAt: "2026-09-20T01:00:00Z", tradingOpen: false, status: "settled" }),
  card({ id: "void", category: "events", deadlineAt: "2026-09-21T01:00:00Z", tradingOpen: false, status: "cancelled" }),
];
const ids = (list: { id: string }[]) => list.map((c) => c.id);
const show = (over: Partial<BrowseFilters> = {}) => ids(browse(cards, { ...DEFAULT_FILTERS, ...over }, now));

describe("category tabs", () => {
  it("are All and the five event categories", () => {
    expect(FEED_TABS.map((tab) => tab.label)).toEqual(["All", "Nightlife", "Food", "Events", "Entertainment", "Campus"]);
    expect(isFeedTab("food")).toBe(true);
    expect(isFeedTab("academics")).toBe(false);
    expect(isFeedTab(undefined)).toBe(false);
  });

  it("show every open market under All, in the order given", () => {
    expect(show()).toEqual(["bar", "donuts", "film", "café"]);
  });

  it("narrow to one category", () => {
    expect(show({ tab: "food" })).toEqual(["donuts", "café"]);
    expect(show({ tab: "campus" })).toEqual([]);
  });
});

describe("filters", () => {
  it("narrow to one venue", () => {
    expect(show({ venue: "midway-on-high" })).toEqual(["bar"]);
    expect(show({ venue: "midway-on-high", status: "all" })).toEqual(["bar", "closed"]);
  });

  it("show closed, resolved and void markets only when asked", () => {
    expect(show({ status: "closed" })).toEqual(["closed"]);
    expect(show({ status: "resolved" })).toEqual(["resolved"]);
    expect(show({ status: "void" })).toEqual(["void"]);
    expect(show({ status: "all" })).toHaveLength(cards.length);
  });

  it("keep markets closing within the chosen span, soonest first, and never ones already past their cutoff", () => {
    expect(show({ closing: "today" })).toEqual(["bar"]);
    expect(show({ closing: "week" })).toEqual(["bar", "donuts"]);
    expect(show({ closing: "month" })).toEqual(["bar", "donuts", "film"]);
    expect(show({ closing: "week", status: "all" })).toEqual(["bar", "donuts"]);
  });

  it("combine with each other and with search", () => {
    expect(show({ tab: "food", closing: "week" })).toEqual(["donuts"]);
    expect(show({ tab: "nightlife", query: "drinks" })).toEqual(["bar"]);
  });
});

describe("the address", () => {
  it("reads filters back, ignoring anything unknown", () => {
    const params = new URLSearchParams("cat=food&venue=buckeye-donuts&status=resolved&closes=week&q=donuts");
    expect(readFilters(params)).toEqual({ tab: "food", venue: "buckeye-donuts", status: "resolved", closing: "week", query: "donuts" });
    expect(readFilters(new URLSearchParams("cat=academics&venue=Bad Slug!&status=nope&closes=year"))).toEqual(DEFAULT_FILTERS);
    // An address from before the pivot still opens the feed.
    expect(readFilters(new URLSearchParams("tab=competitions"))).toEqual(DEFAULT_FILTERS);
  });

  it("writes only what differs from the default, so the plain feed stays /", () => {
    expect(filtersToSearch(DEFAULT_FILTERS)).toBe("");
    expect(isNarrowed(DEFAULT_FILTERS)).toBe(false);
    expect(filtersToSearch({ ...DEFAULT_FILTERS, tab: "food", closing: "week" })).toBe("cat=food&closes=week");
    expect(isNarrowed({ ...DEFAULT_FILTERS, status: "all" })).toBe(true);
  });
});

describe("search", () => {
  it("matches the question, the venue, the event and the category", () => {
    expect(show({ query: "qualifying" })).toEqual(["bar"]);
    expect(show({ query: "gateway" })).toEqual(["film"]);
    expect(show({ query: "friday night" })).toEqual(["bar"]);
    expect(show({ query: "entertainment" })).toEqual(["film"]);
  });

  it("needs every word, in any order, and ignores case and accents", () => {
    expect(show({ query: "DONUTS buckeye" })).toEqual(["donuts"]);
    expect(show({ query: "cafe zoe" })).toEqual(["café"]);
    expect(show({ query: "donuts midway" })).toEqual([]);
  });

  it("treats an empty or blank query as no search", () => {
    expect(matchesSearch(cards[0], "   ")).toBe(true);
    expect(queryWords("  a  b ")).toEqual(["a", "b"]);
    expect(queryWords("1 2 3 4 5 6 7 8 9 10")).toHaveLength(8);
  });
});
