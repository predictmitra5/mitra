import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { CreatorError, readCreatorHome, type CreatorHome } from "@/modules/startups/creator";
import { duration, industryLabel, videoKindLabel } from "@/modules/startups/labels";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { FounderFace, StartupMark } from "@/app/components/startup/thumb";
import { VerificationBadge } from "@/app/components/startup/profile-parts";
import { listInvites } from "@/modules/startups/invites";
import { ClaimForm, SuggestForm, UpdateForm } from "./forms";
import { CancelInvite } from "./cancel-invite";

/*
 * Create (2026-10-19): the creator hub. Since 2026-10-21 the founder profile,
 * startups and videos are made and edited one question per screen
 * (/create/founder, /create/startup, /create/video); a member without a
 * founder profile starts there. Here a founder sees what they have, follows
 * the next step, writes updates, sends claims for verification and suggests
 * markets, and sees followers and how their videos are watched. Everything new
 * waits for the owner's approval; founders never create or settle markets.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create", robots: { index: false } };

const STATUS: Record<string, string> = { pending: "Waiting for review", approved: "Live", rejected: "Turned down", suspended: "Suspended" };
const day = (value: Date | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(value) : "";

const SAVED: Record<string, string> = {
  profile: "Founder profile saved.",
  startup: "Startup saved. The owner reviews new startups before they appear anywhere.",
  video: "Video sent for review. It appears in feeds once the owner approves it.",
  joined: "You joined the team. Your founder profile still needs the owner's approval before others see it.",
};

const INVITE_STATE: Record<string, string> = {
  waiting: "Waiting", unlocked: "Password matched, making their profile", joined: "Joined", expired: "Expired", locked: "Locked after wrong passwords", cancelled: "Cancelled",
};

export default async function CreatePage({ searchParams }: PageProps<"/create">) {
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
  const founder = home?.founder ?? null;
  if (home && !founder) redirect("/create/founder");
  const saved = (await searchParams).saved;
  const notice = typeof saved === "string" ? SAVED[saved] : undefined;
  const live = home?.startups.filter((s) => s.status === "approved" || s.status === "pending") ?? [];
  const canInvite = !!founder && founder.status !== "suspended" && founder.status !== "rejected";
  const invites = new Map(await Promise.all(live.map(async (s) => [s.id, await listInvites(database, identity.id, s.id).catch(() => [])] as const)));

  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="create" />
      <main className="account create">
        <div className="account-head"><h1>Create</h1><span className="muted">For founders: your profile, your startups, your videos</span></div>
        {problem && <p className="form-error" role="alert">{problem}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}
        {home && founder && (
          <>
            <section className="create-card">
              <div className="create-card-head">
                <FounderFace founder={founder} size={56} />
                <div>
                  <h2>{founder.name} <span className={`status-pill status-${founder.status === "approved" ? "open" : founder.status}`}>{STATUS[founder.status]}</span></h2>
                  <p className="muted">@{founder.handle} · {home.founderFollowers.toLocaleString("en-US")} followers{founder.status === "approved" && <> · <Link href={`/@${founder.handle}`}>View profile</Link></>}</p>
                  {founder.reviewReason && founder.status !== "approved" && <p className="form-error">The owner&rsquo;s note: {founder.reviewReason}</p>}
                </div>
              </div>
              {founder.status !== "suspended" && <div className="create-actions"><Link className="btn btn-quiet" href="/create/founder">Edit profile</Link></div>}
            </section>

            {founder.status !== "suspended" && founder.status !== "rejected" && live.length === 0 && (
              <section className="create-card create-next">
                <h2>Next: your startup</h2>
                <p className="muted">Tell people what you&rsquo;re building, one question at a time. Then add your first video.</p>
                <Link className="btn btn-primary" href="/create/startup">Register your startup</Link>
              </section>
            )}
            {live.length > 0 && home.videos.length === 0 && (
              <section className="create-card create-next">
                <h2>Next: your first video</h2>
                <p className="muted">Paste a YouTube link to a video of you talking about {live[0].name}. Unlisted works.</p>
                <Link className="btn btn-primary" href={`/create/video?startup=${live[0].id}`}>Add a video</Link>
              </section>
            )}

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
                    <div className="create-actions">
                      <Link className="btn btn-primary" href={`/create/video?startup=${startup.id}`}>Add a video</Link>
                      <Link className="btn btn-quiet" href={`/create/startup?id=${startup.id}`}>Edit details</Link>
                      {canInvite && <Link className="btn btn-quiet" href={`/create/invite?startup=${startup.id}`}>Invite a co-founder</Link>}
                    </div>
                    {(invites.get(startup.id)?.length ?? 0) > 0 && (
                      <ul className="invite-list" aria-label={`Co-founder invites for ${startup.name}`}>
                        {invites.get(startup.id)!.map((invite) => (
                          <li key={invite.id}>
                            <span><strong>{invite.role}</strong> <span className="muted">· {INVITE_STATE[invite.state]}{invite.joinedHandle ? ` · @${invite.joinedHandle}` : ""} · made {day(invite.createdAt)}</span></span>
                            {(invite.state === "waiting" || invite.state === "unlocked") && <CancelInvite id={invite.id} />}
                          </li>
                        ))}
                      </ul>
                    )}
                    <details><summary>Post an update or milestone</summary><UpdateForm startupId={startup.id} /></details>
                    <details><summary>Send a claim for verification</summary><ClaimForm startupId={startup.id} /></details>
                    {startup.status === "approved" && <details><summary>Suggest a market</summary><SuggestForm startupId={startup.id} /></details>}
                  </>}
                </article>
              ))}
              {live.length > 0 && founder.status !== "suspended" && founder.status !== "rejected" && <Link className="create-card create-new" href="/create/startup">Register another startup</Link>}
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
        <p className="muted account-small">Videos are YouTube links: upload to YouTube (Unlisted is fine), then paste the link. Everything you post is reviewed by the owner before it is public, and stays labelled as founder-reported until checked.</p>
      </main>
      <MarketFooter />
    </div>
  );
}
