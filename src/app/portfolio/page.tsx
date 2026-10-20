import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { positionsPageNumber, loadPositions, PositionsError, readClosedPositions, readTradeHistory, type ClosedPosition, type PositionsPage, type TradeRecord } from "@/modules/account/positions";
import { readViewerOrNull, type Viewer } from "@/modules/account/viewer";
import { photoUrl } from "@/modules/account/photo-url";
import { readFollowing, readSavedVideoIds } from "@/modules/social/service";
import { readVideoCards } from "@/modules/startups/read";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { toVideoCardData, type VideoCardData } from "@/app/components/feed/video-data";
import { PortfolioView, type Following } from "./portfolio-view";

/* The member's profile and portfolio (2026-10-19). Identity comes only from the server. */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portfolio", robots: { index: false, follow: false } };

export default async function Portfolio({ searchParams }: PageProps<"/portfolio">) {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  let data: PositionsPage | undefined;
  let closed: ClosedPosition[] = [];
  let history: TradeRecord[] = [];
  let following: Following = { founders: [], startups: [] };
  let saved: VideoCardData[] = [];
  let me = { name: "You", handle: "", photo: null as string | null };
  let balanceMicro = 0;
  let failure: PositionsError | undefined;
  // The top bar's details are looked up only once the page reads the database anyway.
  let viewer: Viewer | null = null;
  try {
    const page = positionsPageNumber((await searchParams).page);
    const db = getDb();
    viewer = await readViewerOrNull(db, identity.id);
    data = await loadPositions(db, identity.id, page);
    // Everything below is additive: positions still show if any of it fails.
    const [row] = await db.select({ profile: schema.profiles, wallet: schema.wallets }).from(schema.profiles)
      .leftJoin(schema.wallets, eq(schema.wallets.userId, schema.profiles.id)).where(eq(schema.profiles.id, identity.id)).limit(1);
    if (row) {
      me = { name: row.profile.displayName, handle: row.profile.handle, photo: photoUrl(row.profile.handle, row.profile.photoUpdatedAt) };
      // Rounded down to a tenth, never showing more than is there.
      balanceMicro = Math.floor((row.wallet?.balanceMicro ?? 0) / 100_000) * 100_000;
    }
    history = await readTradeHistory(db, identity.id).catch(() => []);
    closed = await readClosedPositions(db, identity.id).catch(() => []);
    following = await readFollowing(db, identity.id).catch(() => following);
    const savedIds = await readSavedVideoIds(db, identity.id, 12).catch(() => []);
    saved = (await readVideoCards(db, savedIds, identity.id).catch(() => [])).map(toVideoCardData);
  } catch (error) {
    failure = error instanceof PositionsError ? error : new PositionsError("UNAVAILABLE", "Your portfolio couldn’t load. Please try again shortly.");
  }
  return <div className="market-shell"><MarketHeader viewer={viewer ?? { displayName: null, photo: null, balanceMicro: null, ownerQueue: null }} active="portfolio" /><main className="account portfolio">
    {data ? <PortfolioView me={me} balanceMicro={balanceMicro} data={data} closed={closed} trades={history} following={following} saved={saved} /> : <section className="account-empty">
      <h1>{failure?.code === "PROFILE_REQUIRED" ? "Finish setting up your account." : "Portfolio unavailable."}</h1>
      <p role="alert">{failure?.message}</p>
      <Link className="btn btn-quiet" href={failure?.code === "PROFILE_REQUIRED" ? "/welcome" : "/portfolio"}>{failure?.code === "PROFILE_REQUIRED" ? "Finish setting up" : "Reload"}</Link>
    </section>}
  </main><MarketFooter /></div>;
}
