import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { positionsPageNumber, loadPositions, PositionsError, type PositionsPage } from "@/modules/account/positions";
import { readViewerOrNull, type Viewer } from "@/modules/account/viewer";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { PositionsView } from "./positions-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Positions", robots: { index: false, follow: false } };

export default async function Positions({ searchParams }: PageProps<"/positions">) {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  let data: PositionsPage | undefined;
  let failure: PositionsError | undefined;
  // The top bar's details are looked up only once the page is reading the
  // database anyway: a malformed page number touches no data at all.
  let viewer: Viewer | null = null;
  try {
    const page = positionsPageNumber((await searchParams).page);
    const db = getDb();
    viewer = await readViewerOrNull(db, identity.id);
    data = await loadPositions(db, identity.id, page);
  } catch (error) {
    failure = error instanceof PositionsError ? error : new PositionsError("UNAVAILABLE", "Your positions couldn’t load. Please try again shortly.");
  }
  return <div className="market-shell"><MarketHeader viewer={viewer ?? { displayName: null, photo: null, balanceMicro: null, ownerQueue: null }} active="positions" /><main className="account">
    {data ? <PositionsView data={data} /> : <section className="account-empty">
      <h1>{failure?.code === "PROFILE_REQUIRED" ? "Finish setting up your account." : "Positions unavailable."}</h1>
      <p role="alert">{failure?.message}</p>
      <Link className="btn btn-quiet" href={failure?.code === "PROFILE_REQUIRED" ? "/account" : "/positions"}>{failure?.code === "PROFILE_REQUIRED" ? "Open your account" : "Reload positions"}</Link>
    </section>}
  </main><MarketFooter /></div>;
}
