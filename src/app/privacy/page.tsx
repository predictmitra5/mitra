import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/app/components/info-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "A plain-language privacy summary for Mitra.",
};

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="PRIVACY · UPDATED OCTOBER 19, 2026" title="Founders are public. Your account is not." intro="This is a plain-language summary of what Mitra collects, what anyone visiting can see, and what stays private.">
      <div className="info-grid">
        <section className="info-card">
          <span className="info-number">01</span>
          <h2>What anyone can see</h2>
          <p>Approved founder and startup profiles, their videos and updates, and markets: their terms, sources, prices, executed contract volume, how many people traded, rulings and outcomes. Comments show the commenter&rsquo;s name, handle and photo. Like, save and follower counts are public; who liked, saved or followed is not. Markets and trades never show who traded.</p>
        </section>
        <section className="info-card">
          <span className="info-number">02</span>
          <h2>What stays private</h2>
          <p>Your sign-in details, USD balances and order reservations, positions, trade history, saved videos, follows, market suggestions, reports, objections and moderation notes. Profiles, startups and videos a founder submits stay private to them and the owner until approved.</p>
        </section>
        <section className="info-card">
          <span className="info-number">03</span>
          <h2>What the feed learns from</h2>
          <p>To pick videos for you, Mitra records what you are shown, how long and how far you watch, skips, shares, likes, saves, follows, comments and &ldquo;not interested&rdquo;, and keeps a running interest score per industry. If you are signed in this is stored with your account; if not, with a random identifier in a first-party cookie (mitra_viewer) that holds nothing personal. Prices and trading are never used to rank videos.</p>
        </section>
        <section className="info-card">
          <span className="info-number">04</span>
          <h2>Markets and measurement</h2>
          <p>Markets are settled by the Mitra owner from each market&rsquo;s named source. Mitra also counts when a market is shown to or opened by a signed-in member, as capped hourly totals with no viewer identity kept for 24 hours, to order the market directory, and records completed trades for accounting.</p>
        </section>
        <section className="info-card">
          <span className="info-number">05</span>
          <h2>Financial records</h2>
          <p>The exchange keeps an append-only record of orders, executions and balanced accounting entries. Account funding and trading are currently unavailable. Identity, custody and retention requirements for a future launch remain subject to the selected operating arrangement.</p>
        </section>
        <section className="info-card">
          <span className="info-number">06</span>
          <h2>Storage and access</h2>
          <p>Authentication, the database and file storage are provided through Supabase; hosting through Vercel. Images founders upload are re-encoded so no location or camera data stays in them. Access is limited by the app&rsquo;s account and owner controls, but no online service can promise absolute security.</p>
        </section>
        <section className="info-card">
          <span className="info-number">07</span>
          <h2>Leaving</h2>
          <p>You can permanently delete your account from the account page. Mitra removes your login, profile details, photo, any earlier proof files, and suggestions that were never published. Settled trades and ledger entries remain as anonymized accounting records.</p>
        </section>
      </div>
      <aside className="info-callout info-callout-wide">
        <div>
          <strong>Independent by design.</strong>
          <p>Mitra is an independent platform and does not imply endorsement by any startup featured on it. Account funding and trading are not available yet.</p>
        </div>
        <Link href="/faq">Read the FAQ <span aria-hidden="true">↗︎</span></Link>
      </aside>
    </InfoPage>
  );
}
