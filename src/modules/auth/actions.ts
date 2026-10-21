"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { isBanned } from "@/modules/account/standing";
import { hasCompletedProfile } from "@/modules/account/viewer";
import { createAuthClient } from "./server";
import { appOrigin } from "./config";
import {
  safeReturnTo,
  eligibleIdentity,
  normalizeEmail,
  passwordError,
  type FormState,
} from "./policy";
const unavailable = {
  error: "We couldn’t connect right now. Please try again shortly.",
};
export async function signIn(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const email = normalizeEmail(form.get("email")),
    password = form.get("password"),
    next = safeReturnTo(form.get("next"));
  if (
    !email ||
    typeof password !== "string" ||
    !password ||
    password.length > 128
  )
    return { error: "Enter your email and password." };
  let finished = false;
  try {
    const client = await createAuthClient();
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error)
      return {
        error: "Check your email and password, and verify your email first.",
      };
    const verified = await client.auth.getUser();
    const identity = verified.error
      ? null
      : eligibleIdentity(verified.data.user);
    if (!identity || (await isBanned(getDb(), identity.id))) {
      await client.auth.signOut({ scope: "local" });
      return { error: "This account cannot sign in." };
    }
    finished = await hasCompletedProfile(getDb(), identity.id);
  } catch {
    return unavailable;
  }
  revalidatePath("/", "layout");
  redirect(
    finished
      ? (next ?? "/")
      : `/welcome${next ? `?next=${encodeURIComponent(next)}` : ""}`,
  );
}
export async function sendSignupCode(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const email = normalizeEmail(form.get("email"));
  if (!email) return { error: "Enter a valid email address." };
  try {
    const client = await createAuthClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${appOrigin()}/auth/callback`,
      },
    });
    if (error)
      return {
        error:
          error.status === 429
            ? "Wait a minute before requesting another code."
            : "We couldn’t send a code. Please try again shortly.",
      };
    return {
      success: `We sent a six-digit code to ${email}.`,
      verification: { email },
    };
  } catch {
    return unavailable;
  }
}
export async function verifyEmailCode(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const email = normalizeEmail(form.get("email")),
    token = form.get("token"),
    next = safeReturnTo(form.get("next"));
  if (!email || typeof token !== "string" || !/^\d{6}$/.test(token))
    return { error: "Enter your email and the six-digit code." };
  let returning = false;
  try {
    const client = await createAuthClient();
    const verified = await client.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (verified.error)
      return {
        error: "That code is invalid or expired.",
        verification: { email },
      };
    const fresh = await client.auth.getUser();
    const identity = fresh.error ? null : eligibleIdentity(fresh.data.user);
    if (
      !identity ||
      identity.email !== email ||
      (await isBanned(getDb(), identity.id))
    ) {
      await client.auth.signOut({ scope: "local" });
      return { error: "This account could not be verified." };
    }
    returning = await hasCompletedProfile(getDb(), identity.id);
  } catch {
    return unavailable;
  }
  revalidatePath("/", "layout");
  if (returning) redirect(next ?? "/account?notice=account-exists");
  return { verified: true, verification: { email } };
}
export async function setSignupPassword(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const password = form.get("password"),
    next = safeReturnTo(form.get("next"));
  const invalid = passwordError(password);
  if (invalid) return { error: invalid, verified: true };
  if (password !== form.get("confirmPassword"))
    return { error: "Your passwords don’t match.", verified: true };
  try {
    const client = await createAuthClient();
    const { data, error } = await client.auth.getUser();
    if (error || !eligibleIdentity(data.user))
      return { error: "Your sign-up expired. Start again." };
    if ((await client.auth.updateUser({ password: password as string })).error)
      return {
        error: "Choose a different password and try again.",
        verified: true,
      };
  } catch {
    return { ...unavailable, verified: true };
  }
  revalidatePath("/", "layout");
  redirect(`/welcome${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}
export async function requestPasswordReset(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const email = normalizeEmail(form.get("email"));
  if (!email) return { error: "Enter a valid email address." };
  try {
    const client = await createAuthClient();
    if (
      (
        await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${appOrigin()}/auth/recovery`,
        })
      ).error
    )
      return unavailable;
    return {
      success: "If this address has an account, a reset link is on its way.",
    };
  } catch {
    return unavailable;
  }
}
export async function resetPassword(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const password = form.get("password"),
    invalid = passwordError(password);
  if (invalid) return { error: invalid };
  if (password !== form.get("confirmPassword"))
    return { error: "Your passwords don’t match." };
  try {
    const client = await createAuthClient();
    const { data, error } = await client.auth.getUser();
    if (error || !eligibleIdentity(data.user))
      return { error: "Request a new reset link." };
    if ((await client.auth.updateUser({ password: password as string })).error)
      return { error: "Choose a different password and try again." };
  } catch {
    return unavailable;
  }
  redirect("/account");
}
export async function signOut(): Promise<void> {
  try {
    await (await createAuthClient()).auth.signOut({ scope: "local" });
  } catch {
    redirect("/sign-in?notice=signout-failed");
  }
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
