/*
 * Presentation helpers for goals on the feed, the ticker and the goal page.
 * Pure functions only, so every one is testable and the server and browser
 * render the same text.
 *
 * Since 2026-09-24 the look follows Kalshi's (docs/DESIGN.md, section 9): the
 * chance as the headline number, today's change to one decimal, time left in
 * words, and play-point volume.
 */

export type GoalType = "gpa" | "club" | "internship" | "gym" | "running" | "launch" | "own_words" | "other";

/** Category names, as the feed's tabs and each card's kicker show them. */
const CATEGORY: Record<string, string> = {
  gpa: "Grades",
  club: "Clubs",
  internship: "Internships",
  gym: "Gym",
  running: "Running",
  launch: "Launches",
  // "Bet on literally anything" (2026-09-24): a goal in the person's own words.
  own_words: "Anything",
  other: "Goal",
};

export function categoryLabel(goalType: string | null): string {
  return CATEGORY[goalType ?? "other"] ?? "Goal";
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * What the goal is about, in as few words as possible: "deadlift 315 lb",
 * "3.8 GPA", "Google offer", "half marathon under 1:59:00". Derived from the
 * template wording, which is fixed per goal type; anything else falls back to
 * the verb phrase after "Will <name>". Casing is kept as the person wrote it.
 */
export function stakeText(goalType: string | null, question: string, displayName?: string): string {
  const q = question.trim();
  // "Will <name> …" with the name stripped exactly, when it is known. Shape alone
  // cannot tell a two-word name ("Sam Lee launch") from a name and a verb ("Sam launch").
  const named = displayName && q.toLowerCase().startsWith(`will ${displayName.toLowerCase()} `)
    ? q.slice(`will ${displayName} `.length)
    : null;
  // The gym template is "Will <name> <achievement> by <date>?", so with the name
  // known the achievement is exact. A verb pattern would guess the name's length
  // and take a surname as part of the lift ("Rivera bench press").
  if (goalType === "gym" && named) {
    const achievement = named.replace(/ by [^?]+\?$/i, "");
    if (achievement && achievement !== named) return achievement;
  }
  const gpa = goalType === "gpa" ? /at least an? ([0-9.]+) GPA/i.exec(q) : null;
  if (gpa) return `${Number(gpa[1])} GPA`;
  const club = goalType === "club" ? /admission to (.+?) by /i.exec(q) : null;
  if (club) return club[1];
  const internship = goalType === "internship" ? /internship offer from (.+?) by /i.exec(q) : null;
  if (internship) return `${internship[1]} offer`;
  const running = goalType === "running" ? / run an? (.+?)(?: in under ([0-9:]+))? by [^?]+\?$/i.exec(q) : null;
  if (running) return running[2] ? `${running[1]} under ${running[2]}` : running[1];
  const gym = goalType === "gym"
    ? /^Will .+? ((?:[a-z]+ )?(?:run|lift|deadlift|squat|bench|press|swim|bike|climb|hit|do|complete|finish)\b.+?) by /i.exec(q)
    : null;
  if (gym) return gym[1];
  // Own words, or wording that changed: take the verb phrase after "Will <name>"
  // (or "Will I"). A goal in the person's own words keeps a trailing "by …",
  // because "accepted by Stanford" must not lose "by Stanford".
  const lead = named ?? q.replace(/^Will \S+ /i, "");
  const phrase = lead.replace(/\?$/, "").replace(/ by [^?]+$/i, (m) => (goalType === "own_words" ? m : ""));
  return phrase || q;
}

const TICKER_MAX = 30;

/** The ticker's label: the first name and the stake, as "Luis deadlift 315 lb". */
export function tickerLabel(goalType: string | null, question: string, displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] ?? "";
  const stake = stakeText(goalType, question, displayName).trim();
  return clip([first, stake].filter(Boolean).join(" ") || "Goal", TICKER_MAX);
}

/**
 * The card title: the full question, minus the trailing deadline on template
 * goals, since the card says how long is left. A goal in the person's own words
 * keeps every word, because "accepted by Stanford" must not lose "by Stanford".
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

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Points traded, as "4,138 pts traded". Micro-units in. */
export function volumeLabel(volumeMicro: number): string {
  const points = Math.max(0, volumeMicro) / 1_000_000;
  if (points === 0) return "No trades yet";
  if (points < 1) return "<1 pt traded";
  return `${whole.format(points)} pts traded`;
}

/** Points to one decimal, as "47.1". Micro-units in. */
export function pointsText(micro: number, digits = 1): string {
  return (micro / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** A whole percent for display. Never 0 or 100: a binary market is never certain. */
export function percent(yesPrice: number): number {
  return Math.min(99, Math.max(1, Math.round(yesPrice * 100)));
}

/**
 * A price change in percentage points to one decimal, with its direction.
 * Arrows carry the direction, so it never rests on colour alone. Rounds the
 * size and then reapplies the sign, so equal moves up and down read the same.
 */
export function changeLabel(changeBp: number): { text: string; direction: "up" | "down" | "flat" } {
  const tenths = Math.round(Math.abs(changeBp) / 10);
  if (tenths === 0) return { text: "0.0", direction: "flat" };
  return { text: (tenths / 10).toFixed(1), direction: changeBp > 0 ? "up" : "down" };
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** "12 days", "5 hours", "4 months"; null once the moment has passed. */
function duration(ms: number): string | null {
  if (ms <= 0) return null;
  const hours = ms / 3_600_000;
  if (hours < 1) return "under an hour";
  if (hours < 48) return plural(Math.floor(hours), "hour");
  const days = Math.round(hours / 24);
  if (days < 60) return plural(days, "day");
  return plural(Math.round(days / 30), "month");
}

/** "12 days left" on a card. Server-computed, so no clock skew. */
export function timeLeft(deadline: Date, now: Date): string {
  const words = duration(deadline.getTime() - now.getTime());
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)} left` : "Closed";
}

/** "closes in 12 days" beside the person on a goal page. */
export function closesInWords(deadline: Date, now: Date): string {
  const words = duration(deadline.getTime() - now.getTime());
  return words ? `closes in ${words}` : "trading closed";
}
