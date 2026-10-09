import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { CAMPUSES, isCampusKey } from "@/config/campus";
import { currentIdentity } from "@/modules/auth/server";
import { EventError, listPendingProposals, listSources, listVenues } from "@/modules/events/service";
import { categoryLabel } from "@/modules/events/categories";
import { formatMoment, toLocalInput } from "@/modules/events/time";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { readViewerOrNull } from "@/modules/account/viewer";
import { PublishForm, RejectForm, type PublishDefaults } from "./review-forms";

export const metadata = { title: "Review suggestions", robots: { index: false } };

const HOUR = 3_600_000;

/**
 * The owner's queue (2026-10-08): students' market suggestions, oldest first,
 * each with a publish form prefilled from it and a turn-down form, and a form
 * for publishing a market from scratch. Hidden from everyone else.
 */
export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const database = getDb();
  const viewer = await readViewerOrNull(database, identity.id);

  let proposals;
  try {
    proposals = await listPendingProposals(database, identity.id);
  } catch (error) {
    // Hide the page entirely from anyone who isn't the owner.
    if (error instanceof EventError && error.code === "NOT_OWNER") notFound();
    throw error;
  }
  const venuesByCampus = Object.fromEntries(await Promise.all(Object.keys(CAMPUSES).map(async (key) =>
    [key, isCampusKey(key) ? await listVenues(database, key) : []] as const)));
  const sources = await listSources(database);
  const campuses = Object.values(CAMPUSES).map((campus) => ({ key: campus.key, name: campus.communityName }));
  const home = CAMPUSES[identity.campus];

  const { notice } = await searchParams;
  const message = notice === "rejected" ? "Suggestion turned down. They can see your reason." : undefined;

  const blank: PublishDefaults = {
    proposalId: null, campus: home.key, question: "", category: "nightlife", venueId: "", venueName: "", eventTitle: "",
    windowStart: "", windowEnd: "", cutoff: "", resultsDue: "",
  };
  const venueOptions = (campus: string) => (venuesByCampus[campus] ?? []).map((venue) => ({ id: venue.id, name: venue.name }));

  return <div className="market-shell"><MarketHeader viewer={viewer} /><main className="account-main review-main">
    <div className="account-topline"><span className="eyebrow">OWNER REVIEW</span><Link className="text-button" href="/account">Back to account</Link></div>
    <div className="owner-links"><Link className="secondary-button" href="/review/markets">Outcomes and objections ↗︎</Link><Link className="secondary-button" href="/review/people">People: photos and bans ↗︎</Link></div>
    <section className="account-welcome">
      <h1>{proposals.length === 0 ? "No suggestions waiting." : `${proposals.length} suggestion${proposals.length === 1 ? "" : "s"} waiting.`}</h1>
      <p>Publish only what a named source can settle exactly: a count, a window, a time zone, a cutoff. Set the opening odds to your honest guess. Nothing a student suggests goes live until you publish it.</p>
    </section>
    {message && <p className="form-success" role="status">{message}</p>}

    <details className="review-card publish-new">
      <summary>Publish a new market</summary>
      <PublishForm defaults={blank} venues={venueOptions(home.key)} sources={sources} campuses={campuses} />
    </details>

    {proposals.map(({ proposal, proposer }) => {
      const zone = CAMPUSES[isCampusKey(proposal.campus) ? proposal.campus : home.key].timeZone;
      const start = proposal.windowStartAt;
      const end = proposal.windowEndAt ?? new Date(start.getTime() + 3 * HOUR);
      const defaults: PublishDefaults = {
        proposalId: proposal.id, campus: proposal.campus, question: proposal.question, category: proposal.category,
        venueId: proposal.venueId ?? "", venueName: proposal.venueName, eventTitle: "",
        windowStart: toLocalInput(start, zone), windowEnd: toLocalInput(end, zone),
        cutoff: toLocalInput(start, zone), resultsDue: toLocalInput(new Date(end.getTime() + 72 * HOUR), zone),
      };
      return <article key={proposal.id} className="review-card">
        <div className="review-meta">
          <span className="status-pill status-draft">{categoryLabel(proposal.category)}</span>
          <span>{proposal.venueName}{proposal.venueId ? "" : " (new venue)"} · {CAMPUSES[isCampusKey(proposal.campus) ? proposal.campus : home.key].communityName}</span>
          <span>from {proposer.displayName} · @{proposer.handle}</span>
        </div>
        <h2>{proposal.question}</h2>
        <dl className="goal-dates">
          <div><dt>Starts</dt><dd>{formatMoment(start, zone)}</dd></div>
          {proposal.windowEndAt && <div><dt>Ends</dt><dd>{formatMoment(proposal.windowEndAt, zone)}</dd></div>}
          <div><dt>Suggested</dt><dd>{formatMoment(proposal.createdAt, zone)}</dd></div>
        </dl>
        <p className="review-criteria"><strong>How they’d check it:</strong> {proposal.resolutionNote}</p>
        <div className="review-actions review-actions-stack">
          <details>
            <summary>Publish as a market</summary>
            <PublishForm defaults={defaults} venues={venueOptions(proposal.campus)} sources={sources} campuses={campuses} />
          </details>
          <RejectForm proposalId={proposal.id} />
        </div>
      </article>;
    })}
  </main><MarketFooter /></div>;
}
