import Link from "next/link";
import { cardTitle, initials, percent, timeLeft, changeLabel } from "@/modules/discovery/present";
import { industryLabel } from "@/modules/startups/labels";
import { statusLine } from "@/modules/events/status";
import { StartupThumb } from "../startup/thumb";
import { Sparkline, type SparkPoint } from "./sparkline";

/*
 * Market cards (2026-10-19, startup markets), in the language of the owner's
 * card screenshots and the existing Kalshi direction: the founder-and-startup
 * thumbnail on top, the industry and startup in small capitals, the market's
 * short question, the chance large in baby blue with three months of price
 * beside it, Yes and No with their prices, then Trade Coins traded, traders and
 * the close date. The whole card opens the market; the startup link and the
 * Yes/No buttons stay clickable on top. Demo markets say so.
 */

export type CardData = {
  id: string;
  question: string;
  /** The card's few words (2026-10-09); null shows the full question. */
  shortQuestion: string | null;
  milestoneKind: string | null;
  startupId: string;
  startupName: string;
  startupSlug: string;
  startupTagline: string;
  industry: string;
  glyph: string;
  hue: number;
  logoUrl: string | null;
  productFeatures: string[];
  thumbnailUrl: string | null;
  founderName: string | null;
  founderHandle: string | null;
  founderHue: number;
  founderPortraitUrl: string | null;
  founderRole: string | null;
  timeZone: string | null;
  isSample: boolean;
  yesPrice: number;
  hasPrice?: boolean;
  yesAskCents?: number | null;
  noAskCents?: number | null;
  tradingOpen: boolean;
  paused: boolean;
  status: string;
  ruledOutcome: "yes" | "no" | null;
  /** ISO strings: this crosses from server to client components. */
  deadlineAt: string;
  approvedAt: string;
  volumeMicro: number;
  traders: number;
  change24hBp: number;
  reason: "just added" | "closing soon" | "active" | "quiet";
  spark: SparkPoint[];
};

/** "Dec 31, 2027" in Eastern time, where every startup market's deadline is written. */
export function closeDate(card: Pick<CardData, "deadlineAt" | "timeZone">): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: card.timeZone ?? "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(card.deadlineAt));
}

/** "Closes Dec 31, 2027". Kept for lists that say so in words. */
export function closesAt(card: Pick<CardData, "deadlineAt" | "timeZone">): string {
  return `Closes ${closeDate(card)}`;
}

/** The small label on demonstration data (2026-10-19): fictional startups, people and numbers. */
export function SampleTag({ label = "Demo" }: { label?: string }) {
  return <span className="sample-tag" title="Fictional startup and market for illustration. No live exchange activity.">{label}</span>;
}

/**
 * A photo or initials: a circle for people, a small square for older venue
 * markets. Without a size, the stylesheet sets it, so it can change with the screen.
 */
export function Avatar({ name, photo = null, size, shape = "round" }: {
  name: string; photo?: string | null; size?: number; shape?: "round" | "square";
}) {
  const className = `avatar avatar-${shape}`;
  const style = size ? { width: size, height: size, fontSize: size * 0.38 } : undefined;
  if (photo) {
    return (
      // The name is always written beside it, so the image itself is decorative.
      // eslint-disable-next-line @next/next/no-img-element
      <img className={`${className} avatar-photo`} src={photo} alt="" width={size} height={size} loading="lazy" decoding="async" style={style} />
    );
  }
  return <span className={className} style={style} aria-hidden="true">{initials(name)}</span>;
}

/** Kept for older event markets' pages: a venue's initials in a small square. */
export function VenueMark({ name, size }: { name: string | null; size?: number }) {
  return <Avatar name={name ?? "Mitra"} size={size} shape="square" />;
}

/** A price change to one decimal. The arrow carries the direction; colour repeats it. */
export function Change({ bp, when }: { bp: number; when?: string }) {
  const { text, direction } = changeLabel(bp);
  const words = `${direction === "up" ? "Up" : direction === "down" ? "Down" : "No change,"} ${text} points${when ? ` ${when}` : ""}`;
  return (
    <span className={`change change-${direction}`}>
      <span aria-hidden="true">{direction === "up" ? "▲ " : direction === "down" ? "▼ " : ""}{text}</span>
      <span className="sr-only">{words}</span>
    </span>
  );
}

/** A gain or loss in Trade Coins to one decimal, as "+7.3" or "−1.6", with its colour. */
export function Gain({ micro }: { micro: number }) {
  const tenths = Math.round(micro / 100_000);
  if (tenths === 0) return <span className="gain gain-flat">0.0</span>;
  return (
    <span className={`gain gain-${tenths > 0 ? "up" : "down"}`}>
      {tenths > 0 ? "+" : "−"}{Math.abs(tenths / 10).toFixed(1)}
    </span>
  );
}

/** Yes and No with their prices, "YES · 42¢" as in the owner's screenshot; each opens the market with that side chosen. */
export function PriceButtons({ id, yesAskCents = null, noAskCents = null, size = "card", onOpen }: { id: string; yesPrice?: number; yesAskCents?: number | null; noAskCents?: number | null; size?: "card" | "large"; onOpen?: () => void }) {
  const yes = yesAskCents === null ? "No offer" : `${yesAskCents}¢`;
  const no = noAskCents === null ? "No offer" : `${noAskCents}¢`;
  return (
    <div className={`price-buttons price-buttons-${size}`}>
      <Link className="price-button price-yes" href={`/markets/${id}?side=yes`} prefetch={false} aria-label={`Choose Yes: ${yes}`} onClick={onOpen}>
        <span>Yes · {yes}</span>
      </Link>
      <Link className="price-button price-no" href={`/markets/${id}?side=no`} prefetch={false} aria-label={`Choose No: ${no}`} onClick={onOpen}>
        <span>No · {no}</span>
      </Link>
    </div>
  );
}

/** Trade Coins and traders in a few words: "1,284 Trade Coins traded · 27 traders", "demo Trade Coins" on demo markets. */
export function activityLine(card: Pick<CardData, "volumeMicro" | "traders"> & { isSample?: boolean }): string {
  const volume = `${Math.floor(card.volumeMicro / 1_000_000).toLocaleString()} contracts traded`;
  return card.traders > 0 ? `${volume} · ${card.traders.toLocaleString("en-US")} trader${card.traders === 1 ? "" : "s"}` : volume;
}

/**
 * `flash` marks a live price move, so the number pulses once in its direction.
 * `index` staggers the card's entrance on load (the Motion block in globals.css).
 */
export function MarketCard({ card, now, flash = null, index = 0 }: { card: CardData; now: Date; flash?: "up" | "down" | null; index?: number }) {
  const href = `/markets/${card.id}`;
  const yes = percent(card.yesPrice);
  const resolved = (card.status === "settled" || card.status === "ruled") && card.ruledOutcome;
  return (
    <article className="card rise" style={{ "--rise-i": Math.min(index, 8) } as React.CSSProperties}>
      <StartupThumb className="card-thumb"
        startup={{ name: card.startupName, tagline: card.startupTagline, glyph: card.glyph, hue: card.hue, logoUrl: card.logoUrl, productFeatures: card.productFeatures, thumbnailUrl: card.thumbnailUrl }}
        founder={card.founderName ? { name: card.founderName, portraitUrl: card.founderPortraitUrl, hue: card.founderHue, role: card.founderRole } : null}
        bar={false} />
      <div className="card-top">
        <span className="card-kicker">
          {industryLabel(card.industry)} &middot; <Link href={`/startups/${card.startupSlug}`} prefetch={false}>{card.startupName}</Link>
        </span>
        {card.isSample && <SampleTag />}
      </div>
      <Link className="card-title" href={href} title={card.shortQuestion ? card.question : undefined}>{cardTitle(card)}</Link>
      <div className="card-odds">
        {resolved ? (
          <div className="card-chance card-resolved">
            <strong className={`outcome-${card.ruledOutcome}`}>{card.ruledOutcome === "yes" ? "Yes" : "No"}</strong>
            <span>{card.status === "settled" ? "Resolved" : "Ruled, objections open"}</span>
          </div>
        ) : (
          <div className="card-chance">
            <strong key={card.yesPrice} className={flash ? `flash flash-${flash}` : undefined}>{card.hasPrice ? `${yes}%` : "—"}</strong>
            <span>Last trade{card.change24hBp !== 0 && <> <Change bp={card.change24hBp} when="today" /></>}</span>
          </div>
        )}
        <Sparkline points={card.spark} label={`${card.startupName}: chance of Yes over three months`} caption="3M" />
      </div>
      {card.tradingOpen ? <PriceButtons id={card.id} yesAskCents={card.yesAskCents} noAskCents={card.noAskCents} />
        : !resolved && <p className="card-status">{card.paused ? "Trading paused" : statusLine(card)}</p>}
      <p className="card-when">
        <span>{activityLine(card)}</span>
        <span className="card-left" title={card.tradingOpen ? timeLeft(new Date(card.deadlineAt), now) : undefined}>{closeDate(card)}</span>
      </p>
    </article>
  );
}

/** One row of the Closing soon list beside the featured market. */
export function ClosingRow({ card, now, flash = null }: { card: CardData; now: Date; flash?: "up" | "down" | null }) {
  return (
    <li>
      <Link className="closing-row" href={`/markets/${card.id}`}>
        <span className="startup-mark closing-mark" style={{ "--mark-hue": card.hue } as React.CSSProperties} aria-hidden="true">{initials(card.startupName)}</span>
        <span className="closing-text">
          <span className="closing-title">{cardTitle(card)}</span>
          <span className="closing-left">{timeLeft(new Date(card.deadlineAt), now)}{card.isSample && <> <SampleTag /></>}</span>
        </span>
        <span className="closing-value">
          <strong key={card.yesPrice} className={flash ? `flash flash-${flash}` : undefined}>{card.hasPrice ? `${percent(card.yesPrice)}%` : "—"}</strong>
          <Change bp={card.change24hBp} when="today" />
        </span>
      </Link>
    </li>
  );
}
