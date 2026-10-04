import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { readViewerOrNull } from "@/modules/account/viewer";
import { currentIdentity } from "@/modules/auth/server";
import { MarketFooter, MarketHeader } from "./market/market-header";

export async function InfoPage({ eyebrow, title, intro, children }: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  let viewer = null;
  try {
    const identity = await currentIdentity();
    if (identity) viewer = await readViewerOrNull(getDb(), identity.id);
  } catch {
    // These pages remain public even when identity or the database is unavailable.
  }
  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} />
      <main className="info-page">
        <header className="info-hero">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        {children}
      </main>
      <MarketFooter />
    </div>
  );
}
