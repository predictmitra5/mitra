"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { parseTradeAmount } from "./input";
import { executeTrade, previewTrade, TradingError, type TradeConfirmation, type TradePreview, type TradeReceipt } from "./service";

type Result<T> = { ok: true; value: T } | { ok: false; error: string; code: string };

function failure(error: unknown) {
  return { ok: false as const,
    error: error instanceof TradingError ? error.message : "We couldn’t reach trading. You can safely retry the same confirmation.",
    code: error instanceof TradingError ? error.code : "UNAVAILABLE" };
}

export async function previewOrder(form: FormData): Promise<Result<TradePreview>> {
  try {
    const identity = await currentIdentity();
    if (!identity) throw new TradingError("SIGNED_OUT", "Sign in with your verified university email to trade.");
    const amountMicro = parseTradeAmount(form.get("amount"));
    const marketId = form.get("marketId"), side = form.get("side"), action = form.get("action");
    if (amountMicro === null || typeof marketId !== "string" || (side !== "YES" && side !== "NO") || (action !== "buy" && action !== "sell")) {
      throw new TradingError("INVALID_INPUT", "Enter a positive amount with at most six decimal places.");
    }
    return { ok: true, value: await previewTrade(getDb(), identity.id, { marketId, side, action, amountMicro }) };
  } catch (error) { return failure(error); }
}

export async function confirmOrder(input: TradeConfirmation): Promise<Result<TradeReceipt>> {
  let result: TradeReceipt;
  try {
    const identity = await currentIdentity();
    if (!identity) throw new TradingError("SIGNED_OUT", "Sign in with your verified university email to trade.");
    // The service validates every value and computes prices and balances again.
    // Client-supplied preview totals, identity, and wallet values are never used.
    result = await executeTrade(getDb(), identity.id, input);
  } catch (error) { return failure(error); }
  revalidatePath(`/markets/${result.marketId}`);
  revalidatePath("/account");
  revalidatePath("/positions");
  return { ok: true, value: result };
}
