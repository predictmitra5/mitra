import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readPublicMarket, readTrader } from "@/modules/market/service";
import { readCards, readPriceSeries, readTicker, readVolumeBuckets, recordClick } from "@/modules/discovery/feed";
import { advanceMarket, readObjections } from "@/modules/market/lifecycle";
import { valueHolding } from "@/modules/account/positions";
import { readViewerOrNull } from "@/modules/account/viewer";
import { cardTitle, closesInWords, pointsText } from "@/modules/discovery/present";
import { statusLine } from "@/modules/events/status";
import { formatMoment } from "@/modules/events/time";
import { industryLabel, milestoneLabel, monthYear, verificationLabel, VERIFICATION, type VerificationKey } from "@/modules/startups/labels";
import { readMarketStartup } from "@/modules/startups/read";
import { followState, listComments } from "@/modules/social/service";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { Gain, SampleTag, type CardData } from "@/app/components/market/market-card";
import { toCardData } from "@/app/components/market/card-data";
import { Ticker } from "@/app/components/market/ticker";
import { FounderFace, StartupMark, StartupThumb } from "@/app/components/startup/thumb";
import { VideoPlayer } from "@/app/components/startup/video-player";
import { CommentThread } from "@/app/components/social/comments";
import { FollowButton } from "@/app/components/social/follow-button";
import { SignupPrompt } from "@/app/components/signup-prompt";
import { LiveChart, LivePrice, LiveStats } from "./live-market";
import { TradeDock } from "./trade-dock";
import type { TradeAccess } from "./trade-panel";
import { ObjectionForm } from "./objection-form";

/*
 * A market's page (2026-10-19, startup markets), in the brief's order: the
 * founder-and-startup video; the question with the Yes probability and the
 * latest prices; the large price chart with 1D to ALL, tooltips and volume
 * bars; what the startup is (description, facts, founders, product,
 * milestones, links, verification); the market's statistics; trading (beside
 * the page on a desktop, a sheet on a phone); exactly how it resolves; and the
 * discussion with the founder's updates.
 *
 * Anyone can read it; trading and comments need an account. Market pages stay
 * out of search engines until the owner decides otherwise. Older event markets
 * still open here, with their venue terms.
 */

export const dynamic = "force-dynamic";
const loadMarket = cache(async (id: string) => {
  const database = getDb();
  await advanceMarket(database, id);
  return readPublicMarket(database, id);
});

export async function generateMetadata({ params }: PageProps<"/markets/[id]">): Promise<Metadata> {
  try {
    const market = await loadMarket((await params).id);
    return { title: market ? cardTitle(market) : "Market unavailable", robots: { index: false, follow: false } };
  } catch { return { title: "Market unavailable", robots: { index: false } }; }
}

const ZONE = "America/New_York";
const longDate = (value: Date, zone: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: zone }).format(value);

type Held = { yesSharesMicro: number; noSharesMicro: number; yesCostBasisMicro: number; noCostBasisMicro: number };

/** "Your position": each side's contracts, average entry, value at today's price and the change since bought. */
function Position({ held, yesPrice, className }: { held: Held; yesPrice: number; className: string }) {
  const value = valueHolding({ ...held, yesPrice });
  if (!value || value.sides.length === 0) return null;
  return (
    <section className={`goal-position ${className}`} aria-label="Your position">
      <h2>Your position</h2>
      <ul>
        {value.sides.map((side) => (
          <li key={side.side}>
            <span className="muted">{pointsText(side.sharesMicro)} {side.side === "yes" ? "Yes" : "No"} at {(side.costMicro / side.sharesMicro * 100).toFixed(1)}¢</span>
            <span>{pointsText(side.valueMicro)} Trade Coins <Gain micro={side.gainMicro} /></span>
          </li>
        ))}
      </ul>
      <Link className="goal-position-link" href="/portfolio">Portfolio</Link>
    </section>
  );
}

function Unavailable() {
  return <div className="market-shell"><MarketHeader viewer={null} /><main className="account-main"><section className="account-card"><h1>This market is temporarily unavailable.</h1><p>Please try again shortly.</p><Link href="/markets" prefetch={false}>Back to all markets</Link></section></main><MarketFooter /></div>;
}

function VerificationBadge({ level }: { level: string }) {
  const key = (level in VERIFICATION ? level : "unverified") as VerificationKey;
  return <span className={`verify verify-${key}`} title={VERIFICATION[key].note}>{key === "independently_verified" && <BadgeCheck size={13} aria-hidden="true" />}{verificationLabel(key)}</span>;
}

export default async function MarketPage({ params, searchParams }: PageProps<"/markets/[id]">) {
  const { id } = await params;
  const now = new Date();
  let market;
  try { market = await loadMarket(id); }
  catch { return <Unavailable />; }
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

  // Signed-out reads remain available but cannot write click telemetry. This
  // is outside the cached loader so metadata generation never double-counts.
  if (identity) await recordClick(getDb(), id);
  // Price history, volume and the ticker: public, and additive, so a failure
  // leaves the chart empty and the prices above it still correct.
  let series: { at: string; yesBp: number }[] = [];
  let volumes: { at: string; micro: number; hourly: boolean }[] = [];
  let card: CardData | null = null;
  let ticker: CardData[] = [];
  let info: Awaited<ReturnType<typeof readMarketStartup>> = null;
  let comments: Awaited<ReturnType<typeof listComments>> = [];
  let followsStartup = false;
  try {
    const database = getDb();
    const points = await readPriceSeries(database, id, { at: now, yesBp: Math.round(market.yesPrice * 10_000) });
    series = points.map((point) => ({ at: new Date(point.at).toISOString(), yesBp: point.yesBp }));
    volumes = (await readVolumeBuckets(database, id, now)).map((b) => ({ ...b, at: b.at.toISOString() }));
    const [found] = await readCards(database, [id], now);
    card = found ? toCardData(found) : null;
    ticker = (await readTicker(database, now)).map(toCardData);
    info = await readMarketStartup(database, market.startupId);
    comments = await listComments(database, "market", id, 60);
    if (market.startupId) followsStartup = (await followState(database, identity?.id, { startupIds: [market.startupId] })).startups.has(market.startupId);
  } catch {
    // Leave these empty.
  }

  const viewer = await readViewerOrNull(getDb(), identity?.id);
  const open = market.tradingOpen;
  const zone = market.timeZone ?? ZONE;
  const status = market.pausedAt && market.status === "open" ? "Trading paused"
    : statusLine({ status: market.status, tradingOpen: open, ruledOutcome: market.ruledOutcome, contestOpen: market.contestOpen });
  const access: TradeAccess = market.pausedAt && market.status === "open" ? { kind: "paused", reason: market.pausedReason }
    : !open ? { kind: "closed" }
    : accountUnavailable ? { kind: "unavailable" }
    : !identity ? { kind: "signed-out" }
    : !trader ? { kind: "no-profile" }
    : trader.blocked ? { kind: "blocked", message: trader.blocked }
    : { kind: "open" };
  const requestedSide = (await searchParams).side;
  const held = trader?.position ?? null;
  const startup = info?.startup ?? null;
  const founder = info?.team[0] ?? null;
  const video = info?.video ?? null;
  const thumb = startup ? (
    <StartupThumb priority startup={startup} founder={founder ? { name: founder.name, portraitUrl: founder.portraitUrl, hue: founder.hue, role: founder.role } : null}
      imageUrl={video?.thumbnailUrl} durationSeconds={video?.durationSeconds} />
  ) : null;
  const statsCreated = longDate(market.approvedAt ?? market.createdAt, zone);
  const openedAt = market.approvedAt ? `${longDate(market.approvedAt, zone)} at ${Math.round((market.openingProbabilityBp ?? 5000) / 100)}%` : null;

  return <div className="market-shell goal-shell">
    <MarketHeader viewer={viewer} active="markets" />
    <Ticker cards={ticker} />
    <main className="goal market-page">
      <div className="goal-main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/markets" prefetch={false}>Markets</Link>
          {startup && <><span aria-hidden="true">/</span><Link prefetch={false} href={`/markets?industry=${startup.industry}`}>{industryLabel(startup.industry)}</Link></>}
          {startup && <><span aria-hidden="true">/</span><Link prefetch={false} href={`/startups/${startup.slug}`}>{startup.name}</Link></>}
        </nav>
        <Link className="goal-back" href="/markets" prefetch={false}>← Markets</Link>

        {/* 1. The founder and the startup together, with the founder's video. */}
        {thumb && startup && (
          <section className="market-hero rise" aria-label={`${startup.name} founder video`}>
            {video ? <VideoPlayer video={{ ...video }} poster={thumb} /> : thumb}
          </section>
        )}

        {/* 2. The question and its probability. */}
        <div className="goal-intro rise">
          {startup ? (
            <div className="market-identity">
              <StartupMark startup={startup} size={40} />
              <div>
                <span className="market-kicker">{industryLabel(startup.industry)} · {milestoneLabel(market.milestoneKind)}{market.isSample && <> <SampleTag /></>}</span>
                <span><Link className="market-startup" href={`/startups/${startup.slug}`} prefetch={false}>{startup.name}</Link>
                  {founder && <span className="muted"> · <Link href={`/founders/${founder.handle}`} prefetch={false}>{founder.name}</Link></span>}
                  <span className="muted"> · {closesInWords(market.deadlineAt, now)}</span></span>
              </div>
            </div>
          ) : (
            <p className="muted goal-archived">{market.venueName ? `${market.venueName} · an earlier campus event market` : "An earlier Mitra market."}</p>
          )}
          <h1>{market.question}</h1>
          {market.isSample && startup && (
            <p className="sample-note">
              <strong>Demo market.</strong> {startup.name}, its founders and every number on this page are fictional, made to demonstrate Mitra.
              The price history comes from simulated trades by fictional demo traders. Trades use Trade Coins, which have no cash value.
            </p>
          )}
          <LivePrice id={market.id} yesPrice={market.yesPrice} status={status} />
        </div>

        {/* 3. The price over time. */}
        <section className="goal-chart rise" aria-label="Price history">
          <LiveChart id={market.id} points={series} volumes={volumes} initialRange="3M" />
        </section>

        {held && <Position held={held} yesPrice={market.yesPrice} className="goal-position-phone" />}

        {market.ruledOutcome && market.status !== "cancelled" && <section className="goal-notice">
          <h2>{market.status === "settled" ? "Final outcome" : "The owner’s ruling"}: {market.ruledOutcome === "yes" ? "Yes" : "No"}</h2>
          <p className="goal-text">{market.rulingReason}</p>
          {market.status === "settled" ? <p className="muted">Winning contracts paid 1 Trade Coin each; losing contracts paid 0. Balances are updated. This result is final.</p>
            : <p className="muted">Objections close {market.contestEndsAt && formatMoment(market.contestEndsAt, zone)}. If the owner changes the ruling, a fresh 24-hour window starts.</p>}
          {market.contestOpen && (trader ? <ObjectionForm marketId={id} version={market.rulingVersion} />
            : identity ? <Link className="btn btn-quiet" href="/welcome">Complete your profile to object</Link>
            : <Link className="btn btn-quiet" href="/sign-in" data-needs-account>Log in to object</Link>)}
        </section>}
        {market.status === "cancelled" && <section className="goal-notice"><h2>Void. Held costs refunded.</h2><p className="goal-text">Every participant received the cost of the contracts they still held. This is a refund, not a Yes or No payout.</p></section>}
        {!!objections.length && <section className="goal-notice"><h2>Private objections you can view</h2><p className="muted">Visible only to each author and the owner.</p>{objections.map((objection) => <article key={objection.id} className="goal-objection"><p className="muted">Ruling version {objection.rulingVersion} · {formatMoment(objection.createdAt, zone)}</p><p className="goal-text">{objection.reason}</p></article>)}</section>}

        {/* 4. What the startup is. */}
        {info && startup && (
          <section className="goal-section rise" aria-labelledby="about-title">
            <div className="goal-section-head">
              <h2 id="about-title">About {startup.name}</h2>
              <FollowButton kind="startup" id={startup.id} initial={followsStartup} signedIn={!!identity} />
            </div>
            <p className="about-text">{startup.description}</p>
            <dl className="goal-facts about-facts">
              <div><dt>Industry</dt><dd>{industryLabel(startup.industry)}</dd></div>
              <div><dt>Founded</dt><dd>{monthYear(startup.foundedOn)}</dd></div>
              <div><dt>Stage</dt><dd>{startup.stage}</dd></div>
              {startup.headquarters && <div><dt>Based in</dt><dd>{startup.headquarters}</dd></div>}
              <div><dt>Verification</dt><dd><VerificationBadge level={startup.verification} /></dd></div>
            </dl>
            <h3 className="about-sub">The product</h3>
            <p className="about-text">{startup.productDetails}</p>
            {info.team.length > 0 && <>
              <h3 className="about-sub">{info.team.length === 1 ? "Founder" : "Founders"}</h3>
              <ul className="about-team">
                {info.team.map((person) => (
                  <li key={person.id}>
                    <Link href={`/founders/${person.handle}`} prefetch={false} className="about-person">
                      <FounderFace founder={person} size={44} />
                      <span><strong>{person.name}</strong><span className="muted">{person.role ?? "Founder"}</span></span>
                    </Link>
                    <p>{person.bio} {person.background}</p>
                  </li>
                ))}
              </ul>
            </>}
            {info.updates.length > 0 && <>
              <h3 className="about-sub">Recent milestones</h3>
              <ul className="timeline timeline-compact">
                {info.updates.map((update) => (
                  <li key={update.id}><time>{monthYear(update.happenedAt)}</time><div><strong>{update.title}</strong><p>{update.body}</p><VerificationBadge level={update.verification} /></div></li>
                ))}
              </ul>
            </>}
            {info.claims.length > 0 && <>
              <h3 className="about-sub">Claims and verification</h3>
              <ul className="claims">
                {info.claims.map((claim) => (
                  <li key={claim.id}><VerificationBadge level={claim.level} /><span>{claim.statement}{claim.sourceName && <span className="muted"> Source: {claim.sourceName}.</span>}</span></li>
                ))}
              </ul>
            </>}
            <p className="about-links">
              <Link href={`/startups/${startup.slug}`} prefetch={false}>{startup.name} profile and every market</Link>
              {founder && <Link href={`/founders/${founder.handle}`} prefetch={false}>{founder.name}&rsquo;s profile</Link>}
              {startup.websiteUrl && <a href={startup.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">Website <ExternalLink size={13} aria-hidden="true" /></a>}
            </p>
          </section>
        )}

        {/* 5. The market's numbers. */}
        <section className="goal-section rise" aria-labelledby="stats-title">
          <h2 id="stats-title">Market statistics</h2>
          <LiveStats id={market.id} yesPrice={market.yesPrice} volumeMicro={card?.volumeMicro ?? 0} traders={card?.traders ?? 0}
            closes={formatMoment(market.deadlineAt, zone)} created={statsCreated} status={status} />
        </section>

        {/* 7. Exactly how it resolves. (6, trading, is beside the page or in the phone's sheet.) */}
        <section className="goal-section rise" aria-labelledby="rules-title">
          <h2 id="rules-title">Resolution criteria</h2>
          {market.yesCondition && market.noCondition && (
            <div className="outcomes">
              <div className="outcome outcome-yes"><h3>Resolves Yes if</h3><p>{market.yesCondition}</p></div>
              <div className="outcome outcome-no"><h3>Resolves No if</h3><p>{market.noCondition}</p></div>
            </div>
          )}
          <p className="goal-rules">{market.resolutionCriteria}</p>
          <dl className="goal-facts">
            <div><dt>Trading closes</dt><dd>{formatMoment(market.deadlineAt, zone)}</dd></div>
            <div><dt>Results due</dt><dd>{formatMoment(market.evidenceDeadlineAt, zone)}</dd></div>
            {market.sourceName && <div><dt>Verification source</dt><dd>{market.sourceName}{market.sourceUrl && <> · <a className="source-link" href={market.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">link</a></>}</dd></div>}
            {openedAt && <div><dt>Opened</dt><dd>{openedAt}, set by the owner</dd></div>}
            <div><dt>If no result arrives</dt><dd>Void and held costs refunded</dd></div>
            <div><dt>If voided</dt><dd>Contracts refunded at what you paid</dd></div>
          </dl>
          <p className="muted goal-small">Only the Mitra owner settles markets, from the source above. Founders cannot trade, settle or change their own markets. Each ruling has a 24-hour window for objections before payout.</p>
        </section>

        {/* 8. Discussion, with the founder's latest update. */}
        <section className="goal-section rise" aria-labelledby="talk-title">
          <h2 id="talk-title">Discussion</h2>
          {info?.updates[0] && startup && (
            <article className="founder-update">
              <span className="founder-tag">Founder update</span>
              <strong>{info.updates[0].title}</strong>
              <p>{info.updates[0].body}</p>
              <span className="muted">{startup.name} · {monthYear(info.updates[0].happenedAt)}</span>
            </article>
          )}
          <CommentThread target="market" targetId={market.id} signedIn={!!identity && !!trader}
            initial={comments.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), author: c.author }))} />
        </section>
      </div>

      <TradeDock
        marketId={market.id}
        title={cardTitle(market)}
        name={startup?.name ?? market.venueName ?? "Mitra"}
        photo={null}
        mark={startup ? <StartupMark startup={startup} size={32} /> : undefined}
        yesPrice={market.yesPrice}
        liquidity={market.liquidity}
        access={access}
        balanceMicro={trader?.balanceMicro ?? null}
        allowanceMicro={trader?.allowanceMicro ?? null}
        heldYesMicro={held?.yesSharesMicro ?? 0}
        heldNoMicro={held?.noSharesMicro ?? 0}
        heldYesCostMicro={held?.yesCostBasisMicro ?? 0}
        heldNoCostMicro={held?.noCostBasisMicro ?? 0}
        initialSide={requestedSide === "no" ? "NO" : "YES"}
        openInitially={open && (requestedSide === "yes" || requestedSide === "no")}
        tradingOpen={open}
        position={held ? <Position held={held} yesPrice={market.yesPrice} className="goal-position-desktop" /> : null}
      />
    </main>
    <MarketFooter />
    {!identity && <SignupPrompt />}
  </div>;
}
