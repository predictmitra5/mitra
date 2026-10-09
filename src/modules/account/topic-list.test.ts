import { describe, expect, it } from "vitest";
import { TOPICS, cleanTopics, isTopic } from "./topic-list";

describe("onboarding topics", () => {
  it("keeps only known topics, each once, in the list's order", () => {
    expect(cleanTopics(["food", "nightlife", "food", "crypto", 7, null, "campus"])).toEqual(["nightlife", "food", "campus"]);
    // Topics saved before the 2026-10-08 pivot are no longer offered.
    expect(cleanTopics(["academics", "running"])).toEqual([]);
  });

  it("accepts choosing none", () => {
    expect(cleanTopics([])).toEqual([]);
  });

  it("recognises every listed topic and nothing else", () => {
    for (const topic of TOPICS) expect(isTopic(topic.key)).toBe(true);
    expect(isTopic("Nightlife")).toBe(false);
    expect(isTopic(undefined)).toBe(false);
  });
});
