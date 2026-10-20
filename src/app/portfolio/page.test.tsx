import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), database: vi.fn(), load: vi.fn(), redirect: vi.fn() }));
vi.mock("@/modules/auth/server", () => ({ currentIdentity: mocks.identity }));
vi.mock("@/db/client", () => ({ getDb: mocks.database, schema: {} }));
vi.mock("@/modules/account/positions", async (original) => ({ ...await original<object>(), loadPositions: mocks.load }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, usePathname: () => "/portfolio" }));
// The top bar loads the guide's follows on its own (2026-10-20); these tests are about the page.
vi.mock("@/app/components/market/market-header", () => ({ MarketHeader: () => null, MarketFooter: () => null }));
vi.mock("next/link", () => ({ default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => React.createElement("a", { href, className }, children) }));
import Portfolio, { metadata, dynamic } from "./page";
import { PortfolioView } from "./portfolio-view";
import { PositionsError, type PositionsPage } from "@/modules/account/positions";

const fixture: PositionsPage = { total: 1, page: 1, pages: 1, totals: { valueMicro: 12_345_678, costMicro: 4_567_891, gainMicro: 7_777_787 }, markets: [{
  marketId: "fixture-id", question: "Will Lumenly reach 100,000 verified monthly active users by December 31, 2027?", shortQuestion: "Will Lumenly reach 100K users?",
  category: null, venueName: null, startupName: "Lumenly", startupSlug: "lumenly", industry: "edtech", isSample: true, yesPrice: 0.62,
  status: "open", deadlineAt: new Date("2027-12-31T23:59:00-05:00"), evidenceDeadlineAt: new Date("2028-01-14T23:59:00-05:00"),
  contestEndsAt: null, ruledOutcome: null, tradingOpen: true, contestOpen: false,
  yesSharesMicro: 1_000_000, noSharesMicro: 12_345_678, yesCostBasisMicro: 400_000, noCostBasisMicro: 4_567_890,
}] };
const empty: PositionsPage = { total: 0, markets: [], page: 1, pages: 1, totals: { valueMicro: 0, costMicro: 0, gainMicro: 0 } };
const none = { founders: [], startups: [] };
const me = { name: "Leo Park", handle: "leo", photo: null };
const view = (data: PositionsPage, extra: Partial<React.ComponentProps<typeof PortfolioView>> = {}) =>
  renderToStaticMarkup(React.createElement(PortfolioView, { me, balanceMicro: 900_000_000, data, following: none, ...extra }));

beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("React", React);
  mocks.identity.mockResolvedValue({ id: "verified-user" }); mocks.database.mockReturnValue("database"); mocks.load.mockResolvedValue(fixture);
  mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
});

describe("portfolio page authorization", () => {
  it("redirects signed-out visitors before any holdings query", async () => {
    mocks.identity.mockResolvedValue(null);
    await expect(Portfolio({ searchParams: Promise.resolve({}), params: Promise.resolve({}) })).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in"); expect(mocks.database).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("takes identity only from the server, including when a user query parameter is forged", async () => {
    await Portfolio({ searchParams: Promise.resolve({ page: "2", userId: "someone-else" }), params: Promise.resolve({}) }).catch(() => null);
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith("database", "verified-user", 2);
    expect(dynamic).toBe("force-dynamic"); expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it("shows safe errors and never treats an unavailable query as an empty portfolio", async () => {
    mocks.load.mockRejectedValue(new Error("private SQL parameters"));
    const html = renderToStaticMarkup(await Portfolio({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }));
    expect(html).toContain("Portfolio unavailable"); expect(html).not.toContain("private SQL"); expect(html).not.toContain("No open positions");
    mocks.load.mockRejectedValue(new PositionsError("PROFILE_REQUIRED", "Complete your active account."));
    expect(renderToStaticMarkup(await Portfolio({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }))).toContain("Finish setting up your account");
  });
  it("rejects duplicate pagination arguments before accessing the database", async () => {
    const html = renderToStaticMarkup(await Portfolio({ searchParams: Promise.resolve({ page: ["1", "2"] }), params: Promise.resolve({}) }));
    expect(html).toContain("Open the first page"); expect(mocks.database).not.toHaveBeenCalled();
  });
});

describe("portfolio view", () => {
  it("shows Trade Coins, portfolio value and each side with contracts, average entry and current price", () => {
    const html = view(fixture);
    expect(html).toContain("Trade Coins");
    expect(html).toContain("/markets/fixture-id");
    expect(html).toContain("Will Lumenly reach 100K users?");
    expect(html).toContain("EdTech · Lumenly");
    expect(html).toContain("Demo");
    expect(html).toContain('side-yes">Yes</span> · 1.0 contracts · avg 40.0¢ · now 62.0¢');
    expect(html).toContain('side-no">No</span> · 12.3 contracts · avg 37.0¢ · now 38.0¢');
    // 900 available + 12.3 in positions.
    expect(html).toContain("912.3");
  });
  it("says where a closed holding stands", () => {
    const closed = { ...fixture, markets: [{ ...fixture.markets[0], tradingOpen: false, status: "closed" as const }] };
    expect(view(closed)).toContain("Trading closed · Results due Jan 14");
  });
  it("points an empty portfolio at the feed and the markets, and pages through long ones", () => {
    const html = view(empty);
    expect(html).toContain("No open positions"); expect(html).toContain('href="/markets"');
    const pages = view({ ...fixture, page: 2, pages: 3 });
    expect(pages).toContain("/portfolio?page=1"); expect(pages).toContain("/portfolio?page=3");
  });
  it("lists closed positions with realized profit or loss, and recent trades", () => {
    const html = view(fixture, {
      closed: [{ marketId: "c", question: "Will Lumenly launch on iOS?", shortQuestion: null, startupName: "Lumenly", status: "settled", ruledOutcome: "yes", paidMicro: 20_000_000, receivedMicro: 31_000_000, realizedMicro: 11_000_000, lastAt: new Date() }],
      trades: [{ id: "t", marketId: "fixture-id", question: "Q", shortQuestion: "Will Lumenly reach 100K users?", venueName: null, startupName: "Lumenly", action: "buy", side: "no", sharesMicro: 12_345_678, amountMicro: 4_567_890, yesPriceAfterBp: 6200, createdAt: new Date("2026-09-30T16:00:00Z") }],
    });
    expect(html).toContain("Closed positions"); expect(html).toContain("Resolved Yes"); expect(html).toContain("+11.0");
    expect(html).toContain("Trade history"); expect(html).toContain("Bought 12.3"); expect(html).toContain("−4.6");
  });
  it("lists followed startups and founders", () => {
    const html = view(fixture, { following: {
      startups: [{ id: "s", slug: "lumenly", name: "Lumenly", tagline: "AI Study Companion", industry: "edtech", glyph: "sparkles", hue: 210, logoUrl: null, isDemo: true }],
      founders: [{ id: "f", handle: "arivale", name: "Ari Vale", headline: "Turning notes into plans", hue: 205, portraitUrl: null }],
    } });
    expect(html).toContain("/startups/lumenly"); expect(html).toContain("/founders/arivale"); expect(html).toContain("1 startup · 1 founder");
  });
});
