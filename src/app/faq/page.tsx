import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/app/components/info-page";

export const metadata: Metadata = {
  title: "FAQ",
  description: "How Mitra works: founder videos, startup markets, Trade Coins, and how markets are made and settled.",
};

export default function FaqPage() {
  const questions = [
    {
      question: "What is Mitra?",
      answer: "A place to discover founders before they are famous. You watch short videos from founders about what they are building, follow the ones you like, and predict their startups' milestones on Yes or No markets with Trade Coins. Anyone can watch and browse; trading, following and commenting need an account.",
    },
    {
      question: "How does the For you feed pick videos?",
      answer: "From what you watch, how far you watch, what you like, save, share and skip, the industries you pick when you join, and the founders you follow, plus some videos from new founders and from outside your usual industries so unknown founders get seen. It never uses market prices, trading or anyone's positions, so it cannot be used to push a market up or down.",
    },
    {
      question: "How do Trade Coins work?",
      answer: "Trade Coins are Mitra’s market-trading balance. New accounts start at zero. Eligible QR campaigns may award Trade Coins after a browser location check; device location can be inaccurate or spoofed and is not proof of presence. At most 100 Trade Coins can be committed to any one market. Trade Coins are not currently redeemable for cash or prizes, and purchases are not available while payment processing is being set up.",
    },
    {
      question: "What are Coins?",
      answer: "Coins are intended for digital items such as the Campus Original badge. The shop previews possible Coin bundles and their Trade Coin bonus, but checkout is disabled: no payment is taken and no Coins are issued.",
    },
    {
      question: "What does a price mean?",
      answer: "A Yes price of 42¢ means traders put the chance at about 42%. Each contract pays 1 Trade Coin if its side wins and 0 if it loses, so buying Yes at 42¢ makes 58¢ per contract if Yes happens. Prices move as people trade against Mitra's automated market maker.",
    },
    {
      question: "What are demo startups?",
      answer: "Startups, founders, videos and markets marked Demo are fictional, made to show how Mitra works. Their price history comes from simulated trades by fictional demo traders. You can trade them with Trade Coins; when they are retired they are voided and everyone is refunded what they paid.",
    },
    {
      question: "How does a market get made?",
      answer: "Only the Mitra owner opens markets, each on a measurable milestone of an approved startup: a user count checked by an audit, a public listing, a named competition result, a date. Every market states exactly when it resolves Yes and No, its deadline, how the number is measured, its source, and what happens if the source is missing or sources disagree. Founders can suggest a market; they cannot open, change or settle one.",
    },
    {
      question: "Can founders trade their own markets?",
      answer: "No. Founders, and anyone who manages a startup's profile, are blocked from trading that startup's markets. Anyone recorded as deciding an outcome is blocked too.",
    },
    {
      question: "How is the outcome decided?",
      answer: "After trading closes, the owner checks the market's named source and records the outcome with an explanation. A 24-hour objection period follows before payout.",
    },
    {
      question: "What if the result never comes in?",
      answer: "Missing data is not a No. If the source has not reported by the published results deadline, the owner can void the market and refund each participant’s held cost. A market that turns out to be broken is handled the same way.",
    },
    {
      question: "What does \"verified\" mean on a profile?",
      answer: "Claims carry one of four labels: unverified (nobody has checked), founder-reported (the founder says so), independently verified (checked against a source outside the company), or disputed (sources disagree). Demo numbers are never presented as verified facts about real companies.",
    },
    {
      question: "Is Mitra affiliated with a university or the startups?",
      answer: "No. Mitra is independent and is not affiliated with, endorsed by, or sponsored by any university. A startup appearing on Mitra does not mean Mitra endorses it.",
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
