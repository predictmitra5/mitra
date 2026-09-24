import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { GoalError, listPendingDrafts } from "@/modules/goals/service";
import { DEADLINE_TIME_ZONE } from "@/modules/goals/templates";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { ReviewForms } from "./review-forms";

export const metadata = { title: "Review goals" };

const when = new Intl.DateTimeFormat("en-US", { timeZone: DEADLINE_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");

  let drafts;
  try {
    drafts = await listPendingDrafts(getDb(), identity.id);
  } catch (error) {
    // Hide the page entirely from anyone who isn't the owner.
    if (error instanceof GoalError && error.code === "NOT_OWNER") notFound();
    throw error;
  }

  const { notice } = await searchParams;
  const message = notice === "approved" ? "Goal opened for trading." : notice === "rejected" ? "Goal rejected. They can see your reason." : undefined;

  return <div className="market-shell"><MarketHeader signedIn /><main className="account-main review-main">
    <div className="account-topline"><span className="eyebrow">OWNER REVIEW</span><Link className="text-button" href="/account">Back to account</Link></div>
    <Link className="secondary-button" href="/review/markets">Manage outcomes and objections ↗︎</Link>
    <section className="account-welcome"><h1>{drafts.length === 0 ? "Nothing to review." : `${drafts.length} goal${drafts.length === 1 ? "" : "s"} waiting.`}</h1><p>Approve only goals that can’t be won or lost just by deciding to. Set the opening odds to your honest guess.</p></section>
    {message && <p className="form-success" role="status">{message}</p>}
    {drafts.map(({ market, subject }) => <article key={market.id} className="review-card">
      <div className="review-meta"><span className="status-pill status-draft">{market.goalType?.replace("_", " ") ?? "goal"}</span><span>{subject.displayName} · @{subject.handle}</span></div>
      <h2>{market.question}</h2>
      <p className="review-criteria">{market.resolutionCriteria}</p>
      <dl className="goal-dates"><div><dt>Trading closes</dt><dd>{when.format(market.deadlineAt)} ET</dd></div><div><dt>Proof due</dt><dd>{when.format(market.evidenceDeadlineAt)} ET</dd></div></dl>
      <ReviewForms marketId={market.id} />
    </article>)}
  </main><MarketFooter /></div>;
}
