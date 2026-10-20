import { describe, expect, it } from "vitest";
import { TOPICS, cleanTopics, isTopic } from "./topic-list";

describe("onboarding topics", () => {
  it("are the startup industries, and keep only known ones, each once, in the list's order", () => {
    expect(TOPICS.map((t) => t.key)).toContain("robotics");
    expect(cleanTopics(["gaming", "ai", "gaming", "crypto", 7, null, "climate"])).toEqual(["ai", "gaming", "climate"]);
    // Topics saved before the pivots are no longer offered.
    expect(cleanTopics(["academics", "nightlife", "other"])).toEqual([]);
  });

  it("accepts choosing none", () => {
    expect(cleanTopics([])).toEqual([]);
  });

  it("recognises every listed topic and nothing else", () => {
    for (const topic of TOPICS) expect(isTopic(topic.key)).toBe(true);
    expect(isTopic("AI")).toBe(false);
    expect(isTopic(undefined)).toBe(false);
  });
});
