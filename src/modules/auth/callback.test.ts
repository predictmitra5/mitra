import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthClient: vi.fn(),
  auth: { exchangeCodeForSession: vi.fn(), getUser: vi.fn(), signOut: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ createAuthClient: mocks.createAuthClient }));

import { completeAuthCallback } from "./callback";

const user = {
  id: "3a6f0546-6747-4b8f-b682-05ec32a12c09",
  email: "student.123@osu.edu",
  email_confirmed_at: "2026-09-16T12:00:00.000Z",
  is_anonymous: false,
};
const providerError = { message: "private-provider-detail", status: 400, code: "flow_state_expired" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createAuthClient.mockResolvedValue({ auth: mocks.auth });
  mocks.auth.exchangeCodeForSession.mockResolvedValue({ data: { user, session: { user }, redirectType: null }, error: null });
  mocks.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
});

function request(query: string) {
  return new NextRequest(`https://goals.example.test/auth/callback?${query}`);
}

describe("PKCE callback", () => {
  it.each(["/account", "/reset-password"] as const)("uses only the fixed %s destination after exchange and independent validation", async (destination) => {
    const response = await completeAuthCallback(request("code=test-code&next=https%3A%2F%2Fevil.example&redirect_to=%2Fadmin"), destination);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://goals.example.test${destination}`);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("test-code");
    expect(mocks.auth.getUser).toHaveBeenCalledOnce();
    expect(mocks.auth.getUser.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.auth.exchangeCodeForSession.mock.invocationCallOrder[0]);
  });

  it("rejects expired exchanges even if an existing eligible session is available", async () => {
    mocks.auth.exchangeCodeForSession.mockResolvedValue({ data: { user: null, session: null }, error: providerError });
    const response = await completeAuthCallback(request("code=expired-code&next=%2Freset-password"), "/reset-password");
    expect(response.headers.get("location")).toBe("https://goals.example.test/sign-in?notice=link-expired");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.auth.getUser).not.toHaveBeenCalled();
    expect(response.headers.get("location")).not.toContain(providerError.message);
  });

  it.each(["", "code=", "error=access_denied&code=valid-code", `code=${"x".repeat(2049)}`])("rejects missing, rejected or oversized codes before initializing Auth", async (query) => {
    const response = await completeAuthCallback(request(query), "/account");
    expect(response.headers.get("location")).toBe("https://goals.example.test/sign-in?notice=link-expired");
    expect(mocks.createAuthClient).not.toHaveBeenCalled();
  });

  it("rejects exchanged sessions with non-university, unconfirmed or alias identities", async () => {
    for (const invalidUser of [
      { ...user, email: "outsider@example.com" },
      { ...user, email_confirmed_at: undefined },
      { ...user, email: "student.123@buckeyemail.osu.edu" },
      { ...user, is_anonymous: true },
    ]) {
      mocks.auth.getUser.mockResolvedValue({ data: { user: invalidUser }, error: null });
      const response = await completeAuthCallback(request("code=test-code"), "/account");
      expect(response.headers.get("location")).toBe("https://goals.example.test/sign-in?notice=link-expired");
    }
    expect(mocks.auth.signOut).toHaveBeenCalledTimes(4);
    expect(mocks.auth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
  });

  it("fails closed when getUser reports an error despite containing a valid user", async () => {
    mocks.auth.getUser.mockResolvedValue({ data: { user }, error: providerError });
    const response = await completeAuthCallback(request("code=test-code"), "/reset-password");
    expect(response.headers.get("location")).toBe("https://goals.example.test/sign-in?notice=link-expired");
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not expose callback codes or thrown provider errors in the failure response", async () => {
    mocks.auth.exchangeCodeForSession.mockRejectedValue(new Error(providerError.message));
    const response = await completeAuthCallback(request("code=private-test-code&error_description=private-description"), "/reset-password");
    expect(response.headers.get("location")).toBe("https://goals.example.test/sign-in?notice=link-expired");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("");
  });
});
