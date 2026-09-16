"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import type { FormState } from "@/modules/auth/policy";
import { AccountError, provisionAccount } from "./provision";

export async function completeProfile(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in with your confirmed Ohio State email to continue." };
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
  revalidatePath("/account");
  redirect("/account");
}
