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

  it("serves a photo to anyone, cached only by the browser", async () => {
    const response = await GET({ nextUrl: new URL("https://mitra.test/photos/member?v=7") } as never, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(mocks.identity).not.toHaveBeenCalled();
  });

  it("does not serve a removed or banned person's photo", async () => {
    mocks.readPhoto.mockResolvedValue(null);
    const response = await GET({ nextUrl: new URL("https://mitra.test/photos/member?v=7") } as never, context);
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
