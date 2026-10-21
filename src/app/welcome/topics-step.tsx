"use client";

import { useActionState, useState } from "react";
import { saveOnboardingTopics } from "@/modules/account/actions";
import { TOPICS } from "@/modules/account/topic-list";
import type { FormState } from "@/modules/auth/policy";

const check = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
);

/** Onboarding: industries to follow (2026-10-05; startup industries since 2026-10-19). They start the feed's leaning; see topics.ts. */
export function TopicsStep({ initial, next }: { initial: readonly string[]; next: string | null }) {
  const [chosen, setChosen] = useState(() => new Set(initial));
  const [state, action, pending] = useActionState(saveOnboardingTopics, {} as FormState);

  function toggle(key: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <form action={action} className="step-form" aria-busy={pending}>
      <input type="hidden" name="next" value={next ?? ""} />
      <h1>What are you curious about?</h1>
      <p className="step-sub">Pick the industries you want to see founders from. Your feed starts there and learns from what you watch.</p>
      <fieldset className="topics">
        <legend className="sr-only">Topics</legend>
        {TOPICS.map((topic) => {
          const on = chosen.has(topic.key);
          return (
            <label key={topic.key} className={`topic${on ? " on" : ""}`}>
              <input className="sr-only" type="checkbox" name="topic" value={topic.key} checked={on} onChange={() => toggle(topic.key)} />
              {on && check}{topic.label}
            </label>
          );
        })}
      </fieldset>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Continue"}</button>
    </form>
  );
}
