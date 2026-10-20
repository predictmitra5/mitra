"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import { moreVideos } from "../feed/feed-actions";
import type { VideoCardData } from "../feed/video-data";
import type { CardData } from "../market/market-card";
import { GridCard, ShelfCard } from "./grid-card";
import { CHIPS, type Topic } from "./topics";

/*
 * YouTube's home (2026-10-20): a row of chips, then a grid of founder videos
 * with their markets, the market moving most today in the first slot, one
 * shelf of markets closing soon after the first rows, and more videos as the
 * viewer scrolls. Chips filter in place and live in the address (?topic=), so
 * the page does not reload and records nothing.
 */

/** Where the shelf sits: after the first rows, as on YouTube. */
const SHELF_AFTER = 6;

export function HomeGrid({ items: first, highlight, closingSoon, signedIn, following, topic: initialTopic, nowIso, empty }: {
  items: VideoCardData[]; highlight: VideoCardData | null; closingSoon: CardData[]; signedIn: boolean; following: boolean;
  topic: Topic; nowIso: string; empty: React.ReactNode;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [items, setItems] = useState(first);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [done, setDone] = useState(first.length < 8);
  const loading = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  function pick(next: Topic) {
    setTopic(next);
    window.history.replaceState(null, "", next === "all" ? "/" : `/?topic=${next}`);
    window.scrollTo({ top: 0 });
  }

  const visible = useMemo(() => {
    const shown = items.filter((card) => !hidden.has(card.id));
    if (topic === "all") return shown;
    if (topic === "new") return [...shown].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    if (topic === "closing") {
      return shown.filter((card) => card.market?.tradingOpen).sort((a, b) => a.market!.deadlineAt.localeCompare(b.market!.deadlineAt));
    }
    return shown.filter((card) => card.startup.industry === topic);
  }, [items, hidden, topic]);
  const lead = highlight && !hidden.has(highlight.id) && (topic === "all" || topic === highlight.startup.industry) ? highlight : null;

  // More videos as the end comes into view, while there are more to show.
  useEffect(() => {
    const element = end.current;
    if (!element || done) return;
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || loading.current) return;
      loading.current = true;
      const shown = [...items.map((card) => card.id), ...(highlight ? [highlight.id] : [])];
      const more = await moreVideos(shown, following).catch(() => []);
      const markets = new Set([highlight?.market?.id, ...items.map((card) => card.market?.id)].filter(Boolean));
      const fresh = more.filter((card) => card.id !== highlight?.id && !items.some((known) => known.id === card.id) && !(card.market && markets.has(card.market.id)));
      if (fresh.length) setItems((list) => [...list, ...fresh]);
      if (more.length < 8) setDone(true);
      loading.current = false;
    }, { rootMargin: "600px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [items, done, following, highlight]);

  const hide = (id: string) => setHidden((set) => new Set(set).add(id));
  const cards = visible.map((card, index) => (
    <GridCard key={card.id} card={card} now={now} signedIn={signedIn} index={index + (lead ? 1 : 0)} onHide={hide} />
  ));
  const shelf = topic === "all" && !following && closingSoon.length > 0 && (
    <section className="yt-shelf" aria-labelledby="shelf-title">
      <div className="yt-shelf-head">
        <h2 id="shelf-title">Closing soon</h2>
        <p>Markets whose trading ends first</p>
      </div>
      <div className="yt-shelf-row">{closingSoon.map((card) => <ShelfCard key={card.id} card={card} now={now} />)}</div>
      <Link className="btn btn-quiet yt-explore" href="/markets?sort=closing" prefetch={false}>Explore more</Link>
    </section>
  );

  return (
    <>
      <div className="yt-chips" role="toolbar" aria-label="Topics">
        <Link className="yt-chip yt-chip-icon" href="/markets" prefetch={false} aria-label="All markets"><Compass size={20} aria-hidden="true" /></Link>
        {following ? (
          <>
            <Link className="yt-chip" href="/" prefetch={false}>All</Link>
            <span className="yt-chip" aria-current="true">Following</span>
            {CHIPS.slice(1).map((chip) => <Link key={chip.key} className="yt-chip" href={`/?topic=${chip.key}`} prefetch={false}>{chip.label}</Link>)}
          </>
        ) : (
          <>
            <button type="button" className="yt-chip" aria-pressed={topic === "all"} onClick={() => pick("all")}>All</button>
            <Link className="yt-chip" href="/following" prefetch={false}>Following</Link>
            {CHIPS.slice(1).map((chip) => (
              <button key={chip.key} type="button" className="yt-chip" aria-pressed={topic === chip.key} onClick={() => pick(chip.key)}>{chip.label}</button>
            ))}
          </>
        )}
      </div>

      {!lead && visible.length === 0 ? empty : (
        <div className="yt-grid">
          {lead && <GridCard card={lead} now={now} signedIn={signedIn} highlight onHide={hide} />}
          {cards.slice(0, SHELF_AFTER - (lead ? 1 : 0))}
          {shelf}
          {cards.slice(SHELF_AFTER - (lead ? 1 : 0))}
        </div>
      )}
      {topic === "all" && !done && <div ref={end} className="yt-more-sentinel" aria-hidden="true" />}
    </>
  );
}
