import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { DEFAULT_CAMPUS_KEY } from "@/config/campus";
import { currentIdentity } from "@/modules/auth/server";
import { readPublicMarket, readTrader } from "@/modules/market/service";
import { readPriceSeries, readQuotes, readTicker, recordClick } from "@/modules/discovery/feed";
import { advanceMarket, readObjections } from "@/modules/market/lifecycle";
import { valueHolding } from "@/modules/account/positions";
import { readViewerOrNull } from "@/modules/account/viewer";
import { cardTitle, categoryLabel, closesInWords, pointsText } from "@/modules/discovery/present";
import { statusLine } from "@/modules/events/status";
import { formatMoment, formatWindow } from "@/modules/events/time";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { Gain, SampleTag, VenueMark, type CardData } from "@/app/components/market/market-card";
import { toCardData } from "@/app/components/market/card-data";
import { Ticker } from "@/app/components/market/ticker";
import { LiveChart, LiveStats } from "./live-market";
import { TradeDock } from "./trade-dock";
import type { TradeAccess } from "./trade-panel";
import { ObjectionForm } from "./objection-form";
import { SignupPrompt } from "@/app/components/signup-prompt";

/*
 * A market's page in the Kalshi direction (2026-09-24), for campus event
 * markets since 2026-10-08 (DECISIONS.md): the venue and event, the question,
 * the chance large above the chart, volume and close date, exact Yes and No
 * conditions, the event window, trading cutoff and results deadline, and the
 * source that settles it, with whether that source is connected or still a
 * placeholder. A sample market says so above everything else. The trade panel
 * sits on the right on a desktop and in a bottom sheet on a phone.
 *
 * Anyone can read it; trading and every other write still needs a verified
 * university identity, and visitors get the sign-up pop-up. Market pages stay
 * out of search engines until the owner decides otherwise.
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
    return { title: market?.question ?? "Market unavailable", robots: { index: false, follow: false } };
  } catch { return { title: "Market unavailable", robots: { index: false } }; }
}

const FALLBACK_ZONE = "America/New_York";
const longDate = (value: Date, zone: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: zone }).format(value);
const shortDate = (value: Date, zone: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: zone }).format(value);

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

function Unavailable() {
  return <div className="market-shell"><MarketHeader viewer={null} /><main className="account-main"><section className="account-card"><h1>This market is temporarily unavailable.</h1><p>Please try again shortly.</p><Link href="/" prefetch={false}>Back to all markets</Link></section></main><MarketFooter /></div>;
}

export default async function MarketPage({ params, searchParams }: PageProps<"/markets/[id]">) {
  const { id } = await params;
  const now = new Date();
  let market;
  try { market = await loadMarket(id); }
  catch { return <Unavailable />; }
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
    ticker = (await readTicker(database, now, { campus: market.campus ?? DEFAULT_CAMPUS_KEY })).map(toCardData);
  } catch {
    // Leave these empty.
  }

  const viewer = await readViewerOrNull(getDb(), identity?.id);
  const open = market.tradingOpen;
  const zone = market.timeZone ?? FALLBACK_ZONE;
  const category = categoryLabel(market.category);
  const window = market.windowStartAt && market.windowEndAt ? formatWindow(market.windowStartAt, market.windowEndAt, zone) : null;
  const status = open ? null : statusLine({ status: market.status, tradingOpen: open, ruledOutcome: market.ruledOutcome, contestOpen: market.contestOpen });
  const access: TradeAccess = !open ? { kind: "closed" }
    : accountUnavailable ? { kind: "unavailable" }
    : !identity ? { kind: "signed-out" }
    : !trader ? { kind: "no-profile" }
    : trader.blocked ? { kind: "blocked", message: trader.blocked }
    : { kind: "open" };
  const requestedSide = (await searchParams).side;
  const initialSide = requestedSide === "no" ? "NO" : "YES";
  const held = trader?.position ?? null;
  const opened = market.approvedAt ? `${longDate(market.approvedAt, zone)} at ${Math.round((market.openingProbabilityBp ?? 5000) / 100)}%` : null;

  return <div className="market-shell goal-shell">
    <MarketHeader viewer={viewer} active="markets" />
    <Ticker cards={ticker} />
    <main className="goal">
      <div className="goal-main">
        <div className="goal-intro rise">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/" prefetch={false}>Markets</Link>
            {market.category && <><span aria-hidden="true">/</span><Link prefetch={false} href={`/?cat=${market.category}`}>{category}</Link></>}
            {market.venueSlug && <><span aria-hidden="true">/</span><Link prefetch={false} href={`/venues/${market.venueSlug}`}>{market.venueName}</Link></>}
          </nav>
          <Link className="goal-back" href="/" prefetch={false}>← Markets</Link>
          {market.venueName ? (
            <div className="goal-person">
              <VenueMark name={market.venueName} size={48} />
              <div>
                <span>
                  <strong>{market.venueSlug ? <Link href={`/venues/${market.venueSlug}`} prefetch={false}>{market.venueName}</Link> : market.venueName}</strong>
                  {" "}<span className="muted">{category}{market.venueArea ? ` · ${market.venueArea}` : ""}</span>
                  {market.isSample && <> <SampleTag /></>}
                </span>
                <span className="muted">{market.eventTitle ? `${market.eventTitle} · ` : ""}{closesInWords(market.deadlineAt, now)}</span>
              </div>
            </div>
          ) : (
            <p className="muted goal-archived">An earlier Mitra market, before markets moved to campus events.</p>
          )}
          <h1>{market.question}</h1>
          {status && <p className="goal-status">{status}</p>}
          {market.isSample && (
            <p className="sample-note">
              <strong>Sample market.</strong> A hypothetical demonstration. Mitra has no partnership with {market.venueName ?? "this venue"} and
              receives no data from it, and the price history before {market.approvedAt ? shortDate(market.approvedAt, zone) : "it opened"} is
              demonstration data. Trades use real points; sample markets are voided and everyone is refunded when they are retired.
            </p>
          )}
        </div>

        <section className="goal-chart rise" aria-label="Chance of Yes">
          <LiveChart id={market.id} points={series} />
          <LiveStats id={market.id} yesPrice={market.yesPrice} volumeMicro={volumeMicro} closes={formatMoment(market.deadlineAt, zone)} />
        </section>

        {held && <Position held={held} yesPrice={market.yesPrice} className="goal-position-phone" />}

        {market.ruledOutcome && market.status !== "cancelled" && <section className="goal-notice">
          <h2>{market.status === "settled" ? "Final outcome" : "The owner’s ruling"}: {market.ruledOutcome === "yes" ? "Yes" : "No"}</h2>
          <p className="goal-text">{market.rulingReason}</p>
          {market.status === "settled" ? <p className="muted">Winning shares paid 1 point each; losing shares paid 0. Balances have been updated. This result is final.</p>
            : <p className="muted">Objections close {market.contestEndsAt && formatMoment(market.contestEndsAt, zone)}. If the owner changes the ruling, a fresh 24-hour window starts.</p>}
          {market.contestOpen && (trader ? <ObjectionForm marketId={id} version={market.rulingVersion} />
            : identity ? <Link className="btn btn-quiet" href="/account">Complete your profile to object</Link>
            : <Link className="btn btn-quiet" href="/sign-in" data-needs-account>Log in to object</Link>)}
        </section>}
        {market.status === "cancelled" && <section className="goal-notice"><h2>Void. Held costs refunded.</h2><p className="goal-text">Every participant received the cost of the shares they still held. This is a refund, not a Yes or No payout.</p></section>}
        {!!objections.length && <section className="goal-notice"><h2>Private objections you can view</h2><p className="muted">Visible only to each author and the owner.</p>{objections.map((objection) => <article key={objection.id} className="goal-objection"><p className="muted">Ruling version {objection.rulingVersion} · {formatMoment(objection.createdAt, zone)}</p><p className="goal-text">{objection.reason}</p></article>)}</section>}

        <section className="goal-section rise" aria-labelledby="rules-title">
          <h2 id="rules-title">Rules</h2>
          {market.yesCondition && market.noCondition && (
            <div className="outcomes">
              <div className="outcome outcome-yes"><h3>Resolves Yes if</h3><p>{market.yesCondition}</p></div>
              <div className="outcome outcome-no"><h3>Resolves No if</h3><p>{market.noCondition}</p></div>
            </div>
          )}
          <p className="goal-rules">{market.resolutionCriteria}</p>
          <dl className="goal-facts">
            {window && <div><dt>Event window</dt><dd>{window}</dd></div>}
            <div><dt>Trading cutoff</dt><dd>{formatMoment(market.deadlineAt, zone)}</dd></div>
            <div><dt>Results due</dt><dd>{formatMoment(market.evidenceDeadlineAt, zone)}</dd></div>
            {opened && <div><dt>Opened</dt><dd>{opened}, set by the owner</dd></div>}
            <div><dt>If no result arrives</dt><dd>Resolves No</dd></div>
            <div><dt>If voided</dt><dd>Shares refunded at what you paid</dd></div>
          </dl>
          <p className="muted goal-small">Trading ends at the cutoff, or earlier if the owner closes it. The owner settles the market from the source below once the window ends. Each ruling has a 24-hour window for objections before payout.</p>
        </section>

        {market.sourceName && (
          <section className="goal-section rise" aria-labelledby="source-title">
            <div className="goal-section-head">
              <h2 id="source-title">Verification source</h2>
              <span className={`source-state${market.sourceOperational ? " source-live" : ""}`}>{market.sourceOperational ? "Connected" : "Placeholder · not connected"}</span>
            </div>
            <p className="source-name">{market.sourceName}</p>
            {market.sourceMethod && <p className="goal-rules">{market.sourceMethod}</p>}
            {market.sourceUrl && <a className="source-link" href={market.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{market.sourceUrl}</a>}
          </section>
        )}
      </div>

      <TradeDock
        marketId={market.id}
        title={cardTitle(market)}
        name={market.venueName ?? "Mitra"}
        photo={null}
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
