"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import type { FormState } from "@/modules/auth/policy";
import { beginPhotoUpload, completePhotoUpload, PhotoError, removeProfilePhoto } from "./photos";

const signedOut = { error: "Sign in to change your photo." };

function refresh() {
  // Photos appear on the account page, the goal form, and everywhere a name is shown.
  revalidatePath("/", "layout");
}

export type PhotoUploadStart = { ok: true; uploadId: string; url: string } | { ok: false; error: string };

/**
 * Step 1 of a new photo (2026-09-24): a one-time link to upload the original
 * to, because Vercel refuses request bodies over 4.5 MB.
 */
export async function startPhotoUpload(file: { contentType: string; bytes: number }): Promise<PhotoUploadStart> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { ok: false, ...signedOut };
    const start = await beginPhotoUpload(getDb(), identity.id, { contentType: file?.contentType, bytes: file?.bytes });
    return { ok: true, ...start };
  } catch (error) {
    if (error instanceof PhotoError) return { ok: false, error: error.message };
    return { ok: false, error: "Your photo could not be uploaded. Please try again." };
  }
}

/** Step 3: check the uploaded original for AI labels, re-encode it and save it. */
export async function finishPhotoUpload(upload: { uploadId: string; contentType: string }): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    await completePhotoUpload(getDb(), identity.id, { uploadId: upload?.uploadId, contentType: upload?.contentType });
  } catch (error) {
    if (error instanceof PhotoError) return { error: error.message };
    return { error: "Your photo could not be saved. Please try again." };
  }
  refresh();
  return { success: "Photo saved." };
}

export async function removeOwnPhotoAction(): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    await removeProfilePhoto(getDb(), identity.id, identity.id);
  } catch (error) {
    if (error instanceof PhotoError) return { error: error.message };
    return { error: "Your photo could not be removed. Please try again." };
  }
  refresh();
  return { success: "Photo removed." };
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
