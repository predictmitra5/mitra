"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { claimRefill, RefillError, type RefillReceipt } from "./refill";

export type RefillResult = { ok: true; receipt: RefillReceipt } | { ok: false; code: string; error: string };

export async function refillCash(requestId: string): Promise<RefillResult> {
  let receipt: RefillReceipt;
  try {
    const identity = await currentIdentity();
    if (!identity) throw new RefillError("SIGNED_OUT", "Sign in with your confirmed Ohio State email to refill.");
    receipt = await claimRefill(getDb(), identity.id, requestId);
  } catch (error) {
    return { ok: false, code: error instanceof RefillError ? error.code : "UNAVAILABLE",
      error: error instanceof RefillError ? error.message : "Your refill could not be confirmed. Retry the same refill safely." };
  }
  revalidatePath("/account");
  revalidatePath("/markets/[id]", "page");
  return { ok: true, receipt };
}
