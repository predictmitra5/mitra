import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { searchAll, type SearchResults } from "@/modules/startups/search";
import { industryLabel, INDUSTRIES } from "@/modules/startups/labels";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { MarketCard, SampleTag } from "@/app/components/market/market-card";
import { toCardData } from "@/app/components/market/card-data";
import { SearchBox } from "@/app/components/market/search-box";
import { FounderFace, StartupMark, StartupThumb } from "@/app/components/startup/thumb";
import { SignupPrompt } from "@/app/components/signup-prompt";

/* Search across startups, founders, industries, markets and videos (2026-10-19). */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const query = typeof raw === "string" ? raw.slice(0, 80).trim() : "";
  let identity = null;
  try { identity = await currentIdentity(); } catch { /* a visitor */ }
  // The top bar and the results load side by side (2026-10-22); readViewerOrNull never throws.
  const viewerRead = identity ? readViewerOrNull(getDb(), identity.id) : Promise.resolve(null);
  const now = new Date();
  let results: SearchResults | null = null;
  let failed = false;
  if (query) {
    try { results = await searchAll(getDb(), query, identity?.id ?? null, now); } catch { failed = true; }
  }
  const viewer = await viewerRead;
  const total = results ? results.startups.length + results.founders.length + results.markets.length + results.videos.length : 0;

  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="search" query={query} />
      <main className="search-page">
        <h1>{query ? <>Results for &ldquo;{query}&rdquo;</> : "Search"}</h1>
        <div className="search-page-box"><SearchBox initial={query} /></div>
        <div className="chips" aria-label="Browse by industry">
          {INDUSTRIES.filter((i) => i.key !== "other").map((i) => <Link key={i.key} className="chip" href={`/search?q=${encodeURIComponent(i.tag)}`} prefetch={false} aria-current={results?.industries.includes(i.key) ? "true" : undefined}>{i.label}</Link>)}
        </div>
        {failed && <p className="form-error" role="alert">Search is temporarily unavailable. Please try again shortly.</p>}
        {results && total === 0 && <p className="muted feed-none">Nothing matches &ldquo;{query}&rdquo;. Try a startup&rsquo;s name, a founder, or an industry like AI or Climate.</p>}
        {results && results.startups.length > 0 && (
          <section className="search-section" aria-labelledby="s-startups">
            <h2 id="s-startups">Startups</h2>
            <ul className="result-list">
              {results.startups.map((s) => (
                <li key={s.id}><Link href={`/startups/${s.slug}`} prefetch={false} className="result-row">
                  <StartupMark startup={s} size={44} />
                  <span><strong>{s.name}</strong>{s.isDemo && <> <SampleTag /></>}<span className="muted">{s.tagline} · {industryLabel(s.industry)} · {s.stage}</span></span>
                </Link></li>
              ))}
            </ul>
          </section>
        )}
        {results && results.founders.length > 0 && (
          <section className="search-section" aria-labelledby="s-founders">
            <h2 id="s-founders">Founders</h2>
            <ul className="result-list">
              {results.founders.map((f) => (
                <li key={f.id}><Link href={`/founders/${f.handle}`} prefetch={false} className="result-row">
                  <FounderFace founder={f} size={44} />
                  <span><strong>{f.name}</strong><span className="muted">@{f.handle}{f.startupName ? ` · ${f.startupName}` : ""} · {f.headline}</span></span>
                </Link></li>
              ))}
            </ul>
          </section>
        )}
        {results && results.markets.length > 0 && (
          <section className="search-section" aria-labelledby="s-markets">
            <h2 id="s-markets">Markets</h2>
            <div className="grid">{results.markets.map((m, i) => <MarketCard key={m.id} card={toCardData(m)} now={now} index={i} />)}</div>
          </section>
        )}
        {results && results.videos.length > 0 && (
          <section className="search-section" aria-labelledby="s-videos">
            <h2 id="s-videos">Videos</h2>
            <ul className="video-grid">
              {results.videos.map((v) => (
                <li key={v.id}><Link href={`/watch/${v.id}`} prefetch={false} className="video-tile">
                  <StartupThumb startup={v.startup} founder={v.founder} imageUrl={v.thumbnailUrl} durationSeconds={v.durationSeconds} />
                  <span className="video-tile-title">{v.title}</span>
                  <span className="muted">{v.startup.name}{v.founder ? ` · ${v.founder.name}` : ""}</span>
                </Link></li>
              ))}
            </ul>
          </section>
        )}
        {!query && <p className="muted">Find founders, startups, industries, markets and videos. Try &ldquo;robotics&rdquo;, &ldquo;#EdTech&rdquo; or a founder&rsquo;s name.</p>}
      </main>
      <MarketFooter />
      {!identity && <SignupPrompt />}
    </div>
  );
}
