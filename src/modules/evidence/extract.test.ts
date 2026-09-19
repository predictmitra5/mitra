import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The contract: reading a document is additive. Whatever the provider does -
 * times out, rate limits, declines, returns nonsense - the owner must still
 * reach the review screen and be able to write the statement themselves. A
 * thrown error here would take the screen down and leave proof unreviewable.
 *
 * Checked separately against the real model on 2026-09-19, with a fictional
 * transcript as both PDF and PNG: the GPA came through and no ID number, date
 * of birth, address or phone number appeared in any proposed statement.
 */

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@anthropic-ai/sdk", () => {
  // Defined inside the factory: vi.mock is hoisted above module scope.
  class FakeRateLimitError extends Error {}
  class FakeAnthropic {
    messages = { create: mocks.create };
    static RateLimitError = FakeRateLimitError;
  }
  return { default: FakeAnthropic, FakeRateLimitError };
});

import Anthropic from "@anthropic-ai/sdk";
import { proposeStatements } from "./extract";

const file = new Uint8Array([1, 2, 3, 4]);
const goal = {
  question: "Will Jordan finish the fall 2026 semester with a GPA of 3.8 or higher?",
  criteria: "YES if the official fall 2026 GPA is 3.80 or above on an official transcript.",
};

function reply(payload: unknown, stopReason = "end_turn") {
  return { stop_reason: stopReason, content: [{ type: "text", text: JSON.stringify(payload) }] };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-a-real-credential");
  vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-4-5");
});

afterEach(() => vi.unstubAllEnvs());

describe("proposing statements", () => {
  it("returns the wording and the private details separately", async () => {
    mocks.create.mockResolvedValue(reply({
      proposals: [{ statement: "Fall 2026 term GPA is 3.85.", basis: "Shows 'Semester GPA: 3.85'." }],
      private_details: ["Student ID: 500-84-2291", "Address: 4417 Neil Avenue"],
    }));

    const result = await proposeStatements(file, "application/pdf", goal);
    expect(result.proposals).toEqual([
      { statement: "Fall 2026 term GPA is 3.85.", basis: "Shows 'Semester GPA: 3.85'." },
    ]);
    expect(result.privateDetails).toEqual(["Student ID: 500-84-2291", "Address: 4417 Neil Avenue"]);
    expect(result.unavailable).toBeUndefined();
  });

  it("sends a PDF as a document and an image as an image", async () => {
    mocks.create.mockResolvedValue(reply({ proposals: [], private_details: [] }));

    await proposeStatements(file, "application/pdf", goal);
    expect(mocks.create.mock.calls[0][0].messages[0].content[0]).toMatchObject({
      type: "document", source: { type: "base64", media_type: "application/pdf" },
    });

    await proposeStatements(file, "image/jpeg", goal);
    expect(mocks.create.mock.calls[1][0].messages[0].content[0]).toMatchObject({
      type: "image", source: { type: "base64", media_type: "image/jpeg" },
    });
  });

  it("gives the model the goal's own terms to read against", async () => {
    mocks.create.mockResolvedValue(reply({ proposals: [], private_details: [] }));
    await proposeStatements(file, "image/png", goal);
    const prompt = mocks.create.mock.calls[0][0].messages[0].content[1].text;
    expect(prompt).toContain(goal.question);
    expect(prompt).toContain(goal.criteria);
  });
});

describe("failures never block review", () => {
  it("survives a provider error without throwing", async () => {
    mocks.create.mockRejectedValue(new Error("connection reset by peer"));
    const result = await proposeStatements(file, "application/pdf", goal);
    expect(result.proposals).toEqual([]);
    expect(result.unavailable).toMatch(/write the statement yourself/i);
  });

  it("does not leak the provider's message to the interface", async () => {
    mocks.create.mockRejectedValue(new Error("account 12345 quota exceeded at endpoint /v1/x"));
    const result = await proposeStatements(file, "application/pdf", goal);
    expect(JSON.stringify(result)).not.toContain("12345");
    expect(JSON.stringify(result)).not.toContain("/v1/x");
  });

  it("says so plainly when rate limited", async () => {
    mocks.create.mockRejectedValue(new (Anthropic as unknown as { RateLimitError: new (m: string) => Error }).RateLimitError("slow down"));
    expect((await proposeStatements(file, "image/png", goal)).unavailable).toMatch(/busy/i);
  });

  it("handles a declined document as a normal outcome", async () => {
    mocks.create.mockResolvedValue(reply({ proposals: [] }, "refusal"));
    const result = await proposeStatements(file, "image/png", goal);
    expect(result.proposals).toEqual([]);
    expect(result.unavailable).toMatch(/declined/i);
  });

  it("survives unparseable or unexpected output", async () => {
    for (const content of [
      [{ type: "text", text: "not json at all" }],
      [{ type: "text", text: "{}" }],
      [{ type: "text", text: '{"proposals": "not a list"}' }],
      [],
    ]) {
      mocks.create.mockResolvedValue({ stop_reason: "end_turn", content });
      const result = await proposeStatements(file, "image/png", goal);
      expect(result.proposals).toEqual([]);
      expect(result.privateDetails).toEqual([]);
    }
  });

  it("drops malformed proposals instead of failing the whole list", async () => {
    mocks.create.mockResolvedValue(reply({
      proposals: [
        { statement: "Fall 2026 term GPA is 3.85.", basis: "ok" },
        { statement: "ab", basis: "too short to mean anything" },
        { basis: "no statement at all" },
        null,
        "a string",
      ],
      private_details: ["Student ID", "", 42, null],
    }));
    const result = await proposeStatements(file, "image/png", goal);
    expect(result.proposals).toHaveLength(1);
    expect(result.privateDetails).toEqual(["Student ID"]);
  });

  it("caps a runaway list and trims long values", async () => {
    mocks.create.mockResolvedValue(reply({
      proposals: Array.from({ length: 50 }, () => ({ statement: "x".repeat(900), basis: "y".repeat(900) })),
      private_details: Array.from({ length: 80 }, () => "z".repeat(900)),
    }));
    const result = await proposeStatements(file, "image/png", goal);
    expect(result.proposals.length).toBeLessThanOrEqual(6);
    expect(result.proposals[0].statement.length).toBeLessThanOrEqual(300);
    expect(result.privateDetails.length).toBeLessThanOrEqual(20);
  });

  it("does not call the provider at all when no key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await proposeStatements(file, "image/png", goal);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(result.unavailable).toMatch(/not configured/i);
  });

  it("does not call the provider for a type it cannot read", async () => {
    const result = await proposeStatements(file, "application/zip", goal);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(result.proposals).toEqual([]);
  });
});
