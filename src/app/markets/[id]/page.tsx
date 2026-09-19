import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { formatMicro } from "@/modules/market/input";
import { readPublicMarket, readTrader } from "@/modules/market/service";
import { advanceMarket, readObjections } from "@/modules/market/lifecycle";
import { AppHeader } from "@/app/components/auth-screen";
import { TradeForm } from "./trade-form";
import { ObjectionForm } from "./objection-form";

// This page includes the current user's holdings: never put it in a shared cache.
export const dynamic = "force-dynamic";
const loadMarket = cache(async (id: string) => {
  const database = getDb();
  await advanceMarket(database, id);
  return readPublicMarket(database, id);
});

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
  let objections: Awaited<ReturnType<typeof readObjections>> = [];
  let accountUnavailable = false;
  try {
    identity = await currentIdentity();
    if (identity) {
      trader = await readTrader(getDb(), identity.id, id);
      if (trader) objections = await readObjections(getDb(), identity.id, id);
    }
  } catch { accountUnavailable = true; }
  const open = market.tradingOpen;
  const status = open ? "Trading open" : market.status === "cancelled" ? "Cancelled" : market.status === "settled" ? "Settled" : market.status === "ruled" ? "Ruling · objections open" : "Trading closed";

  return <div className="site-shell"><AppHeader /><main className="market-main">
    <nav className="market-nav"><Link href="/account">← Your account</Link>{identity && <Link href="/positions" prefetch={false}>Your predictions ↗</Link>}<span className="eyebrow">PLAY-MONEY PREDICTIONS</span></nav>
    <div className="market-layout">
      <div className="market-story">
        <section className="market-hero">
          <div className="review-meta"><span className={`status-pill ${open ? "status-open" : ""}`}>{status}</span><span>{market.goalType?.replaceAll("_", " ")}</span></div>
          <p className="market-person">{market.displayName} <span>@{market.handle}</span></p>
          <h1>{market.question}</h1>
          <div className="market-prices" aria-label="Last market share prices">
            <div><span>YES</span><strong>{(market.yesPrice * 100).toFixed(2)}<small>¢</small></strong></div>
            <div><span>NO</span><strong>{((1 - market.yesPrice) * 100).toFixed(2)}<small>¢</small></strong></div>
          </div>
          <p className="market-price-note">{open ? "100¢ = 1 play point. A share pays 1 point if its outcome wins, and 0 if it loses. These are current prices; your preview shows the full trade cost." : "These are the last trading prices, not a final payout. The outcome and any refund appear below."}</p>
        </section>
        {market.ruledOutcome && market.status !== "cancelled" && <section className="market-rules ruling-box">
          <span className="eyebrow">{market.status === "settled" ? "FINAL OUTCOME" : "OWNER RULING"}</span>
          <h2>{market.ruledOutcome.toUpperCase()} · {market.status === "settled" ? "Payout complete" : "Open to objections"}</h2>
          <p className="market-criteria">{market.rulingReason}</p>
          {market.status === "settled" ? <p className="muted">Winning shares paid 1 point each; losing shares paid 0. Balances have been updated. This result is final.</p>
            : <p className="muted">Objections close {market.contestEndsAt && date(market.contestEndsAt)} ET. If the owner changes the ruling, a fresh 24-hour window starts.</p>}
          {market.contestOpen && (trader ? <ObjectionForm marketId={id} version={market.rulingVersion} />
            : <Link className="secondary-button" href={identity ? "/account" : "/sign-in"}>{identity ? "Complete your profile to object" : "Sign in to object"}</Link>)}
        </section>}
        {market.status === "cancelled" && <section className="market-rules ruling-box"><span className="eyebrow">CANCELLED</span><h2>Held costs refunded.</h2><p>Every participant received the cost of the shares they still held. This is a refund, not a YES or NO payout.</p></section>}
        {!!objections.length && <section className="market-rules private-objections"><h2>Private objections you can view</h2><p className="field-hint">Visible only to each author and the owner.</p>{objections.map((objection) => <article key={objection.id}><p className="field-hint">Ruling version {objection.rulingVersion} · {date(objection.createdAt)} ET</p><p className="market-criteria">{objection.reason}</p></article>)}</section>}
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
