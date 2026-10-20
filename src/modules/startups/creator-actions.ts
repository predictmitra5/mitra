"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { addClaim, addUpdate, addVideo, CreatorError, registerStartup, saveFounderProfile, suggestMarket, updateStartup } from "./creator";

/*
 * The creator hub's forms (2026-10-19). Each checks the signed-in account on
 * the server and returns a message the form shows; nothing here trusts an id
 * from the browser except which startup to change, which the service checks
 * the account manages.
 */

export type FormState = { ok: boolean; message: string } | null;

async function run(work: (userId: string) => Promise<unknown>, done: string): Promise<FormState> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, message: "Log in to use creator tools." };
  try {
    await work(identity.id);
  } catch (error) {
    return { ok: false, message: error instanceof CreatorError ? error.message : "That didn't save. Please try again." };
  }
  revalidatePath("/create");
  return { ok: true, message: done };
}

const field = (form: FormData, name: string) => form.get(name) ?? undefined;

export async function saveFounderAction(_: FormState, form: FormData): Promise<FormState> {
  return run((userId) => saveFounderProfile(getDb(), userId, {
    handle: field(form, "handle"), name: field(form, "name"), headline: field(form, "headline"), bio: field(form, "bio"),
    background: field(form, "background"), location: field(form, "location"), portraitUrl: field(form, "portraitUrl"),
    websiteUrl: field(form, "websiteUrl"), accomplishments: field(form, "accomplishments"),
  }), "Founder profile saved. A new profile is visible to others once the owner approves it.");
}

function startupInput(form: FormData) {
  return {
    name: field(form, "name"), tagline: field(form, "tagline"), headline: field(form, "headline"), description: field(form, "description"),
    industry: field(form, "industry"), tags: field(form, "tags"), stage: field(form, "stage"), foundedOn: field(form, "foundedOn"),
    headquarters: field(form, "headquarters"), websiteUrl: field(form, "websiteUrl"), logoUrl: field(form, "logoUrl"),
    thumbnailUrl: field(form, "thumbnailUrl"), productImageUrl: field(form, "productImageUrl"), productDetails: field(form, "productDetails"),
    features: field(form, "features"), screenshots: field(form, "screenshots"), role: field(form, "role"),
  };
}

export async function registerStartupAction(_: FormState, form: FormData): Promise<FormState> {
  return run((userId) => registerStartup(getDb(), userId, startupInput(form)), "Startup registered. The owner reviews it before it appears anywhere.");
}

export async function updateStartupAction(_: FormState, form: FormData): Promise<FormState> {
  return run(async (userId) => {
    const row = await updateStartup(getDb(), userId, form.get("startupId"), startupInput(form));
    revalidatePath(`/startups/${row.slug}`);
  }, "Startup details saved.");
}

export async function addVideoAction(_: FormState, form: FormData): Promise<FormState> {
  return run((userId) => addVideo(getDb(), userId, form.get("startupId"), {
    title: field(form, "title"), description: field(form, "description"), kind: field(form, "kind"), videoUrl: field(form, "videoUrl"),
    thumbnailUrl: field(form, "thumbnailUrl"), durationSeconds: field(form, "durationSeconds"), captions: field(form, "captions"),
  }), "Video sent for review. It appears in feeds once the owner approves it.");
}

export async function addUpdateAction(_: FormState, form: FormData): Promise<FormState> {
  return run((userId) => addUpdate(getDb(), userId, form.get("startupId"), {
    title: field(form, "title"), body: field(form, "body"), kind: field(form, "kind"), happenedOn: field(form, "happenedOn"),
  }), "Update posted. It shows as founder-reported until the owner checks it.");
}

export async function addClaimAction(_: FormState, form: FormData): Promise<FormState> {
  return run((userId) => addClaim(getDb(), userId, form.get("startupId"), {
    statement: field(form, "statement"), sourceName: field(form, "sourceName"), sourceUrl: field(form, "sourceUrl"),
  }), "Claim sent for verification.");
}

export async function suggestMarketAction(_: FormState, form: FormData): Promise<FormState> {
  return run((userId) => suggestMarket(getDb(), userId, form.get("startupId"), {
    question: field(form, "question"), howToCheck: field(form, "howToCheck"), closesOn: field(form, "closesOn"),
  }), "Suggestion sent. Only the owner can open a market, with exact rules and an opening price.");
}
