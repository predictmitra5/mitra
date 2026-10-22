"use server";
import { currentIdentity } from "@/modules/auth/server";
import { getDb } from "@/db/client";
import { submitOrder, cancelMemberOrder } from "./store";
import type { OrderInput } from "./engine";
import { LIMITS, RATE_LIMITED_MESSAGE } from "@/modules/security/rate-limit";
import { within } from "@/modules/security/request";
export async function placeLimitOrder(input: OrderInput) {
  const identity = await currentIdentity();
  if (!identity) return { ok: false as const, error: "Sign in to continue." };
  if (!(await within(LIMITS.social, `user:${identity.id}`))) return { ok: false as const, error: RATE_LIMITED_MESSAGE };
  try {
    await submitOrder(getDb(), identity.id, input);
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error: "Trading is not available yet. Account funding is closed.",
    };
  }
}
export async function cancelLimitOrder(orderId: string, requestId: string) {
  const identity = await currentIdentity();
  if (!identity) return { ok: false as const, error: "Sign in to continue." };
  if (!(await within(LIMITS.social, `user:${identity.id}`))) return { ok: false as const, error: RATE_LIMITED_MESSAGE };
  try {
    await cancelMemberOrder(getDb(), identity.id, orderId, requestId);
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error: "The order could not be cancelled. Reload and try again.",
    };
  }
}
