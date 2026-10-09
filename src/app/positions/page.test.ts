import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), database: vi.fn(), load: vi.fn(), redirect: vi.fn() }));
vi.mock("@/modules/auth/server", () => ({ currentIdentity: mocks.identity }));
vi.mock("@/db/client", () => ({ getDb: mocks.database }));
vi.mock("@/modules/account/positions", async (original) => ({ ...await original<object>(), loadPositions: mocks.load }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, usePathname: () => "/positions" }));
vi.mock("next/link", () => ({ default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => React.createElement("a", { href, className }, children) }));
import Positions, { metadata, dynamic } from "./page";
import { PositionsView } from "./positions-view";
import { PositionsError, type PositionsPage } from "@/modules/account/positions";

const fixture: PositionsPage = { total: 1, page: 1, pages: 1, totals: { valueMicro: 12_345_678, costMicro: 4_567_891, gainMicro: 7_777_787 }, markets: [{
  marketId: "fixture-id", question: "Will Midway on High sell more than 1,000 drinks on Friday?", category: "nightlife", venueName: "Midway on High", isSample: true, yesPrice: 0.62,
  status: "open", deadlineAt: new Date("2026-10-01T03:59:00Z"), evidenceDeadlineAt: new Date("2026-10-08T03:59:00Z"),
  contestEndsAt: null, ruledOutcome: null, tradingOpen: true, contestOpen: false,
  yesSharesMicro: 1_000_000, noSharesMicro: 12_345_678, yesCostBasisMicro: 400_000, noCostBasisMicro: 4_567_890,
}] };
const empty: PositionsPage = { total: 0, markets: [], page: 1, pages: 1, totals: { valueMicro: 0, costMicro: 0, gainMicro: 0 } };
const view = (data: PositionsPage) => renderToStaticMarkup(React.createElement(PositionsView, { data }));
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
    expect(renderToStaticMarkup(rendered)).toContain("<h1>Positions</h1>");
    expect(dynamic).toBe("force-dynamic"); expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it("shows safe errors and never treats an unavailable query as an empty portfolio", async () => {
    mocks.load.mockRejectedValue(new Error("private SQL parameters"));
    const html = renderToStaticMarkup(await Positions({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }));
    expect(html).toContain("Positions unavailable"); expect(html).not.toContain("private SQL"); expect(html).not.toContain("No positions yet");
    mocks.load.mockRejectedValue(new PositionsError("PROFILE_REQUIRED", "Complete your active account."));
    expect(renderToStaticMarkup(await Positions({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }))).toContain("Finish setting up your account");
  });
  it("rejects duplicate pagination arguments before accessing the database", async () => {
    const html = renderToStaticMarkup(await Positions({ searchParams: Promise.resolve({ page: ["1", "2"] }), params: Promise.resolve({}) }));
    expect(html).toContain("Open the first page"); expect(mocks.database).not.toHaveBeenCalled();
  });
  it("lists each side held with its shares and price paid, and the value with the change since bought", () => {
    const html = view(fixture);
    expect(html).toContain('/markets/fixture-id');
    expect(html).toContain("Will Midway on High sell more than 1,000 drinks on Friday?");
    expect(html).toContain("Nightlife · Midway on High");
    expect(html).toContain("Sample");
    expect(html).toContain('side-yes">Yes</span> · 1.0 shares · paid 40¢');
    expect(html).toContain('side-no">No</span> · 12.3 shares · paid 37¢');
    // 1 Yes share at 62¢ plus 12.345678 No shares at 38¢ = 5.311 points, against 4.968 paid.
    expect(html).toContain("5.3 pts"); expect(html).toContain("+0.3");
    expect(html).toContain("12.3 pts"); expect(html).toContain("+7.8");
    expect(html).toContain("not what selling them would return");
  });
  it("says where a closed holding stands: results due, objections open, or payout pending", () => {
    const closed = { ...fixture, markets: [{ ...fixture.markets[0], tradingOpen: false, status: "closed" as const }] };
    expect(view(closed)).toContain("Trading closed · Results due Oct 7");
    const ruled = { ...fixture.markets[0], status: "ruled" as const, tradingOpen: false, ruledOutcome: "yes" as const, contestEndsAt: new Date("2026-10-09T03:59:00Z") };
    expect(view({ ...fixture, markets: [{ ...ruled, contestOpen: true }] })).toContain("Resolved Yes · Objections close Oct 8");
    expect(view({ ...fixture, markets: [{ ...ruled, contestOpen: false }] })).toContain("Objections closed · Payout pending");
  });
  it("sends an empty portfolio to the public feed, and pages through long ones", () => {
    const html = view(empty);
    expect(html).toContain("No positions yet"); expect(html).toContain('href="/"'); expect(html).toContain("Browse markets");
    const pages = view({ ...fixture, page: 2, pages: 3 });
    expect(pages).toContain('/positions?page=1'); expect(pages).toContain('/positions?page=3');
  });
  it("lists recent trades, each linked to its market", () => {
    const html = renderToStaticMarkup(React.createElement(PositionsView, { data: fixture, trades: [{
      id: "trade-id", marketId: "fixture-id", question: "Will Midway on High sell more than 1,000 drinks on Friday?", venueName: "Midway on High",
      action: "buy", side: "no", sharesMicro: 12_345_678, amountMicro: 4_567_890, yesPriceAfterBp: 6200, createdAt: new Date("2026-09-30T16:00:00Z"),
    }] }));
    expect(html).toContain("Trade history");
    expect(html).toContain("Bought 12.3");
    expect(html).toContain("−4.6 pts");
    expect(view(fixture)).not.toContain("Trade history");
  });
  it("keeps the public chance for screen readers, and says when it is the closing number", () => {
    expect(view(fixture)).toContain("62% chance of Yes.");
    const closed = { ...fixture, markets: [{ ...fixture.markets[0], tradingOpen: false, status: "closed" as const }] };
    expect(view(closed)).toContain("62% chance of Yes when trading closed.");
    const unpriced = view({ ...fixture, markets: [{ ...fixture.markets[0], yesPrice: null }] });
    expect(unpriced).not.toContain("chance of Yes"); expect(unpriced).not.toContain("holding-value");
  });
});
