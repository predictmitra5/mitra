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

/** Also finishes a ban whose cancellations did not all go through the first time. */
export async function banAction(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    if (text(form, "confirm") !== "yes") return { error: "Tick the box to confirm the ban." };
    const result = await banPerson(getDb(), identity.id, text(form, "userId"), text(form, "reason"));
    revalidatePath("/review/people");
    const parts = [
      result.cancelled ? `${result.cancelled} goal${result.cancelled === 1 ? "" : "s"} cancelled and refunded` : "",
      result.rejected ? `${result.rejected} draft${result.rejected === 1 ? "" : "s"} rejected` : "",
    ].filter(Boolean);
    if (result.remaining) {
      return { error: `Banned, but ${result.remaining} goal${result.remaining === 1 ? "" : "s"} could not be cancelled yet. Press “Finish cancelling” to try again.` };
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
    return { success: "Ban lifted. Goals it cancelled stay cancelled." };
  } catch (error) {
    if (error instanceof ModerationError) return { error: error.message };
    return { error: "The ban could not be lifted. Please try again." };
  }
}
