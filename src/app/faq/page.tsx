import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/app/components/info-page";

export const metadata: Metadata = {
  title: "FAQ",
  description: "How Mitra works, who can join, and how campus event markets are made and resolved.",
};

export default function FaqPage() {
  const questions = [
    {
      question: "What is Mitra?",
      answer: "A campus prediction market for things that happen around you: a venue’s busy night, a screening’s turnout, an event’s attendance. You use Yes or No points to forecast whether each one happens. Anyone can browse; trading and suggesting markets need a verified Ohio State or Illinois email.",
    },
    {
      question: "Is Mitra affiliated with a university or the venues?",
      answer: "No. Mitra is an independent platform and is not affiliated with, endorsed by, or sponsored by any university. Unless a market says its source is connected, Mitra has no partnership with the venue it is about.",
    },
    {
      question: "How do points work?",
      answer: "Every account starts with 1,000 points, and you can put at most 100 points into any one market. Points are not currently cash or prizes.",
    },
    {
      question: "What are sample markets?",
      answer: "Markets marked Sample are hypothetical demonstrations. Their sources are placeholders and their early price history is demonstration data. You can trade them with real points; when they are retired they are voided and everyone is refunded what they paid.",
    },
    {
      question: "How does a market get made?",
      answer: "Anyone with an account can suggest one. Suggestions are private to you and the Mitra owner. The owner either turns it down with a reason you can read, or publishes it with exact Yes and No conditions, an event window, a trading cutoff, a results deadline, a named source, and opening odds. Wording is frozen once trading opens.",
    },
    {
      question: "How is the outcome decided?",
      answer: "Each market names the source of its number, such as a venue’s point-of-sale count or a ticketing report, and says whether that source is connected or still a placeholder. After the event window ends, the owner checks the source and records the outcome with an explanation. A 24-hour objection period follows before payout.",
    },
    {
      question: "What if the result never comes in?",
      answer: "If the source has not reported by the results deadline, the market resolves No. A market that turns out to be broken, for example an event that never happens, is voided and everyone is refunded.",
    },
    {
      question: "Are there things I shouldn’t do?",
      answer: "Don’t buy, or ask anyone to buy, at a venue to move a market, and don’t trade a market about a place where you work or that you own. Anyone recorded as deciding a market’s outcome is blocked from trading it.",
    },
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
