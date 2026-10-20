import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/components/home/load", () => ({ loadHome: mocks.load }));

import Home from "./page";
import { HomePage } from "@/app/components/home/home-page";

const empty = { items: [], highlight: null, closingSoon: [], signedIn: false, viewer: null, unavailable: false };
const visit = (topic?: string) => Home({ params: Promise.resolve({}), searchParams: Promise.resolve(topic ? { topic } : {}) } as never);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockResolvedValue(empty);
});

describe("home: YouTube's home (2026-10-20)", () => {
  it("loads the personal home and renders it with every topic", async () => {
    const view = await visit();
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith();
    expect(view.type).toBe(HomePage);
    expect(view.props).toMatchObject({ topic: "all", data: { signedIn: false, unavailable: false } });
  });

  it("opens on a topic from the address, and ignores one it does not know", async () => {
    expect((await visit("gaming")).props.topic).toBe("gaming");
    expect((await visit("closing")).props.topic).toBe("closing");
    expect((await visit("<script>")).props.topic).toBe("all");
  });

  it("passes a member's state through", async () => {
    mocks.load.mockResolvedValue({ ...empty, signedIn: true, viewer: { displayName: "Leo", photo: null, balanceMicro: 1_000_000_000, ownerQueue: null } });
    const view = await visit();
    expect(view.props.data.signedIn).toBe(true);
    expect(view.props.data.viewer.displayName).toBe("Leo");
  });

  it("shows the unavailable state rather than failing", async () => {
    mocks.load.mockResolvedValue({ ...empty, unavailable: true });
    expect((await visit()).props.data.unavailable).toBe(true);
  });
});
