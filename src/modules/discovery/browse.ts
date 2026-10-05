import { categoryLabel } from "./present";

/*
 * Tabs and search on the feed, decided 2026-09-24 (DECISIONS.md). Both only
 * narrow the goals the feed already loaded, in the browser: ranking and
 * measurement are untouched, and nothing here reaches the database.
 *
 * - "Anything" shows every goal.
 * - "Competitions / Awards" groups club and running outcomes.
 * - "Academics" contains GPA outcomes.
 * - "Closing soon" is every goal still open for trading, soonest deadline
 *   first (back from 2026-09-24 in the 2026-10-05 design).
 * - Search matches the question, the person's name, their handle and the
 *   category, every word of the query somewhere in those.
 */

export const FEED_TABS = [
  { key: "anything", label: "Anything" },
  { key: "academics", label: "Academics" },
  { key: "competitions", label: "Competitions / Awards" },
  { key: "closing", label: "Closing soon" },
] as const;

export type FeedTab = (typeof FEED_TABS)[number]["key"];

export function isFeedTab(value: unknown): value is FeedTab {
  return typeof value === "string" && FEED_TABS.some((tab) => tab.key === value);
}

export function tabLabel(tab: FeedTab): string {
  return FEED_TABS.find((entry) => entry.key === tab)?.label ?? "Anything";
}

export type Browsable = {
  question: string;
  goalType: string | null;
  displayName: string;
  handle: string;
  deadlineAt: string | Date;
  tradingOpen: boolean;
};

/** Lower case without accents, so "zoe" finds "Zoë". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The words of a query, ignoring a leading @ on a handle. At most eight. */
export function queryWords(query: string): string[] {
  return fold(query).split(/\s+/).map((word) => word.replace(/^@+/, "")).filter(Boolean).slice(0, 8);
}

export function matchesSearch(card: Browsable, query: string): boolean {
  const words = queryWords(query);
  if (words.length === 0) return true;
  const haystack = fold([card.question, card.displayName, card.handle, categoryLabel(card.goalType)].join(" "));
  return words.every((word) => haystack.includes(word));
}

/** The cards a tab and a search show, in the order they show them. */
export function browse<T extends Browsable>(cards: readonly T[], tab: FeedTab, query: string): T[] {
  const searched = cards.filter((card) => matchesSearch(card, query));
  if (tab === "academics") return searched.filter((card) => card.goalType === "gpa");
  if (tab === "competitions") return searched.filter((card) => card.goalType === "club" || card.goalType === "running");
  if (tab === "closing") {
    return searched.filter((card) => card.tradingOpen)
      .sort((a, b) => new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime());
  }
  return searched;
}
