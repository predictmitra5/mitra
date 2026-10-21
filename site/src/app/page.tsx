import { ArrowRight, ArrowUpRight } from "lucide-react";
import { FaqList } from "@/components/faq-list";
import { HeroShell } from "@/components/hero";
import { HowStory } from "@/components/how-story";
import { LotusOutline } from "@/components/lotus-outline";
import { MarketCard } from "@/components/market-card";
import { MotionRoot } from "@/components/motion-root";
import { RulesCard } from "@/components/rules-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TeamSection } from "@/components/team-section";
import { EXAMPLES } from "@/content/examples";
import { FAQ } from "@/content/faq";
import { SHOW_TEAM } from "@/content/team";
import { app } from "@/lib/links";

/*
 * Mitra's website, one page (DECISIONS.md 2026-10-20, "Mitra's own website").
 * The words are currency-neutral, per the owner: founders, their videos, and
 * Yes/No markets on their milestones with clear rules; example markets are
 * demo data with no prices or volumes. Sections alternate black, white and
 * light grey; each after the opening is a sheet that slides over the last.
 */

export default function Home() {
  const items = [
    { id: "how", label: "How it works" },
    { id: "markets", label: "Markets" },
    { id: "founders", label: "For founders" },
    ...(SHOW_TEAM ? [{ id: "team", label: "Team" }] : []),
    { id: "faq", label: "FAQ" },
  ];

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader items={items} appUrl={app()} />
      <main id="main">
        <HeroShell>
          <div className="hero-copy">
            <p className="hero-kicker" data-hero-kicker><span className="pulse-dot" aria-hidden="true" />Founder videos, startup markets</p>
            <h1 className="display" data-split="hero">
              <span className="title-line">Watch founders build.</span>{" "}
              <span className="title-line">Call what happens next.</span>
            </h1>
            <p className="lede hero-lede" data-hero-fade>
              Mitra is where you discover early-stage founders through their videos, follow their startups, and call their next milestones in Yes/No markets.
            </p>
            <div className="hero-actions" data-hero-fade>
              <a className="btn btn-primary" href={app()}>
                Open Mitra
                <ArrowRight aria-hidden="true" strokeWidth={2} />
              </a>
              <a className="btn btn-ghost" href="#how">How it works</a>
            </div>
          </div>
        </HeroShell>

        <section id="markets" className="section has-rails" data-surface="paper" data-chapter>
          <div className="container" data-chapter-content>
            <div className="section-head">
              <div>
                <span className="tag" data-reveal>On Mitra</span>
                <h2 className="heading" data-split>What founders say they&rsquo;ll do next.</h2>
              </div>
              <div className="section-side" data-reveal>
                <p className="body">Each market turns one milestone into a Yes/No question with a date: a launch, a user count, a place in an accelerator.</p>
                <a className="link" href={app("/markets")}>See every market<ArrowUpRight aria-hidden="true" strokeWidth={2} /></a>
              </div>
            </div>
            <ul className="cards">
              {EXAMPLES.map((example) => <MarketCard key={example.key} example={example} href={app("/markets")} />)}
            </ul>
            <p className="fineprint" data-reveal>Examples from Mitra&rsquo;s demo catalog. These startups and founders are fictional.</p>
          </div>
        </section>

        <section id="how" className="section" data-surface="mist" data-chapter>
          <div className="container" data-chapter-content>
            <h2 className="statement bracketed" data-split>
              <span className="title-line">A pitch is easy.</span>{" "}
              <span className="title-line">A milestone is proof.</span>
            </h2>
            <HowStory>
              <span className="tag" data-reveal>How it works</span>
              <h3 className="heading-sm" data-split>From a founder&rsquo;s video to a clear call.</h3>
              <p className="body story-body" data-reveal>Founders show what they&rsquo;re building. Every market spells out what counts as getting there, and what doesn&rsquo;t.</p>
            </HowStory>
          </div>
        </section>

        <section id="rules" className="section" data-surface="ink" data-chapter>
          <div className="container" data-chapter-content>
            <h2 className="heading" data-split>Rules first. Then the market.</h2>
            <div className="story story-flip">
              <div className="story-art" data-reveal>
                <RulesCard />
              </div>
              <div className="story-copy story-copy-center" data-reveal>
                <span className="tag">How markets settle</span>
                <h3 className="heading-sm">Everyone reads the same rules.</h3>
                <p className="body story-body">Before a market opens, Mitra writes down what counts as Yes, what counts as No, where the answer will come from and when it closes. Once it opens, the wording is locked.</p>
                <p className="body">When it closes, Mitra checks that source and settles it. A startup&rsquo;s founders never settle, or trade, their own markets.</p>
              </div>
            </div>
            <ul className="facts" data-reveal>
              <li><strong>Locked wording</strong><span>A market&rsquo;s rules can&rsquo;t be edited once it opens.</span></li>
              <li><strong>Named sources</strong><span>Every market says where its answer will come from.</span></li>
              <li><strong>Labelled facts</strong><span>Claims on a startup&rsquo;s page say whether they&rsquo;re founder-reported, independently verified or disputed.</span></li>
            </ul>
          </div>
        </section>

        <section id="founders" className="section has-rails" data-surface="paper" data-chapter>
          <div className="container" data-chapter-content>
            <div className="section-head">
              <div>
                <span className="tag" data-reveal>For founders</span>
                <h2 className="heading" data-split>Your story. Your track record.</h2>
              </div>
              <p className="lede section-side" data-reveal>Show people what you&rsquo;re building, then let your milestones do the talking.</p>
            </div>
            <ol className="columns" data-reveal>
              <li>
                <span className="num">01</span>
                <h3 className="title">Post your videos</h3>
                <p className="body">Make a founder page, add your startup and post short videos. Mitra reviews each one before anyone else sees it.</p>
              </li>
              <li>
                <span className="num">02</span>
                <h3 className="title">Markets on your milestones</h3>
                <p className="body">Suggest a milestone you&rsquo;re chasing. Mitra writes the market: the question, the rules, the source and the close date.</p>
              </li>
              <li>
                <span className="num">03</span>
                <h3 className="title">Hands off your own markets</h3>
                <p className="body">Founders, and whoever registers a startup, can&rsquo;t trade its markets. That keeps every market fair to everyone watching.</p>
              </li>
            </ol>
            <div className="founders-cta" data-reveal>
              <a className="btn btn-primary" href={app("/create")}>
                Start a founder page
                <ArrowRight aria-hidden="true" strokeWidth={2} />
              </a>
            </div>
          </div>
        </section>

        {SHOW_TEAM && <TeamSection />}

        <section id="faq" className="section faq" data-surface="ink" data-chapter>
          <div className="container" data-chapter-content>
            <div className="faq-grid">
              <div className="faq-head">
                <h2 className="heading" data-split>Good questions. Straight answers.</h2>
                <a className="link" href={app("/faq")} data-reveal>Mitra&rsquo;s full FAQ<ArrowUpRight aria-hidden="true" strokeWidth={2} /></a>
              </div>
              <FaqList items={FAQ} />
            </div>

            <div className="closing" data-draw-trigger>
              <div className="closing-art" aria-hidden="true"><LotusOutline /></div>
              <h2 className="closing-title" data-split>Get to know Mitra.</h2>
              <div className="closing-actions" data-reveal>
                <a className="btn btn-primary" href={app()}>
                  Open Mitra
                  <ArrowRight aria-hidden="true" strokeWidth={2} />
                </a>
                <a className="btn btn-ghost" href="#how">How it works</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter showTeam={SHOW_TEAM} />
      <MotionRoot />
    </>
  );
}
