import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { LifecycleError, listLifecycleMarkets, readObjections } from "@/modules/market/lifecycle";
import { formatMoment } from "@/modules/events/time";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { OwnerControls } from "./owner-controls";
import { readViewerOrNull } from "@/modules/account/viewer";

export const metadata = { title: "Manage outcomes", robots: { index: false } };
const FALLBACK_ZONE = "America/New_York";

/**
 * Every live market for the owner (2026-10-08): close trading early, rule from
 * the market's named source once its window ends, or rule No when the source
 * never reported by the results deadline, then the 24-hour objection window.
 */
export default async function ManageMarketsPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const viewer = await readViewerOrNull(getDb(), identity?.id);
  let rows;
  try { rows = await listLifecycleMarkets(getDb(), identity.id); }
  catch (error) {
    if (error instanceof LifecycleError && ["NOT_OWNER", "PROFILE_REQUIRED"].includes(error.code)) notFound();
    throw new Error("Outcome review is temporarily unavailable.");
  }
  const items = await Promise.all(rows.map(async (row) => ({
    ...row,
    objections: await readObjections(getDb(), identity.id, row.market.id),
  })));
  return <div className="market-shell"><MarketHeader viewer={viewer} /><main className="account-main review-main">
    <div className="account-topline"><span className="eyebrow">OWNER OUTCOMES</span><Link className="text-button" href="/review">Review suggestions</Link></div>
    <section className="account-welcome"><h1>Settle every market.</h1><p>Close trading, read each market’s source once its window ends, and explain the outcome. With no result by the results deadline, the market is ruled No. Rulings stay open to objections for 24 hours before payout becomes final.</p></section>
    {!items.length && <section className="account-card"><h2>No live markets to manage.</h2><Link href="/review">Publish one</Link></section>}
    {items.map(({ market, venueName, sourceName, sourceUrl, objections }) => {
      const zone = market.timeZone ?? FALLBACK_ZONE;
      return <article className="review-card" key={market.id}>
        <div className="review-meta">
          <span className={`status-pill status-${market.status}`}>{market.status}</span>
          <span>{venueName ?? "Earlier goal market"}</span>
          {market.isSample && <span className="sample-tag">Sample</span>}
        </div>
        <h2><Link href={`/markets/${market.id}`}>{market.question} ↗︎</Link></h2>
        {market.yesCondition && <p className="market-criteria"><strong>Yes if:</strong> {market.yesCondition}</p>}
        {market.noCondition && <p className="market-criteria"><strong>No if:</strong> {market.noCondition}</p>}
        <dl className="goal-dates">
          <div><dt>Trading cutoff</dt><dd>{formatMoment(market.deadlineAt, zone)}</dd></div>
          {market.windowEndAt && <div><dt>Window ends</dt><dd>{formatMoment(market.windowEndAt, zone)}</dd></div>}
          <div><dt>Results due</dt><dd>{formatMoment(market.evidenceDeadlineAt, zone)}</dd></div>
        </dl>
        {sourceName && <p className="field-hint">Source: {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{sourceName}</a> : sourceName}</p>}
        {market.ruledOutcome && <section className="ruling-box"><h3>Current ruling: {market.ruledOutcome.toUpperCase()} · version {market.rulingVersion}</h3><p className="market-criteria">{market.rulingReason}</p><p className="field-hint">Objections until {market.contestEndsAt && formatMoment(market.contestEndsAt, zone)}</p></section>}
        {!!objections.length && <section className="private-objections"><h3>Private objections ({objections.length})</h3>{objections.map((objection) => <article key={objection.id}><p className="field-hint">Ruling version {objection.rulingVersion} · {formatMoment(objection.createdAt, zone)}</p><p className="market-criteria">{objection.reason}</p></article>)}</section>}
        <OwnerControls marketId={market.id} version={market.rulingVersion} canClose={market.status === "open"}
          canRule={market.rulingAvailable} canRuleMissing={market.missingDataAvailable} isRevision={market.status === "ruled"}
          resultsDue={formatMoment(market.evidenceDeadlineAt, zone)} />
      </article>;
    })}
  </main><MarketFooter /></div>;
}
