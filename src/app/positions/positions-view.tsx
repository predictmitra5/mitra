import Link from "next/link";
import { EmptyState } from "@/app/components/empty-state";
import { valueHolding, type HeldGoal, type PositionsPage } from "@/modules/account/positions";
import { cardTitle, percent, pointsText } from "@/modules/discovery/present";
import { Avatar, Gain } from "@/app/components/market/goal-card";
import { photoUrl } from "@/modules/account/photo-url";

const date = (value: Date) => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
}).format(value);

/** Where a holding stands, when trading is no longer open. */
function standing(goal: HeldGoal): string | null {
  if (goal.tradingOpen) return null;
  if (goal.status === "ruled" && goal.ruledOutcome) {
    const ruled = `Ruled ${goal.ruledOutcome === "yes" ? "Yes" : "No"}`;
    if (!goal.contestEndsAt) return ruled;
    return goal.contestOpen ? `${ruled} · Objections close ${date(goal.contestEndsAt)} ET` : `${ruled} · Objections closed · Payout pending`;
  }
  return `Trading closed · Proof due ${date(goal.evidenceDeadlineAt)} ET`;
}

/**
 * The signed-in person's holdings, as the account page and the positions page
 * both list them (2026-09-24): each goal's photo and question, the side, shares
 * and average price paid, then the value at today's price and the gain or loss
 * since bought. Value is what the shares are worth at the current price, not
 * what selling them would return.
 */
export function PositionRows({ goals }: { goals: HeldGoal[] }) {
  return (
    <ul className="holdings">
      {goals.map((goal) => {
        const value = valueHolding(goal);
        const note = standing(goal);
        return (
          <li key={goal.marketId}>
            <Link className="holding" href={`/markets/${goal.marketId}`} prefetch={false}>
              <Avatar name={goal.displayName} photo={photoUrl(goal.handle, goal.photoUpdatedAt)} size={40} shape="square" />
              <span className="holding-text">
                <span className="holding-title">{cardTitle(goal.goalType, goal.question)}</span>
                {(value?.sides ?? sidesWithoutPrice(goal)).map((side) => (
                  <span key={side.side} className="holding-sub">
                    <span className={`side-${side.side}`}>{side.side === "yes" ? "Yes" : "No"}</span>
                    {" · "}{pointsText(side.sharesMicro)} shares · paid {Math.round((side.costMicro / side.sharesMicro) * 100)}¢
                  </span>
                ))}
                {note && <span className="holding-note">{note}</span>}
                {goal.yesPrice !== null && (
                  <span className="sr-only">{percent(goal.yesPrice)}% chance of Yes{goal.tradingOpen ? "" : " when trading closed"}.</span>
                )}
              </span>
              {value && (
                <span className="holding-value">
                  <strong>{pointsText(value.valueMicro)} pts</strong>
                  <Gain micro={value.gainMicro} />
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function sidesWithoutPrice(goal: HeldGoal) {
  return (["yes", "no"] as const)
    .map((side) => ({
      side,
      sharesMicro: side === "yes" ? goal.yesSharesMicro : goal.noSharesMicro,
      costMicro: side === "yes" ? goal.yesCostBasisMicro : goal.noCostBasisMicro,
    }))
    .filter((side) => side.sharesMicro > 0);
}

/** The positions page: every holding, 20 to a page, with the totals across all of them. */
export function PositionsView({ data }: { data: PositionsPage }) {
  return (
    <>
      <div className="account-head">
        <h1>Positions</h1>
        {data.total > 0 && (
          <p className="positions-total">
            <span className="muted">In positions</span>{" "}
            <strong>{pointsText(data.totals.valueMicro)} pts</strong> <Gain micro={data.totals.gainMicro} />
          </p>
        )}
      </div>
      {data.total === 0 ? (
        <EmptyState title="No positions yet" action={<Link className="btn btn-primary" href="/" prefetch={false}>Browse goals</Link>}>
          When you buy Yes or No on a goal, it shows up here with what it is worth today.
        </EmptyState>
      ) : (
        <section aria-labelledby="holdings-title">
          <div className="account-section-head">
            <h2 id="holdings-title">{data.total === 1 ? "1 goal" : `${data.total} goals`}</h2>
            <span className="muted">Value · since you bought</span>
          </div>
          <PositionRows goals={data.goals} />
          <p className="muted account-small">Value is the shares at today&rsquo;s price, not what selling them would return. Soonest deadline first. Sold, paid-out and refunded positions leave this list.</p>
          {data.pages > 1 && (
            <nav className="pager" aria-label="Positions pages">
              {data.page > 1 ? <Link className="btn btn-secondary" href={`/positions?page=${data.page - 1}`} prefetch={false}>Previous</Link> : <span />}
              <span>Page {data.page} of {data.pages}</span>
              {data.page < data.pages ? <Link className="btn btn-secondary" href={`/positions?page=${data.page + 1}`} prefetch={false}>Next</Link> : <span />}
            </nav>
          )}
        </section>
      )}
    </>
  );
}
