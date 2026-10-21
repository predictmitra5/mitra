import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/app/components/info-page";

export const metadata: Metadata = {
  title: "FAQ",
  description: "How Mitra works: founder videos, startup order books, and how markets are made and settled.",
};

export default function FaqPage() {
  const questions = [
 {question:'What is Mitra?',answer:'Discover founders and startups through short videos, follow their progress and explore Yes/No markets on independently verifiable milestones.'},
 {question:'Can I deposit or trade now?',answer:'Account funding, withdrawals and customer trading are unavailable. Monetary balances begin at zero. No promotional trading credits or replacement balances are issued.'},
 {question:'What do market prices mean?',answer:'Each side has its own order book and executable offers. The last traded price is a historical reference, not a promise that another order will fill. With no resting offers we display No offer. Fully collateralized winning contracts pay $1 and losing contracts pay $0 under the published rules once funded trading is authorized.'},
 {question:'How are contracts matched?',answer:'Limit orders match eligible resting liquidity at the best executable price, then earliest order time. The resting order sets execution price. Orders may fill partly, remain open, or be cancelled. Self-trading and unsupported short selling are prohibited.'},
 {question:'What are demo startups?',answer:'Content marked Demo is fictional and is shown for illustration. It creates no monetary balances, financial executions or live trading volume.'},
 {question:'What happens if a source is missing?',answer:'Missing information never means No. Unresolved markets require review against their published conditions and results deadline. A void cancels open orders and pays $0.50 per fully collateralized contract.'},
 {question:'Who can trade a startup’s markets?',answer:'Founders, startup managers, market outcome decision-makers and owners who resolve markets are prohibited from trading markets they influence. Verified legal, identity and geographic requirements must also be satisfied before execution can open.'},
 {question:'How are videos selected?',answer:'The feed uses viewing, follows, saves, comments and industry interests. It does not use trading positions or market prices to rank videos.'},
 {question:'Is Mitra approved to accept customer money?',answer:'No such approval is claimed. The operating entity, regulatory route or regulated partner, custody, identity checks, eligible products and launch authorization still require verification before funding or customer execution can open.'}
 ];
  return (
    <InfoPage eyebrow="MITRA FAQ" title="Questions, answered." intro="The short version of how Mitra works and where its current boundaries are.">
      <section className="faq-list" aria-label="Frequently asked questions">
        {questions.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}<span aria-hidden="true">+</span></summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
      <aside className="info-callout">
        <p>Want the details on your data?</p>
        <Link href="/privacy">Read the privacy summary <span aria-hidden="true">↗︎</span></Link>
      </aside>
    </InfoPage>
  );
}
