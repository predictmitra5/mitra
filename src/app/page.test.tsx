import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
import { MarketHeader } from "./components/market/market-header";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.database.mockReturnValue("database");
  mocks.readFeed.mockResolvedValue({ cards: [], past: [], featured: null, closingSoon: [] });
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
    expect(mocks.readFeed).toHaveBeenCalledWith("database", expect.any(Date), { campus: "osu" });
    expect(mocks.recordExposures).not.toHaveBeenCalled();
    expect(mocks.viewer).not.toHaveBeenCalled();
  });

  it("lets signed-out visitors choose either public campus feed and keeps the header and disclosure in sync", async () => {
    mocks.identity.mockResolvedValue(null);
    const view = await Home({ searchParams: Promise.resolve({ campus: "uiuc", q: "donuts" }), params: Promise.resolve({}) });
    expect(mocks.readFeed).toHaveBeenCalledWith("database", expect.any(Date), { campus: "uiuc" });
    const [header, , footer] = view.props.children;
    expect(header.props.campus).toBe("uiuc");
    expect(header.props.query).toBe("donuts");
    expect(footer.props.campus).toBe("uiuc");
  });

  it("ignores an invalid campus choice and keeps the default campus", async () => {
    mocks.identity.mockResolvedValue(null);
    await Home({ searchParams: Promise.resolve({ campus: "other" }), params: Promise.resolve({}) });
    expect(mocks.readFeed).toHaveBeenCalledWith("database", expect.any(Date), { campus: "osu" });
  });

  it("puts the signed-out campus dropdown beside the logo and links directly to each feed", () => {
    const markup = renderToStaticMarkup(createElement(MarketHeader, { viewer: null, campus: "uiuc", query: "donuts" }));
    const brandHomeStart = markup.indexOf('class="brand-home"');
    const brandHomeEnd = markup.indexOf("</a>", brandHomeStart);
    const campusMenuStart = markup.indexOf('<details class="public-campus-menu"');
    expect(brandHomeStart).toBeGreaterThanOrEqual(0);
    expect(brandHomeEnd).toBeLessThan(campusMenuStart);
    expect(markup.indexOf("public-campus-menu")).toBeLessThan(markup.indexOf("topbar-actions"));
    expect(markup).toContain('aria-label="Browse campus; currently Illinois"');
    expect(markup).toContain('href="/?campus=osu&amp;q=donuts"');
    expect(markup).toContain('href="/?campus=uiuc&amp;q=donuts"');
    expect(markup).not.toContain("public-campus-picker");
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

  it("shows a member their own campus's markets", async () => {
    mocks.identity.mockResolvedValue({ id: "verified-user", email: "netid@illinois.edu", campus: "uiuc" });
    await Home({ searchParams: Promise.resolve({}), params: Promise.resolve({}) });
    expect(mocks.readFeed).toHaveBeenCalledWith("database", expect.any(Date), { campus: "uiuc" });
  });

  it("does not let a signed-in member switch away from their verified campus", async () => {
    mocks.identity.mockResolvedValue({ id: "verified-user", email: "member@osu.edu", campus: "osu" });
    await Home({ searchParams: Promise.resolve({ campus: "uiuc" }), params: Promise.resolve({}) });
    expect(mocks.readFeed).toHaveBeenCalledWith("database", expect.any(Date), { campus: "osu" });
  });
});
