"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { percent, tickerSymbol } from "@/modules/discovery/present";
import { Avatar, Change, type CardData } from "./goal-card";

/*
 * A scrolling tape of goals and prices across the top of the feed, the way a
 * stock ticker runs across a trading screen (decided 2026-09-24). Prices come
 * in live from the page's quote store. It pauses under the pointer or keyboard
 * focus, and stands still for anyone who asks their system for less motion.
 */

const MIN_ITEMS = 3;
const MAX_ITEMS = 20;
const SECONDS_PER_ITEM = 4;

export function TickerTape({ cards, flashes }: { cards: CardData[]; flashes: ReadonlyMap<string, "up" | "down" | null> }) {
  if (cards.length < MIN_ITEMS) return null;
  const items = cards.slice(0, MAX_ITEMS);
  // The set is drawn twice so the loop is seamless; the copy is hidden from
  // screen readers and the keyboard, which get the first set only.
  const row = (copy: boolean) => items.map((card) => {
    const flash = flashes.get(card.id);
    return (
      <Link key={`${copy ? "copy" : "main"}-${card.id}`} className="tape-item" href={`/markets/${card.id}`} prefetch={false}
        tabIndex={copy ? -1 : undefined} title={card.question}>
        <Avatar name={card.displayName} photo={card.photo} size={18} />
        <span className="tape-sym">{tickerSymbol(card.goalType, card.question, card.displayName)}</span>
        <span key={card.yesPrice} className={flash ? `tape-price flash flash-${flash}` : "tape-price"}>{percent(card.yesPrice)}%</span>
        <Change bp={card.change24hBp} />
      </Link>
    );
  });
  const style = { "--tape-duration": `${items.length * SECONDS_PER_ITEM}s` } as CSSProperties;
  return (
    <section className="tape" aria-label="Live prices">
      <div className="tape-track" style={style}>
        <div className="tape-set">{row(false)}</div>
        <div className="tape-set" aria-hidden="true">{row(true)}</div>
      </div>
    </section>
  );
}
