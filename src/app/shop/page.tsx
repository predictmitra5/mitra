import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { ShopOffers } from "./shop-offers";

export const metadata = { title: "Badges and Silver Coins", robots: { index: false } };

export default async function ShopPage() {
  const identity = await currentIdentity();
  const viewer = await readViewerOrNull(getDb(), identity?.id);
  return <div className="market-shell">
    <MarketHeader viewer={viewer} />
    <main className="account-main shop-main">
      <div className="account-topline"><span className="eyebrow">MITRA SHOP</span></div>
      <section className="account-welcome"><h1>Choose a badge.</h1><p>Each offer includes the badge shown, Silver Coins, and an equal Gold Trade Coin bonus after confirmed payment. Payments are not connected yet.</p></section>
      <ShopOffers />
    </main>
    <MarketFooter />
  </div>;
}
