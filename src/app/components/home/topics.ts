import { INDUSTRIES } from "@/modules/startups/labels";

/*
 * The home page's chips (2026-10-20, YouTube's topic row), shared by the
 * server page, which reads ?topic=, and the grid, which filters by it.
 */

export type Topic = "all" | "new" | "closing" | (typeof INDUSTRIES)[number]["key"];

export const CHIPS: { key: Topic; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "closing", label: "Closing soon" },
  ...INDUSTRIES.filter((entry) => entry.key !== "other").map((entry) => ({ key: entry.key as Topic, label: entry.label })),
];

export function readTopic(value: unknown): Topic {
  return CHIPS.some((chip) => chip.key === value) ? (value as Topic) : "all";
}
