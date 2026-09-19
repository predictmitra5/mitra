"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FeedReason } from "@/modules/discovery/ranking";

/**
 * The public feed, decided 2026-09-19. Everything here is already public on a
 * goal's own page: display name, handle, terms, price and deadline. The server
 * does the ranking and the formatting; this component only filters and displays.
 */
export type FeedCardView = {
  id: string;
  question: string;
  goalType: string | null;
  displayName: string;
  handle: string;
  /** Already formatted in Eastern time by the server, so there is no clock here. */
  deadline: string;
  closesIn: string;
  yesPercent: number;
  tradingOpen: boolean;
  reason: FeedReason;
};

export type FeedPersonView = { handle: string; displayName: string; openGoals: number };

/** How long a visitor with no account browses before being asked to make one. */
const PROMPT_AFTER_MS = 2 * 60 * 1000;
const PROMPT_DISMISSED_KEY = "mitra.signup-prompt-dismissed";

const reasonLabel: Record<FeedReason, string> = {
  "just added": "Just added",
  "closing soon": "Closing soon",
  active: "Active",
  quiet: "Open",
};

/** Template names as they read on a card. Anything else shows as written. */
const goalTypeNames: Record<string, string> = {
  gpa: "Grades", club: "Clubs", internship: "Internships", launch: "Launches", gym: "Gym", other: "Other",
};
function goalTypeLabel(goalType: string): string {
  return goalTypeNames[goalType] ?? goalType;
}

function GoalCard({ card }: { card: FeedCardView }) {
  const no = 100 - card.yesPercent;
  return (
    <Link className="feed-card" href={`/markets/${card.id}`}>
      <div className="feed-card-top">
        <span className="feed-person">{card.displayName}<span>@{card.handle}</span></span>
        <span className={`feed-tag feed-tag-${card.reason.replace(" ", "-")}`}>{reasonLabel[card.reason]}</span>
      </div>
      <p className="feed-question">{card.question}</p>
      <div className="feed-odds" aria-label={`Yes ${card.yesPercent} percent, no ${no} percent`}>
        <div className="feed-odds-yes"><span>YES</span><strong>{card.yesPercent}%</strong></div>
        <div className="feed-odds-no"><span>NO</span><strong>{no}%</strong></div>
      </div>
      <div className="feed-bar" aria-hidden="true"><span style={{ width: `${card.yesPercent}%` }} /></div>
      <div className="feed-card-foot">
        <span>{card.tradingOpen ? card.closesIn : "Trading closed"}</span>
        <span>{card.goalType ? `${goalTypeLabel(card.goalType)} · ${card.deadline}` : card.deadline}</span>
      </div>
    </Link>
  );
}

function SignUpPrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="feed-prompt" role="dialog" aria-modal="false" aria-labelledby="feed-prompt-title">
      <div className="feed-prompt-body">
        <h2 id="feed-prompt-title">Want to make a call?</h2>
        <p>
          Browsing is open to everyone. Making predictions needs an account, which comes with
          1,000 play points. No deposits, no cash value.
        </p>
        <div className="feed-prompt-actions">
          <Link className="primary-button" href="/sign-up">Create an account</Link>
          <Link className="feed-prompt-secondary" href="/sign-in">Sign in</Link>
        </div>
      </div>
      <button type="button" className="feed-prompt-close" onClick={onDismiss} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
}

export function FeedView({
  cards, justAdded, people, signedIn, unavailable,
}: {
  cards: FeedCardView[];
  justAdded: FeedCardView[];
  people: FeedPersonView[];
  signedIn: boolean;
  unavailable: boolean;
}) {
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

  const shown = person ? cards.filter((card) => card.handle === person) : cards;
  const freshShown = person ? justAdded.filter((card) => card.handle === person) : justAdded;

  if (unavailable) {
    return (
      <section className="feed-empty">
        <h1>Goals are temporarily unavailable.</h1>
        <p>Please try again shortly.</p>
      </section>
    );
  }

  return (
    <>
      {people.length > 0 && (
        <nav className="feed-tabs" aria-label="Filter goals by person">
          <button type="button" className={person === null ? "is-active" : ""} onClick={() => setPerson(null)}>
            Everyone
          </button>
          {people.map((entry) => (
            <button
              key={entry.handle}
              type="button"
              className={person === entry.handle ? "is-active" : ""}
              onClick={() => setPerson(entry.handle)}
            >
              {entry.displayName}<span>{entry.openGoals}</span>
            </button>
          ))}
        </nav>
      )}

      {cards.length === 0 ? (
        <section className="feed-empty">
          <h1>No goals are open yet.</h1>
          <p>
            Goals appear here once someone writes one about themselves and it is approved.
            {signedIn ? " Yours can be the first." : " Create an account to add yours."}
          </p>
          <Link className="primary-button" href={signedIn ? "/goals/new" : "/sign-up"}>
            {signedIn ? "Write a goal" : "Create an account"}
          </Link>
        </section>
      ) : (
        <>
          {freshShown.length > 0 && (
            <section className="feed-section" aria-labelledby="feed-just-added">
              <h2 id="feed-just-added" className="feed-section-title">Just added</h2>
              <div className="feed-strip">
                {freshShown.map((card) => <GoalCard key={`fresh-${card.id}`} card={card} />)}
              </div>
            </section>
          )}

          <section className="feed-section" aria-labelledby="feed-all">
            <h2 id="feed-all" className="feed-section-title">
              {person ? `${people.find((p) => p.handle === person)?.displayName ?? person}'s goals` : "Open goals"}
            </h2>
            {shown.length === 0 ? (
              <p className="muted">No open goals for this person right now.</p>
            ) : (
              <div className="feed-grid">
                {shown.map((card) => <GoalCard key={card.id} card={card} />)}
              </div>
            )}
          </section>
        </>
      )}

      {showPrompt && <SignUpPrompt onDismiss={dismissPrompt} />}
    </>
  );
}
