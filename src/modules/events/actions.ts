"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { CAMPUSES, isCampusKey } from "@/config/campus";
import { currentIdentity } from "@/modules/auth/server";
import type { FormState } from "@/modules/auth/policy";
import { EventError, publishMarket, rejectProposal, submitProposal } from "./service";
import { parseLocalDateTime } from "./time";

const signedOut = { error: "Sign in with your verified university email to continue." };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** A student's suggestion. The campus and proposer come from the verified identity. */
export async function suggestMarket(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    const zone = CAMPUSES[identity.campus].timeZone;
    const start = parseLocalDateTime(text(form, "start"), zone);
    if (!start) return { error: "Pick when it happens." };
    const endText = text(form, "end");
    const end = endText ? parseLocalDateTime(endText, zone) : null;
    if (endText && !end) return { error: "That end time isn’t a real date and time." };
    await submitProposal(getDb(), identity.id, identity.campus, {
      question: text(form, "question"), category: text(form, "category"), venueName: text(form, "venue"),
      venueId: text(form, "venueId") || null, windowStartAt: start, windowEndAt: end, resolutionNote: text(form, "resolution"),
    });
  } catch (error) {
    if (error instanceof EventError) return { error: error.message };
    return { error: "We couldn’t send your suggestion. Please try again shortly." };
  }
  revalidatePath("/account");
  redirect("/account?notice=suggestion-sent#suggestions");
}

/** Owner: publish a market, from a suggestion (proposalId) or from scratch. */
export async function publishMarketAction(_state: FormState, form: FormData): Promise<FormState> {
  let marketId: string;
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    const campus = text(form, "campus");
    if (!isCampusKey(campus)) return { error: "Choose a campus." };
    const zone = CAMPUSES[campus].timeZone;
    const when = (name: string) => parseLocalDateTime(text(form, name), zone);
    const percent = Number(text(form, "openingPercent"));
    if (!Number.isInteger(percent) || percent < 1 || percent > 99) return { error: "Set opening odds as a whole number from 1 to 99." };
    const venueId = text(form, "venueId");
    const sourceId = text(form, "sourceId");
    const market = await publishMarket(getDb(), identity.id, {
      proposalId: text(form, "proposalId") || null,
      campus, question: text(form, "question"), shortQuestion: text(form, "shortQuestion"), category: text(form, "category"),
      venue: venueId ? { id: venueId } : { name: text(form, "venueName"), area: text(form, "venueArea"), description: text(form, "venueDescription") },
      eventTitle: text(form, "eventTitle"), timeZone: zone,
      windowStartAt: when("windowStart"), windowEndAt: when("windowEnd"), tradingCutoffAt: when("cutoff"), resultsDueAt: when("resultsDue"),
      yesCondition: text(form, "yesCondition"), noCondition: text(form, "noCondition"), rules: text(form, "rules"),
      source: sourceId ? { id: sourceId } : {
        name: text(form, "sourceName"), method: text(form, "sourceMethod"), url: text(form, "sourceUrl"),
        operational: text(form, "sourceOperational") === "on",
      },
      openingProbabilityBp: percent * 100, isSample: text(form, "isSample") === "on", note: text(form, "note"),
    });
    marketId = market.id;
  } catch (error) {
    if (error instanceof EventError) return { error: error.message };
    return { error: "We couldn’t publish this market. Please try again shortly." };
  }
  revalidatePath("/");
  revalidatePath("/review");
  redirect(`/markets/${marketId}`);
}

export async function rejectProposalAction(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    await rejectProposal(getDb(), identity.id, text(form, "proposalId"), text(form, "reason"));
  } catch (error) {
    if (error instanceof EventError) return { error: error.message };
    return { error: "We couldn’t save that. Please try again shortly." };
  }
  revalidatePath("/review");
  redirect("/review?notice=rejected");
}
