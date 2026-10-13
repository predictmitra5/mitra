import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { ShopOffers } from "./shop-offers";

export const metadata = { title: "Coins and a badge", robots: { index: false } };

export default async function ShopPage() {
  const identity = await currentIdentity();
  const viewer = await readViewerOrNull(getDb(), identity?.id);
  return <div className="market-shell">
    <MarketHeader viewer={viewer} />
    <main className="account-main shop-main">
      <div className="account-topline"><span className="eyebrow">MITRA SHOP</span></div>
      <section className="account-welcome"><h1>Get more Coins.</h1><p>Choose a Coin amount. Each level includes the Campus Original badge and the same amount in Trade Coins after confirmed payment. The bonus is disclosed before payment. Payments are not connected yet, so no charge or Coins are issued.</p></section>
      <ShopOffers />
    </main>
    <MarketFooter />
  </div>;
}
