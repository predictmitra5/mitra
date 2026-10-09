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
import { SignupPrompt } from "./components/signup-prompt";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.database.mockReturnValue("database");
  mocks.readFeed.mockResolvedValue({ cards: [], featured: null, closingSoon: [] });
  mocks.recordExposures.mockResolvedValue(undefined);
  mocks.viewer.mockResolvedValue(null);
});

describe("home feed for visitors and members", () => {
  it("shows visitors the feed with the sign-up pop-up and reads no account", async () => {
    mocks.identity.mockResolvedValue(null);
    const view = await Home({ searchParams: Promise.resolve({}), params: Promise.resolve({}) });
    const [, feed, , prompt] = view.props.children;
    expect(feed.type).toBe(FeedView);
    expect(feed.props.signedIn).toBe(false);
    expect(prompt.type).toBe(SignupPrompt);
    expect(mocks.readFeed).toHaveBeenCalledWith("database", expect.any(Date));
    expect(mocks.recordExposures).not.toHaveBeenCalled();
    expect(mocks.viewer).not.toHaveBeenCalled();
  });

  it("treats an unavailable sign-in service as a visitor rather than failing", async () => {
    mocks.identity.mockRejectedValue(new Error("auth down"));
    const view = await Home({ searchParams: Promise.resolve({}), params: Promise.resolve({}) });
    expect(view.props.children[1].props.signedIn).toBe(false);
  });

  it("gives a verified member their header and no pop-up", async () => {
    mocks.identity.mockResolvedValue({ id: "verified-user", email: "member@osu.edu", campus: "osu" });
    const view = await Home({ searchParams: Promise.resolve({}), params: Promise.resolve({}) });
    const [, feed, , prompt] = view.props.children;
    expect(feed.props.signedIn).toBe(true);
    expect(prompt).toBe(false);
    expect(mocks.viewer).toHaveBeenCalledWith("database", "verified-user");
    expect(mocks.recordExposures).toHaveBeenCalledWith("database", []);
  });
});
