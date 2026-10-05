import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/app/components/info-page";

export const metadata: Metadata = {
  title: "FAQ",
  description: "How Mitra works, who can join, and how goals are resolved.",
};

export default function FaqPage() {
  const questions = [
    {
      question: "What is Mitra?",
      answer: "A university prediction community for personal goals. People post goals about themselves, and their community uses Yes or No points to forecast whether those goals will happen. Anyone can browse; trading and posting need a verified Ohio State or Illinois email.",
    },
    {
      question: "Is Mitra affiliated with a university?",
      answer: "No. Mitra is an independent platform and is not affiliated with, endorsed by, or sponsored by any university.",
    },
    {
      question: "How do points work?",
      answer: "Every account starts with 1,000 points. Points are not currently cash or prizes.",
    },
    {
      question: "Who can post a goal?",
      answer: "The current communities are for adults with a verified OSU or UIUC email. You can post a goal only about yourself, and a profile photo is required before posting.",
    },
    {
      question: "Can I trade on my own goal?",
      answer: "No. A goal’s subject cannot buy or sell on that market. Anyone recorded as deciding the outcome is also blocked from trading it.",
    },
    {
      question: "How does a goal become a market?",
      answer: "The subject submits the goal and its proof rules. The Mitra owner reviews it, either rejects it or opens it, and sets the opening probability. Wording is frozen once trading opens.",
    },
    {
      question: "How is the outcome verified?",
      answer: "The subject submits a document or link during the proof window. Original documents remain private. The Mitra owner reviews the evidence and publishes a short verified statement, followed by an objection period before settlement.",
    },
    {
      question: "What happens if there is no proof?",
      answer: "Under the current pilot rules, missing proof resolves the goal as No after the proof window. The owner records that ruling before the objection period begins.",
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
        <p>Want the details on data and evidence?</p>
        <Link href="/privacy">Read the privacy summary <span aria-hidden="true">↗︎</span></Link>
      </aside>
    </InfoPage>
  );
}
