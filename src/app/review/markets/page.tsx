import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { LifecycleError, listLifecycleMarkets, readObjections } from "@/modules/market/lifecycle";
import { AppHeader } from "@/app/components/auth-screen";
import { OwnerControls } from "./owner-controls";

export const metadata = { title: "Manage outcomes", robots: { index: false } };
const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

export default async function ManageMarketsPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  let rows;
  try { rows = await listLifecycleMarkets(getDb(), identity.id); }
  catch (error) {
    if (error instanceof LifecycleError && ["NOT_OWNER", "PROFILE_REQUIRED"].includes(error.code)) notFound();
    throw new Error("Outcome review is temporarily unavailable.");
  }
  const items = await Promise.all(rows.map(async (row) => ({ ...row, objections: await readObjections(getDb(), identity.id, row.market.id) })));
  return <div className="site-shell"><AppHeader /><main className="account-main review-main">
    <div className="account-topline"><span className="eyebrow">OWNER OUTCOMES</span><Link className="text-button" href="/review">Review new goals</Link></div>
    <section className="account-welcome"><h1>Follow every goal through.</h1><p>Close trading, review proof, and explain each outcome. Rulings stay open to objections for 24 hours before payout becomes final.</p></section>
    {!items.length && <section className="account-card"><h2>No active goals to manage.</h2><Link href="/account">Your account</Link></section>}
    {items.map(({ market, displayName, handle, objections }) => <article className="review-card" key={market.id}>
      <div className="review-meta"><span className={`status-pill status-${market.status}`}>{market.status}</span><span>{displayName} · @{handle}</span></div>
      <h2><Link href={`/markets/${market.id}`}>{market.question} ↗</Link></h2><p className="market-criteria">{market.resolutionCriteria}</p>
      <dl className="goal-dates"><div><dt>Trading deadline</dt><dd>{when.format(market.deadlineAt)} ET</dd></div><div><dt>Proof deadline</dt><dd>{when.format(market.evidenceDeadlineAt)} ET</dd></div></dl>
      {market.ruledOutcome && <section className="ruling-box"><h3>Current ruling: {market.ruledOutcome.toUpperCase()} · version {market.rulingVersion}</h3><p className="market-criteria">{market.rulingReason}</p><p className="field-hint">Objections until {market.contestEndsAt && when.format(market.contestEndsAt)} ET</p></section>}
      {!!objections.length && <section className="private-objections"><h3>Private objections ({objections.length})</h3>{objections.map((objection) => <article key={objection.id}><p className="field-hint">Ruling version {objection.rulingVersion} · {when.format(objection.createdAt)} ET</p><p className="market-criteria">{objection.reason}</p></article>)}</section>}
      <OwnerControls marketId={market.id} version={market.rulingVersion} canClose={market.status === "open"}
        canRule={market.rulingAvailable} isRevision={market.status === "ruled"} />
    </article>)}
  </main><footer className="app-footer"><span>Play money. Real goals.</span><span>Owner tools</span></footer></div>;
}
