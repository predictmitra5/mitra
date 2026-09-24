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
 * Thumbnails are generated art per goal type, carrying the person's profile
 * photo since 2026-09-24, when photos became required to post a goal. Goals in
 * the person's own words ("bet on literally anything") get one of several art
 * variants chosen from the goal id, so a feed of them is not one grey wall.
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

/** Art direction per goal type. Decorative, not data, so not bound by the chart palette. */
const ART: Record<string, string> = {
  gpa: "art-gpa",
  club: "art-club",
  internship: "art-internship",
  gym: "art-gym",
  launch: "art-launch",
};

/** Art for goals outside the templates, picked steadily from the goal id. */
const ANYTHING_ART = ["art-any-0", "art-any-1", "art-any-2", "art-any-3", "art-any-4"];

function artFor(goalType: string | null, seed: string | undefined): string {
  if (goalType && ART[goalType]) return ART[goalType];
  if (!seed) return "art-goal";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return ANYTHING_ART[hash % ANYTHING_ART.length];
}

export function Thumbnail({
  goalType, question, displayName, deadlineAt, tradingOpen, now, size = "card", photo = null, seed,
}: {
  goalType: string | null;
  question: string;
  displayName: string;
  deadlineAt: string;
  tradingOpen: boolean;
  now: Date;
  size?: "card" | "hero";
  photo?: string | null;
  /** The goal id, to vary the art for goals in the person's own words. */
  seed?: string;
}) {
  const art = artFor(goalType, seed);
  const stake = thumbnailText(goalType, question, displayName);
  return (
    <div className={`thumb ${art} thumb-${size}`}>
      <span className="thumb-pattern" aria-hidden="true" />
      <span className="thumb-chip">{categoryLabel(goalType)}</span>
      <span className="thumb-stake">{stake}</span>
      {photo
        // Already a 512-pixel WebP from the app's own route; next/image would only re-process it.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="thumb-face" src={photo} alt="" loading="lazy" decoding="async" />
        : <span className="thumb-who" aria-hidden="true">{initials(displayName)}</span>}
      <span className="thumb-badge">{tradingOpen ? closesIn(new Date(deadlineAt), now) : "Closed"}</span>
    </div>
  );
}

export function Avatar({ name, photo = null, size = 36 }: { name: string; photo?: string | null; size?: number }) {
  if (photo) {
    return (
      // The name is always written beside it, so the image itself is decorative.
      // eslint-disable-next-line @next/next/no-img-element
      <img className="avatar avatar-photo" src={photo} alt="" width={size} height={size} loading="lazy" decoding="async" style={{ width: size, height: size }} />
    );
  }
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

/** `flash` marks a live price move, so the number pulses once in its direction. */
export function GoalCard({ card, now, flash = null }: { card: CardData; now: Date; flash?: "up" | "down" | null }) {
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
          photo={card.photo}
          seed={card.id}
        />
      </Link>
      <div className="gcard-body">
        <Avatar name={card.displayName} photo={card.photo} />
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
          <span className="gcard-chance"><strong key={card.yesPrice} className={flash ? `flash flash-${flash}` : undefined}>{percent(card.yesPrice)}%</strong> chance</span>
          <Change bp={card.change24hBp} />
        </div>
        <ProbabilityBar yesPrice={card.yesPrice} />
        <PricePills yesPrice={card.yesPrice} href={href} compact />
      </div>
    </article>
  );
}

/** One line of the sidebar rundown, like Kalshi's Trending list. */
export function RundownRow({ card, now, show, flash = null }: { card: CardData; now: Date; show: "deadline" | "change"; flash?: "up" | "down" | null }) {
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
          <strong key={card.yesPrice} className={flash ? `flash flash-${flash}` : undefined}>{percent(card.yesPrice)}%</strong>
          <Change bp={card.change24hBp} />
        </span>
      </Link>
    </li>
  );
}
