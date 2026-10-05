import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthClient: vi.fn(),
  isBanned: vi.fn(),
  hasProfile: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  rememberCampus: vi.fn(),
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOtp: vi.fn(),
    getUser: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    verifyOtp: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ createAuthClient: mocks.createAuthClient }));
vi.mock("@/db/client", () => ({ getDb: () => "database" }));
vi.mock("@/modules/account/standing", () => ({ isBanned: mocks.isBanned }));
vi.mock("@/modules/account/viewer", () => ({ hasCompletedProfile: mocks.hasProfile }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/config/campus-server", () => ({ rememberCampus: mocks.rememberCampus }));

import { requestPasswordReset, resetPassword, sendSignupCode, setSignupPassword, signIn, signOut, verifyEmailCode } from "./actions";

const user: User = {
  id: "3a6f0546-6747-4b8f-b682-05ec32a12c09",
  email: "student.123@osu.edu",
  email_confirmed_at: "2026-09-16T12:00:00.000Z",
  created_at: "2026-09-16T12:00:00.000Z",
  aud: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  is_anonymous: false,
};
const session = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const password = " a long test password ";
const providerError = { message: "provider-private-details", status: 400, code: "test_failure" };

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: "Student.123@buckeyemail.osu.edu",
    campus: "osu",
    password,
    confirmPassword: password,
    ...values,
  })) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_URL", "https://goals.example.test");
  mocks.createAuthClient.mockResolvedValue({ auth: mocks.auth });
  mocks.redirect.mockImplementation((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  });
  mocks.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null });
  mocks.auth.signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
  mocks.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
  mocks.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mocks.auth.updateUser.mockResolvedValue({ data: { user }, error: null });
  mocks.auth.verifyOtp.mockResolvedValue({ data: { user, session }, error: null });
  mocks.isBanned.mockResolvedValue(false);
  mocks.hasProfile.mockResolvedValue(false);
});

afterEach(() => vi.unstubAllEnvs());

describe("auth server actions", () => {
  it("rejects invalid university addresses before constructing an SDK client", async () => {
    for (const action of [signIn, sendSignupCode, requestPasswordReset]) {
      expect(await action({}, form({ email: "student.123@osu.edu.evil.example" }))).toHaveProperty("error");
    }
    expect(mocks.createAuthClient).not.toHaveBeenCalled();
  });

  it("requires matching passwords for signup and reset before making SDK calls", async () => {
    for (const action of [setSignupPassword, resetPassword]) {
      expect(await action({}, form({ confirmPassword: "different-password" }))).toHaveProperty("error");
      expect(await action({}, form({ password: "short", confirmPassword: "short" }))).toHaveProperty("error");
    }
    expect(mocks.createAuthClient).not.toHaveBeenCalled();
  });

  it("signs in using the canonical mailbox and validates the resulting user before redirecting", async () => {
    await expect(signIn({}, form({ next: "https://evil.example" }))).rejects.toThrow("NEXT_REDIRECT:/welcome");
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({ email: user.email, password });
    expect(mocks.auth.getUser).toHaveBeenCalledOnce();
    expect(mocks.auth.getUser.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.auth.signInWithPassword.mock.invocationCallOrder[0]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mocks.rememberCampus).toHaveBeenCalledWith("osu");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/welcome");
  });

  it("sends a member who finished onboarding to the feed", async () => {
    mocks.hasProfile.mockResolvedValue(true);
    await expect(signIn({}, form())).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("refuses a banned account and signs its session back out", async () => {
    mocks.isBanned.mockResolvedValue(true);
    expect(await signIn({}, form())).toEqual({ error: "This account has been banned from Mitra." });
    expect(mocks.isBanned).toHaveBeenCalledWith("database", user.id);
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("refuses sign-in when it cannot check for a ban, rather than letting one through", async () => {
    mocks.isBanned.mockRejectedValue(new Error("database down"));
    const result = await signIn({}, form());
    expect(result).toHaveProperty("error");
    expect(JSON.stringify(result)).not.toContain("database down");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does not trust the successful login payload when server validation fails", async () => {
    mocks.auth.getUser.mockResolvedValue({ data: { user }, error: providerError });
    const result = await signIn({}, form());
    expect(result).toHaveProperty("error");
    expect(JSON.stringify(result)).not.toContain(providerError.message);
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a server-verified user whose actual identity is outside the university", async () => {
    mocks.auth.getUser.mockResolvedValue({ data: { user: { ...user, email: "outsider@example.com" } }, error: null });
    expect(await signIn({}, form())).toHaveProperty("error");
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("asks for a sign-up code with only the school address and the configured callback", async () => {
    const result = await sendSignupCode({}, form({
      isOwner: "true", userId: "another-user", balance: "999999", adultConfirmed: "true",
      emailRedirectTo: "https://evil.example", origin: "https://evil.example", next: "//evil.example",
    }));
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("verification", { email: user.email, campus: "osu" });
    expect(mocks.auth.signInWithOtp).toHaveBeenCalledExactlyOnceWith({
      email: user.email,
      options: { shouldCreateUser: true, emailRedirectTo: "https://goals.example.test/auth/callback" },
    });
    expect(mocks.rememberCampus).toHaveBeenCalledWith("osu");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("never signs anyone up with a password or starts a session before the code is entered", async () => {
    await sendSignupCode({}, form());
    expect(mocks.auth.signUp).not.toHaveBeenCalled();
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
    expect(mocks.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("supports UIUC sign-up only when the selected campus matches the email", async () => {
    const result = await sendSignupCode({}, form({ campus: "uiuc", email: "NETID@ILLINOIS.EDU" }));
    expect(result.verification).toEqual({ email: "netid@illinois.edu", campus: "uiuc" });
    expect(mocks.auth.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: "netid@illinois.edu" }));
    expect(await sendSignupCode({}, form({ campus: "osu", email: "netid@illinois.edu" }))).toHaveProperty("error");
  });

  it("says to wait when the email service limits how often codes are sent", async () => {
    mocks.auth.signInWithOtp.mockResolvedValue({ data: {}, error: { ...providerError, status: 429 } });
    const result = await sendSignupCode({}, form());
    expect(result.error).toContain("Wait a minute");
    expect(result.verification).toBeUndefined();
  });

  it("recovery gives the same account-neutral response and uses the configured recovery callback", async () => {
    const existing = await requestPasswordReset({}, form());
    const unknown = await requestPasswordReset({}, form({ email: "unknown.456@osu.edu" }));
    expect(existing).toEqual(unknown);
    expect(existing.success).toContain("If this address has an account");
    expect(mocks.auth.resetPasswordForEmail).toHaveBeenNthCalledWith(1, user.email, {
      redirectTo: "https://goals.example.test/auth/recovery",
    });
    expect(mocks.auth.resetPasswordForEmail).toHaveBeenNthCalledWith(2, "unknown.456@osu.edu", {
      redirectTo: "https://goals.example.test/auth/recovery",
    });
  });

  it("does not expose provider error details or thrown errors", async () => {
    mocks.auth.signInWithOtp.mockResolvedValue({ data: {}, error: providerError });
    mocks.auth.resetPasswordForEmail.mockRejectedValue(new Error(providerError.message));
    for (const action of [sendSignupCode, requestPasswordReset]) {
      const result = await action({}, form());
      expect(result).toHaveProperty("error");
      expect(JSON.stringify(result)).not.toContain(providerError.message);
    }
  });

  it("blocks password changes for absent, unconfirmed, anonymous and noncanonical sessions", async () => {
    for (const invalidUser of [
      null,
      { ...user, email_confirmed_at: undefined },
      { ...user, is_anonymous: true },
      { ...user, email: "student.123@buckeyemail.osu.edu" },
      { ...user, email: "outsider@example.com" },
    ]) {
      mocks.auth.getUser.mockResolvedValue({ data: { user: invalidUser }, error: null });
      expect(await resetPassword({}, form({ userId: user.id, email_verified: "true" }))).toHaveProperty("error");
    }
    mocks.auth.getUser.mockResolvedValue({ data: { user }, error: providerError });
    expect(await resetPassword({}, form())).toHaveProperty("error");
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("changes only the validated user's password and waits for success before redirecting", async () => {
    await expect(resetPassword({}, form({ userId: "another-user", isOwner: "true" }))).rejects.toThrow("NEXT_REDIRECT:/account");
    expect(mocks.auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password });
    expect(mocks.auth.updateUser.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.auth.getUser.mock.invocationCallOrder[0]);
    expect(mocks.redirect.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.auth.updateUser.mock.invocationCallOrder[0]);
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/account");
  });

  it("keeps a failed password update on the form without exposing the provider error", async () => {
    mocks.auth.updateUser.mockResolvedValue({ data: { user: null }, error: providerError });
    const result = await resetPassword({}, form());
    expect(result).toHaveProperty("error");
    expect(JSON.stringify(result)).not.toContain(providerError.message);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("signs out the current session and redirects without leaking session data", async () => {
    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(mocks.auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/sign-in");
  });
});

describe("email code verification", () => {
  it("verifies a six-digit email code, re-checks the provider identity and moves a new member to the password", async () => {
    const result = await verifyEmailCode({}, form({ token: "123456" }));
    expect(result).toEqual({ verified: true, verification: { email: user.email, campus: "osu" } });
    expect(mocks.auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({ email: user.email, token: "123456", type: "email" });
    expect(mocks.auth.getUser).toHaveBeenCalledOnce();
    expect(mocks.isBanned).toHaveBeenCalledWith("database", user.id);
    expect(mocks.hasProfile).toHaveBeenCalledWith("database", user.id);
    expect(mocks.rememberCampus).toHaveBeenCalledWith("osu");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("tells a returning member the account already exists after the code proves ownership", async () => {
    mocks.hasProfile.mockResolvedValue(true);
    await expect(verifyEmailCode({}, form({ token: "123456" }))).rejects.toThrow("NEXT_REDIRECT:/account?notice=account-exists");
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
  });

  it("refuses a banned account and signs its session back out", async () => {
    mocks.isBanned.mockResolvedValue(true);
    const result = await verifyEmailCode({}, form({ token: "123456" }));
    expect(result.error).toContain("banned");
    expect(result.verified).toBeUndefined();
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("rejects malformed codes and mismatched campus data before provider access", async () => {
    expect(await verifyEmailCode({}, form({ token: "1234" }))).toHaveProperty("error");
    expect(await verifyEmailCode({}, form({ token: "123456", campus: "uiuc" }))).toHaveProperty("error");
    expect(mocks.createAuthClient).not.toHaveBeenCalled();
  });

  it("keeps the code step after an expired code without leaking provider details", async () => {
    mocks.auth.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: providerError });
    const result = await verifyEmailCode({}, form({ token: "123456" }));
    expect(result.error).toContain("invalid or expired");
    expect(result.verification).toEqual({ email: user.email, campus: "osu" });
    expect(result.verified).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(providerError.message);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("sign-up password", () => {
  it("sets the password only on a verified university session, then goes on to set-up", async () => {
    await expect(setSignupPassword({}, form({ userId: "another-user", isOwner: "true" }))).rejects.toThrow("NEXT_REDIRECT:/welcome");
    expect(mocks.auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password });
    expect(mocks.auth.updateUser.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.auth.getUser.mock.invocationCallOrder[0]);
  });

  it("refuses without a verified session, telling them to start again", async () => {
    for (const invalidUser of [null, { ...user, email_confirmed_at: undefined }, { ...user, email: "outsider@example.com" }]) {
      mocks.auth.getUser.mockResolvedValue({ data: { user: invalidUser }, error: null });
      const result = await setSignupPassword({}, form());
      expect(result.error).toContain("Start again");
      expect(result.verified).toBeUndefined();
    }
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps a rejected password on the step without the provider error", async () => {
    mocks.auth.updateUser.mockResolvedValue({ data: { user: null }, error: providerError });
    const result = await setSignupPassword({}, form());
    expect(result).toMatchObject({ verified: true });
    expect(JSON.stringify(result)).not.toContain(providerError.message);
  });
});
