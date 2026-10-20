import { INDUSTRIES } from "@/modules/startups/labels";

/*
 * Topics a person follows, picked during onboarding (decided 2026-10-05). Since
 * 2026-10-19 they are the startup industries, and they give a new member's
 * feed its first leaning before they have watched anything (topics.ts). Safe
 * to import in the browser.
 */

// Event categories saved before 2026-10-19, and goal topics before 2026-10-08,
// are simply no longer offered.
export const TOPICS = INDUSTRIES.filter((entry) => entry.key !== "other").map(({ key, label }) => ({ key, label }));

export type TopicKey = (typeof TOPICS)[number]["key"];

export function isTopic(value: unknown): value is TopicKey {
  return typeof value === "string" && TOPICS.some((topic) => topic.key === value);
}

/** Only known topics, each once, in the list's own order. */
export function cleanTopics(values: readonly unknown[]): TopicKey[] {
  const chosen = new Set(values.filter(isTopic));
  return TOPICS.map((topic) => topic.key).filter((key) => chosen.has(key));
}
