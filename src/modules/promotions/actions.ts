"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { CAMPUSES, isCampusKey } from "@/config/campus";
import { currentIdentity } from "@/modules/auth/server";
import type { FormState } from "@/modules/auth/policy";
import { CampaignError, claimCampaign, createCampaign } from "./campaigns";
import { parseLocalDateTime } from "@/modules/events/time";

export type CampaignFormState = FormState & { claimUrl?: string };
const value = (form: FormData, key: string) => {
  const item = form.get(key);
  return typeof item === "string" ? item : "";
};

export async function createQrCampaignAction(_state: CampaignFormState, form: FormData): Promise<CampaignFormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return { error: "Sign in with an owner account to continue." };
    const campus = value(form, "campus");
    if (!isCampusKey(campus)) return { error: "Choose a campus." };
    const zone = CAMPUSES[campus].timeZone;
    const startsAt = parseLocalDateTime(value(form, "startsAt"), zone);
    const endsAt = parseLocalDateTime(value(form, "endsAt"), zone);
    if (!startsAt || !endsAt) return { error: "Enter a valid campaign start and end time." };
    const created = await createCampaign(getDb(), identity.id, {
      campus,
      name: value(form, "name"),
      latitude: Number(value(form, "latitude")),
      longitude: Number(value(form, "longitude")),
      radiusMeters: Number(value(form, "radiusMeters")),
      rewardCoins: Number(value(form, "rewardCoins")),
      maxClaims: value(form, "maxClaims") ? Number(value(form, "maxClaims")) : null,
      startsAt,
      endsAt,
    });
    revalidatePath("/review/campaigns");
    return { success: "Campaign created. Copy this private claim link now; the secret cannot be recovered later.", claimUrl: `/promotions/claim/${created.token}` };
  } catch (error) {
    if (error instanceof CampaignError) return { error: error.message };
    return { error: "We couldn’t create this campaign. Check the details and try again." };
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
