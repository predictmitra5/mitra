/*
 * Event-market categories, decided 2026-10-08 from the owner's pivot brief.
 * Safe to import in the browser: the feed's tabs, cards and the suggestion form
 * all read this list.
 */

export const CATEGORIES = [
  { key: "nightlife", label: "Nightlife" },
  { key: "food", label: "Food" },
  { key: "events", label: "Events" },
  { key: "entertainment", label: "Entertainment" },
  { key: "campus", label: "Campus" },
] as const;

export type Category = (typeof CATEGORIES)[number]["key"];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.some((category) => category.key === value);
}

/** The category's name, or "Market" for a legacy goal market, which has none. */
export function categoryLabel(category: string | null | undefined): string {
  return CATEGORIES.find((entry) => entry.key === category)?.label ?? "Market";
}
