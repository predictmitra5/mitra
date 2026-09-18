import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { formatMicro } from "@/modules/market/input";
import { readPublicMarket, readTrader } from "@/modules/market/service";
import { AppHeader } from "@/app/components/auth-screen";
import { TradeForm } from "./trade-form";

// This page includes the current user's holdings: never put it in a shared cache.
export const dynamic = "force-dynamic";
const loadMarket = cache(async (id: string) => readPublicMarket(getDb(), id));

export async function generateMetadata({ params }: PageProps<"/markets/[id]">): Promise<Metadata> {
  try {
    const market = await loadMarket((await params).id);
    return { title: market?.question ?? "Goal unavailable", robots: { index: !!market, follow: !!market } };
  } catch { return { title: "Goal unavailable", robots: { index: false } }; }
}

const date = (value: Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "America/New_York" }).format(value);

export default async function MarketPage({ params }: PageProps<"/markets/[id]">) {
  const { id } = await params;
  let market;
  try { market = await loadMarket(id); }
  catch {
    return <div className="site-shell"><AppHeader /><main className="account-main"><section className="account-card"><h1>This goal is temporarily unavailable.</h1><p>Please try again shortly.</p><Link href="/account">Your account</Link></section></main></div>;
  }
  if (!market) notFound();
  let identity = null;
  let trader = null;
  let accountUnavailable = false;
  try {
    identity = await currentIdentity();
    if (identity) trader = await readTrader(getDb(), identity.id, id);
  } catch { accountUnavailable = true; }
  const open = market.tradingOpen;
  const status = open ? "Trading open" : market.status === "cancelled" ? "Cancelled" : market.status === "settled" ? "Settled" : "Trading closed";

  return <div className="site-shell"><AppHeader /><main className="market-main">
    <nav className="market-nav"><Link href="/account">← Your account</Link><span className="eyebrow">PLAY-MONEY PREDICTIONS</span></nav>
    <div className="market-layout">
      <div className="market-story">
        <section className="market-hero">
          <div className="review-meta"><span className={`status-pill ${open ? "status-open" : ""}`}>{status}</span><span>{market.goalType?.replaceAll("_", " ")}</span></div>
          <p className="market-person">{market.displayName} <span>@{market.handle}</span></p>
          <h1>{market.question}</h1>
          <div className="market-prices" aria-label="Current share prices">
            <div><span>YES</span><strong>{(market.yesPrice * 100).toFixed(2)}<small>¢</small></strong></div>
            <div><span>NO</span><strong>{((1 - market.yesPrice) * 100).toFixed(2)}<small>¢</small></strong></div>
          </div>
          <p className="market-price-note">100¢ = 1 play point. A share pays 1 point if its outcome wins, and 0 if it loses. These are current prices; your preview shows the full trade cost.</p>
        </section>
        <section className="market-rules"><span className="eyebrow">BEFORE YOU MAKE YOUR CALL</span><h2>What counts as YES</h2>
          <p className="market-criteria">{market.resolutionCriteria}</p>
          <dl className="goal-dates"><div><dt>Goal deadline</dt><dd>{date(market.deadlineAt)} ET</dd></div><div><dt>Proof due</dt><dd>{date(market.evidenceDeadlineAt)} ET</dd></div></dl>
          <p className="muted">Trading ends at the goal deadline, or earlier if the owner closes it. The subject has 7 days to supply proof. Missing proof resolves NO. The owner’s ruling has a 24-hour contest window before final payout.</p>
          <p className="field-hint">This page is public. Private proof documents do not appear here. If the goal is cancelled, remaining shares are refunded at their held cost.</p>
        </section>
      </div>
      <aside className="market-ticket" aria-label="Trade this goal"><span className="eyebrow">MAKE YOUR CALL</span><h2>Your prediction</h2>
        {trader && <dl className="trade-summary holdings">
          <div><dt>Available points</dt><dd>{formatMicro(trader.balanceMicro)}</dd></div>
          <div><dt>YES shares held</dt><dd>{formatMicro(trader.position.yesSharesMicro)}</dd></div>
          <div><dt>NO shares held</dt><dd>{formatMicro(trader.position.noSharesMicro)}</dd></div>
          <div><dt>Remaining cost allowance</dt><dd>{formatMicro(trader.allowanceMicro)} points</dd></div>
        </dl>}
        {!open ? <p className="rule-note">Trading is closed. You can still read this goal’s terms.</p>
          : accountUnavailable ? <p className="form-error" role="alert">Your trading account couldn’t load. Refresh to try again.</p>
          : !identity ? <><p className="muted">Sign in with your confirmed Ohio State email to trade. Ages 18 and up.</p><Link className="primary-button" href="/sign-in">Sign in to trade</Link></>
          : !trader ? <><p className="rule-note">Complete your active profile and 18+ confirmation before trading.</p><Link className="primary-button" href="/account">Open your account</Link></>
          : trader.blocked ? <p className="rule-note">{trader.blocked}</p>
          : <TradeForm marketId={id} />}
      </aside>
    </div>
  </main><footer className="app-footer"><span>Play money. Real goals.</span><span>No deposits. No cash value.</span></footer></div>;
}
