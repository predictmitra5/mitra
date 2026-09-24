import Link from "next/link";
import { cardTitle, categoryLabel, changeLabel, initials, percent, timeLeft } from "@/modules/discovery/present";

/*
 * Goal cards in the Kalshi direction, decided 2026-09-24 (DECISIONS.md and
 * docs/DESIGN.md section 9). A framed card: the person's photo as a small
 * square, the category and name, the question, the chance large on the right,
 * today's change and time left, and Yes and No with their prices. Flat: no
 * thumbnails, gradients or stickers.
 */

export type CardData = {
  id: string;
  question: string;
  goalType: string | null;
  displayName: string;
  handle: string;
  /** Their profile photo's URL, or null to fall back to initials. */
  photo: string | null;
  yesPrice: number;
  tradingOpen: boolean;
  /** ISO strings: this crosses from server to client components. */
  deadlineAt: string;
  approvedAt: string;
  volumeMicro: number;
  change24hBp: number;
  reason: "just added" | "closing soon" | "active" | "quiet";
};

/**
 * A person's photo: a small square beside goals, a circle for the viewer.
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

/** Yes and No with their prices, in words; each opens the goal with that side chosen. */
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

/** `flash` marks a live price move, so the number pulses once in its direction. */
export function GoalCard({ card, now, flash = null }: { card: CardData; now: Date; flash?: "up" | "down" | null }) {
  const href = `/markets/${card.id}`;
  return (
    <article className="card">
      <div className="card-top">
        <Avatar name={card.displayName} photo={card.photo} size={40} shape="square" />
        <div className="card-head">
          <span className="card-kicker">{categoryLabel(card.goalType)} &middot; {card.displayName}</span>
          <Link className="card-title" href={href} prefetch={false}>{cardTitle(card.goalType, card.question)}</Link>
        </div>
        <div className="card-chance">
          <strong key={card.yesPrice} className={flash ? `flash flash-${flash}` : undefined}>{percent(card.yesPrice)}%</strong>
          <span>chance</span>
        </div>
      </div>
      <p className="card-meta">
        <Change bp={card.change24hBp} when="today" />
        <span aria-hidden="true">today</span>
        <span className="card-left">{card.tradingOpen ? timeLeft(new Date(card.deadlineAt), now) : "Trading closed"}</span>
      </p>
      <PriceButtons id={card.id} yesPrice={card.yesPrice} />
    </article>
  );
}

/** One row of the Closing soon list beside the featured goal. */
export function ClosingRow({ card, now, flash = null }: { card: CardData; now: Date; flash?: "up" | "down" | null }) {
  return (
    <li>
      <Link className="closing-row" href={`/markets/${card.id}`} prefetch={false}>
        <Avatar name={card.displayName} photo={card.photo} size={32} shape="square" />
        <span className="closing-text">
          <span className="closing-title">{cardTitle(card.goalType, card.question)}</span>
          <span className="closing-left">{timeLeft(new Date(card.deadlineAt), now)}</span>
        </span>
        <span className="closing-value">
          <strong key={card.yesPrice} className={flash ? `flash flash-${flash}` : undefined}>{percent(card.yesPrice)}%</strong>
          <Change bp={card.change24hBp} when="today" />
        </span>
      </Link>
    </li>
  );
}
