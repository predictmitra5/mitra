import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/components/feed/load", () => ({ loadVideoFeed: mocks.load }));

import Home from "./page";
import { FeedPage } from "@/app/components/feed/feed-page";

const empty = { cards: [], signedIn: false, viewer: null, unavailable: false, coldStart: true };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockResolvedValue(empty);
});

describe("home: the For you video feed", () => {
  it("loads the personal feed and renders it as For you", async () => {
    const view = await Home();
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith();
    expect(view.type).toBe(FeedPage);
    expect(view.props).toMatchObject({ tab: "for-you", signedIn: false, unavailable: false });
  });

  it("passes a member's state through", async () => {
    mocks.load.mockResolvedValue({ ...empty, signedIn: true, viewer: { displayName: "Leo", photo: null, balanceMicro: 1_000_000_000, ownerQueue: null } });
    const view = await Home();
    expect(view.props.signedIn).toBe(true);
    expect(view.props.viewer.displayName).toBe("Leo");
  });

  it("shows the unavailable state rather than failing", async () => {
    mocks.load.mockResolvedValue({ ...empty, unavailable: true });
    expect((await Home()).props.unavailable).toBe(true);
  });
});
