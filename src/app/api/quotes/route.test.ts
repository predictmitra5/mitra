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
  it("rejects signed-out requests before reading the database", async () => {
    mocks.identity.mockResolvedValue(null);
    const response = await GET({ nextUrl: new URL("https://mitra.test/api/quotes?ids=one") } as never);
    expect(response.status).toBe(401);
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.readQuotes).not.toHaveBeenCalled();
  });

  it("serves quotes after server-verified authentication", async () => {
    mocks.identity.mockResolvedValue({ id: "verified-user" });
    const response = await GET({ nextUrl: new URL("https://mitra.test/api/quotes?ids=one") } as never);
    expect(response.status).toBe(200);
    expect(mocks.readQuotes).toHaveBeenCalledWith("database", ["one"]);
  });
});
