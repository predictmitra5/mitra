"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { applyOwnerCommand, LifecycleError, submitObjection, type ObjectionInput, type OwnerCommand } from "./lifecycle";

export type LifecycleResult = { ok: true } | { ok: false; error: string; code: string };

function failure(error: unknown): LifecycleResult {
  return { ok: false, code: error instanceof LifecycleError ? error.code : "UNAVAILABLE",
    error: error instanceof LifecycleError ? error.message : "The update could not be confirmed. Retry the same request safely." };
}

function refresh(marketId: string) {
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/review/markets");
  revalidatePath("/account");
  revalidatePath("/positions");
}

export async function manageMarket(input: OwnerCommand): Promise<LifecycleResult> {
  let marketId: string;
  try {
    const identity = await currentIdentity();
    if (!identity) throw new LifecycleError("SIGNED_OUT", "Sign in with your verified university email to continue.");
    ({ marketId } = await applyOwnerCommand(getDb(), identity.id, input));
  } catch (error) { return failure(error); }
  refresh(marketId);
  return { ok: true };
}

export async function objectToRuling(input: ObjectionInput): Promise<LifecycleResult> {
  let marketId: string;
  try {
    const identity = await currentIdentity();
    if (!identity) throw new LifecycleError("SIGNED_OUT", "Sign in with your verified university email to object.");
    ({ marketId } = await submitObjection(getDb(), identity.id, input));
  } catch (error) { return failure(error); }
  refresh(marketId);
  return { ok: true };
}
