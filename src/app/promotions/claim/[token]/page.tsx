import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { readPublicCampaign } from "@/modules/promotions/campaigns";
import { ClaimForm } from "./claim-form";

export const metadata = { title: "Campus campaign", robots: { index: false, follow: false } };

export default async function ClaimCampaignPage({ params }: PageProps<"/promotions/claim/[token]">) {
  const { token } = await params;
  const campaign = await readPublicCampaign(getDb(), token);
  if (!campaign || !campaign.active || campaign.endsAt <= new Date()) notFound();
  const identity = await currentIdentity();
  const campusName = campaign.campus === "osu" ? "Ohio State" : "Illinois";
  return <div className="market-shell"><MarketHeader viewer={null} brandMode="neutral" entryAction="sign-in" />
    <main className="account-main"><section className="account-card claim-card">
      <span className="eyebrow">{campusName.toUpperCase()} CAMPUS CAMPAIGN</span>
      <h1>{campaign.name}</h1>
      <p>Claim {campaign.rewardMicro / 1_000_000} Trade Coins. Mitra checks whether your device location is within the campaign’s {campaign.radiusMeters} metre area.</p>
      {identity && identity.campus !== campaign.campus
        ? <p className="form-error">This campaign is for a different verified campus account.</p>
        : <ClaimForm token={token} signedIn={!!identity} />}
      {!identity && <p><Link href="/sign-in">Sign in</Link> · <Link href="/sign-up">Create an account</Link></p>}
    </section></main><MarketFooter brandMode="neutral" />
  </div>;
}
