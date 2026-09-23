"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cardTitle, categoryLabel, closesIn, shortDate, volumeLabel } from "@/modules/discovery/present";
import { Avatar, Change, GoalCard, PricePills, RundownRow, Thumbnail, type CardData } from "./components/market/goal-card";
import { PriceChart, type ChartPoint } from "./components/market/price-chart";

/*
 * The public home feed, redesigned 2026-09-22 (docs/DESIGN.md). Structure is
 * Kalshi's: a featured goal with its chart, a rundown down the side, an upcoming
 * strip, then the grid. Cards take YouTube's thumbnail-and-title shape and
 * GoFundMe's single glanceable bar.
 *
 * What stays as decided on 2026-09-19: tabs by person, a Just added strip, the
 * ranking order, and a dismissible account prompt after two minutes.
 */

export type FeaturedData = CardData & { series: ChartPoint[] };
export type PersonTab = { handle: string; displayName: string; openGoals: number };

const PROMPT_AFTER_MS = 2 * 60 * 1000;
const PROMPT_DISMISSED_KEY = "mitra.signup-prompt-dismissed";

function Featured({ goals, now }: { goals: FeaturedData[]; now: Date }) {
  const [index, setIndex] = useState(0);
  if (goals.length === 0) return null;
  const goal = goals[Math.min(index, goals.length - 1)];
  const href = `/markets/${goal.id}`;
  const step = (by: number) => setIndex((i) => (i + by + goals.length) % goals.length);

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Featured goals">
      <div className="hero-top">
        <span className="hero-kicker">
          <span className="hero-kicker-dot" aria-hidden="true" />
          {categoryLabel(goal.goalType)}
        </span>
        {goals.length > 1 && (
          <div className="hero-nav">
            <button type="button" onClick={() => step(-1)} aria-label="Previous featured goal">&lsaquo;</button>
            <span aria-live="polite">{index + 1} of {goals.length}</span>
            <button type="button" onClick={() => step(1)} aria-label="Next featured goal">&rsaquo;</button>
          </div>
        )}
      </div>
      <div className="hero-body">
        <div className="hero-main">
          <div className="hero-person">
            <Avatar name={goal.displayName} size={40} />
            <span><strong>{goal.displayName}</strong><span>@{goal.handle}</span></span>
          </div>
          <h2 className="hero-title"><Link href={href} prefetch={false}>{cardTitle(goal.goalType, goal.question)}</Link></h2>
          <div className="hero-odds">
            <PricePills yesPrice={goal.yesPrice} href={href} />
          </div>
          <p className="hero-meta">
            <span>{volumeLabel(goal.volumeMicro)}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{goal.tradingOpen ? closesIn(new Date(goal.deadlineAt), now) : "Trading closed"}</span>
            <span aria-hidden="true">&middot;</span>
            <span>Today <Change bp={goal.change24hBp} /></span>
          </p>
        </div>
        <div className="hero-chart">
          <PriceChart key={goal.id} points={goal.series} height={230} />
        </div>
      </div>
    </section>
  );
}

function Upcoming({ goals, now }: { goals: CardData[]; now: Date }) {
  if (goals.length === 0) return null;
  return (
    <section className="strip" aria-labelledby="strip-title">
      <h2 id="strip-title" className="section-title">Just added</h2>
      <ul className="strip-row">
        {goals.map((goal) => (
          <li key={goal.id}>
            <Link className="strip-card" href={`/markets/${goal.id}`} prefetch={false}>
              <Thumbnail
                goalType={goal.goalType}
                question={goal.question}
                displayName={goal.displayName}
                deadlineAt={goal.deadlineAt}
                tradingOpen={goal.tradingOpen}
                now={now}
              />
              <span className="strip-date">Closes {shortDate(new Date(goal.deadlineAt))}</span>
              <span className="strip-title">{cardTitle(goal.goalType, goal.question)}</span>
              <span className="strip-who">{goal.displayName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SignUpPrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="feed-prompt" role="dialog" aria-modal="false" aria-labelledby="feed-prompt-title">
      <div className="feed-prompt-body">
        <h2 id="feed-prompt-title">Want to make a call?</h2>
        <p>Browsing is open to everyone. Predicting needs an account, which comes with 1,000 play points. No deposits, no cash value.</p>
        <div className="feed-prompt-actions">
          <Link className="btn btn-accent" href="/sign-up">Create an account</Link>
          <Link className="feed-prompt-secondary" href="/sign-in">Sign in</Link>
        </div>
      </div>
      <button type="button" className="feed-prompt-close" onClick={onDismiss} aria-label="Dismiss">&times;</button>
    </div>
  );
}

export function FeedView({
  cards, justAdded, people, featured, closingSoon, movers, signedIn, unavailable, nowIso,
}: {
  cards: CardData[];
  justAdded: CardData[];
  people: PersonTab[];
  featured: FeaturedData[];
  closingSoon: CardData[];
  movers: CardData[];
  signedIn: boolean;
  unavailable: boolean;
  nowIso: string;
}) {
  const now = new Date(nowIso);
  const [person, setPerson] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (signedIn) return;
    try {
      if (window.sessionStorage.getItem(PROMPT_DISMISSED_KEY) === "1") return;
    } catch {
      // Storage can be unavailable or blocked; the prompt still works without it.
    }
    const timer = window.setTimeout(() => setShowPrompt(true), PROMPT_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [signedIn]);

  function dismissPrompt() {
    setShowPrompt(false);
    try {
      window.sessionStorage.setItem(PROMPT_DISMISSED_KEY, "1");
    } catch {
      // Dismissal simply will not be remembered.
    }
  }

  if (unavailable) {
    return (
      <section className="panel feed-empty">
        <h1>Goals are temporarily unavailable.</h1>
        <p>Please try again shortly.</p>
      </section>
    );
  }

  const byPerson = (list: CardData[]) => (person ? list.filter((card) => card.handle === person) : list);
  const shown = byPerson(cards);
  const personName = people.find((p) => p.handle === person)?.displayName ?? person;

  return (
    <>
      {people.length > 0 && (
        <nav className="chips" aria-label="Filter goals by person">
          <button type="button" className={person === null ? "chip is-active" : "chip"} onClick={() => setPerson(null)}>
            Everyone
          </button>
          {people.map((entry) => (
            <button
              key={entry.handle}
              type="button"
              className={person === entry.handle ? "chip is-active" : "chip"}
              onClick={() => setPerson(entry.handle)}
              aria-pressed={person === entry.handle}
            >
              <Avatar name={entry.displayName} size={22} />
              {entry.displayName}
              <span className="chip-count">{entry.openGoals}</span>
            </button>
          ))}
        </nav>
      )}

      {cards.length === 0 ? (
        <section className="panel feed-empty">
          <h1>No goals are open yet.</h1>
          <p>
            Goals appear here once someone writes one about themselves and it is approved.
            {signedIn ? " Yours can be the first." : " Create an account to add yours."}
          </p>
          <Link className="btn btn-accent" href={signedIn ? "/goals/new" : "/sign-up"}>
            {signedIn ? "Write a goal" : "Create an account"}
          </Link>
        </section>
      ) : (
        <div className="feed-layout">
          <div className="feed-main">
            {person === null && <Featured goals={featured} now={now} />}

            {person === null && (
              <section className="trust" aria-label="How Mitra works">
                <div><strong>Play money only</strong><span>1,000 points to start. No deposits, no cash value.</span></div>
                <div><strong>Proof, checked by a person</strong><span>Outcomes rest on a statement written after reading the evidence.</span></div>
                <div><strong>No betting on yourself</strong><span>Nobody trades a goal about their own life.</span></div>
              </section>
            )}

            {person === null && <Upcoming goals={justAdded} now={now} />}

            <section aria-labelledby="grid-title">
              <h2 id="grid-title" className="section-title">{person ? `${personName}'s goals` : "Open goals"}</h2>
              {shown.length === 0 ? (
                <p className="muted">No open goals for this person right now.</p>
              ) : (
                <div className="grid">
                  {shown.map((card) => <GoalCard key={card.id} card={card} now={now} />)}
                </div>
              )}
            </section>
          </div>

          <aside className="feed-side" aria-label="Rundown">
            {closingSoon.length > 0 && (
              <section className="panel rundown">
                <h2>Closing soon</h2>
                <ul>{byPerson(closingSoon).map((card) => <RundownRow key={card.id} card={card} now={now} show="deadline" />)}</ul>
              </section>
            )}
            {movers.length > 0 && (
              <section className="panel rundown">
                <h2>Moving today</h2>
                <ul>{byPerson(movers).map((card) => <RundownRow key={card.id} card={card} now={now} show="change" />)}</ul>
              </section>
            )}
          </aside>
        </div>
      )}

      {showPrompt && <SignUpPrompt onDismiss={dismissPrompt} />}
    </>
  );
}
