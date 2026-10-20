"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { industryLabel, monthYear } from "@/modules/startups/labels";
import { percent } from "@/modules/discovery/present";
import { FollowButton } from "../social/follow-button";
import { StartupMark, StartupThumb } from "../startup/thumb";
import { useLiveQuotes, withQuote } from "../market/live-quotes";
import { moreVideos } from "./feed-actions";
import { VideoCard } from "./video-card";
import type { VideoCardData } from "./video-data";

/*
 * The video feed (2026-10-19). One card per founder video, stacked and
 * snapping into place as you scroll or swipe, the way TikTok and YouTube
 * Shorts do it; only the card most in view plays. The arrow keys, J and K,
 * and the arrow buttons on a desktop move a card at a time. Near the end it
 * asks the server for more, ranked again with what you just did.
 *
 * On a wide screen a side panel follows the card in view: the startup, its
 * stage, Follow and what plays next.
 */

export function Reel({ initial, signedIn, following = false, empty }: {
  initial: VideoCardData[]; signedIn: boolean; following?: boolean; empty: React.ReactNode;
}) {
  const [cards, setCards] = useState(initial);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const items = useRef<(HTMLElement | null)[]>([]);
  const ratios = useRef(new Map<number, number>());
  // Read by the observer's callback, which outlives a render.
  const latest = useRef({ cards, loading, done, following });
  useEffect(() => { latest.current = { cards, loading, done, following }; });

  /** More cards, a few before the end, ranked again with what the viewer just did. */
  const loadMore = useCallback((index: number) => {
    const { cards: list, loading: busy, done: finished, following: mode } = latest.current;
    if (finished || busy || index < list.length - 3) return;
    latest.current.loading = true;
    setLoading(true);
    void moreVideos(list.map((c) => c.id), mode).then((more) => {
      if (more.length === 0) setDone(true);
      else setCards((current) => [...current, ...more.filter((m) => !current.some((c) => c.id === m.id))]);
    }).finally(() => setLoading(false));
  }, []);

  // Live prices for the predictions on screen, as on the rest of the site.
  const ids = useMemo(() => cards.map((c) => c.market?.id).filter((id): id is string => !!id), [cards]);
  const live = useLiveQuotes(ids);
  const shown = useMemo(() => cards.map((c) => (c.market ? { ...c, market: withQuote(c.market, live) } : c)), [cards, live]);

  // The card most in view (at least 60% of its video) is the one that plays.
  useEffect(() => {
    ratios.current.clear();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const index = Number(entry.target.closest<HTMLElement>(".reel-item")?.dataset.index);
        if (!Number.isInteger(index)) continue;
        ratios.current.set(index, entry.isIntersecting ? entry.intersectionRatio : 0);
      }
      let best = -1, bestRatio = 0.6;
      for (const [index, ratio] of ratios.current) if (ratio >= bestRatio) { best = index; bestRatio = ratio; }
      if (best >= 0) { setActive(best); loadMore(best); }
    }, { threshold: [0, 0.25, 0.6, 0.8, 1] });
    for (const element of items.current) {
      const media = element?.querySelector(".vcard-media");
      if (media) observer.observe(media);
    }
    return () => observer.disconnect();
  }, [shown.length, loadMore]);

  const go = useCallback((index: number) => {
    const target = items.current[Math.max(0, Math.min(cards.length - 1, index))];
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [cards.length]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (target?.closest("input, textarea, select, [contenteditable=true]") || document.querySelector("dialog[open]")) return;
      if (event.key === "ArrowDown" || event.key === "j") { event.preventDefault(); go(active + 1); }
      else if (event.key === "ArrowUp" || event.key === "k") { event.preventDefault(); go(active - 1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go]);

  function hide(id: string) {
    setCards((list) => list.filter((c) => c.id !== id));
  }

  if (cards.length === 0) return <>{empty}</>;
  const current = shown[active] ?? shown[0];
  const next = shown.slice(active + 1, active + 4);

  return (
    <div className="reel-layout">
      <div className="reel" aria-label={following ? "Videos from founders and startups you follow" : "Founder videos picked for you"}>
        {shown.map((card, index) => (
          <section key={card.id} className="reel-item" data-index={index} ref={(el) => { items.current[index] = el; }}
            style={{ "--rise-i": Math.min(index, 3) } as React.CSSProperties}>
            {card.reason && index === active && <p className="reel-reason" aria-live="polite">{card.reason}</p>}
            <VideoCard card={card} active={index === active} signedIn={signedIn} onHide={hide} priority={index < 2} />
          </section>
        ))}
        <div className="reel-end">
          {loading ? <p className="muted">Finding more founders…</p> : done ? (
            <div className="reel-done">
              <h2>You&rsquo;re all caught up</h2>
              <p className="muted">Browse every market, or follow founders to fill your Following tab.</p>
              <Link className="btn btn-primary" href="/markets" prefetch={false}>Browse markets</Link>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="reel-side" aria-label="About this startup">
        {current && (
          <div className="reel-panel" key={current.id}>
            <div className="reel-panel-head">
              <StartupMark startup={current.startup} size={44} />
              <div>
                <Link className="reel-panel-name" href={`/startups/${current.startup.slug}`} prefetch={false}>{current.startup.name}</Link>
                <span className="muted">{industryLabel(current.startup.industry)} · {current.startup.stage}</span>
              </div>
            </div>
            <p className="reel-panel-text">{current.startup.description}</p>
            <FollowButton key={`f-${current.startup.id}`} kind="startup" id={current.startup.id} initial={current.viewer.followsStartup} signedIn={signedIn} videoId={current.id} size="large" count={current.counts.startupFollowers} />
            {current.market && (
              <Link className="reel-panel-market" href={`/markets/${current.market.id}`} prefetch={false}>
                <span className="eyebrow">Market</span>
                <span>{current.market.shortQuestion ?? current.market.question}</span>
                <strong>{percent(current.market.yesPrice)}% Yes</strong>
              </Link>
            )}
            {next.length > 0 && (
              <div className="reel-next">
                <h3 className="eyebrow">Up next</h3>
                <ul>
                  {next.map((card, i) => (
                    <li key={card.id}>
                      <button type="button" onClick={() => go(active + 1 + i)}>
                        <StartupThumb startup={card.startup} founder={card.founder ? { ...card.founder } : null} imageUrl={card.thumbnailUrl} bar={false} className="thumb-mini" />
                        <span><strong>{card.startup.name}</strong><span className="muted">{card.founder?.name ?? ""} · {monthYear(card.publishedAt)}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="reel-arrows">
          <button type="button" className="icon-button" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous video (K)"><ChevronUp size={20} aria-hidden="true" /></button>
          <button type="button" className="icon-button" onClick={() => go(active + 1)} disabled={active >= cards.length - 1} aria-label="Next video (J)"><ChevronDown size={20} aria-hidden="true" /></button>
        </div>
      </aside>
    </div>
  );
}
