import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), database: vi.fn(), readQuotes: vi.fn() }));
vi.mock("@/modules/auth/server", () => ({ currentIdentity: mocks.identity }));
vi.mock("@/db/client", () => ({ getDb: mocks.database }));
vi.mock("@/modules/discovery/feed", () => ({ MAX_QUOTES: 24, readQuotes: mocks.readQuotes }));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.database.mockReturnValue("database");
  mocks.readQuotes.mockResolvedValue([]);
});

describe("live quote access", () => {
  it("serves prices to signed-out visitors without reading any identity", async () => {
    const response = await GET({ nextUrl: new URL("https://mitra.test/api/quotes?ids=one") } as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.readQuotes).toHaveBeenCalledWith("database", ["one"]);
    expect(mocks.identity).not.toHaveBeenCalled();
  });

  it("caps how many goals one request can ask about", async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `goal-${i}`).join(",");
    await GET({ nextUrl: new URL(`https://mitra.test/api/quotes?ids=${ids}`) } as never);
    expect(mocks.readQuotes.mock.calls[0][1]).toHaveLength(24);
  });
});
