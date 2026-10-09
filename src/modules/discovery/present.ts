/*
 * Presentation helpers for markets on the feed, the ticker and the market page.
 * Pure functions only, so every one is testable and the server and browser
 * render the same text.
 *
 * Since 2026-09-24 the look follows Kalshi's (docs/DESIGN.md, section 9): the
 * chance as the headline number, today's change to one decimal, time left in
 * words, and play-point volume.
 */

export { categoryLabel } from "@/modules/events/categories";

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const TICKER_MAX = 30;

/** The ticker's label: the venue's name, or the start of the question when there is none. */
export function tickerLabel(question: string, venueName: string | null): string {
  return clip((venueName ?? question).trim() || "Market", TICKER_MAX);
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

/** "closes in 12 days" on a market page. */
export function closesInWords(deadline: Date, now: Date): string {
  const words = duration(deadline.getTime() - now.getTime());
  return words ? `closes in ${words}` : "trading closed";
}
