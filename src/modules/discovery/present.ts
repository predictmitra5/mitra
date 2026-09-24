/*
 * Presentation helpers for goal cards, decided 2026-09-22 with the market UI
 * redesign (docs/DESIGN.md). Pure functions only, so every one is testable and
 * the server and browser render the same text.
 *
 * The card borrows its structure from three places:
 * - YouTube: a large thumbnail carrying short, bold text, then avatar, title, meta.
 * - GoFundMe: the person named up front, and a single bar you read at a glance.
 * - Kalshi: the price as the headline number, volume, and the day's change.
 */

export type GoalType = "gpa" | "club" | "internship" | "gym" | "launch" | "own_words" | "other";

/** Short category names for a card's corner chip. */
const CATEGORY: Record<string, string> = {
  gpa: "Grades",
  club: "Clubs",
  internship: "Internships",
  gym: "Gym",
  launch: "Launches",
  own_words: "Goal",
  other: "Goal",
};

export function categoryLabel(goalType: string | null): string {
  return CATEGORY[goalType ?? "other"] ?? "Goal";
}

const THUMBNAIL_MAX = 34;

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * The big text on a thumbnail: the stake, in as few words as possible, the way
 * a YouTube thumbnail says "BOTH SOLD?" rather than the video's full title.
 * Derived from the template wording, which is fixed per goal type. Anything that
 * does not match falls back to a trimmed version of the question itself.
 */
export function thumbnailText(goalType: string | null, question: string, displayName?: string): string {
  const q = question.trim();
  // "Will <name> …" with the name stripped exactly, when it is known. Shape alone
  // cannot tell a two-word name ("Sam Lee launch") from a name and a verb ("Sam launch").
  const named = displayName && q.toLowerCase().startsWith(`will ${displayName.toLowerCase()} `)
    ? q.slice(`will ${displayName} `.length)
    : null;
  // The gym template is "Will <name> <achievement> by <date>?", so with the name
  // known the achievement is exact. The verb pattern below guessed the name's
  // length and took a surname as part of the lift ("Rivera bench press").
  if (goalType === "gym" && named) {
    const achievement = named.replace(/ by [^?]+\?$/i, "");
    if (achievement && achievement !== named) return clip(titleCase(achievement), THUMBNAIL_MAX);
  }
  const patterns: Record<string, RegExp> = {
    gpa: /at least an? ([0-9.]+) GPA/i,
    club: /admission to (.+?) by /i,
    internship: /internship offer from (.+?) by /i,
    gym: /^Will .+? ((?:[a-z]+ )?(?:run|lift|deadlift|squat|bench|press|swim|bike|climb|hit|do|complete|finish)\b.+?) by /i,
  };
  const match = goalType && patterns[goalType] ? patterns[goalType].exec(q) : null;
  if (match) {
    if (goalType === "gpa") return `${match[1]} GPA`;
    if (goalType === "internship") return clip(`${match[1]} internship`, THUMBNAIL_MAX);
    return clip(titleCase(match[1]), THUMBNAIL_MAX);
  }
  // Own words, or wording that changed: take the verb phrase after "Will <name>".
  const lead = named ?? q.replace(/^Will \S+ /i, "");
  const phrase = lead.replace(/\?$/, "").replace(/ by [^?]+$/i, (m) => (goalType === "own_words" ? m : ""));
  return clip(titleCase(phrase || q), THUMBNAIL_MAX);
}

/**
 * The card title: the full question, minus the trailing deadline, which the
 * thumbnail badge already shows. Only template goals are trimmed; a goal in the
 * person's own words keeps every word, because "accepted by Stanford" must not
 * lose "by Stanford".
 */
export function cardTitle(goalType: string | null, question: string): string {
  const q = question.trim();
  if (!goalType || goalType === "own_words" || goalType === "other") return q;
  const trimmed = q.replace(/ by [^?]+\?$/i, "?");
  return trimmed.length >= 12 ? trimmed : q;
}

/** One or two letters for an avatar, from a display name. */
export function initials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Play points traded, as "12.4K pts". Micro-units in, compact text out. */
export function volumeLabel(volumeMicro: number): string {
  const points = Math.max(0, volumeMicro) / 1_000_000;
  if (points === 0) return "No trades yet";
  if (points < 1) return "<1 pt traded";
  return `${compact.format(points)} pts traded`;
}

/** A whole percent for display. Never 0 or 100: a binary market is never certain. */
export function percent(yesPrice: number): number {
  return Math.min(99, Math.max(1, Math.round(yesPrice * 100)));
}

/**
 * The day's change as a signed whole number of percentage points, with a
 * direction. Arrows carry the direction so it never rests on colour alone.
 */
export function changeLabel(change24hBp: number): { text: string; direction: "up" | "down" | "flat" } {
  // Round the size, then reapply the sign. Math.round alone rounds -11.5 to -11
  // but 11.5 to 12, so equal moves up and down would show different sizes.
  const points = Math.sign(change24hBp) * Math.round(Math.abs(change24hBp) / 100);
  if (points === 0) return { text: "0", direction: "flat" };
  return points > 0
    ? { text: `${points}`, direction: "up" }
    : { text: `${Math.abs(points)}`, direction: "down" };
}

/** "Closes in 3d", "Closes in 5h", "Closed". Server-computed, so no clock skew. */
export function closesIn(deadline: Date, now: Date): string {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return "Closed";
  const hours = ms / 3_600_000;
  if (hours < 1) return "< 1h left";
  if (hours < 48) return `${Math.floor(hours)}h left`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days}d left`;
  return `${Math.round(days / 30)}mo left`;
}

/** "2d ago", in the manner of a YouTube meta line. */
export function ago(then: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - then.getTime());
  const hours = ms / 3_600_000;
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Short month and day for a rundown row, like Kalshi's "SEP 24". */
export function shortDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })
    .format(value)
    .toUpperCase();
}
