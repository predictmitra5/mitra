import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { CampaignError, listCampaigns } from "@/modules/promotions/campaigns";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { CampaignForm } from "./campaign-form";

export const metadata = { title: "QR campaigns", robots: { index: false } };

export default async function CampaignsPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  let campaigns;
  try { campaigns = await listCampaigns(getDb(), identity.id); }
  catch (error) { if (error instanceof CampaignError) notFound(); throw new Error("Campaigns are temporarily unavailable."); }
  const viewer = await readViewerOrNull(getDb(), identity.id);
  return <div className="market-shell"><MarketHeader viewer={viewer} /><main className="account-main review-main">
    <div className="account-topline"><span className="eyebrow">OWNER CAMPAIGNS</span><Link href="/review/markets">Manage markets</Link></div>
    <section className="account-welcome"><h1>Campus QR awards.</h1><p>Create a location-checked claim link for a posted QR code. Each verified account can claim once per campaign; the optional campaign cap limits total awards.</p></section>
    <CampaignForm />
    <section className="account-card campaign-list"><h2>Existing campaigns</h2>
      {!campaigns.length && <p>No campaigns yet.</p>}
      {campaigns.map(({ campaign, claimCount }) => <article key={campaign.id}>
        <div><strong>{campaign.name}</strong><span>{campaign.campus.toUpperCase()} · {campaign.rewardMicro / 1_000_000} Gold Trade Coins · {claimCount}{campaign.maxClaims == null ? "" : ` / ${campaign.maxClaims}`} claims</span><small>Radius {campaign.radiusMeters} m · ends {campaign.endsAt.toLocaleString()}</small></div>
        <span className={`status-pill ${campaign.active && campaign.endsAt > new Date() ? "status-open" : "status-cancelled"}`}>{campaign.active && campaign.endsAt > new Date() ? "Active" : "Ended"}</span>
      </article>)}
    </section>
  </main><MarketFooter /></div>;
}
