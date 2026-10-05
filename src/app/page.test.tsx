import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  database: vi.fn(),
  readFeed: vi.fn(),
  recordExposures: vi.fn(),
  viewer: vi.fn(),
}));

vi.mock("@/modules/auth/server", () => ({ currentIdentity: mocks.identity }));
vi.mock("@/db/client", () => ({ getDb: mocks.database }));
vi.mock("@/modules/discovery/feed", async (original) => ({
  ...await original<object>(),
  readFeed: mocks.readFeed,
  recordExposures: mocks.recordExposures,
}));
vi.mock("@/modules/account/viewer", () => ({ readViewerOrNull: mocks.viewer }));
vi.mock("@/config/campus-server", () => ({ selectedCampus: async () => ({ key: "osu" }) }));

import Home from "./page";
import { FeedView } from "./feed-view";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.database.mockReturnValue("database");
  mocks.readFeed.mockResolvedValue({ cards: [], featured: null, closingSoon: [] });
  mocks.recordExposures.mockResolvedValue(undefined);
  mocks.viewer.mockResolvedValue(null);
});

describe("home access boundary", () => {
  it("shows neutral signup before reading or measuring any goal data", async () => {
    mocks.identity.mockResolvedValue(null);
    const view = await Home({ searchParams: Promise.resolve({}), params: Promise.resolve({}) });
    expect(view.props.className).toBe("market-shell entry-shell");
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.readFeed).not.toHaveBeenCalled();
    expect(mocks.recordExposures).not.toHaveBeenCalled();
  });

  it("loads the ranked feed only for a verified identity", async () => {
    mocks.identity.mockResolvedValue({ id: "verified-user", email: "member@osu.edu", campus: "osu" });
    const view = await Home({ searchParams: Promise.resolve({}), params: Promise.resolve({}) });
    const feed = view.props.children[1];
    expect(feed.type).toBe(FeedView);
    expect(mocks.readFeed).toHaveBeenCalledWith("database", expect.any(Date));
    expect(mocks.recordExposures).toHaveBeenCalledWith("database", []);
    expect(mocks.viewer).toHaveBeenCalledWith("database", "verified-user");
  });
});
