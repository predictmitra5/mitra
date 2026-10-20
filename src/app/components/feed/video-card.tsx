"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, EyeOff, Flag, Heart, Link2, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";
import { toggleLike, toggleSave } from "@/modules/social/actions";
import { cardTitle, percent } from "@/modules/discovery/present";
import { hashtags, industryLabel } from "@/modules/startups/labels";
import { activityLine, closeDate, PriceButtons, SampleTag } from "../market/market-card";
import { Sparkline } from "../market/sparkline";
import { FounderFace, StartupThumb } from "../startup/thumb";
import { VideoPlayer } from "../startup/video-player";
import { FollowButton } from "../social/follow-button";
import { CommentSheet } from "../social/comments";
import { ReportSheet } from "../social/report-sheet";
import { askToSignUp, toast } from "./needs-account";
import { track } from "./tracker";
import type { VideoCardData } from "./video-data";

/*
 * One card of the video feed (2026-10-19), as close to the owner's two
 * screenshots as they fit together: the founder-and-startup video on top with
 * Save in its corner; the founder's handle, company and Follow with Share
 * beside them; the startup's headline, the founder's line and hashtags; then
 * "Featured prediction" with View market, the question, the Yes probability
 * large in baby blue beside three months of price, Yes and No with their
 * prices, Trade Coins traded and the close date. Like, comment, share, save and
 * more (follow startup, not interested, report) sit in a rail beside the
 * video, as on TikTok and YouTube Shorts.
 */

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function VideoCard({ card, active, signedIn, onHide, priority = false }: {
  card: VideoCardData; active: boolean; signedIn: boolean; onHide: (id: string) => void; priority?: boolean;
}) {
  const [liked, setLiked] = useState(card.viewer.liked);
  const [likes, setLikes] = useState(card.counts.likes);
  const [saved, setSaved] = useState(card.viewer.saved);
  const [saves, setSaves] = useState(card.counts.saves);
  const [comments, setComments] = useState(card.counts.comments);
  const [sheet, setSheet] = useState<"comments" | "report" | null>(null);
  const [menu, setMenu] = useState(false);
  const [, start] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const { startup, founder, market } = card;

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [menu]);

  function like() {
    if (!signedIn) { askToSignUp(); return; }
    const next = !liked;
    setLiked(next); setLikes((n) => n + (next ? 1 : -1));
    start(async () => {
      const result = await toggleLike(card.id, next);
      if (result.ok) setLikes(result.value.count);
      else { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); if (result.code === "SIGNED_OUT") askToSignUp(); else toast(result.error); }
    });
  }

  function save() {
    if (!signedIn) { askToSignUp(); return; }
    const next = !saved;
    setSaved(next); setSaves((n) => n + (next ? 1 : -1));
    start(async () => {
      const result = await toggleSave(card.id, next);
      if (result.ok) { setSaves(result.value.count); toast(next ? "Saved to your portfolio" : "Removed from saved"); }
      else { setSaved(!next); setSaves((n) => n + (next ? -1 : 1)); if (result.code === "SIGNED_OUT") askToSignUp(); else toast(result.error); }
    });
  }

  async function share() {
    const url = `${window.location.origin}/watch/${card.id}`;
    track({ videoId: card.id, kind: "share" });
    try {
      if (navigator.share) { await navigator.share({ title: `${startup.name} on Mitra`, text: card.title, url }); return; }
    } catch { /* fall through to copying */ }
    try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast(url); }
  }

  function notInterested() {
    setMenu(false);
    track({ videoId: card.id, kind: "not_interested" });
    onHide(card.id);
  }

  const tags = hashtags(startup.industry, startup.tags);
  const thumb = (
    <StartupThumb priority={priority} startup={startup} founder={founder ? { name: founder.name, portraitUrl: founder.portraitUrl, hue: founder.hue, role: founder.role } : null}
      imageUrl={card.thumbnailUrl} durationSeconds={card.durationSeconds} label={card.kind === "demo" ? "Product demo" : card.kind === "update" ? "Progress update" : "Founder video"} />
  );

  return (
    <article className="vcard" data-video-id={card.id} aria-label={`${startup.name}: ${card.title}`}>
      <div className="vcard-main">
        <div className="vcard-media">
          <VideoPlayer video={card} poster={thumb} active={active} />
          <button type="button" className={`vcard-save${saved ? " is-on" : ""}`} onClick={save} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save video"} data-needs-account={signedIn ? undefined : true}>
            <Bookmark size={20} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="vcard-body">
          <div className="vcard-founder">
            {founder ? (
              <Link href={`/founders/${founder.handle}`} prefetch={false} className="vcard-face" aria-label={founder.name}>
                <FounderFace founder={founder} size={40} />
              </Link>
            ) : null}
            <div className="vcard-who">
              {founder ? <Link className="vcard-handle" href={`/founders/${founder.handle}`} prefetch={false}>@{founder.handle}</Link>
                : <Link className="vcard-handle" href={`/startups/${startup.slug}`} prefetch={false}>{startup.name}</Link>}
              <span className="vcard-role">
                {founder ? <>Founder of <Link href={`/startups/${startup.slug}`} prefetch={false}>{startup.name}</Link></> : startup.tagline}
                <span aria-hidden="true"> · </span>{industryLabel(startup.industry)}
              </span>
            </div>
            {founder && <FollowButton kind="founder" id={founder.id} initial={card.viewer.followsFounder} signedIn={signedIn} videoId={card.id} />}
            <button type="button" className="icon-button vcard-share" onClick={share} aria-label="Share"><Share2 size={18} aria-hidden="true" /></button>
          </div>

          <h2 className="vcard-title"><Link href={`/startups/${startup.slug}`} prefetch={false}>{startup.headline}</Link></h2>
          <p className="vcard-desc">{founder?.bio ?? card.description}</p>
          <p className="vcard-tags">
            {tags.map((tag) => <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} prefetch={false}>#{tag}</Link>)}
            {card.isDemo && <SampleTag />}
          </p>

          {market && (
            <section className="vcard-market" aria-label="Featured prediction">
              <div className="vcard-market-head">
                <span className="eyebrow">Featured prediction</span>
                <Link href={`/markets/${market.id}`} prefetch={false} onClick={() => track({ videoId: card.id, kind: "open_market" })}>View market <span aria-hidden="true">↗︎</span></Link>
              </div>
              <Link className="vcard-question" href={`/markets/${market.id}`} prefetch={false} onClick={() => track({ videoId: card.id, kind: "open_market" })}
                title={market.shortQuestion ? market.question : undefined}>{cardTitle(market)}</Link>
              <div className="vcard-odds">
                <div className="vcard-chance"><strong>{percent(market.yesPrice)}%</strong><span>YES probability</span></div>
                <Sparkline points={market.spark} label={`Chance of Yes over three months for ${startup.name}`} caption="3M price history" />
              </div>
              {market.tradingOpen ? <PriceButtons id={market.id} yesPrice={market.yesPrice} onOpen={() => track({ videoId: card.id, kind: "open_market" })} />
                : <p className="card-status">{market.paused ? "Trading paused" : "Trading closed"}</p>}
              <p className="vcard-meta"><span>{activityLine(market)}</span><span>{closeDate(market)}</span></p>
            </section>
          )}
        </div>
      </div>

      <div className="vcard-rail" aria-label="Actions">
        <button type="button" className={`rail-button${liked ? " is-liked" : ""}`} onClick={like} aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} data-needs-account={signedIn ? undefined : true}>
          <span className="rail-icon"><Heart size={22} aria-hidden="true" fill={liked ? "currentColor" : "none"} /></span><span>{compact.format(likes)}</span>
        </button>
        <button type="button" className="rail-button" onClick={() => setSheet("comments")} aria-label={`Comments, ${comments}`}>
          <span className="rail-icon"><MessageCircle size={22} aria-hidden="true" /></span><span>{compact.format(comments)}</span>
        </button>
        <button type="button" className="rail-button" onClick={share} aria-label="Share">
          <span className="rail-icon"><Share2 size={22} aria-hidden="true" /></span><span>Share</span>
        </button>
        <button type="button" className={`rail-button${saved ? " is-saved" : ""}`} onClick={save} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save"} data-needs-account={signedIn ? undefined : true}>
          <span className="rail-icon"><Bookmark size={22} aria-hidden="true" fill={saved ? "currentColor" : "none"} /></span><span>{compact.format(saves)}</span>
        </button>
        <div className="rail-more" ref={menuRef}>
          <button type="button" className="rail-button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label="More">
            <span className="rail-icon"><MoreHorizontal size={22} aria-hidden="true" /></span>
          </button>
          {menu && (
            <div className="menu" role="menu">
              <div className="menu-follow" role="none"><FollowButton kind="startup" id={startup.id} initial={card.viewer.followsStartup} signedIn={signedIn} videoId={card.id} label={`Follow ${startup.name}`} /></div>
              <button type="button" role="menuitem" onClick={notInterested}><EyeOff size={16} aria-hidden="true" />Not interested</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); void share(); }}><Link2 size={16} aria-hidden="true" />Copy link</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setSheet("report"); }}><Flag size={16} aria-hidden="true" />Report</button>
            </div>
          )}
        </div>
      </div>

      <CommentSheet open={sheet === "comments"} onClose={() => setSheet(null)} videoId={card.id} title={startup.name} signedIn={signedIn} onCount={(d) => setComments((n) => n + d)} />
      <ReportSheet open={sheet === "report"} onClose={() => setSheet(null)} target="video" targetId={card.id} what="this video" signedIn={signedIn} />
    </article>
  );
}
