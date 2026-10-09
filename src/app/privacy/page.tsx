import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/app/components/info-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "A plain-language privacy summary for the Mitra campus pilot.",
};

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="PRIVACY · UPDATED OCTOBER 8, 2026" title="Markets are public. Your account is not." intro="This is a plain-language summary of what the current pilot collects, what anyone visiting Mitra can see, and what stays private.">
      <div className="info-grid">
        <section className="info-card">
          <span className="info-number">01</span>
          <h2>What anyone can see</h2>
          <p>Anyone who visits Mitra, with or without an account, can see published markets: their venues, terms, sources, prices, aggregate point volume, rulings and outcomes. Your display name, handle and profile photo make up your profile; markets and trades do not show who traded. Market pages ask search engines not to list them.</p>
        </section>
        <section className="info-card">
          <span className="info-number">02</span>
          <h2>What stays private</h2>
          <p>Your sign-in details, wallet, individual positions, trade history, market suggestions, objections and moderation notes are not shown to the community. Suggestions and objections are visible only to you and the Mitra owner.</p>
        </section>
        <section className="info-card">
          <span className="info-number">03</span>
          <h2>How markets are settled</h2>
          <p>Markets are settled by the Mitra owner from each market’s named source, such as a venue’s own count. Mitra does not collect personal information about venue customers. Earlier goal markets that asked members for proof documents have ended.</p>
        </section>
        <section className="info-card">
          <span className="info-number">04</span>
          <h2>Basic activity measurement</h2>
          <p>Mitra records when a market is shown or opened, whether or not the visitor has an account, and records completed trades for accounting. The current feed events do not include a viewer identity, but repeated refreshes can create additional event counts.</p>
        </section>
        <section className="info-card">
          <span className="info-number">05</span>
          <h2>Storage and access</h2>
          <p>Authentication, database records, and private file storage are provided through Supabase. Application hosting is provided through Vercel. Access is limited by the app’s account and owner controls, but no online service can promise absolute security.</p>
        </section>
        <section className="info-card">
          <span className="info-number">06</span>
          <h2>Leaving the pilot</h2>
          <p>You can permanently delete your account from the account page. Mitra removes your login, profile details, photo, any earlier proof files, and suggestions that were never published. Settled trades and ledger entries remain as anonymized accounting records.</p>
        </section>
      </div>
      <aside className="info-callout info-callout-wide">
        <div>
          <strong>Independent by design.</strong>
          <p>Mitra is an independent platform and is not affiliated with, endorsed by, or sponsored by any university.</p>
        </div>
        <Link href="/faq">Read the FAQ <span aria-hidden="true">↗︎</span></Link>
      </aside>
    </InfoPage>
  );
}
