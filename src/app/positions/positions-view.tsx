import Link from "next/link";
import type { HeldGoal, PositionsPage } from "@/modules/account/positions";
import { formatMicro } from "@/modules/market/input";

const date = (value: Date) => new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York",
}).format(value);

function status(goal: HeldGoal) {
  if (goal.tradingOpen) return "Trading open";
  if (goal.status === "ruled") return goal.contestOpen ? "Ruling · objections open" : "Payout pending";
  return "Trading closed";
}

export function PositionsView({ data }: { data: PositionsPage }) {
  return <>
    <section className="positions-heading">
      <span className="eyebrow">YOUR SHARES, IN ONE PLACE</span>
      <h1>Your predictions.</h1>
      <p>Follow the goals you’ve backed. Open a market to read the latest ruling or manage your shares.</p>
      <div className="positions-count"><strong>{data.total}</strong><span>{data.total === 1 ? "goal with shares held" : "goals with shares held"}</span></div>
    </section>
    <div className="positions-explainer"><p>Held cost is what you paid for the shares you still own. It isn’t their current sale value.</p><p>Sold, paid-out and refunded positions leave this list. All amounts are play points.</p></div>
    {data.total === 0 ? <section className="account-note positions-empty"><span className="empty-mark" aria-hidden="true">↗</span><h2>Your next prediction starts here.</h2><p>You aren’t holding any shares yet. Open a shared market link and make a prediction to see it here.</p><Link className="secondary-button" href="/account">Your account</Link></section>
      : <>
        <div className="positions-list-heading"><h2>Current holdings</h2><span>Soonest goal deadline first</span></div>
        <ul className="position-list">{data.goals.map((goal) => <li key={goal.marketId} className="position-card">
          <div className="section-head"><span className={`status-pill ${goal.tradingOpen ? "status-open" : ""}`}>{status(goal)}</span><span className="position-person">{goal.displayName} <span>@{goal.handle}</span></span></div>
          <h3><Link href={`/markets/${goal.marketId}`} prefetch={false}>{goal.question}</Link></h3>
          <div className="position-sides">
            {(["yes", "no"] as const).map((side) => {
              const shares = side === "yes" ? goal.yesSharesMicro : goal.noSharesMicro;
              const cost = side === "yes" ? goal.yesCostBasisMicro : goal.noCostBasisMicro;
              return shares > 0 && <div className={`position-side position-${side}`} key={side}>
                <span className="position-side-label">{side.toUpperCase()}</span>
                <dl><div><dt>Shares held</dt><dd>{formatMicro(shares)}</dd></div><div><dt>Held cost</dt><dd>{formatMicro(cost)} <small>points</small></dd></div></dl>
              </div>;
            })}
          </div>
          {goal.status === "ruled" && goal.ruledOutcome && <p className="position-ruling">Owner’s ruling: <strong>{goal.ruledOutcome.toUpperCase()}</strong>. {goal.contestOpen ? "Read the ruling and submit any objection on the market page." : "The objection window has ended. Payout processing is pending."}</p>}
          <div className="position-footer"><p><span>{goal.status === "ruled" && goal.contestEndsAt ? "Objections close" : goal.tradingOpen ? "Goal deadline" : "Proof deadline"}</span>{date(goal.status === "ruled" && goal.contestEndsAt ? goal.contestEndsAt : goal.tradingOpen ? goal.deadlineAt : goal.evidenceDeadlineAt)} ET</p><Link className="secondary-button" href={`/markets/${goal.marketId}`} prefetch={false}>Open market <span aria-hidden="true">↗</span></Link></div>
        </li>)}</ul>
        {data.pages > 1 && <nav className="positions-pagination" aria-label="Predictions pages">
          {data.page > 1 ? <Link className="secondary-button" href={`/positions?page=${data.page - 1}`} prefetch={false}>Previous</Link> : <span />}
          <span>Page {data.page} of {data.pages}</span>
          {data.page < data.pages ? <Link className="secondary-button" href={`/positions?page=${data.page + 1}`} prefetch={false}>Next</Link> : <span />}
        </nav>}
      </>}
  </>;
}
