import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), database: vi.fn(), load: vi.fn(), redirect: vi.fn() }));
vi.mock("@/modules/auth/server", () => ({ currentIdentity: mocks.identity }));
vi.mock("@/db/client", () => ({ getDb: mocks.database }));
vi.mock("@/modules/account/positions", async (original) => ({ ...await original<object>(), loadPositions: mocks.load }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/link", () => ({ default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => React.createElement("a", { href, className }, children) }));
import Positions, { metadata, dynamic } from "./page";
import { PositionsView } from "./positions-view";
import { PositionsError, type PositionsPage } from "@/modules/account/positions";

const fixture: PositionsPage = { total: 1, page: 1, pages: 1, goals: [{
  marketId: "fixture-id", question: "Will Alex join the chess club?", goalType: "club", yesPrice: 0.62, displayName: "Alex", handle: "alex", photoUpdatedAt: null,
  status: "open", deadlineAt: new Date("2026-10-01T03:59:00Z"), evidenceDeadlineAt: new Date("2026-10-08T03:59:00Z"),
  contestEndsAt: null, ruledOutcome: null, tradingOpen: true, contestOpen: false,
  yesSharesMicro: 1, noSharesMicro: 12_345_678, yesCostBasisMicro: 1, noCostBasisMicro: 4_567_890,
}] };
const now = new Date("2026-09-20T12:00:00Z");
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("React", React);
  mocks.identity.mockResolvedValue({ id: "verified-user" }); mocks.database.mockReturnValue("database"); mocks.load.mockResolvedValue(fixture);
  mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
});

describe("positions page authorization and presentation", () => {
  it("redirects signed-out visitors before any holdings query", async () => {
    mocks.identity.mockResolvedValue(null);
    await expect(Positions({ searchParams: Promise.resolve({}), params: Promise.resolve({}) })).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in"); expect(mocks.database).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("takes identity only from the server, including when a user query parameter is forged", async () => {
    const rendered = await Positions({ searchParams: Promise.resolve({ page: "2", userId: "someone-else" }), params: Promise.resolve({}) });
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith("database", "verified-user", 2);
    expect(renderToStaticMarkup(rendered)).toContain("Your predictions.");
    expect(dynamic).toBe("force-dynamic"); expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it("shows safe errors and never treats an unavailable query as an empty portfolio", async () => {
    mocks.load.mockRejectedValue(new Error("private SQL parameters"));
    const html = renderToStaticMarkup(await Positions({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }));
    expect(html).toContain("Predictions unavailable"); expect(html).not.toContain("private SQL"); expect(html).not.toContain("Your next prediction starts here");
    mocks.load.mockRejectedValue(new PositionsError("PROFILE_REQUIRED", "Complete your active account."));
    expect(renderToStaticMarkup(await Positions({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }))).toContain("Finish setting up your account");
  });
  it("rejects duplicate pagination arguments before accessing the database", async () => {
    const html = renderToStaticMarkup(await Positions({ searchParams: Promise.resolve({ page: ["1", "2"] }), params: Promise.resolve({}) }));
    expect(html).toContain("Open the first page"); expect(mocks.database).not.toHaveBeenCalled();
  });
  it("renders both sides with all six decimals and keeps held cost distinct from sale value", () => {
    const html = renderToStaticMarkup(React.createElement(PositionsView, { now, data: fixture }));
    expect(html).toContain("0.000001"); expect(html).toContain("12.345678"); expect(html).toContain("4.56789");
    expect(html).toContain("YES"); expect(html).toContain("NO"); expect(html).toContain("current sale value");
    expect(html).toContain('/markets/fixture-id'); expect(html).toContain("Sep 30, 2026");
  });
  it("distinguishes pending payouts from an open objection window and supports empty/paginated states", () => {
    const pending = { ...fixture, goals: [{ ...fixture.goals[0], status: "ruled" as const, tradingOpen: false, contestOpen: false, ruledOutcome: "yes" as const, contestEndsAt: new Date("2026-10-09T03:59:00Z") }] };
    expect(renderToStaticMarkup(React.createElement(PositionsView, { now, data: pending }))).toContain("Payout pending");
    expect(renderToStaticMarkup(React.createElement(PositionsView, { now, data: { ...pending, goals: [{ ...pending.goals[0], contestOpen: true }] } }))).toContain("Ruling · objections open");
    expect(renderToStaticMarkup(React.createElement(PositionsView, { now, data: { total: 0, goals: [], page: 1, pages: 1 } }))).toContain("Your next prediction starts here");
    const pages = renderToStaticMarkup(React.createElement(PositionsView, { now, data: { ...fixture, page: 2, pages: 3 } }));
    expect(pages).toContain('/positions?page=1'); expect(pages).toContain('/positions?page=3');
  });
  it("labels an elapsed objection window as closed rather than closing", () => {
    const ruled = { ...fixture.goals[0], status: "ruled" as const, tradingOpen: false, ruledOutcome: "no" as const, contestEndsAt: new Date("2026-10-09T03:59:00Z") };
    const open = renderToStaticMarkup(React.createElement(PositionsView, { now, data: { ...fixture, goals: [{ ...ruled, contestOpen: true }] } }));
    const elapsed = renderToStaticMarkup(React.createElement(PositionsView, { now, data: { ...fixture, goals: [{ ...ruled, contestOpen: false }] } }));
    expect(open).toContain("Objections close<"); expect(elapsed).toContain("Objections closed<");
  });
  it("sends an empty portfolio to the public feed", () => {
    const html = renderToStaticMarkup(React.createElement(PositionsView, { now, data: { total: 0, goals: [], page: 1, pages: 1 } }));
    expect(html).toContain('href="/"'); expect(html).toContain("Browse goals"); expect(html).not.toContain("shared market link");
  });
  it("shows the public chance with the feed's bar, and says when it is the closing number", () => {
    const open = renderToStaticMarkup(React.createElement(PositionsView, { now, data: fixture }));
    expect(open).toContain("62%"); expect(open).toContain("chance of YES"); expect(open).toContain("62 percent chance of YES");
    expect(open).toContain("thumb art-club");
    const closed = renderToStaticMarkup(React.createElement(PositionsView, { now, data: { ...fixture, goals: [{ ...fixture.goals[0], tradingOpen: false, status: "closed" as const }] } }));
    expect(closed).toContain("chance of YES when trading closed");
    const unpriced = renderToStaticMarkup(React.createElement(PositionsView, { now, data: { ...fixture, goals: [{ ...fixture.goals[0], yesPrice: null }] } }));
    expect(unpriced).not.toContain("chance of YES");
  });
});
