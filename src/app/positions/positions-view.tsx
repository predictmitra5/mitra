import Link from "next/link";
import type { HeldGoal, PositionsPage } from "@/modules/account/positions";
import { formatMicro } from "@/modules/market/input";
import { percent } from "@/modules/discovery/present";
import { Avatar, ProbabilityBar, Thumbnail } from "@/app/components/market/goal-card";
import { photoUrl } from "@/modules/account/photo-url";

const date = (value: Date) => new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York",
}).format(value);

function status(goal: HeldGoal) {
  if (goal.tradingOpen) return "Trading open";
  if (goal.status === "ruled") return goal.contestOpen ? "Ruling · objections open" : "Payout pending";
  return "Trading closed";
}

/** Which date matters next for this holding, and what to call it. */
function nextDate(goal: HeldGoal): { label: string; at: Date } {
  if (goal.status === "ruled" && goal.contestEndsAt) {
    return { label: goal.contestOpen ? "Objections close" : "Objections closed", at: goal.contestEndsAt };
  }
  return goal.tradingOpen ? { label: "Goal deadline", at: goal.deadlineAt } : { label: "Proof deadline", at: goal.evidenceDeadlineAt };
}

/**
 * The signed-in person's own holdings. Each card leads with the same thumbnail
 * and chance bar as the feed, so a goal looks the same wherever it appears.
 * The chance is the market's public price; held cost stays distinct from what
 * the shares would sell for.
 */
export function PositionsView({ data, now }: { data: PositionsPage; now: Date }) {
  return <>
    <section className="positions-heading">
      <span className="eyebrow">YOUR SHARES, IN ONE PLACE</span>
      <h1>Your predictions.</h1>
      <p>Follow the goals you’ve backed. Open a market to read the latest ruling or manage your shares.</p>
      <div className="positions-count"><strong>{data.total}</strong><span>{data.total === 1 ? "goal with shares held" : "goals with shares held"}</span></div>
    </section>
    <div className="positions-explainer"><p>Held cost is what you paid for the shares you still own. It isn’t their current sale value.</p><p>Sold, paid-out and refunded positions leave this list. Held costs are in play points.</p></div>
    {data.total === 0 ? <section className="account-note positions-empty"><span className="empty-mark" aria-hidden="true">↗︎</span><h2>Your next prediction starts here.</h2><p>You aren’t holding any shares yet. Browse the goals and make a prediction to see it here.</p><Link className="secondary-button" href="/">Browse goals</Link></section>
      : <>
        <div className="positions-list-heading"><h2>Current holdings</h2><span>Soonest goal deadline first</span></div>
        <ul className="position-list">{data.goals.map((goal) => {
          const href = `/markets/${goal.marketId}`;
          const next = nextDate(goal);
          const photo = photoUrl(goal.handle, goal.photoUpdatedAt);
          return <li key={goal.marketId} className="position-card">
            <div className="position-top">
              {/* The title below is the link; this copy is for pointers only. */}
              <Link className="gcard-thumb" href={href} prefetch={false} tabIndex={-1} aria-hidden="true">
                <Thumbnail goalType={goal.goalType} question={goal.question} displayName={goal.displayName}
                  deadlineAt={goal.deadlineAt.toISOString()} tradingOpen={goal.tradingOpen} now={now} photo={photo} seed={goal.marketId} />
              </Link>
              <div className="position-head">
                <span className={`status-pill ${goal.tradingOpen ? "status-open" : ""}`}>{status(goal)}</span>
                <span className="position-person"><Avatar name={goal.displayName} photo={photo} size={22} />{goal.displayName} <span>@{goal.handle}</span></span>
                <h3><Link href={href} prefetch={false}>{goal.question}</Link></h3>
                {goal.yesPrice !== null && <div className="position-chance">
                  <span><strong>{percent(goal.yesPrice)}%</strong> {goal.tradingOpen ? "chance of YES" : "chance of YES when trading closed"}</span>
                  <ProbabilityBar yesPrice={goal.yesPrice} />
                </div>}
              </div>
            </div>
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
            <div className="position-footer"><p><span>{next.label}</span>{date(next.at)} ET</p><Link className="secondary-button" href={href} prefetch={false}>Open market <span aria-hidden="true">↗︎</span></Link></div>
          </li>;
        })}</ul>
        {data.pages > 1 && <nav className="positions-pagination" aria-label="Predictions pages">
          {data.page > 1 ? <Link className="secondary-button" href={`/positions?page=${data.page - 1}`} prefetch={false}>Previous</Link> : <span />}
          <span>Page {data.page} of {data.pages}</span>
          {data.page < data.pages ? <Link className="secondary-button" href={`/positions?page=${data.page + 1}`} prefetch={false}>Next</Link> : <span />}
        </nav>}
      </>}
  </>;
}
