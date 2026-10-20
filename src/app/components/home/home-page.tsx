import Link from "next/link";
import { MarketHeader } from "../market/market-header";
import { SignupPrompt } from "../signup-prompt";
import { HomeGrid } from "./home-grid";
import type { Topic } from "./topics";
import type { HomeData } from "./load";

/*
 * The home page and Following (2026-10-20): YouTube's home with the guide
 * beside it. Visitors browse freely and get the sign-up pop-up as before.
 */
export function HomePage({ data, following = false, topic = "all" }: { data: HomeData; following?: boolean; topic?: Topic }) {
  const empty = data.unavailable ? (
    <section className="feed-empty">
      <h2>Home is temporarily unavailable.</h2>
      <p>Please try again shortly. Markets are still open at <Link href="/markets">Markets</Link>.</p>
    </section>
  ) : following ? (
    <section className="feed-empty">
      <h2>{data.signedIn ? "Nothing from founders you follow yet." : "Follow founders to fill this page."}</h2>
      <p>{data.signedIn ? "Follow founders and startups from their videos and profiles, and their new videos show up here first." : "Create an account, then follow founders and startups to see their videos here."}</p>
      <Link className="btn btn-primary" href={data.signedIn ? "/" : "/sign-up"}>{data.signedIn ? "Find founders on Home" : "Create an account"}</Link>
    </section>
  ) : topic !== "all" ? (
    <section className="feed-empty">
      <h2>Nothing here yet.</h2>
      <p>No founder videos match this topic yet. Every market is in <Link href="/markets">Markets</Link>.</p>
    </section>
  ) : (
    <section className="feed-empty">
      <h2>No founder videos yet.</h2>
      <p>Videos appear here once the owner approves them. Building something? Create your founder profile and post the first one.</p>
      <Link className="btn btn-primary" href={data.signedIn ? "/create" : "/sign-up"}>{data.signedIn ? "Create" : "Create an account"}</Link>
    </section>
  );
  return (
    <div className="market-shell yt-shell">
      <MarketHeader viewer={data.viewer} active={following ? "following" : "for-you"} guide />
      <main className="yt-main">
        <h1 className="sr-only">{following ? "Following: founder videos" : "Mitra: founder videos and their markets"}</h1>
        <HomeGrid items={data.items} highlight={data.highlight} closingSoon={data.closingSoon} signedIn={data.signedIn}
          following={following} topic={topic} nowIso={new Date().toISOString()} empty={empty} />
      </main>
      {!data.signedIn && <SignupPrompt />}
    </div>
  );
}
