import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { readPublicCampaign } from "@/modules/promotions/campaigns";
import { ClaimForm } from "./claim-form";

export const metadata = { title: "Campus campaign", robots: { index: false, follow: false } };

export default async function ClaimCampaignPage({ params }: PageProps<"/promotions/claim/[token]">) {
  const { token } = await params;
  const campaign = await readPublicCampaign(getDb(), token);
  if (!campaign || !campaign.active || campaign.endsAt <= new Date()) notFound();
  const identity = await currentIdentity();
  const viewer = await readViewerOrNull(getDb(), identity?.id);
  const returnTo = `/promotions/claim/${token}`;
  const campusName = campaign.campus === "osu" ? "Ohio State" : "Illinois";
  const profileReady = !!viewer?.displayName;
  return <div className="market-shell"><MarketHeader viewer={viewer} brandMode="neutral" entryAction={identity ? "none" : "sign-in"} />
    <main className="account-main claim-main"><section className="account-card claim-card">
      <span className="eyebrow">{campusName.toUpperCase()} CAMPUS CAMPAIGN</span>
      <div className="claim-intro"><div><h1>{campaign.name}</h1><p>Check in at this campus location to claim the campaign reward.</p></div>
        <div className="claim-reward"><strong>{(campaign.rewardMicro / 1_000_000).toLocaleString()}</strong><span>Trade Coins</span></div>
      </div>
      <div className="claim-details"><span>Campus <strong>{campusName}</strong></span><span>Claim area <strong>{campaign.radiusMeters} m radius</strong></span></div>
      {identity && <div className="claim-account"><span className="claim-account-dot" aria-hidden="true" />
        <div><strong>Signed in</strong><span>{identity.email}</span></div>
      </div>}
      {identity && identity.campus !== campaign.campus
        ? <p className="form-error" role="alert">This campaign is for a different verified campus account.</p>
        : identity && !profileReady
          ? <div className="claim-signin"><p>Finish setting up your account before claiming.</p><Link className="btn btn-primary" href="/welcome">Continue setup</Link></div>
          : identity
            ? <ClaimForm token={token} signedIn />
            : <div className="claim-signin"><p>Sign in with your verified university email to claim. We’ll bring you back here after login.</p>
              <Link className="btn btn-primary" href={`/sign-in?next=${encodeURIComponent(returnTo)}`}>Log in to claim</Link>
            </div>}
      <p className="claim-privacy">Your browser shares its location for this check only. Mitra discards the coordinates after verifying the campaign radius. Device location can be spoofed.</p>
    </section></main><MarketFooter brandMode="neutral" />
  </div>;
}
