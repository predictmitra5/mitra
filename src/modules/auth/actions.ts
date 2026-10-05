"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CAMPUSES, canonicalUniversityEmail, isCampusKey } from "@/config/campus";
import { rememberCampus } from "@/config/campus-server";
import { getDb } from "@/db/client";
import { isBanned } from "@/modules/account/standing";
import { hasCompletedProfile } from "@/modules/account/viewer";
import { createAuthClient } from "./server";
import { appOrigin } from "./config";
import { eligibleIdentity, passwordError, type FormState } from "./policy";

const unavailable = { error: "We couldn’t connect right now. Please try again shortly." };
const emailMessage = "Use a supported university email: @osu.edu or @illinois.edu.";
const signupFailed = "We couldn’t create your account. Try again shortly, or sign in if you already registered.";

export async function signIn(_state: FormState, form: FormData): Promise<FormState> {
  const email = canonicalUniversityEmail(form.get("email"));
  const password = form.get("password");
  if (!email) return { error: emailMessage };
  if (typeof password !== "string" || !password || password.length > 128) return { error: "Enter your password." };
  let finished = false;
  try {
    const client = await createAuthClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: "Unable to sign in. Check your email and password, and verify your email first." };
    }
    const verified = await client.auth.getUser();
    const identity = verified.error ? null : eligibleIdentity(verified.data.user);
    if (!identity) {
      await client.auth.signOut({ scope: "local" });
      return { error: "Sign in with a verified @osu.edu or @illinois.edu account to continue." };
    }
    // Banned accounts cannot sign in (decided 2026-09-24). A failed lookup
    // refuses sign-in rather than letting a banned person through.
    if (await isBanned(getDb(), identity.id)) {
      await client.auth.signOut({ scope: "local" });
      return { error: "This account has been banned from Mitra." };
    }
    await rememberCampus(identity.campus);
    finished = await hasCompletedProfile(getDb(), identity.id);
  } catch { return unavailable; }
  revalidatePath("/", "layout");
  // Members land on the feed; anyone who never finished onboarding picks it up again.
  redirect(finished ? "/" : "/welcome");
}

/**
 * Sign-up, step one (2026-10-05): email a six-digit code to the school address.
 * Supabase's email sign-in creates the account if it is new, but nobody gets a
 * session until the code from that inbox is entered, so owning the mailbox is
 * proved first whatever the project's confirmation setting. The password comes
 * after, on the verified session.
 */
export async function sendSignupCode(_state: FormState, form: FormData): Promise<FormState> {
  const campus = form.get("campus");
  if (!isCampusKey(campus)) return { error: "Choose your university first." };
  const email = canonicalUniversityEmail(form.get("email"), campus);
  if (!email) return { error: `Use your @${CAMPUSES[campus].emailDomain} address for ${CAMPUSES[campus].communityName}.` };
  try {
    const client = await createAuthClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${appOrigin()}/auth/callback` },
    });
    if (error) {
      const limited = error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "email_rate_limit_exceeded";
      return { error: limited ? "Too many codes in a row. Wait a minute, then ask for a new one." : signupFailed };
    }
    await rememberCampus(campus);
    return { success: `We sent a six-digit code to ${email}.`, verification: { email, campus } };
  } catch { return unavailable; }
}

export async function verifyEmailCode(_state: FormState, form: FormData): Promise<FormState> {
  const campus = form.get("campus");
  if (!isCampusKey(campus)) return { error: "Choose your university and request a new code." };
  const email = canonicalUniversityEmail(form.get("email"), campus);
  const token = form.get("token");
  if (!email) return { error: emailMessage };
  if (typeof token !== "string" || !/^\d{6}$/.test(token)) {
    return { error: "Enter the six-digit code from your email.", verification: { email, campus } };
  }
  let returning = false;
  try {
    const client = await createAuthClient();
    const verifiedOtp = await client.auth.verifyOtp({ email, token, type: "email" });
    if (verifiedOtp.error) {
      return { error: "That code is invalid or expired. Check the latest email and try again.", verification: { email, campus } };
    }
    const verified = await client.auth.getUser();
    const identity = verified.error ? null : eligibleIdentity(verified.data.user);
    if (!identity || identity.email !== email || identity.campus !== campus) {
      await client.auth.signOut({ scope: "local" });
      return { error: "We couldn’t verify that university account. Request a new code and try again.", verification: { email, campus } };
    }
    if (await isBanned(getDb(), identity.id)) {
      await client.auth.signOut({ scope: "local" });
      return { error: "This account has been banned from Mitra.", verification: { email, campus } };
    }
    await rememberCampus(identity.campus);
    returning = await hasCompletedProfile(getDb(), identity.id);
  } catch {
    return { ...unavailable, verification: { email, campus } };
  }
  revalidatePath("/", "layout");
  // A member who already set up their profile is simply signed in; a new one
  // goes on to choose a password.
  if (returning) redirect("/account?notice=account-exists");
  return { verified: true, verification: { email, campus } };
}

/** Sign-up, last step: the password, set only on a session the email code verified. */
export async function setSignupPassword(_state: FormState, form: FormData): Promise<FormState> {
  const password = form.get("password");
  const invalid = passwordError(password);
  if (invalid) return { error: invalid, verified: true };
  if (password !== form.get("confirmPassword")) return { error: "Your passwords don’t match.", verified: true };
  try {
    const client = await createAuthClient();
    const { data, error } = await client.auth.getUser();
    if (error || !eligibleIdentity(data.user)) return { error: "Your sign-up has expired. Start again with your school email." };
    const result = await client.auth.updateUser({ password: password as string });
    if (result.error) return { error: "Choose a different password and try again.", verified: true };
  } catch { return { ...unavailable, verified: true }; }
  revalidatePath("/", "layout");
  redirect("/welcome");
}

export async function requestPasswordReset(_state: FormState, form: FormData): Promise<FormState> {
  const email = canonicalUniversityEmail(form.get("email"));
  if (!email) return { error: emailMessage };
  try {
    const client = await createAuthClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin()}/auth/recovery` });
    if (error) return { error: "We couldn’t request that email. Please try again shortly." };
    return { success: "If this address has an account, a reset link is on its way. Open it in this browser." };
  } catch { return unavailable; }
}

export async function resetPassword(_state: FormState, form: FormData): Promise<FormState> {
  const password = form.get("password");
  const invalid = passwordError(password);
  if (invalid) return { error: invalid };
  if (password !== form.get("confirmPassword")) return { error: "Your passwords don’t match." };
  try {
    const client = await createAuthClient();
    const { data, error } = await client.auth.getUser();
    if (error || !eligibleIdentity(data.user)) return { error: "Your reset session has expired. Request a new reset link." };
    const result = await client.auth.updateUser({ password: password as string });
    if (result.error) return { error: "Choose a different password and try again. If the link expired, request a new one." };
  } catch { return unavailable; }
  revalidatePath("/", "layout");
  redirect("/account");
}

export async function signOut(): Promise<void> {
  try {
    const client = await createAuthClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) redirect("/sign-in?notice=signout-failed");
  } catch {
    // Never serialize a provider error (which could contain request details).
    redirect("/sign-in?notice=signout-failed");
  }
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
