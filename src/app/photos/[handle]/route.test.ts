import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), database: vi.fn(), readPhoto: vi.fn() }));
vi.mock("@/modules/auth/server", () => ({ currentIdentity: mocks.identity }));
vi.mock("@/db/client", () => ({ getDb: mocks.database }));
vi.mock("@/modules/account/photos", () => ({ readPhotoByHandle: mocks.readPhoto }));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.database.mockReturnValue("database");
  mocks.readPhoto.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), version: 7 });
});

describe("profile photo access", () => {
  const context = { params: Promise.resolve({ handle: "member" }) } as never;

  it("rejects signed-out requests before reading the photo", async () => {
    mocks.identity.mockResolvedValue(null);
    const response = await GET({ nextUrl: new URL("https://mitra.test/photos/member?v=7") } as never, context);
    expect(response.status).toBe(401);
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.readPhoto).not.toHaveBeenCalled();
  });

  it("serves authenticated photos without making them publicly cacheable", async () => {
    mocks.identity.mockResolvedValue({ id: "verified-user" });
    const response = await GET({ nextUrl: new URL("https://mitra.test/photos/member?v=7") } as never, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
  });
});
