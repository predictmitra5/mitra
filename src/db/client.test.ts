import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveDatabaseConnectionString } from "./client";

describe("resolveDatabaseConnectionString", () => {
  it("prefers the app-specific DATABASE_URL", () => {
    expect(resolveDatabaseConnectionString({
      DATABASE_URL: "postgres://app-specific",
      POSTGRES_URL: "postgres://integration",
    })).toBe("postgres://app-specific");
  });

  it("uses Vercel's integration-provided POSTGRES_URL as a fallback", () => {
    expect(resolveDatabaseConnectionString({
      POSTGRES_URL: "postgres://integration",
    })).toBe("postgres://integration");
  });

  it("rejects an environment with no configured database", () => {
    expect(() => resolveDatabaseConnectionString({})).toThrow(
      "Database is not configured.",
    );
  });
});
