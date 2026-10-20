import { INDUSTRIES, industryLabel, milestoneLabel, type IndustryKey } from "@/modules/startups/labels";
import { isStatusFilter, publicStatus, STATUS_FILTERS, type StatusFilter } from "@/modules/events/status";

/*
 * The market directory's filters (2026-10-19, startup markets): an order
 * (Trending, New, Most active, Closing soon), an industry, a status and a
 * search. All of them only narrow and reorder the markets the page already
 * loaded, in the browser, and live in the address (?sort=, ?industry=,
 * ?status=, ?q=), so nothing here reaches the database or records a view.
 *
 * - Trending keeps the server's rank order (recent clicks and trades over time).
 * - New puts the most recently opened first; Most active the most Trade Coins
 *   traded; Closing soon the nearest deadline still ahead.
 * - Search matches the question, the startup, its tagline, the founder, the
 *   industry and the kind of milestone, every word somewhere in those.
 */

export const SORTS = [
  { key: "trending", label: "Trending" },
  { key: "new", label: "New" },
  { key: "active", label: "Most active" },
  { key: "closing", label: "Closing soon" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

export function isSort(value: unknown): value is SortKey {
  return typeof value === "string" && SORTS.some((entry) => entry.key === value);
}

export function sortLabel(sort: SortKey): string {
  return SORTS.find((entry) => entry.key === sort)?.label ?? "Trending";
}

/** Industry chips: every industry except the catch-all, which the search still finds. */
export const INDUSTRY_FILTERS = INDUSTRIES.filter((entry) => entry.key !== "other").map(({ key, label }) => ({ key, label }));

export { STATUS_FILTERS };

export type BrowseFilters = {
  sort: SortKey;
  industry: IndustryKey | null;
  query: string;
  status: StatusFilter;
};

export const DEFAULT_FILTERS: BrowseFilters = { sort: "trending", industry: null, query: "", status: "open" };

/** The filters in an address, with anything unknown falling back to the default. */
export function readFilters(params: { get(name: string): string | null }): BrowseFilters {
  const sort = params.get("sort");
  const industry = params.get("industry");
  const status = params.get("status");
  return {
    sort: isSort(sort) ? sort : "trending",
    industry: INDUSTRY_FILTERS.some((entry) => entry.key === industry) ? (industry as IndustryKey) : null,
    query: (params.get("q") ?? "").slice(0, 80),
    status: isStatusFilter(status) ? status : "open",
  };
}

/** The address for a set of filters; defaults are left out so the plain directory stays "/markets". */
export function filtersToSearch(filters: BrowseFilters): string {
  const address = new URLSearchParams();
  if (filters.sort !== "trending") address.set("sort", filters.sort);
  if (filters.industry) address.set("industry", filters.industry);
  if (filters.query.trim()) address.set("q", filters.query);
  if (filters.status !== "open") address.set("status", filters.status);
  return address.toString();
}

/** True when anything narrows or reorders the default view. */
export function isNarrowed(filters: BrowseFilters): boolean {
  return filtersToSearch(filters) !== "";
}

export type Browsable = {
  question: string;
  shortQuestion?: string | null;
  startupName: string;
  startupTagline: string;
  founderName: string | null;
  industry: string;
  milestoneKind: string | null;
  deadlineAt: string | Date;
  approvedAt: string | Date;
  volumeMicro: number;
  tradingOpen: boolean;
  status: string;
};

/** Lower case without accents, so "cafe" finds "Café". */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The words of a query, without a leading # (so #EdTech finds EdTech). At most eight. */
export function queryWords(query: string): string[] {
  return fold(query).split(/\s+/).map((word) => word.replace(/^#/, "")).filter(Boolean).slice(0, 8);
}

export function matchesSearch(card: Browsable, query: string): boolean {
  const words = queryWords(query);
  if (words.length === 0) return true;
  const haystack = fold([card.question, card.shortQuestion ?? "", card.startupName, card.startupTagline, card.founderName ?? "",
    industryLabel(card.industry), card.industry, milestoneLabel(card.milestoneKind)].join(" "));
  return words.every((word) => haystack.includes(word));
}

function matchesStatus(card: Browsable, status: StatusFilter): boolean {
  return status === "all" || publicStatus(card) === status;
}

const time = (value: string | Date) => new Date(value).getTime();

/** The cards a set of filters shows, in the order it shows them. Trending keeps the given order. */
export function browse<T extends Browsable>(cards: readonly T[], filters: BrowseFilters, now: Date): T[] {
  const shown = cards.filter((card) =>
    matchesSearch(card, filters.query) &&
    (!filters.industry || card.industry === filters.industry) &&
    matchesStatus(card, filters.status));
  switch (filters.sort) {
    case "new": return [...shown].sort((a, b) => time(b.approvedAt) - time(a.approvedAt));
    case "active": return [...shown].sort((a, b) => b.volumeMicro - a.volumeMicro);
    case "closing": return shown.filter((card) => time(card.deadlineAt) > now.getTime()).sort((a, b) => time(a.deadlineAt) - time(b.deadlineAt));
    default: return shown;
  }
}
