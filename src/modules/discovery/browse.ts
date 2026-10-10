import { CATEGORIES, categoryLabel, type Category } from "@/modules/events/categories";
import { isStatusFilter, publicStatus, STATUS_FILTERS, type StatusFilter } from "@/modules/events/status";

/*
 * Discovery on the feed (2026-09-24, moved to event markets on 2026-10-08):
 * category tabs, search, and filters by venue, status and closing date. All of
 * them only narrow the markets the feed already loaded, in the browser, and live
 * in the address (?cat=, ?q=, ?venue=, ?status=, ?closes=), so ranking and
 * measurement are untouched and nothing here reaches the database.
 *
 * - "All" shows every category; each other tab is one category.
 * - Status defaults to Open. Closed, Resolved and Void come from the recent
 *   past the feed also loads.
 * - Closing date keeps markets whose trading cutoff is still ahead and within
 *   the chosen span, soonest first.
 * - Search matches the question, the venue, the event and the category, every
 *   word of the query somewhere in those.
 */

export const FEED_TABS = [{ key: "all", label: "All" }, ...CATEGORIES] as const;
export type FeedTab = (typeof FEED_TABS)[number]["key"];

export function isFeedTab(value: unknown): value is FeedTab {
  return typeof value === "string" && FEED_TABS.some((tab) => tab.key === value);
}

export function tabLabel(tab: FeedTab): string {
  return FEED_TABS.find((entry) => entry.key === tab)?.label ?? "All";
}

export const CLOSING_FILTERS = [
  { key: "any", label: "Any closing date" },
  { key: "today", label: "Closes within a day" },
  { key: "week", label: "Closes this week" },
  { key: "month", label: "Closes this month" },
] as const;
export type ClosingFilter = (typeof CLOSING_FILTERS)[number]["key"];

const CLOSING_SPAN_MS: Record<Exclude<ClosingFilter, "any">, number> = {
  today: 24 * 3_600_000,
  week: 7 * 24 * 3_600_000,
  month: 31 * 24 * 3_600_000,
};

export function isClosingFilter(value: unknown): value is ClosingFilter {
  return typeof value === "string" && CLOSING_FILTERS.some((entry) => entry.key === value);
}

export { STATUS_FILTERS };

export type BrowseFilters = {
  tab: FeedTab;
  query: string;
  /** A venue's slug, or null for every venue. */
  venue: string | null;
  status: StatusFilter;
  closing: ClosingFilter;
};

export const DEFAULT_FILTERS: BrowseFilters = { tab: "all", query: "", venue: null, status: "open", closing: "any" };

/** The filters in an address, with anything unknown falling back to the default. */
export function readFilters(params: { get(name: string): string | null }): BrowseFilters {
  const cat = params.get("cat");
  const venue = params.get("venue");
  const status = params.get("status");
  const closes = params.get("closes");
  return {
    tab: isFeedTab(cat) ? cat : "all",
    query: (params.get("q") ?? "").slice(0, 80),
    venue: venue && /^[a-z0-9-]{1,70}$/.test(venue) ? venue : null,
    status: isStatusFilter(status) ? status : "open",
    closing: isClosingFilter(closes) ? closes : "any",
  };
}

/** The address for a set of filters; defaults are left out so the plain feed stays "/". */
export function filtersToSearch(filters: BrowseFilters): string {
  const address = new URLSearchParams();
  if (filters.tab !== "all") address.set("cat", filters.tab);
  if (filters.query.trim()) address.set("q", filters.query);
  if (filters.venue) address.set("venue", filters.venue);
  if (filters.status !== "open") address.set("status", filters.status);
  if (filters.closing !== "any") address.set("closes", filters.closing);
  return address.toString();
}

/** True when anything narrows the default view. */
export function isNarrowed(filters: BrowseFilters): boolean {
  return filtersToSearch(filters) !== "";
}

export type Browsable = {
  question: string;
  shortQuestion?: string | null;
  category: string | null;
  venueName: string | null;
  venueSlug: string | null;
  eventTitle: string | null;
  deadlineAt: string | Date;
  tradingOpen: boolean;
  status: string;
};

/** Lower case without accents, so "cafe" finds "Café". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The words of a query. At most eight. */
export function queryWords(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean).slice(0, 8);
}

export function matchesSearch(card: Browsable, query: string): boolean {
  const words = queryWords(query);
  if (words.length === 0) return true;
  const haystack = fold([card.question, card.shortQuestion ?? "", card.venueName ?? "", card.eventTitle ?? "", categoryLabel(card.category)].join(" "));
  return words.every((word) => haystack.includes(word));
}

function matchesStatus(card: Browsable, status: StatusFilter): boolean {
  return status === "all" || publicStatus(card) === status;
}

/** The cards a set of filters shows, in the order it shows them. */
export function browse<T extends Browsable>(cards: readonly T[], filters: BrowseFilters, now: Date): T[] {
  const shown = cards.filter((card) =>
    matchesSearch(card, filters.query) &&
    (filters.tab === "all" || card.category === (filters.tab as Category)) &&
    (!filters.venue || card.venueSlug === filters.venue) &&
    matchesStatus(card, filters.status));
  if (filters.closing === "any") return shown;
  const span = CLOSING_SPAN_MS[filters.closing];
  return shown
    .filter((card) => {
      const left = new Date(card.deadlineAt).getTime() - now.getTime();
      return left > 0 && left <= span;
    })
    .sort((a, b) => new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime());
}
