import Link from "next/link";
import {
  Bell, Bookmark, Bot, BriefcaseBusiness, ChartLine, ClipboardCheck, Code, Compass, Cpu, Gamepad2, Gavel, GraduationCap, House, Leaf, Plus,
  QrCode, ScrollText, Search, Settings, ShoppingBag, Sparkles, SquarePlay, SquarePlus, Stethoscope, Store, UserRound, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { getDb } from "@/db/client";
import type { Viewer } from "@/modules/account/viewer";
import { currentIdentity } from "@/modules/auth/server";
import { readFollowing } from "@/modules/social/service";
import { INDUSTRIES } from "@/modules/startups/labels";
import { Logo } from "../brand/logo";
import { ThemeToggle } from "../theme-toggle";
import { FounderFace } from "../startup/thumb";
import { Avatar } from "./market-card";
import { GuideButton, GuideScrim } from "./guide-controls";
import { SearchBox } from "./search-box";
import { Toaster } from "../toaster";

/**
 * The top of every page, copied from YouTube on the owner's instruction
 * (2026-10-20, DESIGN.md section 17): the guide button and the logo; search in
 * a centred pill; for members their Trade Coins, Create, the bell (activity)
 * and their photo (the portfolio); Log in and Sign up for visitors. The owner
 * also gets Review with what is waiting.
 *
 * The guide is YouTube's left column: Home and Markets, the founders you
 * follow, You, Explore (the industries), owner tools and the small print.
 * `guide` pages (home, Following) keep it beside the page on wide screens and
 * as icons on narrower ones; elsewhere the guide button opens it as a drawer.
 * On a phone the bar keeps the logo, the bell and search, and the main places
 * move to YouTube's bottom bar.
 */
export type NavKey = "for-you" | "following" | "markets" | "activity" | "portfolio" | "create" | "search";

export async function MarketHeader({ viewer, active, query = "", brandMode = "app", entryAction, guide = false }: {
  viewer: Viewer | null;
  active?: NavKey;
  /** The search already in the address. */
  query?: string;
  /** Older callers passed this; kept so they still compile. */
  search?: "desktop" | "feed";
  brandMode?: "app" | "campus" | "neutral";
  entryAction?: "sign-in" | "sign-up" | "none";
  /** Keep the guide beside the page (YouTube's home) instead of only as a drawer. */
  guide?: boolean;
}) {
  if (brandMode === "neutral") {
    return (
      <>
        <header className="topbar topbar-entry">
          <Link className="brand" href="/" prefetch={false} aria-label="Mitra home"><Logo className="brand-logo" title="Mitra" /></Link>
          <div className="topbar-actions">
            {!viewer && entryAction !== "none" && (
              <Link className="btn btn-quiet entry-header-action" href={entryAction === "sign-in" ? "/sign-in" : "/sign-up"}>
                {entryAction === "sign-in" ? "Sign in" : "Create account"}
              </Link>
            )}
          </div>
        </header>
        <Toaster />
      </>
    );
  }
  const tradeCoins = viewer?.balanceMicro ?? null;
  const follows = viewer ? await followedFounders() : [];
  return (
    <>
      <header className="yt-topbar">
        <div className="yt-start">
          <GuideButton />
          <Link className="brand" href="/" prefetch={false} aria-label="Mitra home"><Logo className="brand-logo" title="Mitra" /></Link>
        </div>
        <div className="yt-center"><SearchBox initial={query} /></div>
        <div className="yt-end">
          {viewer?.ownerQueue != null && (
            <Link className="owner-link" href="/review" aria-label={viewer.ownerQueue > 0 ? `Owner review: ${viewer.ownerQueue} waiting` : "Owner review"}>
              Review{viewer.ownerQueue > 0 && <span className="owner-badge" aria-hidden="true">{viewer.ownerQueue}</span>}
            </Link>
          )}
          <ThemeToggle />
          <Link className="icon-button yt-phone-only" href="/search" prefetch={false} aria-label="Search"><Search size={21} aria-hidden="true" strokeWidth={1.8} /></Link>
          {viewer ? (
            <>
              {tradeCoins !== null && (
                <Link className="yt-coins" href="/portfolio" aria-label={`${coinsShort(tradeCoins)} Trade Coins available`}>
                  <strong>{coinsShort(tradeCoins)}</strong> <span>Trade Coins</span>
                </Link>
              )}
              <Link className="yt-create" href="/create" aria-current={active === "create" ? "page" : undefined}><Plus size={20} aria-hidden="true" />Create</Link>
              <Link className="icon-button" href="/activity" prefetch={false} aria-label="Activity" aria-current={active === "activity" ? "page" : undefined}><Bell size={21} aria-hidden="true" strokeWidth={1.8} /></Link>
              <Link className="topbar-me yt-desktop-only" href="/portfolio" aria-label="Your portfolio">
                <Avatar name={viewer.displayName ?? "You"} photo={viewer.photo} size={32} />
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-quiet yt-login" href="/sign-in">Log in</Link>
              <Link className="btn btn-primary yt-signup" href="/sign-up">Sign up</Link>
            </>
          )}
        </div>
      </header>
      <Guide viewer={viewer} active={active} follows={follows} persistent={guide} />
      {guide && <MiniGuide active={active} signedIn={!!viewer} />}
      <GuideScrim />
      <BottomNav active={active} viewer={viewer} />
      <Toaster />
    </>
  );
}

type Followed = { handle: string; name: string; hue: number; portraitUrl: string | null };

/** The founders the signed-in member follows, for the guide. A failure only leaves the list empty. */
async function followedFounders(): Promise<Followed[]> {
  try {
    const identity = await currentIdentity();
    if (!identity) return [];
    return (await readFollowing(getDb(), identity.id)).founders.slice(0, 8);
  } catch {
    return [];
  }
}

const INDUSTRY_ICONS: Record<string, LucideIcon> = {
  ai: Sparkles, robotics: Bot, edtech: GraduationCap, healthcare: Stethoscope, devtools: Code, gaming: Gamepad2,
  climate: Leaf, consumer: ShoppingBag, fintech: Wallet, hardware: Cpu,
};

function GuideLink({ href, icon: Icon, label, current = false, badge }: { href: string; icon: LucideIcon; label: string; current?: boolean; badge?: number }) {
  return (
    <Link className="yt-guide-link" href={href} prefetch={false} aria-current={current ? "page" : undefined}>
      <Icon size={22} aria-hidden="true" strokeWidth={current ? 2.2 : 1.7} />
      <span>{label}</span>
      {badge ? <span className="owner-badge" aria-label={`${badge} waiting`}>{badge}</span> : null}
    </Link>
  );
}

function Guide({ viewer, active, follows, persistent }: { viewer: Viewer | null; active?: NavKey; follows: Followed[]; persistent: boolean }) {
  const owner = viewer?.ownerQueue != null;
  return (
    <nav className="yt-guide" data-persistent={persistent ? "" : undefined} aria-label="Guide">
      <div className="yt-guide-head">
        <GuideButton />
        <Link className="brand" href="/" prefetch={false} aria-label="Mitra home"><Logo className="brand-logo" title="Mitra" /></Link>
      </div>
      <section className="yt-guide-section">
        <GuideLink href="/" icon={House} label="Home" current={active === "for-you"} />
        <GuideLink href="/markets" icon={ChartLine} label="Markets" current={active === "markets"} />
      </section>
      <section className="yt-guide-section">
        <Link className="yt-guide-title" href="/following" prefetch={false} aria-current={active === "following" ? "page" : undefined}>Following <span aria-hidden="true">›</span></Link>
        {viewer ? (
          follows.length ? follows.map((person) => (
            <Link key={person.handle} className="yt-guide-link yt-guide-person" href={`/founders/${person.handle}`} prefetch={false}>
              <FounderFace founder={person} size={24} />
              <span>{person.name}</span>
            </Link>
          )) : <p className="yt-guide-note">Follow founders from their videos and they show up here.</p>
        ) : (
          <div className="yt-guide-note">
            <p>Log in to follow founders and see their new videos here.</p>
            <Link className="btn btn-quiet yt-guide-signin" href="/sign-in"><UserRound size={18} aria-hidden="true" />Log in</Link>
          </div>
        )}
      </section>
      {viewer && (
        <section className="yt-guide-section">
          <Link className="yt-guide-title" href="/portfolio" prefetch={false}>You <span aria-hidden="true">›</span></Link>
          <GuideLink href="/portfolio" icon={BriefcaseBusiness} label="Portfolio" current={active === "portfolio"} />
          <GuideLink href="/activity" icon={Bell} label="Activity" current={active === "activity"} />
          <GuideLink href="/portfolio#saved-title" icon={Bookmark} label="Saved videos" />
          <GuideLink href="/create" icon={SquarePlay} label="Your founder page" current={active === "create"} />
          <GuideLink href="/shop" icon={Store} label="Shop" />
          <GuideLink href="/account" icon={Settings} label="Account" />
        </section>
      )}
      <section className="yt-guide-section">
        <h2 className="yt-guide-title">Explore</h2>
        {INDUSTRIES.filter((entry) => entry.key !== "other").map((entry) => (
          <GuideLink key={entry.key} href={`/?topic=${entry.key}`} icon={INDUSTRY_ICONS[entry.key] ?? Compass} label={entry.label} />
        ))}
      </section>
      {owner && (
        <section className="yt-guide-section">
          <h2 className="yt-guide-title">Owner</h2>
          <GuideLink href="/review" icon={ClipboardCheck} label="Review" badge={viewer.ownerQueue ?? 0} />
          <GuideLink href="/review/markets/new" icon={SquarePlus} label="Create a market" />
          <GuideLink href="/review/markets" icon={Gavel} label="Outcomes" />
          <GuideLink href="/review/campaigns" icon={QrCode} label="QR campaigns" />
          <GuideLink href="/review/people" icon={Users} label="People" />
          <GuideLink href="/review/audit" icon={ScrollText} label="Audit record" />
        </section>
      )}
      <footer className="yt-guide-foot">
        <nav aria-label="Information"><Link href="/faq">FAQ</Link><Link href="/privacy">Privacy</Link><Link href="/markets">All markets</Link></nav>
        <p>Startups, founders and markets marked Demo are fictional. Trade Coins and Coins have no cash value. Mitra is independent and not affiliated with any university.</p>
      </footer>
    </nav>
  );
}

/** YouTube's narrow guide: four places as icons over small labels. */
function MiniGuide({ active, signedIn }: { active?: NavKey; signedIn: boolean }) {
  const item = (href: string, Icon: LucideIcon, label: string, current: boolean) => (
    <Link className="yt-mini-link" href={href} prefetch={false} aria-current={current ? "page" : undefined}>
      <Icon size={22} aria-hidden="true" strokeWidth={current ? 2.2 : 1.7} /><span>{label}</span>
    </Link>
  );
  return (
    <nav className="yt-mini" aria-label="Main">
      {item("/", House, "Home", active === "for-you")}
      {item("/markets", ChartLine, "Markets", active === "markets")}
      {item("/following", Users, "Following", active === "following")}
      {item(signedIn ? "/portfolio" : "/sign-in", UserRound, "You", active === "portfolio")}
    </nav>
  );
}

/** YouTube's bar along the bottom of a phone: Home, Markets, Create, Following, You. */
function BottomNav({ active, viewer }: { active?: NavKey; viewer: Viewer | null }) {
  const current = (keys: NavKey[]) => (active && keys.includes(active) ? "page" : undefined);
  return (
    <nav className="yt-bottom" aria-label="Main">
      <Link href="/" prefetch={false} aria-current={current(["for-you"])}><House size={22} aria-hidden="true" strokeWidth={1.7} /><span>Home</span></Link>
      <Link href="/markets" prefetch={false} aria-current={current(["markets", "search"])}><ChartLine size={22} aria-hidden="true" strokeWidth={1.7} /><span>Markets</span></Link>
      <Link href={viewer ? "/create" : "/sign-up"} prefetch={false} className="yt-bottom-create" aria-current={current(["create"])} aria-label="Create"><Plus size={24} aria-hidden="true" /></Link>
      <Link href="/following" prefetch={false} aria-current={current(["following"])}><Users size={22} aria-hidden="true" strokeWidth={1.7} /><span>Following</span></Link>
      <Link href={viewer ? "/portfolio" : "/sign-in"} prefetch={false} aria-current={current(["portfolio", "activity"])}>
        {viewer ? <Avatar name={viewer.displayName ?? "You"} photo={viewer.photo} size={24} /> : <UserRound size={22} aria-hidden="true" strokeWidth={1.7} />}
        <span>You</span>
      </Link>
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
