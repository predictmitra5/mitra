import Link from "next/link";
import { CAMPUS } from "@/config/campus";
import type { Viewer } from "@/modules/account/viewer";
import { Avatar } from "./goal-card";
import { SearchBox } from "./search-box";

/**
 * The top bar on every page, in the Kalshi direction (2026-09-24): the wordmark
 * with the motto, search, Goals and Positions, the viewer's available points, a
 * scarlet "Post a goal" and their photo. Log in and Sign up when signed out.
 *
 * `viewer.ownerQueue` is set only for the owner: how many goals and pieces of
 * proof are waiting. That link stays visible on a phone, because nothing else
 * tells the owner something is waiting.
 *
 * On a phone the bar keeps the wordmark, points and photo; the search drops to
 * its own row on the feed (`search="feed"`) and is left out elsewhere.
 */
export function MarketHeader({ viewer, active, query = "", search = "desktop" }: {
  viewer: Viewer | null;
  active?: "goals" | "positions";
  /** The search already in the address, on the feed. */
  query?: string;
  search?: "desktop" | "feed";
}) {
  const points = viewer?.balanceMicro ?? null;
  return (
    <header className={`topbar${search === "feed" ? " topbar-with-search" : ""}`}>
      <Link className="brand" href="/" prefetch={false}>
        <span className="brand-lockup">
          <span className="brand-word">mitra</span>
          <span className="brand-campus">at {CAMPUS.shortName}</span>
        </span>
        <span className="brand-motto">Bet on literally anything</span>
      </Link>
      <div className="topbar-search"><SearchBox initial={query} /></div>
      <nav className="topbar-nav" aria-label="Main">
        <Link href="/" prefetch={false} aria-current={active === "goals" ? "page" : undefined}>Goals</Link>
        {viewer && <Link href="/positions" prefetch={false} aria-current={active === "positions" ? "page" : undefined}>Positions</Link>}
      </nav>
      <div className="topbar-actions">
        {viewer?.ownerQueue != null && (
          <Link className="owner-link" href="/review" aria-label={viewer.ownerQueue > 0 ? `Owner review: ${viewer.ownerQueue} waiting` : "Owner review"}>
            Review
            {viewer.ownerQueue > 0 && <span className="owner-badge" aria-hidden="true">{viewer.ownerQueue}</span>}
          </Link>
        )}
        {viewer ? (
          <>
            {points !== null && (
              <Link className="topbar-points" href="/account" aria-label={`${pointsShort(points)} points available`}>
                <strong>{pointsShort(points)}</strong> <span>pts</span>
              </Link>
            )}
            <Link className="btn btn-primary topbar-post" href="/goals/new">Post a goal</Link>
            <Link className="topbar-me" href="/account" aria-label="Your account">
              <Avatar name={viewer.displayName ?? "You"} photo={viewer.photo} size={32} />
            </Link>
          </>
        ) : (
          <>
            <Link className="btn btn-quiet" href="/sign-in">Log in</Link>
            <Link className="btn btn-primary" href="/sign-up">Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
}

/** Available points for the bar: whole points, or one decimal rounded down, never more than you have. */
function pointsShort(micro: number): string {
  const tenths = Math.floor(Math.max(0, micro) / 100_000) / 10;
  return tenths.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function MarketFooter() {
  return (
    <footer className="market-footer">
      <div className="footer-brand">
        <span className="footer-edition">{CAMPUS.editionName}</span>
        <span>Bet on literally anything. Play money only.</span>
      </div>
      <nav className="footer-links" aria-label="Information">
        <Link href="/faq">FAQ</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
      <p className="footer-disclaimer">{CAMPUS.independenceStatement}</p>
    </footer>
  );
}
