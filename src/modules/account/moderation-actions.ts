"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import type { FormState } from "@/modules/auth/policy";
import { banPerson, ModerationError, unbanPerson } from "./moderation";

const signedOut = { error: "Sign in as the owner to continue." };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Repeating a ban finishes rejection of any pending suggestions. */
export async function banAction(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    if (text(form, "confirm") !== "yes") return { error: "Tick the box to confirm the ban." };
    const result = await banPerson(getDb(), identity.id, text(form, "userId"), text(form, "reason"));
    revalidatePath("/review/people");
    const parts = [
      result.rejected ? `${result.rejected} draft${result.rejected === 1 ? "" : "s"} rejected` : "",
    ].filter(Boolean);
    if (result.remaining) {
      return { error: `Banned, but ${result.remaining} pending suggestion(s) could not be rejected. Retry the ban to finish.` };
    }
    return { success: `Banned.${parts.length ? ` ${parts.join("; ")}.` : ""}` };
  } catch (error) {
    if (error instanceof ModerationError) return { error: error.message };
    return { error: "The ban could not be saved. Please try again." };
  }
}

export async function unbanAction(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    await unbanPerson(getDb(), identity.id, text(form, "userId"));
    revalidatePath("/review/people");
    return { success: "Ban lifted. Anything it cancelled or turned down stays that way." };
  } catch (error) {
    if (error instanceof ModerationError) return { error: error.message };
    return { error: "The ban could not be lifted. Please try again." };
  }
}
