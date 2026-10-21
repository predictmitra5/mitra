import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { readFollowing, readSavedVideoIds } from "@/modules/social/service";
import { readVideoCards } from "@/modules/startups/read";
import { readExchange } from "@/modules/exchange/store";
import { funds } from "@/modules/exchange/engine";
import { readCards } from "@/modules/discovery/feed";
import { photoUrl } from "@/modules/account/photo-url";
import {
  MarketHeader,
  MarketFooter,
} from "@/app/components/market/market-header";
import { toVideoCardData } from "@/app/components/feed/video-data";
import { PortfolioView } from "./portfolio-view";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false, follow: false },
};
export default async function Portfolio() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const db = getDb();
  const [viewer, state, following, savedIds, rows] = await Promise.all([
    readViewerOrNull(db, identity.id),
    readExchange(db),
    readFollowing(db, identity.id),
    readSavedVideoIds(db, identity.id, 12),
    db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, identity.id)),
  ]);
  const p = rows[0];
  if (!p?.adultConfirmedAt) redirect("/welcome");
  const orders = state.orders.filter(
      (o) => o.userId === identity.id && o.status === "open",
    ),
    holdings = state.holdings.filter(
      (h) => h.userId === identity.id && h.available + h.reserved > 0,
    ),
    fills = state.fills
      .filter(
        (f) => f.makerUserId === identity.id || f.takerUserId === identity.id,
      )
      .slice(-50)
      .reverse();
  const [saved, cards] = await Promise.all([
    readVideoCards(db, savedIds, identity.id),
    readCards(db, [
      ...new Set([...orders, ...holdings, ...fills].map((x) => x.marketId)),
    ]),
  ]);
  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="portfolio" />
      <main className="account portfolio">
        <PortfolioView
          me={{
            name: p.displayName,
            handle: p.handle,
            photo: photoUrl(p.handle, p.photoUpdatedAt),
          }}
          funds={funds(state, identity.id)}
          holdings={holdings.map((h) => ({
            outcome: h.outcome,
            available: h.available,
            reserved: h.reserved,
            marketId: h.marketId,
          }))}
          orders={orders.map((o) => ({
            id: o.id,
            marketId: o.marketId,
            outcome: o.outcome,
            direction: o.direction,
            price: o.price,
            remaining: o.remaining,
          }))}
          fills={fills.map((f) => ({
            id: f.id,
            marketId: f.marketId,
            quantity: f.quantity,
            price: f.price,
            outcome: f.outcome,
            at: f.at,
          }))}
          marketNames={Object.fromEntries(cards.map((c) => [c.id, c.question]))}
          following={following}
          saved={saved.map(toVideoCardData)}
        />
      </main>
      <MarketFooter />
    </div>
  );
}
