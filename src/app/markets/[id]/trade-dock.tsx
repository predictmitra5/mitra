"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Side } from "@/modules/market/lmsr";
import { percent } from "@/modules/discovery/present";
import { Avatar } from "@/app/components/market/market-card";
import { useLiveQuotes } from "@/app/components/market/live-quotes";
import { TradePanel, type TradeAccess } from "./trade-panel";

/*
 * Where the trade panel lives (decided 2026-09-24). On a desktop it is a sticky
 * panel on the right. On a phone it is hidden behind a bottom bar, Buy Yes and
 * Buy No with their prices, and opens as a bottom sheet. It is one panel either
 * way, moved by the stylesheet, so there is only ever one form on the page.
 *
 * Opening a market from a feed card's Yes or No (?side=) chooses that side and,
 * on a phone, opens the sheet.
 */

const PHONE = "(max-width: 899px)";

function watchPhone(onChange: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function TradeDock({
  marketId, title, name, photo, yesPrice, liquidity, access, balanceMicro, allowanceMicro,
  heldYesMicro, heldNoMicro, initialSide, openInitially, tradingOpen, position,
}: {
  marketId: string;
  title: string;
  name: string;
  photo: string | null;
  yesPrice: number;
  liquidity: number;
  access: TradeAccess;
  balanceMicro: number | null;
  allowanceMicro: number | null;
  heldYesMicro: number;
  heldNoMicro: number;
  initialSide: Side;
  openInitially: boolean;
  tradingOpen: boolean;
  /** The trader's position, shown under the panel on a desktop. */
  position: ReactNode;
}) {
  const live = useLiveQuotes([marketId]);
  const quote = live.get(marketId);
  const price = quote ? quote.yesBp / 10_000 : yesPrice;
  const [side, setSide] = useState<Side>(initialSide);
  const [open, setOpen] = useState(openInitially);
  const phone = useSyncExternalStore(watchPhone, () => window.matchMedia(PHONE).matches, () => false);
  const sheet = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const modal = phone && open;

  // While the sheet is open on a phone: the page behind stays still, focus moves
  // into the sheet and stays there, and Escape closes it.
  useEffect(() => {
    if (!modal) return;
    const node = sheet.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key !== "Tab" || !node) return;
      const focusable = [...node.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])")];
      if (focusable.length === 0) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      opener.current?.focus();
    };
  }, [modal]);

  function openWith(next: Side, button: HTMLButtonElement) {
    opener.current = button;
    setSide(next);
    setOpen(true);
  }

  const yes = percent(price);
  return (
    <>
      <aside className={`dock${open ? " is-open" : ""}`} aria-label="Trade this market">
        <button type="button" className="dock-backdrop" tabIndex={-1} aria-hidden="true" onClick={() => setOpen(false)} />
        <div className="dock-sheet" ref={sheet} tabIndex={-1}
          role={modal ? "dialog" : undefined} aria-modal={modal ? true : undefined} aria-labelledby={`trade-title-${marketId}`}>
          <span className="dock-grip" aria-hidden="true" />
          <div className="trade-head">
            <Avatar name={name} photo={photo} size={32} shape="square" />
            <h2 id={`trade-title-${marketId}`}>{title}</h2>
            <button type="button" className="dock-close" onClick={() => setOpen(false)}>Close</button>
          </div>
          <TradePanel marketId={marketId} yesPrice={price} liquidity={liquidity} access={access}
            balanceMicro={balanceMicro} allowanceMicro={allowanceMicro} heldYesMicro={heldYesMicro} heldNoMicro={heldNoMicro}
            side={side} onSide={setSide} />
        </div>
        {position}
      </aside>
      {tradingOpen && (
        <div className="buy-bar">
          <button type="button" className="buy-bar-yes" aria-label={`Buy Yes, ${yes}¢`} onClick={(event) => openWith("YES", event.currentTarget)}>
            <span>Buy Yes</span><span>{yes}¢</span>
          </button>
          <button type="button" className="buy-bar-no" aria-label={`Buy No, ${100 - yes}¢`} onClick={(event) => openWith("NO", event.currentTarget)}>
            <span>Buy No</span><span>{100 - yes}¢</span>
          </button>
        </div>
      )}
    </>
  );
}
