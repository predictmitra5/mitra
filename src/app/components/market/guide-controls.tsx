"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

/*
 * YouTube's guide button (2026-10-20). On a page with the guide beside it and a
 * wide screen, it narrows the guide to icons and back (remembered on this
 * device); anywhere else it opens the guide as a drawer over the page, closed
 * by the scrim, Escape, or following a link. The state is two attributes on
 * <html>, so the server-rendered guide needs no props from here.
 */

const MINI = "guideMini";
const OPEN = "guideOpen";
const WIDE = "(min-width: 1312px)";

function setMini(on: boolean) {
  const root = document.documentElement;
  if (on) root.dataset[MINI] = "true"; else delete root.dataset[MINI];
  try { localStorage.setItem("mitra-guide-mini", on ? "1" : "0"); } catch { /* not remembered; fine */ }
}

function close() { delete document.documentElement.dataset[OPEN]; }

export function GuideButton() {
  const pathname = usePathname();

  useEffect(() => {
    try { if (localStorage.getItem("mitra-guide-mini") === "1") document.documentElement.dataset[MINI] = "true"; } catch { /* default: full */ }
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  // A link inside the drawer moves to another page: close it there.
  useEffect(() => { close(); }, [pathname]);

  function toggle() {
    const besidePage = !!document.querySelector(".yt-guide[data-persistent]");
    if (besidePage && window.matchMedia(WIDE).matches) {
      setMini(!document.documentElement.dataset[MINI]);
      return;
    }
    const root = document.documentElement;
    if (root.dataset[OPEN]) close(); else root.dataset[OPEN] = "true";
  }

  return (
    <button type="button" className="icon-button yt-guide-button" onClick={toggle} aria-label="Menu">
      <Menu size={22} aria-hidden="true" strokeWidth={1.8} />
    </button>
  );
}

/** The dimmed page behind the open drawer; a click on it closes the drawer. */
export function GuideScrim() {
  return <button type="button" className="yt-scrim" tabIndex={-1} aria-label="Close menu" onClick={close} />;
}
