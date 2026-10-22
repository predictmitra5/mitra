import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { readStartupPage } from "@/modules/startups/read";
import { hashtags, industryLabel, monthYear } from "@/modules/startups/labels";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { MarketCard, SampleTag } from "@/app/components/market/market-card";
import { toCardData } from "@/app/components/market/card-data";
import { FounderFace, StartupMark, StartupThumb } from "@/app/components/startup/thumb";
import { Claims, Timeline, VerificationBadge, VideoGrid } from "@/app/components/startup/profile-parts";
import { VideoPlayer } from "@/app/components/startup/video-player";
import { FollowButton } from "@/app/components/social/follow-button";
import { SignupPrompt } from "@/app/components/signup-prompt";

/*
 * A startup's page (2026-10-19): the founder-and-startup hero, name, tagline,
 * industry and tags, Follow with the follower count, what it does and the
 * product, its founders, videos, progress timeline and updates, claims with
 * their verification, open markets, resolved markets and how they went.
 *
 * The hero plays the startup's video in place (2026-10-22): its latest, or
 * the one a link chose with ?v=. A startup with no market has no watch page,
 * so /watch/<id> opens its video here.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/startups/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
}

export default async function StartupPage({ params, searchParams }: PageProps<"/startups/[slug]">) {
  const { slug } = await params;
  const { v } = await searchParams;
  let identity = null;
  try { identity = await currentIdentity(); } catch { /* a visitor */ }
  const now = new Date();
  // The page and the top bar load side by side (2026-10-22); readViewerOrNull never throws.
  const [page, viewer] = await Promise.all([
    readStartupPage(getDb(), slug, identity?.id ?? null, now).catch(() => null),
    identity ? readViewerOrNull(getDb(), identity.id) : null,
  ]);
  if (!page) notFound();
  const { startup, team } = page;
  const lead = team[0] ?? null;
  const resolved = page.past.filter((m) => m.status === "settled");
  const yesShare = resolved.length ? Math.round((resolved.filter((m) => m.ruledOutcome === "yes").length / resolved.length) * 100) : null;
  const thumbFounder = lead ? { name: lead.name, portraitUrl: lead.portraitUrl, hue: lead.hue, role: lead.role } : null;
  const shown = page.videos.find((video) => video.id === v) ?? page.videos[0] ?? null;

  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="markets" />
      <main className="profile">
        {page.preview && <p className="sample-note profile-preview"><strong>Waiting for review.</strong> Only you and the owner can see this page until it is approved.</p>}
        <section className="profile-hero rise">
          {shown ? (
            <div className="profile-hero-media">
              <VideoPlayer video={{ ...shown }} poster={<StartupThumb priority startup={startup} founder={thumbFounder} durationSeconds={shown.durationSeconds}
                imageUrl={shown.thumbnailUrl} label={shown === page.videos[0] ? "Latest video" : undefined} />} />
            </div>
          ) : <StartupThumb priority startup={startup} founder={thumbFounder} bar={false} className="profile-hero-media" />}
          <div className="profile-head">
            <StartupMark startup={startup} size={56} />
            <div className="profile-name">
              <span className="eyebrow">{industryLabel(startup.industry)} · {startup.stage}{startup.isDemo && <> <SampleTag /></>}</span>
              <h1>{startup.name}</h1>
              <p className="profile-tagline">{startup.headline}</p>
              <p className="vcard-tags">{hashtags(startup.industry, startup.tags, 5).map((t) => <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} prefetch={false}>#{t}</Link>)}</p>
            </div>
            <div className="profile-actions">
              {!page.preview && <FollowButton kind="startup" id={startup.id} initial={page.following} signedIn={!!identity} count={page.followers} size="large" />}
              <span className="muted">{page.followers.toLocaleString("en-US")} followers</span>
            </div>
          </div>
        </section>

        <div className="profile-columns">
          <div className="profile-main">
            <section className="goal-section rise" aria-labelledby="about">
              <h2 id="about">About {startup.name}</h2>
              <p className="about-text">{startup.description}</p>
              <dl className="goal-facts about-facts">
                <div><dt>Product</dt><dd>{startup.tagline}</dd></div>
                <div><dt>Founded</dt><dd>{monthYear(startup.foundedOn)}</dd></div>
                <div><dt>Stage</dt><dd>{startup.stage}</dd></div>
                {startup.headquarters && <div><dt>Based in</dt><dd>{startup.headquarters}</dd></div>}
                <div><dt>Verification</dt><dd><VerificationBadge level={startup.verification} /></dd></div>
              </dl>
              <h3 className="about-sub">The product</h3>
              <p className="about-text">{startup.productDetails}</p>
              {startup.screenshotUrls.length > 0 && (
                <ul className="screenshots">{startup.screenshotUrls.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <li key={url}><img src={url} alt={`${startup.name} screenshot`} loading="lazy" /></li>
                ))}</ul>
              )}
              {startup.websiteUrl && <p className="about-links"><a href={startup.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">Website <ExternalLink size={13} aria-hidden="true" /></a></p>}
            </section>

            <section className="goal-section rise" aria-labelledby="markets">
              <div className="goal-section-head"><h2 id="markets">Active markets</h2><span className="muted">{page.open.length}</span></div>
              {page.open.length ? <div className="grid grid-two">{page.open.map((m, i) => <MarketCard key={m.id} card={toCardData(m)} now={now} index={i} />)}</div>
                : <p className="muted account-none">No open markets on {startup.name} right now.</p>}
            </section>

            <section className="goal-section rise" aria-labelledby="videos">
              <h2 id="videos">Videos</h2>
              <VideoGrid videos={page.videos} startup={() => startup} founder={() => thumbFounder} />
            </section>

            <section className="goal-section rise" aria-labelledby="timeline">
              <h2 id="timeline">Progress and updates</h2>
              <Timeline items={page.updates} />
            </section>

            {page.past.length > 0 && (
              <section className="goal-section rise" aria-labelledby="resolved">
                <div className="goal-section-head"><h2 id="resolved">Resolved and closed markets</h2>{yesShare !== null && <span className="muted">{yesShare}% resolved Yes</span>}</div>
                <div className="grid grid-two">{page.past.map((m, i) => <MarketCard key={m.id} card={toCardData(m)} now={now} index={i} />)}</div>
              </section>
            )}
          </div>

          <aside className="profile-side">
            <section className="side-card">
              <h2>{team.length === 1 ? "Founder" : "Founders"}</h2>
              <ul className="team">
                {team.map((person) => (
                  <li key={person.id}>
                    <Link href={`/founders/${person.handle}`} prefetch={false} className="about-person">
                      <FounderFace founder={person} size={48} />
                      <span><strong>{person.name}</strong><span className="muted">{person.role}</span></span>
                    </Link>
                    <p className="muted">{person.headline}</p>
                  </li>
                ))}
              </ul>
            </section>
            {page.claims.length > 0 && (
              <section className="side-card">
                <h2>Claims and verification</h2>
                <Claims claims={page.claims} />
                <p className="muted account-small">Founder-reported means the founder says so; independently verified means it was checked against a source outside the company.</p>
              </section>
            )}
            {startup.isDemo && <p className="sample-note">This startup, its founders, videos and numbers are fictional, made to demonstrate Mitra.</p>}
          </aside>
        </div>
      </main>
      <MarketFooter />
      {!identity && <SignupPrompt />}
    </div>
  );
}
