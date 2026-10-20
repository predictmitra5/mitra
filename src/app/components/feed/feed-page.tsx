import Link from "next/link";
import { MarketHeader } from "../market/market-header";
import { SignupPrompt } from "../signup-prompt";
import { Reel } from "./reel";
import type { VideoCardData } from "./video-data";
import type { Viewer } from "@/modules/account/viewer";

/*
 * The home of Mitra since 2026-10-19: founder videos first. "For you" is the
 * recommendation; "Following" is founders and startups the viewer follows.
 * Visitors browse freely and get the sign-up pop-up as before.
 */
export function FeedPage({ tab, cards, signedIn, viewer, unavailable }: {
  tab: "for-you" | "following"; cards: VideoCardData[]; signedIn: boolean; viewer: Viewer | null; unavailable: boolean;
}) {
  const empty = unavailable ? (
    <section className="feed-empty">
      <h2>The feed is temporarily unavailable.</h2>
      <p>Please try again shortly. Markets are still open at <Link href="/markets">Markets</Link>.</p>
    </section>
  ) : tab === "following" ? (
    <section className="feed-empty">
      <h2>{signedIn ? "Nothing from people you follow yet." : "Follow founders to fill this tab."}</h2>
      <p>{signedIn ? "Follow founders and startups from their videos and profiles, and their new videos land here first." : "Create an account, then follow founders and startups to see their videos here."}</p>
      <Link className="btn btn-primary" href={signedIn ? "/" : "/sign-up"}>{signedIn ? "Find founders in For you" : "Create an account"}</Link>
    </section>
  ) : (
    <section className="feed-empty">
      <h2>No founder videos yet.</h2>
      <p>Videos appear here once the owner approves them. Building something? Create your founder profile and post the first one.</p>
      <Link className="btn btn-primary" href={signedIn ? "/create" : "/sign-up"}>{signedIn ? "Create" : "Create an account"}</Link>
    </section>
  );
  return (
    <div className="market-shell feed-shell">
      <MarketHeader viewer={viewer} active={tab} />
      <nav className="tabs feed-tabs" aria-label="Feeds">
        <ul>
          <li><Link href="/" prefetch={false} aria-current={tab === "for-you" ? "page" : undefined}>For you{tab === "for-you" && <span className="tab-line" aria-hidden="true" />}</Link></li>
          <li><Link href="/following" prefetch={false} aria-current={tab === "following" ? "page" : undefined}>Following{tab === "following" && <span className="tab-line" aria-hidden="true" />}</Link></li>
          <li><Link href="/markets" prefetch={false}>Markets</Link></li>
        </ul>
      </nav>
      <main className="feed-page">
        <h1 className="sr-only">{tab === "following" ? "Following" : "For you"}: founder videos</h1>
        <Reel initial={cards} signedIn={signedIn} following={tab === "following"} empty={empty} />
      </main>
      {!signedIn && <SignupPrompt />}
    </div>
  );
}
