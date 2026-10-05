"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import type { FormState } from "@/modules/auth/policy";
import { AccountError, provisionAccount } from "./provision";
import { saveTopics } from "./topics";

export async function completeProfile(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in with your verified university email to continue." };
    const displayName = form.get("displayName");
    const handle = form.get("handle");
    if (typeof displayName !== "string" || typeof handle !== "string") return { error: "Enter a display name and username." };
    await provisionAccount(getDb(), identity.id, {
      displayName, handle, adultConfirmed: form.get("adultConfirmed") === "on",
    });
  } catch (error) {
    if (error instanceof AccountError) return { error: error.message };
    return { error: "We couldn’t finish setting up your account. Please try again shortly." };
  }
  revalidatePath("/", "layout");
  // Onboarding continues with the photo (decided 2026-10-05).
  redirect("/welcome?step=photo");
}

/** Onboarding: the topics they want to follow. Choosing none is fine. */
export async function saveOnboardingTopics(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in with your verified university email to continue." };
    await saveTopics(getDb(), identity.id, form.getAll("topic"));
  } catch {
    return { error: "We couldn’t save your topics. Please try again shortly." };
  }
  redirect("/welcome?step=how");
}
