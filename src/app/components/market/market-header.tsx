import Link from "next/link";
import { CAMPUSES, type CampusKey } from "@/config/campus";
import type { Viewer } from "@/modules/account/viewer";
import { Logo } from "../brand/logo";
import { ThemeToggle } from "../theme-toggle";
import { Avatar } from "./market-card";
import { PublicCampusPicker } from "./public-campus-picker";
import { SearchBox } from "./search-box";

/**
 * The top bar on every page: the Mitra logo and campus identity, search, core
 * navigation, balance, theme choice and account. Owner tools are grouped so
 * they do not compete with the main destinations.
 *
 * `viewer.ownerQueue` is set only for the owner: how many market suggestions
 * are waiting. That link stays visible on a phone, because nothing else tells
 * the owner something is waiting.
 *
 * On a phone the bar keeps the logo, campus selector, balance and photo; the search drops to its
 * own row on the feed (`search="feed"`) and is left out elsewhere.
 */
export function MarketHeader({ viewer, active, query = "", campus, search = "desktop", brandMode = "campus", entryAction }: {
  viewer: Viewer | null;
  active?: "markets" | "positions";
  /** The search already in the address, on the feed. */
  query?: string;
  /** Selected public feed campus; only passed on the signed-out home page. */
  campus?: CampusKey;
  search?: "desktop" | "feed";
  brandMode?: "campus" | "neutral";
  entryAction?: "sign-in" | "sign-up" | "none";
}) {
  const points = viewer?.balanceMicro ?? null;
  const neutral = brandMode === "neutral";
  return (
    <header className={`topbar${search === "feed" && !neutral ? " topbar-with-search" : ""}${neutral ? " topbar-entry" : ""}`}>
      <div className="brand">
        <Link className="brand-home" href="/" prefetch={false} aria-label="Mitra home">
          <span className="brand-lockup">
            <Logo className="brand-logo" title="Mitra" />
            {viewer && <>
              <span className="brand-school campus-only campus-osu">{CAMPUSES.osu.communityName}</span>
              <span className="brand-school campus-only campus-uiuc">{CAMPUSES.uiuc.communityName}</span>
            </>}
          </span>
        </Link>
        {!neutral && !viewer && campus && <PublicCampusPicker campus={campus} query={query} />}
        {!neutral && <span className="brand-motto">Trade on what happens here.</span>}
      </div>
      {!neutral && <div className="topbar-search"><SearchBox initial={query} /></div>}
      {!neutral && <nav className="topbar-nav" aria-label="Main">
        <Link href="/" prefetch={false} aria-current={active === "markets" ? "page" : undefined}>Markets</Link>
        {viewer && <Link href="/positions" prefetch={false} aria-current={active === "positions" ? "page" : undefined}>Positions</Link>}
        {viewer && <Link href="/shop">Shop</Link>}
        {viewer && <Link href="/suggest">Suggest</Link>}
      </nav>}
      {!neutral && <details className="topbar-mobile-menu">
        <summary>Menu</summary>
        <div className="topbar-mobile-links">
          <Link href="/">Markets</Link>
          {viewer && <Link href="/positions">Positions</Link>}
          {viewer && <Link href="/shop">Shop</Link>}
          {viewer && <Link href="/suggest">Suggest a market</Link>}
          {viewer?.ownerQueue != null && <>
            <Link href="/review">Review{viewer.ownerQueue > 0 ? ` · ${viewer.ownerQueue} waiting` : ""}</Link>
            <Link href="/review/campaigns">Campaigns</Link>
          </>}
        </div>
      </details>}
      <div className="topbar-actions">
        <ThemeToggle />
        {viewer?.ownerQueue != null && <details className="owner-menu">
          <summary className="owner-link">Owner{viewer.ownerQueue > 0 && <span className="owner-badge" aria-label={`${viewer.ownerQueue} waiting`}>{viewer.ownerQueue}</span>}</summary>
          <div className="owner-menu-links"><Link href="/review">Review suggestions</Link><Link href="/review/markets">Market outcomes</Link><Link href="/review/campaigns">QR campaigns</Link><Link href="/review/people">People</Link></div>
        </details>}
        {viewer ? (
          <>
            {points !== null && (
              <Link className="topbar-points" href="/account" aria-label={`${pointsShort(points)} Trade Coins available`}>
                <strong>{pointsShort(points)}</strong> <span>Trade Coins</span>
              </Link>
            )}
            <Link className="topbar-me" href="/account" aria-label="Your account">
              <Avatar name={viewer.displayName ?? "You"} photo={viewer.photo} size={32} />
            </Link>
          </>
        ) : neutral ? (
          entryAction && entryAction !== "none" ? <Link className="btn btn-quiet entry-header-action" href={entryAction === "sign-in" ? "/sign-in" : "/sign-up"}>
            {entryAction === "sign-in" ? "Sign in" : "Create account"}
          </Link> : null
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

export function MarketFooter({ brandMode = "campus", campus }: { brandMode?: "campus" | "neutral"; campus?: CampusKey }) {
  if (brandMode === "neutral") {
    return (
      <footer className="market-footer market-footer-entry">
        <div className="footer-brand"><span className="footer-edition">Mitra</span><span>Trade Coins.</span></div>
        <nav className="footer-links" aria-label="Information"><Link href="/faq">FAQ</Link><Link href="/privacy">Privacy</Link></nav>
        <p className="footer-disclaimer">Mitra is an independent platform and is not affiliated with, endorsed by, or sponsored by any university.</p>
      </footer>
    );
  }
  return (
    <footer className="market-footer">
      <div className="footer-brand">
        <span className="footer-edition">Mitra</span>
        <span>Trade on what happens here.</span>
      </div>
      <nav className="footer-links" aria-label="Information">
        <Link href="/faq">FAQ</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
      {campus ? (
        <p className="footer-disclaimer">{CAMPUSES[campus].independenceStatement}</p>
      ) : <>
        <p className="footer-disclaimer campus-only campus-osu">{CAMPUSES.osu.independenceStatement}</p>
        <p className="footer-disclaimer campus-only campus-uiuc">{CAMPUSES.uiuc.independenceStatement}</p>
      </>}
    </footer>
  );
}
