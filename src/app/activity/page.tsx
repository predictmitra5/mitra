import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, Flag, Megaphone, Receipt } from "lucide-react";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { readActivity, type ActivityItem } from "@/modules/startups/activity";
import { cardTitle, pointsText } from "@/modules/discovery/present";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { SampleTag } from "@/app/components/market/market-card";
import { VerificationBadge } from "@/app/components/startup/profile-parts";
import { SignupPrompt } from "@/app/components/signup-prompt";

/*
 * Activity (2026-10-19): what the founders and startups you follow have been
 * doing, and what happened to your trades. Without follows, the latest from
 * every startup.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity", robots: { index: false } };

const when = (at: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(at);
const money: Record<string, string> = { trade_buy: "You bought", trade_sell: "You sold", settlement: "Payout", cancellation_refund: "Refund" };

function Row({ item }: { item: ActivityItem }) {
  if (item.kind === "update") {
    return (
      <li className="activity-item">
        <span className={`activity-icon${item.milestone ? " is-milestone" : ""}`}>{item.milestone ? <Flag size={16} aria-hidden="true" /> : <Megaphone size={16} aria-hidden="true" />}</span>
        <div>
          <p className="activity-head">{item.startupSlug ? <Link href={`/startups/${item.startupSlug}`} prefetch={false}>{item.startupName}</Link> : "A founder"} {item.milestone ? "reached a milestone" : "posted an update"}{item.isDemo && <> <SampleTag /></>}</p>
          <strong>{item.title}</strong>
          <p className="muted">{item.body}</p>
          <span className="activity-meta"><VerificationBadge level={item.verification} /> <time>{when(item.at)}</time></span>
        </div>
      </li>
    );
  }
  if (item.kind === "video") {
    return (
      <li className="activity-item">
        <span className="activity-icon"><Clapperboard size={16} aria-hidden="true" /></span>
        <div>
          <p className="activity-head"><Link href={`/startups/${item.startupSlug}`} prefetch={false}>{item.startupName}</Link> posted a video{item.isDemo && <> <SampleTag /></>}</p>
          <Link href={`/watch/${item.id}`} prefetch={false}><strong>{item.title}</strong></Link>
          <span className="activity-meta"><time>{when(item.at)}</time></span>
        </div>
      </li>
    );
  }
  return (
    <li className="activity-item">
      <span className="activity-icon"><Receipt size={16} aria-hidden="true" /></span>
      <div>
        <p className="activity-head">{money[item.what]} <span className={item.amountMicro >= 0 ? "gain-up" : "gain-down"}>{item.amountMicro >= 0 ? "+" : "−"}{pointsText(Math.abs(item.amountMicro))} USD</span></p>
        <Link href={`/markets/${item.marketId}`} prefetch={false}>{cardTitle(item)}</Link>
        <span className="activity-meta"><time>{when(item.at)}</time></span>
      </div>
    </li>
  );
}

export default async function ActivityPage() {
  let identity = null;
  try { identity = await currentIdentity(); } catch { /* a visitor */ }
  const viewer = identity ? await readViewerOrNull(getDb(), identity.id) : null;
  let items: ActivityItem[] = [];
  let personal = false;
  let failed = false;
  try { ({ items, personal } = await readActivity(getDb(), identity?.id ?? null)); } catch { failed = true; }
  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="activity" />
      <main className="account activity">
        <div className="account-head"><h1>Activity</h1><span className="muted">{personal ? "From founders and startups you follow, and your trades" : "Latest from every startup"}</span></div>
        {!personal && <p className="rule-note">{identity ? "Follow founders and startups to make this yours." : <><Link href="/sign-up" data-needs-account>Sign up</Link> to follow founders and get their updates here.</>}</p>}
        {failed ? <p className="form-error" role="alert">Activity is temporarily unavailable.</p>
          : items.length === 0 ? <p className="muted account-none">Nothing yet.</p>
          : <ul className="activity-list">{items.map((item) => <Row key={`${item.kind}-${item.id}`} item={item} />)}</ul>}
      </main>
      <MarketFooter />
      {!identity && <SignupPrompt />}
    </div>
  );
}
