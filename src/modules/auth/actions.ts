"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAuthClient } from "./server";
import { appOrigin } from "./config";
import { canonicalUniversityEmail, eligibleIdentity, passwordError, type FormState } from "./policy";

const unavailable = { error: "We couldn’t connect right now. Please try again shortly." };
const emailMessage = "Use your Ohio State email, such as name.123@osu.edu.";

export async function signIn(_state: FormState, form: FormData): Promise<FormState> {
  const email = canonicalUniversityEmail(form.get("email"));
  const password = form.get("password");
  if (!email) return { error: emailMessage };
  if (typeof password !== "string" || !password || password.length > 128) return { error: "Enter your password." };
  try {
    const client = await createAuthClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { error: "Unable to sign in. Check your email and password, and confirm your email first." };
    const verified = await client.auth.getUser();
    if (verified.error || !eligibleIdentity(verified.data.user)) {
      await client.auth.signOut({ scope: "local" });
      return { error: "Sign in with a confirmed @osu.edu account to continue." };
    }
  } catch { return unavailable; }
  revalidatePath("/", "layout");
  redirect("/account");
}

export async function signUp(_state: FormState, form: FormData): Promise<FormState> {
  const email = canonicalUniversityEmail(form.get("email"));
  const password = form.get("password");
  if (!email) return { error: emailMessage };
  const invalid = passwordError(password);
  if (invalid) return { error: invalid };
  if (password !== form.get("confirmPassword")) return { error: "Your passwords don’t match." };
  try {
    const client = await createAuthClient();
    const { data, error } = await client.auth.signUp({
      email, password: password as string,
      options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
    });
    if (error) return { error: "We couldn’t create your account. Try again shortly, or sign in if you already registered." };
    // Confirmation must stay enabled; never turn automatic signup into app access.
    if (data.session) {
      await client.auth.signOut({ scope: "local" });
      return { error: "Email confirmation is unavailable. Please contact the app owner." };
    }
    return { success: "Check your Ohio State inbox for a confirmation link. Open it in this browser to finish creating your account. Already registered? You can sign in instead." };
  } catch { return unavailable; }
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
