import Link from "next/link";
import { Bell, BriefcaseBusiness, Compass, House, LineChart, Plus, Search } from "lucide-react";
import type { Viewer } from "@/modules/account/viewer";
import { Logo } from "../brand/logo";
import { ThemeToggle } from "../theme-toggle";
import { Avatar } from "./market-card";
import { SearchBox } from "./search-box";
import { Toaster } from "../toaster";

/**
 * The top bar on every page (2026-10-19): the owner's new logo; search across
 * founders, startups and markets; For you, Following, Markets and Activity;
 * the black/white switch; for members their Trade Coins, a baby blue Create and
 * their photo (the portfolio); Log in and Sign up for visitors. The owner also
 * gets Review with what is waiting. The shop (2026-10-12) is linked from the
 * account page and the portfolio, not the bar.
 *
 * On a phone the bar keeps the logo, search and activity (like the owner's
 * second screenshot) and the main places move to a bar along the bottom.
 */
export type NavKey = "for-you" | "following" | "markets" | "activity" | "portfolio" | "create" | "search";

export function MarketHeader({ viewer, active, query = "", brandMode = "app", entryAction }: {
  viewer: Viewer | null;
  active?: NavKey;
  /** The search already in the address. */
  query?: string;
  /** Older callers passed these; kept so they still compile. */
  search?: "desktop" | "feed";
  brandMode?: "app" | "campus" | "neutral";
  entryAction?: "sign-in" | "sign-up" | "none";
}) {
  const tradeCoins = viewer?.balanceMicro ?? null;
  const neutral = brandMode === "neutral";
  const current = (key: NavKey) => (active === key ? "page" : undefined);
  return (
    <>
      <header className={`topbar${neutral ? " topbar-entry" : ""}`}>
        <Link className="brand" href="/" prefetch={false} aria-label="Mitra home">
          <Logo className="brand-logo" title="Mitra" />
          {!neutral && <span className="brand-motto">Founders, before they&rsquo;re famous.</span>}
        </Link>
        {!neutral && <div className="topbar-search"><SearchBox initial={query} /></div>}
        {!neutral && <nav className="topbar-nav" aria-label="Main">
          <Link href="/" prefetch={false} aria-current={current("for-you")}>For you</Link>
          <Link href="/following" prefetch={false} aria-current={current("following")}>Following</Link>
          <Link href="/markets" prefetch={false} aria-current={current("markets")}>Markets</Link>
          <Link href="/activity" prefetch={false} aria-current={current("activity")}>Activity</Link>
        </nav>}
        <div className="topbar-actions">
          {!neutral && <Link className="icon-button topbar-phone-only" href="/search" prefetch={false} aria-label="Search"><Search size={18} aria-hidden="true" /></Link>}
          {!neutral && <Link className="icon-button topbar-phone-only" href="/activity" prefetch={false} aria-label="Activity"><Bell size={18} aria-hidden="true" /></Link>}
          <ThemeToggle />
          {viewer?.ownerQueue != null && (
            <Link className="owner-link" href="/review" aria-label={viewer.ownerQueue > 0 ? `Owner review: ${viewer.ownerQueue} waiting` : "Owner review"}>
              Review
              {viewer.ownerQueue > 0 && <span className="owner-badge" aria-hidden="true">{viewer.ownerQueue}</span>}
            </Link>
          )}
          {viewer ? (
            <>
              {tradeCoins !== null && (
                <Link className="topbar-points" href="/portfolio" aria-label={`${coinsShort(tradeCoins)} Trade Coins available`}>
                  <strong>{coinsShort(tradeCoins)}</strong> <span>Trade Coins</span>
                </Link>
              )}
              <Link className="btn btn-primary topbar-post" href="/create" aria-current={current("create")}><Plus size={16} aria-hidden="true" />Create</Link>
              <Link className="topbar-me" href="/portfolio" aria-label="Your profile and portfolio">
                <Avatar name={viewer.displayName ?? "You"} photo={viewer.photo} size={32} />
              </Link>
            </>
          ) : neutral ? (
            entryAction === "none" ? null : <Link className="btn btn-quiet entry-header-action" href={entryAction === "sign-in" ? "/sign-in" : "/sign-up"}>
              {entryAction === "sign-in" ? "Sign in" : "Create account"}
            </Link>
          ) : (
            <>
              <Link className="btn btn-quiet topbar-login" href="/sign-in">Log in</Link>
              <Link className="btn btn-primary" href="/sign-up">Sign up</Link>
            </>
          )}
        </div>
      </header>
      {!neutral && <BottomNav active={active} signedIn={!!viewer} />}
      <Toaster />
    </>
  );
}

/** The phone's bar along the bottom: Home, Markets, Create, Activity, Profile. */
function BottomNav({ active, signedIn }: { active?: NavKey; signedIn: boolean }) {
  const current = (keys: NavKey[]) => (active && keys.includes(active) ? "page" : undefined);
  return (
    <nav className="bottom-nav" aria-label="Main">
      <Link href="/" prefetch={false} aria-current={current(["for-you", "following"])}><House size={21} aria-hidden="true" /><span>Home</span></Link>
      <Link href="/markets" prefetch={false} aria-current={current(["markets", "search"])}><LineChart size={21} aria-hidden="true" /><span>Markets</span></Link>
      <Link href={signedIn ? "/create" : "/sign-up"} prefetch={false} className="bottom-create" aria-current={current(["create"])} aria-label="Create"><Plus size={22} aria-hidden="true" /></Link>
      <Link href="/activity" prefetch={false} aria-current={current(["activity"])}><Compass size={21} aria-hidden="true" /><span>Activity</span></Link>
      <Link href={signedIn ? "/portfolio" : "/sign-in"} prefetch={false} aria-current={current(["portfolio"])}><BriefcaseBusiness size={21} aria-hidden="true" /><span>Portfolio</span></Link>
    </nav>
  );
}

/** Available Trade Coins for the bar: whole, or one decimal rounded down, never more than you have. */
function coinsShort(micro: number): string {
  const tenths = Math.floor(Math.max(0, micro) / 100_000) / 10;
  return tenths.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function MarketFooter({ brandMode = "app" }: { brandMode?: "app" | "campus" | "neutral" }) {
  return (
    <footer className={`market-footer${brandMode === "neutral" ? " market-footer-entry" : ""}`}>
      <div className="footer-brand">
        <span className="footer-edition">Mitra</span>
        <span>Discover founders early. Predict with Trade Coins, which have no cash value.</span>
      </div>
      <nav className="footer-links" aria-label="Information">
        <Link href="/markets">Markets</Link>
        <Link href="/faq">FAQ</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
      <p className="footer-disclaimer">Startups, founders and markets marked Demo are fictional, for demonstration. Trade Coins and Coins have no cash value and can’t be withdrawn or redeemed. Mitra is an independent platform and is not affiliated with, endorsed by, or sponsored by any university.</p>
    </footer>
  );
}
