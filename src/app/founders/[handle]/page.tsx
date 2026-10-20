import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { readFounderPage } from "@/modules/startups/read";
import { industryLabel, monthYear } from "@/modules/startups/labels";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { MarketCard, SampleTag } from "@/app/components/market/market-card";
import { toCardData } from "@/app/components/market/card-data";
import { FounderFace, StartupMark } from "@/app/components/startup/thumb";
import { Timeline, VideoGrid } from "@/app/components/startup/profile-parts";
import { FollowButton } from "@/app/components/social/follow-button";
import { SignupPrompt } from "@/app/components/signup-prompt";

/*
 * A founder's page (2026-10-19): founders are followed apart from their
 * companies, because Mitra is about finding people early. Portrait, name,
 * biography and background, the companies they founded, their videos,
 * accomplishments, milestone timeline, the markets on their startups, and
 * followers.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/founders/[handle]">): Promise<Metadata> {
  return { title: `@${(await params).handle}` };
}

export default async function FounderPage({ params }: PageProps<"/founders/[handle]">) {
  const { handle } = await params;
  let identity = null;
  try { identity = await currentIdentity(); } catch { /* a visitor */ }
  const now = new Date();
  const page = await readFounderPage(getDb(), handle, identity?.id ?? null, now).catch(() => null);
  if (!page) notFound();
  const viewer = identity ? await readViewerOrNull(getDb(), identity.id) : null;
  const { founder, companies } = page;
  const byId = new Map(companies.map((c) => [c.id, c]));
  const first = founder.name.split(" ")[0];

  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="markets" />
      <main className="profile">
        {page.preview && <p className="sample-note profile-preview"><strong>Waiting for review.</strong> Only you and the owner can see this page until it is approved.</p>}
        <section className="founder-hero rise">
          <FounderFace founder={founder} size={112} className="founder-hero-face" />
          <div className="profile-name">
            <span className="eyebrow">Founder{founder.location ? ` · ${founder.location}` : ""}{founder.isDemo && <> <SampleTag /></>}</span>
            <h1>{founder.name}</h1>
            <p className="muted">@{founder.handle}</p>
            <p className="profile-tagline">{founder.headline}</p>
          </div>
          <div className="profile-actions">
            {!page.preview && <FollowButton kind="founder" id={founder.id} initial={page.following} signedIn={!!identity} count={page.followers} size="large" />}
            <span className="muted">{page.followers.toLocaleString("en-US")} followers</span>
          </div>
        </section>

        <div className="profile-columns">
          <div className="profile-main">
            <section className="goal-section rise" aria-labelledby="bio">
              <h2 id="bio">About {first}</h2>
              <p className="about-text">{founder.bio}</p>
              {founder.background && <><h3 className="about-sub">Background</h3><p className="about-text">{founder.background}</p></>}
              {founder.accomplishments.length > 0 && <>
                <h3 className="about-sub">Accomplishments</h3>
                <ul className="accomplishments">{founder.accomplishments.map((a) => <li key={a}>{a}</li>)}</ul>
              </>}
              {founder.websiteUrl && <p className="about-links"><a href={founder.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">Website <ExternalLink size={13} aria-hidden="true" /></a></p>}
            </section>

            <section className="goal-section rise" aria-labelledby="videos">
              <h2 id="videos">Videos</h2>
              <VideoGrid videos={page.videos} startup={(id) => byId.get(id) ?? null}
                founder={() => ({ name: founder.name, portraitUrl: founder.portraitUrl, hue: founder.hue, role: null })} />
            </section>

            <section className="goal-section rise" aria-labelledby="markets">
              <div className="goal-section-head"><h2 id="markets">Markets on {first}&rsquo;s startups</h2><span className="muted">{page.markets.length}</span></div>
              {page.markets.length ? <div className="grid grid-two">{page.markets.map((m, i) => <MarketCard key={m.id} card={toCardData(m)} now={now} index={i} />)}</div>
                : <p className="muted account-none">No markets yet.</p>}
            </section>

            <section className="goal-section rise" aria-labelledby="timeline">
              <h2 id="timeline">Milestones</h2>
              <Timeline items={page.updates} showStartup />
            </section>
          </div>

          <aside className="profile-side">
            <section className="side-card">
              <h2>Companies</h2>
              <ul className="team">
                {companies.map((company) => (
                  <li key={company.id}>
                    <Link href={`/startups/${company.slug}`} prefetch={false} className="about-person">
                      <StartupMark startup={company} size={44} />
                      <span><strong>{company.name}</strong><span className="muted">{company.role} · {industryLabel(company.industry)}</span></span>
                    </Link>
                    <p className="muted">{company.tagline}{company.foundedOn ? ` · since ${monthYear(company.foundedOn)}` : ""}</p>
                  </li>
                ))}
              </ul>
            </section>
            {founder.isDemo && <p className="sample-note">{founder.name} is a fictional founder, made to demonstrate Mitra.</p>}
          </aside>
        </div>
      </main>
      <MarketFooter />
      {!identity && <SignupPrompt />}
    </div>
  );
}
