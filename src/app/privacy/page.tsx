import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/app/components/info-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "A plain-language privacy summary for the Mitra campus pilot.",
};

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="PRIVACY · UPDATED OCTOBER 5, 2026" title="Your goals are social. Your documents are not." intro="This is a plain-language summary of what the current pilot collects, what anyone visiting Mitra can see, and what stays private.">
      <div className="info-grid">
        <section className="info-card">
          <span className="info-number">01</span>
          <h2>What anyone can see</h2>
          <p>Anyone who visits Mitra, with or without an account, can see your display name, handle, profile photo, approved goal terms, market prices, aggregate point volume, outcomes, and short evidence statements approved by the Mitra owner. Goal pages ask search engines not to list them.</p>
        </section>
        <section className="info-card">
          <span className="info-number">02</span>
          <h2>What stays private</h2>
          <p>Your sign-in details, wallet, individual positions, objections, moderation notes, and original evidence files are not shown to the community. Evidence originals are visible only to you and the Mitra owner.</p>
        </section>
        <section className="info-card">
          <span className="info-number">03</span>
          <h2>How evidence is reviewed</h2>
          <p>An automated service may read a submitted document to suggest a short publishable statement and identify private details to omit. The owner reviews the original and decides what statement, if any, is published. The original document itself is never published.</p>
        </section>
        <section className="info-card">
          <span className="info-number">04</span>
          <h2>Basic activity measurement</h2>
          <p>Mitra records when a goal is shown or opened, whether or not the visitor has an account, and records completed trades for accounting. The current feed events do not include a viewer identity, but repeated refreshes can create additional event counts.</p>
        </section>
        <section className="info-card">
          <span className="info-number">05</span>
          <h2>Storage and access</h2>
          <p>Authentication, database records, and private file storage are provided through Supabase. Application hosting is provided through Vercel. Access is limited by the app’s account and owner controls, but no online service can promise absolute security.</p>
        </section>
        <section className="info-card">
          <span className="info-number">06</span>
          <h2>Leaving the pilot</h2>
          <p>There is not yet a self-service account-deletion button. Until that is built, contact the person who invited you before submitting sensitive material if this limitation does not work for you.</p>
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
