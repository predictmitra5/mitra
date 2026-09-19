import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), db: vi.fn(), preview: vi.fn(), execute: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb: mocks.db }));
vi.mock("@/modules/auth/server", () => ({ currentIdentity: mocks.identity }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("./service", async (original) => ({ ...await original<object>(), previewTrade: mocks.preview, executeTrade: mocks.execute }));

import { confirmOrder, previewOrder } from "./actions";
import { TradingError, type TradeConfirmation } from "./service";

const marketId = "13357009-751f-415e-93d5-3fc75a44c851";
const confirmation: TradeConfirmation = { marketId, side: "YES", action: "buy", amountMicro: 10_000_000,
  requestId: "dd7109fb-8e87-4375-8608-ce5d80805260", expectedYesSharesMicro: 0, expectedNoSharesMicro: 100_000_000 };

function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ marketId, side: "YES", action: "buy", amount: "10", ...extra }).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.identity.mockResolvedValue({ id: "verified-user", email: "student@osu.edu" });
  mocks.db.mockReturnValue("server-database");
  mocks.preview.mockResolvedValue({ ...confirmation, sharesMicro: 123, totalMicro: 10_000_000 });
  mocks.execute.mockResolvedValue({ id: "trade-id", marketId, side: "YES", action: "buy", sharesMicro: 123, totalMicro: 10_000_000 });
});

describe("trade action authorization boundary", () => {
  it("requires a freshly verified identity for preview and confirmation", async () => {
    mocks.identity.mockResolvedValue(null);
    expect(await previewOrder(form())).toMatchObject({ ok: false, code: "SIGNED_OUT" });
    expect(await confirmOrder(confirmation)).toMatchObject({ ok: false, code: "SIGNED_OUT" });
    expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("uses server identity and parsed amounts, ignoring forged balance, price and user fields", async () => {
    await previewOrder(form({ userId: "victim", balanceMicro: "999999999", price: "0.01" }));
    expect(mocks.preview).toHaveBeenCalledExactlyOnceWith("server-database", "verified-user", { marketId, side: "YES", action: "buy", amountMicro: 10_000_000 });
    await confirmOrder(confirmation);
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith("server-database", "verified-user", confirmation);
    expect(mocks.identity).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed form amounts and outcomes before the database", async () => {
    const invalid: Record<string, string>[] = [{ amount: "1e3" }, { amount: "0.0000001" }, { side: "maybe" }, { action: "credit" }];
    for (const extra of invalid) {
      expect(await previewOrder(form(extra))).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    }
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("preserves safe rule errors while hiding provider and database details", async () => {
    mocks.execute.mockRejectedValue(new TradingError("PRICE_CHANGED", "Preview again."));
    expect(await confirmOrder(confirmation)).toEqual({ ok: false, code: "PRICE_CHANGED", error: "Preview again." });
    mocks.execute.mockRejectedValue(new Error("private database details"));
    const result = await confirmOrder(confirmation);
    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("private database");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("refreshes the account, market and positions after a successful trade", async () => {
    expect(await confirmOrder(confirmation)).toMatchObject({ ok: true });
    expect(mocks.revalidate.mock.calls).toEqual([[`/markets/${marketId}`], ["/account"], ["/positions"]]);
  });
});
