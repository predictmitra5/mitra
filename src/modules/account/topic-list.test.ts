import { describe, expect, it } from "vitest";
import { TOPICS, cleanTopics, isTopic } from "./topic-list";

describe("onboarding topics", () => {
  it("keeps only known topics, each once, in the list's order", () => {
    expect(cleanTopics(["running", "gym", "running", "crypto", 7, null, "academics"])).toEqual(["academics", "gym", "running"]);
  });

  it("accepts choosing none", () => {
    expect(cleanTopics([])).toEqual([]);
  });

  it("recognises every listed topic and nothing else", () => {
    for (const topic of TOPICS) expect(isTopic(topic.key)).toBe(true);
    expect(isTopic("Academics")).toBe(false);
    expect(isTopic(undefined)).toBe(false);
  });
});
