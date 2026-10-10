import Link from "next/link";
import { cardTitle, categoryLabel, initials, percent, timeLeft, changeLabel, volumeLabel } from "@/modules/discovery/present";
import { statusLine } from "@/modules/events/status";

/*
 * Market cards in the Kalshi direction (2026-09-24), moved from people's goals
 * to campus events on 2026-10-08 (DECISIONS.md): the venue's mark as a small
 * square, the category and venue, the question, the chance large on the right,
 * today's change, points traded and the closing time, and Yes and No with
 * their prices. A sample market says so beside its venue. Flat: no thumbnails,
 * gradients or stickers.
 *
 * Since 2026-10-09 (DESIGN.md section 14), after XO Market and Kalshi: the card
 * shows the market's short title, the category and venue sit above it in small
 * capitals, and the whole card opens the market (the title's link is stretched
 * over it; the venue link and the Yes/No buttons stay clickable on top).
 */

export type CardData = {
  id: string;
  question: string;
  /** The card's few words (2026-10-09); null shows the full question. */
  shortQuestion: string | null;
  category: string | null;
  venueName: string | null;
  venueSlug: string | null;
  eventTitle: string | null;
  isSample: boolean;
  yesPrice: number;
  tradingOpen: boolean;
  status: string;
  ruledOutcome: "yes" | "no" | null;
  /** ISO strings: this crosses from server to client components. */
  deadlineAt: string;
  windowStartAt: string | null;
  timeZone: string | null;
  approvedAt: string;
  volumeMicro: number;
  change24hBp: number;
  reason: "just added" | "closing soon" | "active" | "quiet";
};

/** "Closes Oct 16, 9:00 PM" in the market's own zone. */
export function closesAt(card: Pick<CardData, "deadlineAt" | "timeZone">): string {
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: card.timeZone ?? "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(card.deadlineAt));
  return `Closes ${text}`;
}

/** The small "Sample" label on hypothetical demonstration markets. */
export function SampleTag() {
  return <span className="sample-tag" title="A hypothetical demonstration market. Not verified by the venue.">Sample</span>;
}

/** The venue's mark: its initials in a small square, beside its markets. */
export function VenueMark({ name, size }: { name: string | null; size?: number }) {
  return <Avatar name={name ?? "Mitra"} size={size} shape="square" />;
}

/**
 * A photo or initials: a small square beside a venue's markets, a circle for the viewer.
 * Without a size, the stylesheet sets it, so it can change with the screen.
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

/** A gain or loss in points to one decimal, as "+7.3" or "−1.6", with its colour. */
export function Gain({ micro }: { micro: number }) {
  const tenths = Math.round(micro / 100_000);
  if (tenths === 0) return <span className="gain gain-flat">0.0</span>;
  return (
    <span className={`gain gain-${tenths > 0 ? "up" : "down"}`}>
      {tenths > 0 ? "+" : "−"}{Math.abs(tenths / 10).toFixed(1)}
    </span>
  );
}

/** Yes and No with their prices, in words; each opens the market with that side chosen. */
export function PriceButtons({ id, yesPrice, size = "card" }: { id: string; yesPrice: number; size?: "card" | "large" }) {
  const yes = percent(yesPrice);
  return (
    <div className={`price-buttons price-buttons-${size}`}>
      <Link className="price-button price-yes" href={`/markets/${id}?side=yes`} prefetch={false} aria-label={`Yes, ${yes}¢`}>
        <span>Yes</span><span>{yes}¢</span>
      </Link>
      <Link className="price-button price-no" href={`/markets/${id}?side=no`} prefetch={false} aria-label={`No, ${100 - yes}¢`}>
        <span>No</span><span>{100 - yes}¢</span>
      </Link>
    </div>
  );
}

/**
 * `flash` marks a live price move, so the number pulses once in its direction.
 * `index` staggers the card's entrance on load (the Motion block in globals.css).
 *
 * The title link is prefetched up to the market page's loading screen only
 * (markets/[id]/loading.tsx), which runs none of the page and records no click,
 * so the skeleton appears the moment the card is tapped.
 */
export function MarketCard({ card, now, flash = null, index = 0 }: { card: CardData; now: Date; flash?: "up" | "down" | null; index?: number }) {
  const href = `/markets/${card.id}`;
  return (
    <article className="card rise" style={{ "--rise-i": Math.min(index, 8) } as React.CSSProperties}>
      <div className="card-top">
        <VenueMark name={card.venueName} size={32} />
        <span className="card-kicker">
          {categoryLabel(card.category)}
          {card.venueName && <> &middot; {card.venueSlug ? <Link href={`/venues/${card.venueSlug}`} prefetch={false}>{card.venueName}</Link> : card.venueName}</>}
        </span>
        {card.isSample && <SampleTag />}
      </div>
      <div className="card-main">
        <Link className="card-title" href={href} title={card.shortQuestion ? card.question : undefined}>{cardTitle(card)}</Link>
        <div className="card-chance">
          <strong key={card.yesPrice} className={flash ? `flash flash-${flash}` : undefined}>{percent(card.yesPrice)}%</strong>
          <span>chance</span>
        </div>
      </div>
      <p className="card-meta">
        <Change bp={card.change24hBp} when="today" />
        <span aria-hidden="true">today</span>
        <span aria-hidden="true">&middot;</span>
        <span>{volumeLabel(card.volumeMicro)}</span>
      </p>
      {card.tradingOpen && <PriceButtons id={card.id} yesPrice={card.yesPrice} />}
      <p className="card-when">
        {card.tradingOpen
          ? <><span>{closesAt(card)}</span><span className="card-left">{timeLeft(new Date(card.deadlineAt), now)}</span></>
          : <span className="card-status">{statusLine(card)}</span>}
      </p>
    </article>
  );
}

/** One row of the Closing soon list beside the featured market. */
export function ClosingRow({ card, now, flash = null }: { card: CardData; now: Date; flash?: "up" | "down" | null }) {
  return (
    <li>
      <Link className="closing-row" href={`/markets/${card.id}`}>
        <VenueMark name={card.venueName} size={34} />
        <span className="closing-text">
          <span className="closing-title">{cardTitle(card)}</span>
          <span className="closing-left">{timeLeft(new Date(card.deadlineAt), now)}{card.isSample && <> <SampleTag /></>}</span>
        </span>
        <span className="closing-value">
          <strong key={card.yesPrice} className={flash ? `flash flash-${flash}` : undefined}>{percent(card.yesPrice)}%</strong>
          <Change bp={card.change24hBp} when="today" />
        </span>
      </Link>
    </li>
  );
}
