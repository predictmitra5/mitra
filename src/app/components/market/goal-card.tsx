import Link from "next/link";
import {
  ago,
  cardTitle,
  categoryLabel,
  changeLabel,
  closesIn,
  initials,
  percent,
  thumbnailText,
  volumeLabel,
} from "@/modules/discovery/present";

/*
 * The goal card, decided 2026-09-22 with the market UI redesign (DESIGN.md).
 *
 * Read top to bottom it borrows from three places:
 * - YouTube: a 16:9 thumbnail carrying a few bold words, a corner badge for
 *   time, then an avatar beside a two-line title and a meta line.
 * - GoFundMe: the person named up front, and one bar read at a glance. Here the
 *   bar is the chance of YES rather than money raised.
 * - Kalshi: the price as the number that matters, YES and NO side by side,
 *   volume, and how far the price moved today.
 *
 * Thumbnails are generated from the goal type rather than photographs. Photos
 * would be pictures of real students, which is the profile picture question the
 * owner deferred. The component takes an image when that is decided.
 */

export type CardData = {
  id: string;
  question: string;
  goalType: string | null;
  displayName: string;
  handle: string;
  yesPrice: number;
  tradingOpen: boolean;
  /** ISO strings: this crosses from server to client components. */
  deadlineAt: string;
  approvedAt: string;
  volumeMicro: number;
  change24hBp: number;
  reason: "just added" | "closing soon" | "active" | "quiet";
};

/** Art direction per goal type. Decorative, not data, so not bound by the chart palette. */
const ART: Record<string, string> = {
  gpa: "art-gpa",
  club: "art-club",
  internship: "art-internship",
  gym: "art-gym",
  launch: "art-launch",
};

export function Thumbnail({
  goalType, question, displayName, deadlineAt, tradingOpen, now, size = "card",
}: {
  goalType: string | null;
  question: string;
  displayName: string;
  deadlineAt: string;
  tradingOpen: boolean;
  now: Date;
  size?: "card" | "hero";
}) {
  const art = ART[goalType ?? ""] ?? "art-goal";
  const stake = thumbnailText(goalType, question, displayName);
  return (
    <div className={`thumb ${art} thumb-${size}`}>
      <span className="thumb-pattern" aria-hidden="true" />
      <span className="thumb-chip">{categoryLabel(goalType)}</span>
      <span className="thumb-stake">{stake}</span>
      <span className="thumb-who" aria-hidden="true">{initials(displayName)}</span>
      <span className="thumb-badge">{tradingOpen ? closesIn(new Date(deadlineAt), now) : "Closed"}</span>
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Change({ bp }: { bp: number }) {
  const { text, direction } = changeLabel(bp);
  if (direction === "flat") return <span className="change change-flat" aria-label="No change today">&mdash;</span>;
  return (
    <span className={`change change-${direction}`} aria-label={`${direction === "up" ? "Up" : "Down"} ${text} points today`}>
      <span aria-hidden="true">{direction === "up" ? "▲" : "▼"}</span> {text}
    </span>
  );
}

/** YES against NO as one bar: GoFundMe's progress bar, read as a probability. */
export function ProbabilityBar({ yesPrice }: { yesPrice: number }) {
  const yes = percent(yesPrice);
  return (
    <div className="pbar" role="img" aria-label={`${yes} percent chance of YES, ${100 - yes} percent NO`}>
      <span className="pbar-yes" style={{ width: `${yes}%` }} />
      <span className="pbar-no" />
    </div>
  );
}

export function PricePills({ yesPrice, href, compact = false }: { yesPrice: number; href: string; compact?: boolean }) {
  const yes = percent(yesPrice);
  return (
    <div className={`pills${compact ? " pills-compact" : ""}`}>
      <Link className="pill pill-yes" href={href} prefetch={false}>
        <span className="pill-key" aria-hidden="true" />
        <span className="pill-side">Yes</span>
        <strong>{yes}%</strong>
      </Link>
      <Link className="pill pill-no" href={href} prefetch={false}>
        <span className="pill-key" aria-hidden="true" />
        <span className="pill-side">No</span>
        <strong>{100 - yes}%</strong>
      </Link>
    </div>
  );
}

export function GoalCard({ card, now }: { card: CardData; now: Date }) {
  const href = `/markets/${card.id}`;
  const title = cardTitle(card.goalType, card.question);
  return (
    <article className="gcard">
      <Link className="gcard-thumb" href={href} prefetch={false} aria-label={title}>
        <Thumbnail
          goalType={card.goalType}
          question={card.question}
          displayName={card.displayName}
          deadlineAt={card.deadlineAt}
          tradingOpen={card.tradingOpen}
          now={now}
        />
      </Link>
      <div className="gcard-body">
        <Avatar name={card.displayName} />
        <div className="gcard-text">
          <Link className="gcard-title" href={href} prefetch={false}>{title}</Link>
          <p className="gcard-meta">
            <span>{card.displayName}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{volumeLabel(card.volumeMicro)}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{ago(new Date(card.approvedAt), now)}</span>
          </p>
        </div>
      </div>
      <div className="gcard-market">
        <div className="gcard-odds">
          <span className="gcard-chance"><strong>{percent(card.yesPrice)}%</strong> chance</span>
          <Change bp={card.change24hBp} />
        </div>
        <ProbabilityBar yesPrice={card.yesPrice} />
        <PricePills yesPrice={card.yesPrice} href={href} compact />
      </div>
    </article>
  );
}

/** One line of the sidebar rundown, like Kalshi's Trending list. */
export function RundownRow({ card, now, show }: { card: CardData; now: Date; show: "deadline" | "change" }) {
  return (
    <li>
      <Link className="rundown-row" href={`/markets/${card.id}`} prefetch={false}>
        <span className="rundown-text">
          <span className="rundown-title">{cardTitle(card.goalType, card.question)}</span>
          <span className="rundown-sub">
            {card.displayName} &middot; {show === "deadline" ? closesIn(new Date(card.deadlineAt), now) : categoryLabel(card.goalType)}
          </span>
        </span>
        <span className="rundown-value">
          <strong>{percent(card.yesPrice)}%</strong>
          <Change bp={card.change24hBp} />
        </span>
      </Link>
    </li>
  );
}
