"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { Bookmark, EllipsisVertical, EyeOff, Flag, Link2 } from "lucide-react";
import { toggleSave } from "@/modules/social/actions";
import { cardTitle, initials, percent, timeLeft } from "@/modules/discovery/present";
import { duration } from "@/modules/startups/labels";
import { Change, closeDate, PriceButtons, SampleTag, type CardData } from "../market/market-card";
import { Sparkline } from "../market/sparkline";
import { FounderFace, StartupThumb } from "../startup/thumb";
import { VideoPlayer } from "../startup/video-player";
import { FollowButton } from "../social/follow-button";
import { ReportSheet } from "../social/report-sheet";
import { askToSignUp, toast } from "../feed/needs-account";
import { track } from "../feed/tracker";
import type { VideoCardData } from "../feed/video-data";

/*
 * One card of the home grid, copied from YouTube's (2026-10-20): the 16:9
 * thumbnail with the video's length in its corner; the founder's avatar beside
 * the title, which is the market's question; the startup and founder as the
 * channel; the chance, today's change and the price line; then Trade Coins
 * traded and the close date where YouTube puts views and age; a ⋮ menu. The
 * highlight (the market moving most today) takes YouTube's sponsored slot:
 * "Moving most today" in place of "Sponsored" and Yes/No pills under it, and
 * on a phone its video plays muted with captions, as YouTube's first video
 * does.
 */

const PHONE = "(max-width: 799px)";
function subscribe(callback: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
/** Whether the screen is phone-sized; false on the server, so the first paint is the still thumbnail. */
function usePhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);
}

/** "3 days ago", the way YouTube writes a video's age. */
function ago(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  const units: [number, string][] = [[525_600, "year"], [43_200, "month"], [10_080, "week"], [1_440, "day"], [60, "hour"], [1, "minute"]];
  for (const [size, name] of units) {
    const n = Math.floor(minutes / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

const short = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** YouTube's "21K views · 2 days ago", for a market: "308 traded · 14 months left". */
function traded(market: CardData): string {
  const coins = market.volumeMicro / 1_000_000;
  return coins >= 1 ? `${short.format(Math.floor(coins))} contracts traded` : coins > 0 ? "<1 contract traded" : "No trades yet";
}

function Odds({ market }: { market: CardData }) {
  const resolved = (market.status === "settled" || market.status === "ruled") && market.ruledOutcome;
  return (
    <div className="yt-odds">
      {resolved ? (
        <span className={`yt-chance outcome-${market.ruledOutcome}`}><strong>{market.ruledOutcome === "yes" ? "Yes" : "No"}</strong> {market.status === "settled" ? "resolved" : "ruled"}</span>
      ) : (
        <span className="yt-chance"><strong>{market.hasPrice ? `${percent(market.yesPrice)}%` : "—"}</strong> Last trade{market.change24hBp !== 0 && <> <Change bp={market.change24hBp} when="today" /></>}</span>
      )}
      <Sparkline points={market.spark} label={`${market.startupName}: chance of Yes over three months`} />
    </div>
  );
}

export function GridCard({ card, now, signedIn, highlight = false, index = 0, onHide }: {
  card: VideoCardData; now: Date; signedIn: boolean; highlight?: boolean; index?: number; onHide?: (id: string) => void;
}) {
  const { startup, founder, market } = card;
  const href = market ? `/markets/${market.id}` : `/startups/${startup.slug}`;
  const title = market ? cardTitle(market) : card.title;
  const phone = usePhone();
  const ref = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [saved, setSaved] = useState(card.viewer.saved);
  const [, start] = useTransition();

  // An impression once the card is half on screen, for the recommendation.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { track({ videoId: card.id, kind: "impression" }); observer.disconnect(); }
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [card.id]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [menu]);

  const open = () => track({ videoId: card.id, kind: "open_market" });

  function save() {
    setMenu(false);
    if (!signedIn) { askToSignUp(); return; }
    const next = !saved;
    setSaved(next);
    start(async () => {
      const result = await toggleSave(card.id, next);
      if (result.ok) toast(next ? "Saved to your portfolio" : "Removed from saved");
      else { setSaved(!next); if (result.code === "SIGNED_OUT") askToSignUp(); else toast(result.error); }
    });
  }

  async function share() {
    setMenu(false);
    const url = `${window.location.origin}/watch/${card.id}`;
    track({ videoId: card.id, kind: "share" });
    try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast(url); }
  }

  function notInterested() {
    setMenu(false);
    track({ videoId: card.id, kind: "not_interested" });
    onHide?.(card.id);
    toast("You'll see less like this");
  }

  const thumb = (
    <StartupThumb priority={index < 3} bar={false} imageUrl={card.thumbnailUrl}
      startup={startup} founder={founder ? { name: founder.name, portraitUrl: founder.portraitUrl, hue: founder.hue, role: founder.role } : null} />
  );
  const playing = highlight && phone;

  return (
    <article ref={ref} className={`yt-card rise${highlight ? " yt-card-highlight" : ""}`} style={{ "--rise-i": Math.min(index, 8) } as React.CSSProperties}>
      <div className="yt-media">
        {playing ? <VideoPlayer video={card} poster={thumb} active /> : (
          <Link className="yt-thumb" href={href} prefetch={false} onClick={open} tabIndex={-1} aria-hidden="true">
            {thumb}
            <span className="yt-duration">{duration(card.durationSeconds)}</span>
          </Link>
        )}
        {card.isDemo && !playing && <span className="yt-demo"><SampleTag /></span>}
      </div>
      <div className="yt-info">
        {founder ? (
          <Link className="yt-avatar" href={`/founders/${founder.handle}`} prefetch={false} aria-label={founder.name}><FounderFace founder={founder} size={36} /></Link>
        ) : (
          <Link className="yt-avatar startup-mark" href={`/startups/${startup.slug}`} prefetch={false} aria-label={startup.name}
            style={{ "--mark-hue": startup.hue } as React.CSSProperties}>{initials(startup.name)}</Link>
        )}
        <div className="yt-text">
          <h3 className="yt-title">
            <Link href={href} prefetch={false} onClick={open} title={market?.shortQuestion ? market.question : undefined}>{title}</Link>
          </h3>
          {highlight && phone && <p className="yt-desc">{card.title}. {card.description}</p>}
          <p className="yt-channel">
            <Link href={`/startups/${startup.slug}`} prefetch={false}>{startup.name}</Link>
            {founder && <><span aria-hidden="true"> · </span><Link href={`/founders/${founder.handle}`} prefetch={false}>{founder.name}</Link></>}
          </p>
          {market && <Odds market={market} />}
          <p className="yt-stats">
            {highlight && <><strong>Moving most today</strong><span aria-hidden="true"> · </span></>}
            {market ? <>{traded(market)}{!highlight && <><span aria-hidden="true"> · </span>
              <span title={`Closes ${closeDate(market)}`}>{market.tradingOpen ? timeLeft(new Date(market.deadlineAt), now) : market.paused ? "trading paused" : "trading closed"}</span></>}</>
              : ago(card.publishedAt, now)}
          </p>
        </div>
        <div className="yt-more" ref={menuRef}>
          <button type="button" className="icon-button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label="More actions">
            <EllipsisVertical size={20} aria-hidden="true" />
          </button>
          {menu && (
            <div className="menu" role="menu">
              <button type="button" role="menuitem" onClick={save}><Bookmark size={16} aria-hidden="true" fill={saved ? "currentColor" : "none"} />{saved ? "Remove from saved" : "Save video"}</button>
              <div className="menu-follow" role="none"><FollowButton kind="startup" id={startup.id} initial={card.viewer.followsStartup} signedIn={signedIn} videoId={card.id} label={`Follow ${startup.name}`} /></div>
              <button type="button" role="menuitem" onClick={notInterested}><EyeOff size={16} aria-hidden="true" />Not interested</button>
              <button type="button" role="menuitem" onClick={() => void share()}><Link2 size={16} aria-hidden="true" />Copy link</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setReport(true); }}><Flag size={16} aria-hidden="true" />Report</button>
            </div>
          )}
        </div>
      </div>
      {market?.tradingOpen && (
        <div className="yt-pills"><PriceButtons id={market.id} yesAskCents={market.yesAskCents} noAskCents={market.noAskCents} size="large" onOpen={open} /></div>
      )}
      <ReportSheet open={report} onClose={() => setReport(false)} target="video" targetId={card.id} what="this video" signedIn={signedIn} />
    </article>
  );
}

/** A market on the Closing soon shelf: YouTube's shelf card, with time left where the length goes. */
export function ShelfCard({ card, now }: { card: CardData; now: Date }) {
  const href = `/markets/${card.id}`;
  return (
    <article className="yt-shelf-card">
      <Link className="yt-thumb" href={href} prefetch={false} tabIndex={-1} aria-hidden="true">
        <StartupThumb bar={false}
          startup={{ name: card.startupName, tagline: card.startupTagline, glyph: card.glyph, hue: card.hue, logoUrl: card.logoUrl, productFeatures: card.productFeatures, thumbnailUrl: card.thumbnailUrl }}
          founder={card.founderName ? { name: card.founderName, portraitUrl: card.founderPortraitUrl, hue: card.founderHue, role: card.founderRole } : null} />
        <span className="yt-duration">{timeLeft(new Date(card.deadlineAt), now)}</span>
      </Link>
      <h3 className="yt-title"><Link href={href} prefetch={false} title={card.shortQuestion ? card.question : undefined}>{cardTitle(card)}</Link></h3>
      <p className="yt-channel">{card.startupName}{card.isSample && <> <SampleTag /></>}</p>
      <Odds market={card} />
      {card.tradingOpen && <PriceButtons id={card.id} yesAskCents={card.yesAskCents} noAskCents={card.noAskCents} />}
    </article>
  );
}
