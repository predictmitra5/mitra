import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readPublicMarket, readTrader } from "@/modules/market/service";
import { readPriceSeries, readQuotes, readTicker, recordClick, type FeedCard } from "@/modules/discovery/feed";
import { canSubmit, listForSubject, listPublished } from "@/modules/evidence/service";
import { advanceMarket, readObjections } from "@/modules/market/lifecycle";
import { valueHolding } from "@/modules/account/positions";
import { readViewerOrNull } from "@/modules/account/viewer";
import { photoUrl } from "@/modules/account/photo-url";
import { categoryLabel, closesInWords, pointsText, tickerLabel } from "@/modules/discovery/present";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { Avatar, Gain, type CardData } from "@/app/components/market/goal-card";
import { Ticker } from "@/app/components/market/ticker";
import { LiveChart, LiveStats } from "./live-market";
import { TradeDock } from "./trade-dock";
import type { TradeAccess } from "./trade-panel";
import { ObjectionForm } from "./objection-form";
import { EvidenceForm } from "./evidence-form";
import { SignupPrompt } from "@/app/components/signup-prompt";

/*
 * A goal's page in the Kalshi direction (2026-09-24, docs/DESIGN.md section 9):
 * the question, the chance large above the chart, volume and close date, the
 * rules, and proof as a dated list of the owner's verified statements. The trade
 * panel sits on the right on a desktop and in a bottom sheet on a phone.
 *
 * Anyone can read it (2026-10-05); trading and every other write still needs a
 * verified university identity, and visitors get the sign-up pop-up. Goal pages
 * stay out of search engines until the owner decides otherwise.
 */

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
    return { title: market?.question ?? "Goal unavailable", robots: { index: false, follow: false } };
  } catch { return { title: "Goal unavailable", robots: { index: false } }; }
}

const zone = "America/New_York";
const dateTime = (value: Date) => `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(value)} ET`;
const longDate = (value: Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: zone }).format(value);
const shortDate = (value: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: zone }).format(value);

/** The goal's tab on the feed, for the breadcrumb. */
const TAB_OF: Record<string, string> = { gpa: "academics", club: "competitions", running: "competitions" };

function toTickerCard(card: FeedCard): CardData {
  return {
    id: card.id, question: card.question, goalType: card.goalType, displayName: card.displayName, handle: card.handle,
    photo: photoUrl(card.handle, card.photoUpdatedAt), yesPrice: card.yesPrice, tradingOpen: card.tradingOpen, deadlineAt: card.deadlineAt.toISOString(),
    approvedAt: card.approvedAt.toISOString(), volumeMicro: card.volumeMicro, change24hBp: card.change24hBp, reason: card.reason,
  };
}

type Held = { yesSharesMicro: number; noSharesMicro: number; yesCostBasisMicro: number; noCostBasisMicro: number };

/** "Your position": each side's shares, value at today's price, and the change since bought. */
function Position({ held, yesPrice, className }: { held: Held; yesPrice: number; className: string }) {
  const value = valueHolding({ ...held, yesPrice });
  if (!value || value.sides.length === 0) return null;
  return (
    <section className={`goal-position ${className}`} aria-label="Your position">
      <h2>Your position</h2>
      <ul>
        {value.sides.map((side) => (
          <li key={side.side}>
            <span className="muted">{pointsText(side.sharesMicro)} {side.side === "yes" ? "Yes" : "No"} shares</span>
            <span>{pointsText(side.valueMicro)} pts <Gain micro={side.gainMicro} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function MarketPage({ params, searchParams }: PageProps<"/markets/[id]">) {
  const { id } = await params;
  const now = new Date();
  let market;
  try { market = await loadMarket(id); }
  catch {
    return <div className="market-shell"><MarketHeader viewer={null} /><main className="account-main"><section className="account-card"><h1>This goal is temporarily unavailable.</h1><p>Please try again shortly.</p><Link href="/" prefetch={false}>Back to all goals</Link></section></main><MarketFooter /></div>;
  }
  if (!market) notFound();
  // Feed measurement. recordClick swallows its own failures, and is called here
  // rather than in the cached loader so generateMetadata does not double-count.
  await recordClick(getDb(), id);
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

  // Proof. listPublished is public by decision; the other two are only ever
  // read for the person they belong to, and never reveal who the subject is.
  let publishedProof: Awaited<ReturnType<typeof listPublished>> = [];
  let myProof: Awaited<ReturnType<typeof listForSubject>> = [];
  let maySendProof = false;
  try {
    publishedProof = await listPublished(getDb(), id);
    if (identity) {
      maySendProof = await canSubmit(getDb(), identity.id, id);
      if (maySendProof) myProof = await listForSubject(getDb(), identity.id, id);
    }
  } catch {
    // Proof is additive to this page; never let it take the goal down with it.
  }

  // Price history, volume and the ticker: public, and additive, so a failure
  // leaves the chart empty and the prices above it still correct.
  let series: { at: string; yesBp: number }[] = [];
  let volumeMicro = 0;
  let ticker: CardData[] = [];
  try {
    const database = getDb();
    const points = await readPriceSeries(database, id, { at: now, yesBp: Math.round(market.yesPrice * 10_000) });
    series = points.map((point) => ({ at: new Date(point.at).toISOString(), yesBp: point.yesBp }));
    volumeMicro = (await readQuotes(database, [id], now))[0]?.volumeMicro ?? 0;
    ticker = (await readTicker(database, now)).map(toTickerCard);
  } catch {
    // Leave these empty.
  }

  const viewer = await readViewerOrNull(getDb(), identity?.id);
  const open = market.tradingOpen;
  const category = categoryLabel(market.goalType);
  const photo = photoUrl(market.handle, market.photoUpdatedAt);
  const status = open ? null : market.status === "cancelled" ? "Cancelled" : market.status === "settled" ? `Settled: ${market.ruledOutcome === "yes" ? "Yes" : "No"}`
    : market.status === "ruled" ? `Ruled ${market.ruledOutcome === "yes" ? "Yes" : "No"} · ${market.contestOpen ? "objections open" : "payout pending"}` : "Trading closed";
  const access: TradeAccess = !open ? { kind: "closed" }
    : accountUnavailable ? { kind: "unavailable" }
    : !identity ? { kind: "signed-out" }
    : !trader ? { kind: "no-profile" }
    : trader.blocked ? { kind: "blocked", message: trader.blocked }
    : { kind: "open" };
  const requestedSide = (await searchParams).side;
  const initialSide = requestedSide === "no" ? "NO" : "YES";
  const held = trader?.position ?? null;

  // The dated proof list, newest first: each verified statement on the day the
  // owner published it, and the day the goal opened at the owner's price.
  const proof = [
    ...publishedProof.map((item) => ({ key: item.id, at: item.reviewedAt ?? item.createdAt, item })),
    ...(market.approvedAt ? [{ key: "opened", at: market.approvedAt, item: null }] : []),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return <div className="market-shell goal-shell">
    <MarketHeader viewer={viewer} active="goals" />
    <Ticker cards={ticker} />
    <main className="goal">
      <div className="goal-main">
        <div className="goal-intro">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/" prefetch={false}>Goals</Link><span aria-hidden="true">/</span>
            <Link prefetch={false} href={TAB_OF[market.goalType ?? ""] ? `/?tab=${TAB_OF[market.goalType ?? ""]}` : "/"}>{category}</Link>
          </nav>
          <Link className="goal-back" href="/" prefetch={false}>← Goals</Link>
          <div className="goal-person">
            <Avatar name={market.displayName} photo={photo} size={48} shape="square" />
            <div>
              <span><strong>{market.displayName}</strong> <span className="muted">@{market.handle}</span></span>
              <span className="muted">{category} &middot; {closesInWords(market.deadlineAt, now)}</span>
            </div>
          </div>
          <h1>{market.question}</h1>
          {status && <p className="goal-status">{status}</p>}
        </div>

        <section className="goal-chart" aria-label="Chance of Yes">
          <LiveChart id={market.id} points={series} />
          <LiveStats id={market.id} yesPrice={market.yesPrice} volumeMicro={volumeMicro} closes={longDate(market.deadlineAt)} />
        </section>

        {held && <Position held={held} yesPrice={market.yesPrice} className="goal-position-phone" />}

        {market.ruledOutcome && market.status !== "cancelled" && <section className="goal-notice">
          <h2>{market.status === "settled" ? "Final outcome" : "The owner's ruling"}: {market.ruledOutcome === "yes" ? "Yes" : "No"}</h2>
          <p className="goal-text">{market.rulingReason}</p>
          {market.status === "settled" ? <p className="muted">Winning shares paid 1 point each; losing shares paid 0. Balances have been updated. This result is final.</p>
            : <p className="muted">Objections close {market.contestEndsAt && dateTime(market.contestEndsAt)}. If the owner changes the ruling, a fresh 24-hour window starts.</p>}
          {market.contestOpen && (trader ? <ObjectionForm marketId={id} version={market.rulingVersion} />
            : identity ? <Link className="btn btn-secondary" href="/account">Complete your profile to object</Link>
            : <Link className="btn btn-secondary" href="/sign-in" data-needs-account>Log in to object</Link>)}
        </section>}
        {market.status === "cancelled" && <section className="goal-notice"><h2>Cancelled. Held costs refunded.</h2><p className="goal-text">Every participant received the cost of the shares they still held. This is a refund, not a Yes or No payout.</p></section>}
        {!!objections.length && <section className="goal-notice"><h2>Private objections you can view</h2><p className="muted">Visible only to each author and the owner.</p>{objections.map((objection) => <article key={objection.id} className="goal-objection"><p className="muted">Ruling version {objection.rulingVersion} · {dateTime(objection.createdAt)}</p><p className="goal-text">{objection.reason}</p></article>)}</section>}
        {maySendProof && <EvidenceForm marketId={id} mine={myProof} proofDeadline={dateTime(market.evidenceDeadlineAt)} />}

        <section className="goal-section" aria-labelledby="rules-title">
          <h2 id="rules-title">Rules</h2>
          <p className="goal-rules">{market.resolutionCriteria}</p>
          <dl className="goal-facts">
            <div><dt>Goal deadline</dt><dd>{dateTime(market.deadlineAt)}</dd></div>
            <div><dt>Proof due</dt><dd>{dateTime(market.evidenceDeadlineAt)}</dd></div>
            {market.approvedAt && <div><dt>Opened</dt><dd>{longDate(market.approvedAt)}, approved by the owner</dd></div>}
            <div><dt>If cancelled</dt><dd>Shares refunded at what you paid</dd></div>
          </dl>
          <p className="muted goal-small">Trading ends at the deadline, or earlier if the owner closes it. Missing proof resolves No. Each ruling has a 24-hour window for objections before payout. Private proof documents never appear on this page.</p>
        </section>

        <section className="goal-section" aria-labelledby="proof-title">
          <div className="goal-section-head"><h2 id="proof-title">Proof</h2><span className="muted">Written by the owner</span></div>
          <ol className="proof-list">
            {proof.map(({ key, at, item }) => (
              <li key={key}>
                <time dateTime={at.toISOString()}>{shortDate(at)}</time>
                {item ? (
                  <div>
                    {item.removedAt ? <p>Proof was supplied and later removed when the member deleted their account.</p> : <>
                      {item.verifiedStatement && <p>{item.verifiedStatement}</p>}
                      {item.kind === "link" && item.linkUrl && <a href={item.linkUrl} target="_blank" rel="noopener noreferrer nofollow">{item.linkUrl}</a>}
                      {item.caption && <p className="muted">Described by {market.displayName} as: {item.caption}</p>}
                    </>}
                  </div>
                ) : (
                  <p>Goal approved and opened at {Math.round((market.openingProbabilityBp ?? 5000) / 100)}%.</p>
                )}
              </li>
            ))}
          </ol>
          <p className="muted goal-small">The owner writes each statement after reading the original, which stays private because it carries personal details. Links are published as they were sent.</p>
        </section>
      </div>

      <TradeDock
        marketId={market.id}
        title={tickerLabel(market.goalType, market.question, market.displayName)}
        name={market.displayName}
        photo={photo}
        yesPrice={market.yesPrice}
        liquidity={market.liquidity}
        access={access}
        balanceMicro={trader?.balanceMicro ?? null}
        allowanceMicro={trader?.allowanceMicro ?? null}
        heldYesMicro={held?.yesSharesMicro ?? 0}
        heldNoMicro={held?.noSharesMicro ?? 0}
        initialSide={initialSide}
        openInitially={open && (requestedSide === "yes" || requestedSide === "no")}
        tradingOpen={open}
        position={held ? <Position held={held} yesPrice={market.yesPrice} className="goal-position-desktop" /> : null}
      />
    </main>
    <MarketFooter />
    {!identity && <SignupPrompt />}
  </div>;
}
