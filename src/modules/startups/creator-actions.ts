"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { LIMITS, RATE_LIMITED_MESSAGE, RateLimited } from "@/modules/security/rate-limit";
import { limit, within } from "@/modules/security/request";
import {
  addClaim, addUpdate, addVideo, checkFounderHandle, CreatorError, registerStartup, saveFounderProfile, suggestMarket, updateStartup,
} from "./creator";

/*
 * The creator tools' server side (2026-10-19; step-by-step since 2026-10-21).
 * Each checks the signed-in account on the server and returns a message the
 * screen shows, with the field it is about so the steps can go back to it;
 * nothing here trusts an id from the browser except which startup to change,
 * which the service checks the account manages. Every write counts against the
 * creator request limit, by address and by account.
 */

export type FormState = { ok: boolean; message: string } | null;
export type StepResult = { ok: true; message: string; startupId?: string } | { ok: false; message: string; field?: string };

async function run(work: (userId: string) => Promise<{ startupId?: string } | void>, done: string): Promise<StepResult> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, message: "Log in to use creator tools." };
  let extra: { startupId?: string } | void;
  try {
    await limit(LIMITS.creatorWrite, `user:${identity.id}`);
    extra = await work(identity.id);
  } catch (error) {
    if (error instanceof RateLimited) return { ok: false, message: RATE_LIMITED_MESSAGE };
    if (error instanceof CreatorError) return { ok: false, message: error.message, field: error.field };
    return { ok: false, message: "That didn't save. Please try again." };
  }
  revalidatePath("/create");
  return { ok: true, message: done, ...(extra ?? {}) };
}

/** The same for the hub's plain forms, which show only the message. */
async function runForm(work: (userId: string) => Promise<unknown>, done: string): Promise<FormState> {
  const result = await run(async (userId) => { await work(userId); }, done);
  return { ok: result.ok, message: result.message };
}

type Fields = Record<string, unknown>;
const pick = (input: unknown, keys: readonly string[]): Fields => {
  const source = input && typeof input === "object" ? input as Fields : {};
  return Object.fromEntries(keys.map((key) => [key, typeof source[key] === "string" ? source[key] : undefined]));
};

const FOUNDER_FIELDS = ["handle", "name", "headline", "bio", "background", "location", "portraitUrl", "websiteUrl", "accomplishments"] as const;
const STARTUP_FIELDS = ["name", "tagline", "headline", "description", "industry", "tags", "stage", "foundedOn", "headquarters", "websiteUrl",
  "logoUrl", "thumbnailUrl", "productImageUrl", "productDetails", "features", "screenshots", "role"] as const;
const VIDEO_FIELDS = ["title", "description", "kind", "videoUrl", "thumbnailUrl", "durationSeconds"] as const;

/** Whether an @handle is free while the founder types, and the nearest free one if not. */
export async function checkHandleAction(handle: string): Promise<{ handle: string; valid: boolean; available: boolean; suggestion: string } | null> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return null;
  if (!(await within(LIMITS.handleCheck, `user:${identity.id}`))) return null;
  try { return await checkFounderHandle(getDb(), identity.id, handle); } catch { return null; }
}

export async function saveFounderStepsAction(input: unknown): Promise<StepResult> {
  return run(async (userId) => {
    const row = await saveFounderProfile(getDb(), userId, pick(input, FOUNDER_FIELDS) as Parameters<typeof saveFounderProfile>[2]);
    revalidatePath(`/founders/${row.handle}`);
  }, "Founder profile saved. A new profile is visible to others once the owner approves it.");
}

export async function saveStartupStepsAction(startupId: string | null, input: unknown): Promise<StepResult> {
  const fields = pick(input, STARTUP_FIELDS) as Parameters<typeof registerStartup>[2];
  if (startupId) {
    return run(async (userId) => {
      const row = await updateStartup(getDb(), userId, startupId, fields);
      revalidatePath(`/startups/${row.slug}`);
      return { startupId: row.id };
    }, "Startup details saved.");
  }
  return run(async (userId) => ({ startupId: (await registerStartup(getDb(), userId, fields)).id }),
    "Startup registered. The owner reviews it before it appears anywhere.");
}

export async function addVideoStepsAction(startupId: string, input: unknown): Promise<StepResult> {
  return run(async (userId) => { await addVideo(getDb(), userId, startupId, pick(input, VIDEO_FIELDS) as Parameters<typeof addVideo>[3]); },
    "Video sent for review. It appears in feeds once the owner approves it.");
}

const field = (form: FormData, name: string) => form.get(name) ?? undefined;

export async function addUpdateAction(_: FormState, form: FormData): Promise<FormState> {
  return runForm((userId) => addUpdate(getDb(), userId, form.get("startupId"), {
    title: field(form, "title"), body: field(form, "body"), kind: field(form, "kind"), happenedOn: field(form, "happenedOn"),
  }), "Update posted. It shows as founder-reported until the owner checks it.");
}

export async function addClaimAction(_: FormState, form: FormData): Promise<FormState> {
  return runForm((userId) => addClaim(getDb(), userId, form.get("startupId"), {
    statement: field(form, "statement"), sourceName: field(form, "sourceName"), sourceUrl: field(form, "sourceUrl"),
  }), "Claim sent for verification.");
}

export async function suggestMarketAction(_: FormState, form: FormData): Promise<FormState> {
  return runForm((userId) => suggestMarket(getDb(), userId, form.get("startupId"), {
    question: field(form, "question"), howToCheck: field(form, "howToCheck"), closesOn: field(form, "closesOn"),
  }), "Suggestion sent. Only the owner can open a market, with exact rules and an opening price.");
}
