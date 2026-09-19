import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), db: vi.fn(), claim: vi.fn(), refresh: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb: mocks.db }));
vi.mock("@/modules/auth/server", () => ({ currentIdentity: mocks.identity }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("./refill", async (original) => ({ ...await original<object>(), claimRefill: mocks.claim }));
import { refillCash } from "./refill-actions";
import { RefillError } from "./refill";

const receipt = { requestId: "request-id", amountMicro: 10, creditedAt: "2026-09-18T12:00:00Z" };
beforeEach(() => {
  vi.resetAllMocks(); mocks.identity.mockResolvedValue({ id: "verified-user" });
  mocks.db.mockReturnValue("server-database"); mocks.claim.mockResolvedValue(receipt);
});

describe("refill action boundary", () => {
  it("verifies identity on every call and denies signed-out requests", async () => {
    mocks.identity.mockResolvedValue(null);
    expect(await refillCash("request-id")).toMatchObject({ ok: false, code: "SIGNED_OUT" });
    expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("uses the verified user, accepts only the retry id and refreshes private balances", async () => {
    expect(await refillCash("request-id")).toEqual({ ok: true, receipt });
    expect(mocks.claim).toHaveBeenCalledExactlyOnceWith("server-database", "verified-user", "request-id");
    expect(mocks.refresh).toHaveBeenCalledWith("/account");
    expect(mocks.refresh).toHaveBeenCalledWith("/markets/[id]", "page");
    await refillCash("request-id"); expect(mocks.identity).toHaveBeenCalledTimes(2);
  });
  it("returns safe policy errors and keeps SQL/provider details private", async () => {
    mocks.claim.mockRejectedValue(new RefillError("MONTHLY_LIMIT_REACHED", "Both refills were used."));
    expect(await refillCash("request-id")).toEqual({ ok: false, code: "MONTHLY_LIMIT_REACHED", error: "Both refills were used." });
    mocks.claim.mockRejectedValue(new Error("private SQL parameters"));
    const result = await refillCash("request-id");
    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("private SQL"); expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("rethrows a post-commit refresh failure so the client keeps its original retry key", async () => {
    mocks.refresh.mockImplementation(() => { throw new Error("refresh unavailable"); });
    await expect(refillCash("request-id")).rejects.toThrow("refresh unavailable");
    expect(mocks.claim).toHaveBeenCalledTimes(1);
  });
});
