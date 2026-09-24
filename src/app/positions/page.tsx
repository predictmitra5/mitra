import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { positionsPageNumber, loadPositions, PositionsError, type PositionsPage } from "@/modules/account/positions";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { PositionsView } from "./positions-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your predictions", robots: { index: false, follow: false } };

export default async function Positions({ searchParams }: PageProps<"/positions">) {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  // One clock for the whole render, so every card's time-left badge agrees.
  const now = new Date();
  let data: PositionsPage | undefined;
  let failure: PositionsError | undefined;
  try {
    const page = positionsPageNumber((await searchParams).page);
    const db = getDb();
    data = await loadPositions(db, identity.id, page);
  } catch (error) {
    failure = error instanceof PositionsError ? error : new PositionsError("UNAVAILABLE", "Your predictions couldn’t load. Please try again shortly.");
  }
  return <div className="market-shell"><MarketHeader signedIn /><main className="account-main positions-main">
    <nav className="market-nav"><Link href="/account">← Your account</Link><span className="eyebrow">ONLY VISIBLE TO YOU</span></nav>
    {data ? <PositionsView data={data} now={now} /> : <section className="account-card"><h1>{failure?.code === "PROFILE_REQUIRED" ? "Finish setting up your account." : "Predictions unavailable."}</h1><p role="alert">{failure?.message}</p><Link className="secondary-button" href={failure?.code === "PROFILE_REQUIRED" ? "/account" : "/positions"}>{failure?.code === "PROFILE_REQUIRED" ? "Open your account" : "Reload predictions"}</Link></section>}
  </main><MarketFooter /></div>;
}
