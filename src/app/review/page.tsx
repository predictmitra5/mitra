import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { AdminError, readReviewQueue } from "@/modules/startups/admin";
import { duration, industryLabel, verificationLabel, videoKindLabel } from "@/modules/startups/labels";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { StartupThumb } from "@/app/components/startup/thumb";
import { ClaimForm, DeclineSuggestionForm, OpenDraftForm, ReportForm, ReviewForm } from "./admin-forms";

export const metadata = { title: "Review queue", robots: { index: false } };
export const dynamic = "force-dynamic";

const day = (value: Date | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(value) : "";

/**
 * The owner's queue (2026-10-19): founders, startups and videos waiting for
 * approval, market suggestions from founders, claims to verify, reports, and
 * draft markets. Nothing a member submits is public until approved here.
 * Hidden from everyone else.
 */
export default async function ReviewPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const database = getDb();
  let queue;
  try { queue = await readReviewQueue(database, identity.id); }
  catch (error) { if (error instanceof AdminError && error.code === "NOT_OWNER") notFound(); throw error; }
  const viewer = await readViewerOrNull(database, identity.id);
  const waiting = queue.founders.length + queue.startups.length + queue.videos.length + queue.suggestions.length + queue.claims.length + queue.reports.length;

  return <div className="market-shell"><MarketHeader viewer={viewer} /><main className="account-main review-main">
    <div className="account-topline"><span className="eyebrow">OWNER REVIEW</span><Link className="text-button" href="/account">Back to account</Link></div>
    <div className="owner-links">
      <Link className="btn btn-primary" href="/review/markets/new">Create a market</Link>
      <Link className="btn btn-quiet" href="/review/markets">Outcomes, pauses and objections</Link>
      <Link className="btn btn-quiet" href="/review/audit">Audit record</Link>
      <Link className="btn btn-quiet" href="/review/people">People</Link>
    </div>
    <section className="account-welcome">
      <h1>{waiting === 0 ? "Nothing waiting." : `${waiting} waiting for you.`}</h1>
      <p>Approve founders, startups and videos before anyone else sees them. Only you create, open, pause and settle markets; founders can suggest them. Every new market opens at 50/50; odds move only through trading. Keep demo data labelled, and never present simulated numbers as verified.</p>
    </section>

    {queue.startups.length > 0 && <section className="review-group" aria-labelledby="q-startups">
      <h2 id="q-startups">Startups ({queue.startups.length})</h2>
      {queue.startups.map(({ startup, founderName, founderStatus }) => <article className="review-card" key={startup.id}>
        <div className="review-meta"><span className="status-pill">{industryLabel(startup.industry)}</span><span>{startup.stage}</span><span>by {founderName ?? "unknown"}{founderStatus === "pending" ? " (founder also waiting)" : ""}</span><span>{day(startup.createdAt)}</span></div>
        <h3><Link href={`/startups/${startup.slug}`}>{startup.name}: {startup.headline} ↗︎</Link></h3>
        <p className="review-criteria">{startup.description}</p>
        <p className="field-hint">Product: {startup.productDetails}</p>
        <ReviewForm what="startup" id={startup.id} />
      </article>)}
    </section>}

    {queue.founders.length > 0 && <section className="review-group" aria-labelledby="q-founders">
      <h2 id="q-founders">Founder profiles ({queue.founders.length})</h2>
      {queue.founders.map(({ founder, handle }) => <article className="review-card" key={founder.id}>
        <div className="review-meta"><span>@{founder.handle}</span>{handle && <span>account @{handle}</span>}<span>{day(founder.createdAt)}</span></div>
        <h3><Link href={`/founders/${founder.handle}`}>{founder.name} ↗︎</Link></h3>
        <p className="review-criteria">{founder.headline}. {founder.bio}</p>
        {founder.background && <p className="field-hint">{founder.background}</p>}
        <p className="field-hint">
          {[founder.location, founder.educationLevel, founder.school].filter(Boolean).join(" · ") || "No location or education given"}
          {founder.portraitUrl ? " · has a photo" : " · no photo yet"}
          {founder.linkedinUrl && <> · <a href={founder.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow">LinkedIn ↗︎</a></>}
          {founder.resumePath && <> · <a href={`/founders/${founder.handle}/resume`} target="_blank" rel="noopener noreferrer">Resume (PDF) ↗︎</a></>}
        </p>
        <ReviewForm what="founder" id={founder.id} />
      </article>)}
    </section>}

    {queue.videos.length > 0 && <section className="review-group" aria-labelledby="q-videos">
      <h2 id="q-videos">Videos ({queue.videos.length})</h2>
      {queue.videos.map(({ video, startupName, startupStatus }) => <article className="review-card" key={video.id}>
        <div className="review-meta"><span className="status-pill">{videoKindLabel(video.kind)}</span><span>{startupName}{startupStatus !== "approved" ? ` (startup ${startupStatus})` : ""}</span><span>{duration(video.durationSeconds)}</span></div>
        <h3>{video.title}</h3>
        <p className="review-criteria">{video.description}</p>
        {video.videoUrl ? <video className="review-video" src={video.videoUrl} controls preload="metadata" /> : <p className="field-hint">No file: plays as a captioned placeholder.</p>}
        {video.thumbnailUrl && <StartupThumb startup={{ name: startupName, tagline: "", glyph: "sparkles", hue: 210, logoUrl: null, productFeatures: [] }} founder={null} imageUrl={video.thumbnailUrl} bar={false} className="review-thumb" />}
        {video.captions.length > 0 && <details><summary>Captions ({video.captions.length})</summary><ol className="review-captions">{video.captions.map((c, i) => <li key={i}><span className="muted">{duration(c.at)}</span> {c.text}</li>)}</ol></details>}
        <ReviewForm what="video" id={video.id} />
      </article>)}
    </section>}

    {queue.suggestions.length > 0 && <section className="review-group" aria-labelledby="q-suggest">
      <h2 id="q-suggest">Market suggestions ({queue.suggestions.length})</h2>
      {queue.suggestions.map(({ proposal, startupName, handle }) => <article className="review-card" key={proposal.id}>
        <div className="review-meta"><span>{startupName}</span><span>from @{handle}</span><span>{day(proposal.createdAt)}</span>{proposal.suggestedCloseAt && <span>close {day(proposal.suggestedCloseAt)}</span>}</div>
        <h3>{proposal.question}</h3>
        <p className="review-criteria">How to check: {proposal.resolutionNote}</p>
        <div className="review-buttons">
          <Link className="btn btn-primary" href={`/review/markets/new?suggestion=${proposal.id}`}>Write it as a market</Link>
          <DeclineSuggestionForm id={proposal.id} />
        </div>
      </article>)}
    </section>}

    {queue.claims.length > 0 && <section className="review-group" aria-labelledby="q-claims">
      <h2 id="q-claims">Claims to verify ({queue.claims.length})</h2>
      {queue.claims.map(({ claim, startupName }) => <article className="review-card" key={claim.id}>
        <div className="review-meta"><span>{startupName}</span><span className="status-pill">{verificationLabel(claim.level)}</span></div>
        <h3>{claim.statement}</h3>
        {(claim.sourceName || claim.sourceUrl) && <p className="field-hint">Source: {claim.sourceUrl ? <a href={claim.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{claim.sourceName ?? claim.sourceUrl}</a> : claim.sourceName}</p>}
        <ClaimForm id={claim.id} />
      </article>)}
    </section>}

    {queue.reports.length > 0 && <section className="review-group" aria-labelledby="q-reports">
      <h2 id="q-reports">Reports ({queue.reports.length})</h2>
      {queue.reports.map(({ report, reporter, label, href }) => <article className="review-card" key={report.id}>
        <div className="review-meta"><span className="status-pill">{report.target}</span><span>by @{reporter ?? "someone"}</span><span>{day(report.createdAt)}</span></div>
        <h3>{href ? <Link href={href}>{label} ↗︎</Link> : label}</h3>
        <p className="review-criteria">{report.reason}</p>
        <ReportForm id={report.id} canRemove={report.target === "comment" || report.target === "video"} />
      </article>)}
    </section>}

    {queue.drafts.length > 0 && <section className="review-group" aria-labelledby="q-drafts">
      <h2 id="q-drafts">Draft markets ({queue.drafts.length})</h2>
      {queue.drafts.map(({ market, startupName }) => <article className="review-card" key={market.id}>
        <div className="review-meta"><span>{startupName}</span><span>closes {day(market.deadlineAt)}</span><span>Starts with an empty order book</span>{market.isSample && <span className="sample-tag">Demo</span>}</div>
        <h3>{market.question}</h3>
        <div className="review-buttons"><Link className="btn btn-quiet" href={`/review/markets/new?draft=${market.id}`}>Edit the rules</Link><OpenDraftForm id={market.id} /></div>
      </article>)}
    </section>}
  </main><MarketFooter /></div>;
}
