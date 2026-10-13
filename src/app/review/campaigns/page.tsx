import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/db/client";
import { CAMPUSES, isCampusKey } from "@/config/campus";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { CampaignError, listCampaigns } from "@/modules/promotions/campaigns";
import { toLocalInput } from "@/modules/events/time";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { CampaignForm } from "./campaign-form";
import { CampaignItem } from "./campaign-item";

export const metadata = { title: "QR campaigns", robots: { index: false } };

function currentTimestamp() {
  return new Date().getTime();
}

export default async function CampaignsPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  let campaigns;
  try { campaigns = await listCampaigns(getDb(), identity.id); }
  catch (error) { if (error instanceof CampaignError) notFound(); throw new Error("Campaigns are temporarily unavailable."); }
  const viewer = await readViewerOrNull(getDb(), identity.id);
  const nowMs = currentTimestamp();
  return <div className="market-shell"><MarketHeader viewer={viewer} /><main className="account-main review-main">
    <div className="account-topline"><span className="eyebrow">OWNER CAMPAIGNS</span><Link href="/review/markets">Manage markets</Link></div>
    <section className="account-welcome"><h1>Campus QR awards.</h1><p>Create a location-checked claim link for a posted QR code. Each verified account can claim once per campaign; the optional campaign cap limits total awards.</p></section>
    <CampaignForm />
    <section className="account-card campaign-list"><h2>Existing campaigns</h2>
      {!campaigns.length && <p>No campaigns yet.</p>}
      {campaigns.map(({ campaign, claimCount }) => {
        if (!isCampusKey(campaign.campus)) return null;
        return <CampaignItem key={campaign.id} campaign={{
          id: campaign.id,
          campus: campaign.campus,
          name: campaign.name,
          latitude: campaign.latitude,
          longitude: campaign.longitude,
          radiusMeters: campaign.radiusMeters,
          rewardCoins: campaign.rewardMicro / 1_000_000,
          maxClaims: campaign.maxClaims,
          startsAt: toLocalInput(campaign.startsAt, CAMPUSES[campaign.campus].timeZone),
          endsAt: toLocalInput(campaign.endsAt, CAMPUSES[campaign.campus].timeZone),
          endsAtIso: campaign.endsAt.toISOString(),
          active: campaign.active,
          claimCount,
          nowMs,
      }} />;
      })}
    </section>
  </main><MarketFooter /></div>;
}
