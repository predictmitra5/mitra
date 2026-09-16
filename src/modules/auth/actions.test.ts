import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthClient: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    getUser: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ createAuthClient: mocks.createAuthClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { requestPasswordReset, resetPassword, signIn, signOut, signUp } from "./actions";

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
  mocks.auth.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
  mocks.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
  mocks.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mocks.auth.updateUser.mockResolvedValue({ data: { user }, error: null });
});

afterEach(() => vi.unstubAllEnvs());

describe("auth server actions", () => {
  it("rejects invalid university addresses before constructing an SDK client", async () => {
    for (const action of [signIn, signUp, requestPasswordReset]) {
      expect(await action({}, form({ email: "student.123@osu.edu.evil.example" }))).toHaveProperty("error");
    }
    expect(mocks.createAuthClient).not.toHaveBeenCalled();
  });

  it("requires matching passwords for signup and reset before making SDK calls", async () => {
    for (const action of [signUp, resetPassword]) {
      expect(await action({}, form({ confirmPassword: "different-password" }))).toHaveProperty("error");
      expect(await action({}, form({ password: "short", confirmPassword: "short" }))).toHaveProperty("error");
    }
    expect(mocks.createAuthClient).not.toHaveBeenCalled();
  });

  it("signs in using the canonical mailbox and validates the resulting user before redirecting", async () => {
    await expect(signIn({}, form({ next: "https://evil.example" }))).rejects.toThrow("NEXT_REDIRECT:/account");
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({ email: user.email, password });
    expect(mocks.auth.getUser).toHaveBeenCalledOnce();
    expect(mocks.auth.getUser.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.auth.signInWithPassword.mock.invocationCallOrder[0]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/account");
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

  it("signup sends only credentials and the configured callback, never submitted privileges or redirect URLs", async () => {
    const result = await signUp({}, form({
      isOwner: "true", userId: "another-user", balance: "999999", adultConfirmed: "true",
      emailRedirectTo: "https://evil.example", origin: "https://evil.example", next: "//evil.example",
    }));
    expect(result).toHaveProperty("success");
    expect(mocks.auth.signUp).toHaveBeenCalledExactlyOnceWith({
      email: user.email,
      password,
      options: { emailRedirectTo: "https://goals.example.test/auth/callback" },
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("fails closed if signup unexpectedly returns a session without email confirmation", async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { user, session }, error: null });
    expect(await signUp({}, form())).toHaveProperty("error");
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).not.toHaveBeenCalled();
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
    mocks.auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: providerError });
    mocks.auth.resetPasswordForEmail.mockRejectedValue(new Error(providerError.message));
    for (const action of [signUp, requestPasswordReset]) {
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
