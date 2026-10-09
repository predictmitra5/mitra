import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { CAMPUSES } from "@/config/campus";
import { currentIdentity } from "@/modules/auth/server";
import { isInactive } from "@/modules/account/standing";
import { readViewerOrNull } from "@/modules/account/viewer";
import { listVenues } from "@/modules/events/service";
import { toLocalInput } from "@/modules/events/time";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { SuggestForm } from "./suggest-form";

/*
 * A student suggests a market (the brief, 2026-10-08): the question, the venue,
 * when it happens and how it could be checked. It waits for the owner, who
 * writes the exact rules and sets the opening odds, or turns it down with a
 * reason. Nothing here is ever published by itself.
 */

export const metadata: Metadata = { title: "Suggest a market", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SuggestPage() {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) redirect("/sign-in");
  const database = getDb();
  const [profile] = await database.select().from(schema.profiles).where(eq(schema.profiles.id, identity.id)).limit(1);
  if (!profile?.adultConfirmedAt) redirect("/welcome");
  if (isInactive(profile)) redirect("/account");

  const campus = CAMPUSES[identity.campus];
  const venues = await listVenues(database, identity.campus).catch(() => []);
  const viewer = await readViewerOrNull(database, identity.id);
  const now = new Date();
  const earliest = toLocalInput(new Date(now.getTime() + 60 * 60_000), campus.timeZone);

  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} />
      <main className="account-main">
        <div className="account-topline"><span className="eyebrow">SUGGEST A MARKET</span><Link className="text-button" href="/account">Back to account</Link></div>
        <section className="account-welcome">
          <h1>What’s going to happen around {campus.communityName}?</h1>
          <p>Suggest something people can trade on: a venue’s busy night, a sellout, a turnout. Only you and the owner see your suggestion. If the owner publishes it, they write the exact rules and set the opening odds first.</p>
        </section>
        <section className="account-card">
          <SuggestForm venues={venues.map((venue) => ({ id: venue.id, name: venue.name }))} earliest={earliest} zoneLabel={campus.timeZone === "America/New_York" ? "Eastern time" : "Central time"} />
        </section>
      </main>
      <MarketFooter />
    </div>
  );
}
