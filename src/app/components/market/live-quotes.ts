"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Live prices, decided 2026-09-24: about every 15 seconds while the page is
 * visible. One store per page: every component asking for quotes shares one
 * request per interval, whatever the number of cards. Polling stops while the
 * tab is hidden and catches up the moment it is shown again.
 *
 * It reads /api/quotes, which records nothing, so an open page polling all day
 * cannot inflate the feed's view counts.
 */

export type LiveQuote = {
  id: string;
  yesBp: number;
  change24hBp: number;
  volumeMicro: number;
  tradingOpen: boolean;
  /** When the server read these numbers. */
  at: number;
  /** Which way the price moved since the previous poll, for the flash. */
  move: "up" | "down" | null;
};

export const POLL_MS = 15_000;

const watching = new Map<string, number>();
const listeners = new Set<() => void>();
const EMPTY: ReadonlyMap<string, LiveQuote> = new Map();
let snapshot: ReadonlyMap<string, LiveQuote> = EMPTY;
let timer: ReturnType<typeof setInterval> | null = null;
let inflight = false;

async function poll() {
  if (inflight || document.visibilityState !== "visible" || watching.size === 0) return;
  inflight = true;
  try {
    const ids = [...watching.keys()].map(encodeURIComponent).join(",");
    const response = await fetch(`/api/quotes?ids=${ids}`, { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { at: string; quotes: Omit<LiveQuote, "at" | "move">[] };
    const at = Date.parse(body.at);
    let next: Map<string, LiveQuote> | null = null;
    for (const quote of body.quotes) {
      const prev = snapshot.get(quote.id);
      if (prev && prev.yesBp === quote.yesBp && prev.change24hBp === quote.change24hBp
        && prev.volumeMicro === quote.volumeMicro && prev.tradingOpen === quote.tradingOpen) continue;
      next ??= new Map(snapshot);
      const move = !prev || prev.yesBp === quote.yesBp ? prev?.move ?? null : quote.yesBp > prev.yesBp ? "up" : "down";
      next.set(quote.id, { ...quote, at, move });
    }
    if (next) {
      snapshot = next;
      for (const listener of listeners) listener();
    }
  } catch {
    // A missed poll is harmless; the next one catches up.
  } finally {
    inflight = false;
  }
}

function onVisibility() {
  if (document.visibilityState === "visible") void poll();
}

function subscribe(ids: readonly string[], listener: () => void) {
  for (const id of ids) watching.set(id, (watching.get(id) ?? 0) + 1);
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => void poll(), POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    for (const id of ids) {
      const left = (watching.get(id) ?? 1) - 1;
      if (left > 0) watching.set(id, left);
      else watching.delete(id);
    }
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

/** The latest quotes for these goals. Empty until the first poll brings news. */
export function useLiveQuotes(ids: readonly string[]): ReadonlyMap<string, LiveQuote> {
  const key = ids.join(",");
  const subscribeToIds = useCallback((listener: () => void) => subscribe(key ? key.split(",") : [], listener), [key]);
  return useSyncExternalStore(subscribeToIds, () => snapshot, () => EMPTY);
}

type Priced = { id: string; yesPrice: number; change24hBp: number; volumeMicro: number; tradingOpen: boolean };

/** A card with its live numbers laid over what the server rendered. */
export function withQuote<T extends Priced>(card: T, live: ReadonlyMap<string, LiveQuote>): T {
  const quote = live.get(card.id);
  if (!quote) return card;
  return { ...card, yesPrice: quote.yesBp / 10_000, change24hBp: quote.change24hBp, volumeMicro: quote.volumeMicro, tradingOpen: quote.tradingOpen };
}

/**
 * Which way to flash a price: the last move between polls, or, on the first
 * poll, the move away from what the server rendered.
 */
export function flashFor(serverYesPrice: number, quote: LiveQuote | undefined): "up" | "down" | null {
  if (!quote) return null;
  if (quote.move) return quote.move;
  const server = Math.round(serverYesPrice * 10_000);
  return quote.yesBp > server ? "up" : quote.yesBp < server ? "down" : null;
}
