"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import {
  AdminError, declineSuggestion, openMarket, removeComment, resolveReport, reviewClaim, reviewFounder, reviewStartup, reviewVideo, saveMarketDraft, setPaused,
  type MarketDraftInput,
} from "./admin";

/*
 * The owner's forms (2026-10-19). Every action re-checks that the signed-in
 * account is the owner (in the service), and every decision lands in the
 * audit record with its reason.
 */

export type AdminFormState = { ok: boolean; message: string } | null;

async function run(work: (ownerId: string) => Promise<unknown>, done: string, paths: string[] = ["/review"]): Promise<AdminFormState> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, message: "Log in as the owner." };
  try {
    await work(identity.id);
  } catch (error) {
    return { ok: false, message: error instanceof AdminError ? error.message : "That didn't save. Please try again." };
  }
  for (const path of paths) revalidatePath(path);
  return { ok: true, message: done };
}

export async function reviewAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const what = form.get("what"), id = form.get("id"), decision = form.get("decision"), reason = form.get("reason");
  return run((owner) => {
    if (what === "founder") return reviewFounder(getDb(), owner, id, decision, reason);
    if (what === "startup") return reviewStartup(getDb(), owner, id, decision, reason);
    if (what === "video") return reviewVideo(getDb(), owner, id, decision, reason);
    throw new AdminError("INVALID_INPUT", "Unknown item.");
  }, decision === "approve" ? "Approved." : decision === "suspend" ? "Suspended." : "Turned down; they can read your reason.", ["/review", "/", "/markets"]);
}

export async function claimAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  return run((owner) => reviewClaim(getDb(), owner, form.get("id"), form.get("level"), form.get("note")), "Claim reviewed.");
}

export async function reportAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  return run((owner) => resolveReport(getDb(), owner, form.get("id"), form.get("outcome"), form.get("note"), form.get("act")), "Report closed.");
}

export async function removeCommentAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  return run((owner) => removeComment(getDb(), owner, form.get("id"), form.get("reason")), "Comment removed.");
}

export async function declineSuggestionAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  return run((owner) => declineSuggestion(getDb(), owner, form.get("id"), form.get("reason")), "Suggestion turned down.");
}

export async function pauseAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const marketId = form.get("id");
  const paused = form.get("paused") === "true";
  return run((owner) => setPaused(getDb(), owner, marketId, paused, form.get("reason")), paused ? "Trading paused." : "Trading resumed.",
    ["/review/markets", "/markets", typeof marketId === "string" ? `/markets/${marketId}` : "/markets"]);
}

function draftInput(form: FormData): MarketDraftInput {
  const get = (name: string) => form.get(name) ?? undefined;
  return {
    startupId: get("startupId"), question: get("question"), shortQuestion: get("shortQuestion"), kind: get("kind"), yesCondition: get("yesCondition"),
    noCondition: get("noCondition"), rules: get("rules"), sourceName: get("sourceName"), sourceMethod: get("sourceMethod"), sourceUrl: get("sourceUrl"),
    closesOn: get("closesOn"), resultsDueDays: get("resultsDueDays"),
    isDemo: form.get("isDemo") === "on", proposalId: get("proposalId"),
  };
}

/** Saves a draft, then either stays on it for more editing or opens it straight away. */
export async function saveDraftAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, message: "Log in as the owner." };
  const existing = form.get("marketId");
  let id: string;
  try {
    const row = await saveMarketDraft(getDb(), identity.id, draftInput(form), typeof existing === "string" && existing ? existing : null);
    id = row.id;
    if (form.get("intent") === "open") {
      await openMarket(getDb(), identity.id, id);
      revalidatePath("/markets");
    }
  } catch (error) {
    return { ok: false, message: error instanceof AdminError ? error.message : "That didn't save. Please try again." };
  }
  revalidatePath("/review");
  redirect(form.get("intent") === "open" ? `/markets/${id}` : `/review/markets/new?draft=${id}&saved=1`);
}

export async function openDraftAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, message: "Log in as the owner." };
  const id = form.get("id");
  try { await openMarket(getDb(), identity.id, id); }
  catch (error) { return { ok: false, message: error instanceof AdminError ? error.message : "That didn't open. Please try again." }; }
  revalidatePath("/markets");
  revalidatePath("/review");
  redirect(`/markets/${String(id)}`);
}
