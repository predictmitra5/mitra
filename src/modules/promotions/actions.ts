"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { CAMPUSES, isCampusKey } from "@/config/campus";
import { currentIdentity } from "@/modules/auth/server";
import type { FormState } from "@/modules/auth/policy";
import { CampaignError, claimCampaign, createCampaign, deleteCampaign, rotateCampaignToken, setCampaignActive, updateCampaign } from "./campaigns";
import { parseLocalDateTime } from "@/modules/events/time";

export type CampaignFormState = FormState & { claimUrl?: string };
const value = (form: FormData, key: string) => {
  const item = form.get(key);
  return typeof item === "string" ? item : "";
};

function parseCampaignInput(form: FormData) {
  const campus = value(form, "campus");
  if (!isCampusKey(campus)) return { error: "Choose a campus." } as const;
  const zone = CAMPUSES[campus].timeZone;
  const startsAt = parseLocalDateTime(value(form, "startsAt"), zone);
  const endsAt = parseLocalDateTime(value(form, "endsAt"), zone);
  if (!startsAt || !endsAt) return { error: "Enter a valid campaign start and end time." } as const;
  return { input: {
    campus,
    name: value(form, "name"),
    latitude: Number(value(form, "latitude")),
    longitude: Number(value(form, "longitude")),
    radiusMeters: Number(value(form, "radiusMeters")),
    rewardCoins: Number(value(form, "rewardCoins")),
    maxClaims: value(form, "maxClaims") ? Number(value(form, "maxClaims")) : null,
    startsAt,
    endsAt,
  } } as const;
}

export async function createQrCampaignAction(_state: CampaignFormState, form: FormData): Promise<CampaignFormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in with an owner account to continue." };
    const parsed = parseCampaignInput(form);
    if ("error" in parsed) return { error: parsed.error };
    const created = await createCampaign(getDb(), identity.id, parsed.input);
    revalidatePath("/review/campaigns");
    return { success: "Campaign created. Copy this private claim link now; the secret cannot be recovered later.", claimUrl: `/promotions/claim/${created.token}` };
  } catch (error) {
    if (error instanceof CampaignError) return { error: error.message };
    return { error: "We couldn’t create this campaign. Check the details and try again." };
  }
}

export async function updateQrCampaignAction(_state: CampaignFormState, form: FormData): Promise<CampaignFormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in with an owner account to continue." };
    const campaignId = value(form, "campaignId");
    const parsed = parseCampaignInput(form);
    if ("error" in parsed) return { error: parsed.error };
    await updateCampaign(getDb(), identity.id, campaignId, parsed.input);
    revalidatePath("/review/campaigns");
    return { success: "Campaign details updated." };
  } catch (error) {
    if (error instanceof CampaignError) return { error: error.message };
    return { error: "We couldn’t update this campaign. Check the details and try again." };
  }
}

export async function setQrCampaignActiveAction(_state: CampaignFormState, form: FormData): Promise<CampaignFormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in with an owner account to continue." };
    const activeValue = value(form, "active");
    if (activeValue !== "true" && activeValue !== "false") return { error: "Choose a valid campaign action." };
    await setCampaignActive(getDb(), identity.id, value(form, "campaignId"), activeValue === "true");
    revalidatePath("/review/campaigns");
    return { success: activeValue === "true" ? "Campaign resumed." : "Campaign paused." };
  } catch (error) {
    if (error instanceof CampaignError) return { error: error.message };
    return { error: "We couldn’t change this campaign’s status. Please try again." };
  }
}

export async function deleteQrCampaignAction(_state: CampaignFormState, form: FormData): Promise<CampaignFormState & { archived?: boolean }> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in with an owner account to continue." };
    const result = await deleteCampaign(getDb(), identity.id, value(form, "campaignId"));
    revalidatePath("/review/campaigns");
    return result.archived
      ? { success: "Campaign removed. Its claim and award history was retained for the audit record.", archived: true }
      : { success: "Unused campaign deleted.", archived: false };
  } catch (error) {
    if (error instanceof CampaignError) return { error: error.message };
    return { error: "We couldn’t remove this campaign. Please try again." };
  }
}

export async function replaceCampaignQrAction(_state: CampaignFormState, form: FormData): Promise<CampaignFormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in with an owner account to continue." };
    const replaced = await rotateCampaignToken(getDb(), identity.id, value(form, "campaignId"));
    revalidatePath("/review/campaigns");
    return { success: "New QR ready. The previous QR link no longer works.", claimUrl: `/promotions/claim/${replaced.token}` };
  } catch (error) {
    if (error instanceof CampaignError) return { error: error.message };
    return { error: "We couldn’t replace this QR. Please try again." };
  }
}

export async function claimQrCampaignAction(token: string, latitude: number, longitude: number) {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in with your verified university email before claiming." };
    const result = await claimCampaign(getDb(), identity.id, identity.campus, token, { latitude, longitude });
    revalidatePath("/account");
    return { success: `Added ${result.rewardCoins.toLocaleString()} Trade Coins to your account.` };
  } catch (error) {
    if (error instanceof CampaignError) return { error: error.message };
    return { error: "We couldn’t verify this claim. Your location was not saved; please try again." };
  }
}
