"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { appOrigin } from "@/modules/auth/config";
import { currentIdentity } from "@/modules/auth/server";
import { LIMITS, RATE_LIMITED_MESSAGE } from "@/modules/security/rate-limit";
import { within } from "@/modules/security/request";
import { claimInvite, createInvite, InviteError, revokeInvite } from "./invites";

/*
 * Co-founder invites from the browser (2026-10-22). Each checks the signed-in
 * account on the server; making and cancelling count against the creator limit,
 * and every join password typed counts against the join limit by address and
 * by account, on top of each invite's own five tries.
 */

type Failure = { ok: false; message: string; field?: string };

function failure(error: unknown): Failure {
  if (error instanceof InviteError) return { ok: false, message: error.message, field: error.field };
  return { ok: false, message: "That didn't work. Please try again." };
}

export async function createInviteAction(startupId: string, input: { role: string; password: string }):
  Promise<{ ok: true; link: string; expiresAt: string; startupName: string } | Failure> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, message: "Log in to invite co-founders." };
  if (!(await within(LIMITS.creatorWrite, `user:${identity.id}`))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  try {
    const made = await createInvite(getDb(), identity.id, startupId, { role: input?.role, password: input?.password });
    revalidatePath("/create");
    return { ok: true, link: `${appOrigin()}/join/${made.code}`, expiresAt: made.expiresAt.toISOString(), startupName: made.startupName };
  } catch (error) { return failure(error); }
}

export async function revokeInviteAction(inviteId: string): Promise<{ ok: true } | Failure> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, message: "Log in first." };
  if (!(await within(LIMITS.creatorWrite, `user:${identity.id}`))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  try {
    await revokeInvite(getDb(), identity.id, inviteId);
    revalidatePath("/create");
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function claimInviteAction(code: string, password: string): Promise<{ ok: true; joined: boolean } | Failure> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, message: "Log in or sign up first." };
  if (!(await within(LIMITS.join, `user:${identity.id}`))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  try {
    const result = await claimInvite(getDb(), identity.id, code, password);
    revalidatePath("/create");
    return { ok: true, joined: result.kind === "joined" };
  } catch (error) { return failure(error); }
}
