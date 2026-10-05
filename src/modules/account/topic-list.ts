/*
 * Topics a person follows, picked during onboarding (decided 2026-10-05). They
 * are stored and nothing more: changing what the feed shows from them waits for
 * the discovery decision (D08, D09). Safe to import in the browser.
 */

export const TOPICS = [
  { key: "academics", label: "Academics" },
  { key: "internships", label: "Internships" },
  { key: "gym", label: "Gym" },
  { key: "clubs", label: "Clubs" },
  { key: "running", label: "Running" },
  { key: "competitions", label: "Competitions / Awards" },
  { key: "anything", label: "Anything else" },
] as const;

export type TopicKey = (typeof TOPICS)[number]["key"];

export function isTopic(value: unknown): value is TopicKey {
  return typeof value === "string" && TOPICS.some((topic) => topic.key === value);
}

/** Only known topics, each once, in the list's own order. */
export function cleanTopics(values: readonly unknown[]): TopicKey[] {
  const chosen = new Set(values.filter(isTopic));
  return TOPICS.map((topic) => topic.key).filter((key) => chosen.has(key));
}
