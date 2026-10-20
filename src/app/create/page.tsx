import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { CreatorError, readCreatorHome, type CreatorHome } from "@/modules/startups/creator";
import { mediaUploadsEnabled } from "@/modules/startups/media";
import { duration, industryLabel, videoKindLabel } from "@/modules/startups/labels";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { FounderFace, StartupMark } from "@/app/components/startup/thumb";
import { VerificationBadge } from "@/app/components/startup/profile-parts";
import { ClaimForm, FounderForm, StartupForm, SuggestForm, UpdateForm, VideoForm, type StartupDefaults } from "./forms";

/*
 * Create (2026-10-19): the creator hub. A member makes a founder profile,
 * registers startups, describes the product, posts videos and thumbnails,
 * writes updates, sends claims for verification and suggests markets, and
 * sees followers and how their videos are watched. Everything new waits for
 * the owner's approval; founders never create or settle markets.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create", robots: { index: false } };

const STATUS: Record<string, string> = { pending: "Waiting for review", approved: "Live", rejected: "Turned down", suspended: "Suspended" };
const day = (value: Date | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(value) : "";

function startupDefaults(startup: CreatorHome["startups"][number] | null): StartupDefaults {
  if (!startup) return { startupId: null, name: "", tagline: "", headline: "", description: "", industry: "ai", tags: "", stage: "", foundedOn: "", headquarters: "", websiteUrl: "", logoUrl: "", thumbnailUrl: "", productImageUrl: "", productDetails: "", features: "", screenshots: "" };
  return {
    startupId: startup.id, name: startup.name, tagline: startup.tagline, headline: startup.headline, description: startup.description, industry: startup.industry,
    tags: startup.tags.join("\n"), stage: startup.stage, foundedOn: startup.foundedOn ? startup.foundedOn.toISOString().slice(0, 7) : "", headquarters: startup.headquarters ?? "",
    websiteUrl: startup.websiteUrl ?? "", logoUrl: startup.logoUrl ?? "", thumbnailUrl: startup.thumbnailUrl ?? "", productImageUrl: startup.productImageUrl ?? "",
    productDetails: startup.productDetails, features: startup.productFeatures.map((f) => f.replace(/^[a-z-]+:/, "")).join("\n"), screenshots: startup.screenshotUrls.join("\n"),
  };
}

export default async function CreatePage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const database = getDb();
  let home: CreatorHome | null = null;
  let problem: string | null = null;
  try { home = await readCreatorHome(database, identity.id); }
  catch (error) {
    if (error instanceof CreatorError && error.code === "PROFILE_REQUIRED") redirect("/welcome");
    problem = "Creator tools are temporarily unavailable.";
  }
  const viewer = await readViewerOrNull(database, identity.id);
  const uploads = mediaUploadsEnabled();
  const founder = home?.founder ?? null;

  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="create" />
      <main className="account create">
        <div className="account-head"><h1>Create</h1><span className="muted">For founders: your profile, your startups, your videos</span></div>
        {problem && <p className="form-error" role="alert">{problem}</p>}
        {home && !founder && (
          <section className="create-step">
            <h2>1. Your founder profile</h2>
            <p className="muted">People follow founders, not just companies. Your name, a headline and a short bio appear under every video you post. The owner approves new profiles before they are public.</p>
            <FounderForm uploads={uploads} defaults={{ handle: "", name: viewer?.displayName ?? "", headline: "", bio: "", background: "", location: "", portraitUrl: "", websiteUrl: "", accomplishments: "" }} />
          </section>
        )}

        {home && founder && (
          <>
            <section className="create-card">
              <div className="create-card-head">
                <FounderFace founder={founder} size={56} />
                <div>
                  <h2>{founder.name} <span className={`status-pill status-${founder.status === "approved" ? "open" : founder.status}`}>{STATUS[founder.status]}</span></h2>
                  <p className="muted">@{founder.handle} · {home.founderFollowers.toLocaleString("en-US")} followers{founder.status === "approved" && <> · <Link href={`/founders/${founder.handle}`}>View profile</Link></>}</p>
                  {founder.reviewReason && founder.status !== "approved" && <p className="form-error">The owner&rsquo;s note: {founder.reviewReason}</p>}
                </div>
              </div>
              <details><summary>Edit founder profile</summary>
                <FounderForm uploads={uploads} defaults={{ handle: founder.handle, name: founder.name, headline: founder.headline, bio: founder.bio, background: founder.background ?? "",
                  location: founder.location ?? "", portraitUrl: founder.portraitUrl ?? "", websiteUrl: founder.websiteUrl ?? "", accomplishments: founder.accomplishments.join("\n") }} />
              </details>
            </section>

            <section aria-labelledby="your-startups">
              <div className="account-section-head"><h2 id="your-startups">Your startups</h2><span className="muted">{home.startups.length}</span></div>
              {home.startups.length === 0 && <p className="muted account-none">Register your startup below. Once the owner approves it, its page goes live and you can post videos and suggest markets.</p>}
              {home.startups.map((startup) => (
                <article className="create-card" key={startup.id}>
                  <div className="create-card-head">
                    <StartupMark startup={startup} size={48} />
                    <div>
                      <h3>{startup.name} <span className={`status-pill status-${startup.status === "approved" ? "open" : startup.status}`}>{STATUS[startup.status]}</span></h3>
                      <p className="muted">{startup.tagline} · {industryLabel(startup.industry)} · {startup.followers.toLocaleString("en-US")} followers
                        {(startup.status === "approved" || startup.status === "pending") && <> · <Link href={`/startups/${startup.slug}`}>{startup.status === "approved" ? "View page" : "Preview page"}</Link></>}</p>
                      {startup.reviewReason && startup.status !== "approved" && <p className="form-error">The owner&rsquo;s note: {startup.reviewReason}</p>}
                    </div>
                  </div>
                  {(startup.status === "approved" || startup.status === "pending") && <>
                    <details><summary>Post a video</summary><VideoForm startupId={startup.id} uploads={uploads} /></details>
                    <details><summary>Post an update or milestone</summary><UpdateForm startupId={startup.id} /></details>
                    <details><summary>Send a claim for verification</summary><ClaimForm startupId={startup.id} /></details>
                    {startup.status === "approved" && <details><summary>Suggest a market</summary><SuggestForm startupId={startup.id} /></details>}
                    <details><summary>Edit description and product</summary><StartupForm uploads={uploads} defaults={startupDefaults(startup)} /></details>
                  </>}
                </article>
              ))}
              <details className="create-card create-new"><summary>Register a startup</summary><StartupForm uploads={uploads} defaults={startupDefaults(null)} /></details>
            </section>

            {home.videos.length > 0 && (
              <section aria-labelledby="your-videos">
                <div className="account-section-head"><h2 id="your-videos">Your videos</h2><span className="muted">Engagement since posting</span></div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th scope="col">Video</th><th scope="col">Status</th><th scope="col">Views</th><th scope="col">Avg watched</th><th scope="col">Finished</th><th scope="col">Likes</th></tr></thead>
                    <tbody>
                      {home.videos.map((v) => (
                        <tr key={v.id}>
                          <td>{v.status === "approved" ? <Link href={`/watch/${v.id}`}>{v.title}</Link> : v.title}<span className="muted"> · {videoKindLabel(v.kind)} · {duration(v.durationSeconds)}</span></td>
                          <td>{STATUS[v.status]}{v.reviewReason && v.status !== "approved" ? `: ${v.reviewReason}` : ""}</td>
                          <td>{v.views.toLocaleString("en-US")}</td>
                          <td>{Math.round(v.avgProgress * 100)}%</td>
                          <td>{v.completes.toLocaleString("en-US")}</td>
                          <td>{v.likes.toLocaleString("en-US")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {(home.updates.length > 0 || home.claims.length > 0 || home.suggestions.length > 0) && (
              <section aria-labelledby="your-posts">
                <div className="account-section-head"><h2 id="your-posts">Updates, claims and suggestions</h2></div>
                <ul className="holdings">
                  {home.updates.map((u) => <li key={u.id} className="create-row"><strong>{u.title}</strong><span className="muted">{u.kind === "milestone" ? "Milestone" : "Update"} · {day(u.happenedAt)}</span><VerificationBadge level={u.verification} /></li>)}
                  {home.claims.map((c) => <li key={c.id} className="create-row"><strong>{c.statement}</strong><span className="muted">Claim{c.reviewNote ? ` · ${c.reviewNote}` : " · waiting for review"}</span><VerificationBadge level={c.level} /></li>)}
                  {home.suggestions.map((s) => <li key={s.id} className="create-row"><strong>{s.question}</strong><span className="muted">Market suggestion · {s.status === "pending" ? "waiting for the owner" : s.status === "approved" ? "made into a market" : `turned down${s.reviewReason ? `: ${s.reviewReason}` : ""}`}</span>{s.marketId && s.status === "approved" && <Link href={`/markets/${s.marketId}`}>Open market</Link>}</li>)}
                </ul>
              </section>
            )}
          </>
        )}
        <p className="muted account-small">{uploads ? "Files upload straight to Mitra's storage; images are re-encoded so no location or camera data stays in them." : "Uploads aren't switched on yet, so paste links to your video and image files for now."} Everything you post is reviewed by the owner before it is public, and stays labelled as founder-reported until checked.</p>
      </main>
      <MarketFooter />
    </div>
  );
}
