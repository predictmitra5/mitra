"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import type { FormState } from "@/modules/auth/policy";
import { PhotoError, removeProfilePhoto, setProfilePhoto } from "./photos";

const signedOut = { error: "Sign in to change your photo." };

function refresh() {
  // Photos appear on the account page, the goal form, and everywhere a name is shown.
  revalidatePath("/", "layout");
}

export async function uploadPhotoAction(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
    await setProfilePhoto(getDb(), identity.id, new Uint8Array(await file.arrayBuffer()), file.type);
  } catch (error) {
    if (error instanceof PhotoError) return { error: error.message };
    return { error: "Your photo could not be saved. Please try again." };
  }
  refresh();
  return { success: "Photo saved." };
}

export async function removeOwnPhotoAction(_state: FormState): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    await removeProfilePhoto(getDb(), identity.id, identity.id);
  } catch (error) {
    if (error instanceof PhotoError) return { error: error.message };
    return { error: "Your photo could not be removed. Please try again." };
  }
  refresh();
  return { success: "Photo removed. Add one again before posting a goal." };
}

/** The owner removing someone else's photo. Recorded. */
export async function removePersonPhotoAction(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in as the owner to continue." };
    const target = form.get("userId");
    await removeProfilePhoto(getDb(), identity.id, typeof target === "string" ? target : "");
  } catch (error) {
    if (error instanceof PhotoError) return { error: error.message };
    return { error: "The photo could not be removed. Please try again." };
  }
  refresh();
  return { success: "Photo removed." };
}
