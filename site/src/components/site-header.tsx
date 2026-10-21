"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "./logo";

/*
 * Vela's floating menu: a rounded bar over the page that is dark glass above
 * dark sections and white above light ones, switching as each section passes
 * under it (XO's header does the same with its section colours). The link
 * for the section in view is marked, as on xo.market.
 */

type Item = { id: string; label: string };

export function SiteHeader({ items, appUrl }: { items: Item[]; appUrl: string }) {
  const bar = useRef<HTMLElement>(null);
  const [tone, setTone] = useState<"dark" | "light">("dark");
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let frame = 0;
    const ids = new Set(items.map((item) => item.id));
    const measure = () => {
      frame = 0;
      const box = bar.current?.getBoundingClientRect();
      const probe = box ? box.top + box.height / 2 : 44;
      let surface = "ink";
      let current: string | null = null;
      // Later sections slide over earlier ones, so the last one under the bar is on top.
      for (const section of document.querySelectorAll<HTMLElement>("main > section[data-surface], footer[data-surface]")) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= probe && rect.bottom > probe) {
          surface = section.dataset.surface ?? surface;
          current = section.id || null;
        }
      }
      setTone(surface === "ink" ? "dark" : "light");
      setActive(current && ids.has(current) ? current : null);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const onPointer = (event: PointerEvent) => { if (!bar.current?.parentElement?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <header className="header" data-tone={tone} data-open={open || undefined} data-header>
      <nav ref={bar} className="header-bar" aria-label="Main">
        <a className="header-logo" href="#top" aria-label="Mitra, back to the top">
          <Logo />
        </a>
        <ul className="header-links">
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} aria-current={active === item.id ? "location" : undefined}>{item.label}</a>
            </li>
          ))}
        </ul>
        <div className="header-end">
          <a className="header-cta" href={appUrl}>
            Open Mitra
            <ArrowRight aria-hidden="true" strokeWidth={2} />
          </a>
          <button
            type="button"
            className="header-menu"
            aria-expanded={open}
            aria-controls="header-panel"
            aria-label={open ? "Close the menu" : "Open the menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <i aria-hidden="true" />
            <i aria-hidden="true" />
          </button>
        </div>
      </nav>
      <div id="header-panel" className="header-panel" hidden={!open}>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} onClick={() => setOpen(false)}>{item.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
