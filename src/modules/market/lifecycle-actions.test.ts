import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), db: vi.fn(), manage: vi.fn(), object: vi.fn(), refresh: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb: mocks.db }));
vi.mock("@/modules/auth/server", () => ({ currentIdentity: mocks.identity }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("./lifecycle", async (original) => ({ ...await original<object>(), applyOwnerCommand: mocks.manage, submitObjection: mocks.object }));
import { manageMarket, objectToRuling } from "./lifecycle-actions";
import { LifecycleError, type OwnerCommand } from "./lifecycle";

const command: OwnerCommand = { marketId: "goal-id", requestId: "request-id", action: "rule", outcome: "yes", basis: "reviewed_proof", expectedVersion: 0, reason: "The terms are met." };
const objection = { id: "submission-id", marketId: "goal-id", rulingVersion: 1, reason: "Please review the date." };
beforeEach(() => {
  vi.resetAllMocks(); mocks.identity.mockResolvedValue({ id: "verified-user" }); mocks.db.mockReturnValue("server-database");
  mocks.manage.mockResolvedValue({ marketId: "goal-id" }); mocks.object.mockResolvedValue({ marketId: "goal-id" });
});

describe("lifecycle action boundary", () => {
  it("re-verifies identity for both owner updates and objections", async () => {
    mocks.identity.mockResolvedValue(null);
    expect(await manageMarket(command)).toMatchObject({ ok: false, code: "SIGNED_OUT" });
    expect(await objectToRuling(objection)).toMatchObject({ ok: false, code: "SIGNED_OUT" });
    expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.manage).not.toHaveBeenCalled(); expect(mocks.object).not.toHaveBeenCalled();
  });
  it("uses the verified actor and leaves role/version validation to the transaction", async () => {
    expect(await manageMarket(command)).toEqual({ ok: true });
    expect(await objectToRuling(objection)).toEqual({ ok: true });
    expect(mocks.manage).toHaveBeenCalledExactlyOnceWith("server-database", "verified-user", command);
    expect(mocks.object).toHaveBeenCalledExactlyOnceWith("server-database", "verified-user", objection);
    expect(mocks.identity).toHaveBeenCalledTimes(2);
    expect(mocks.refresh).toHaveBeenCalledWith("/markets/goal-id");
    expect(mocks.refresh).toHaveBeenCalledWith("/review/markets");
    expect(mocks.refresh).toHaveBeenCalledWith("/account");
  });
  it("preserves permission errors and never exposes provider/database details", async () => {
    mocks.manage.mockRejectedValue(new LifecycleError("NOT_OWNER", "Only the owner may do this."));
    expect(await manageMarket(command)).toMatchObject({ ok: false, code: "NOT_OWNER" });
    mocks.object.mockRejectedValue(new Error("private SQL details"));
    const result = await objectToRuling(objection);
    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("private SQL"); expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
