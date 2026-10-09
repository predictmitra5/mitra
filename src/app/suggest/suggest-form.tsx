"use client";

import { useActionState } from "react";
import { suggestMarket } from "@/modules/events/actions";
import { CATEGORIES } from "@/modules/events/categories";
import type { FormState } from "@/modules/auth/policy";

/** The suggestion form. The campus and the proposer come from the signed-in identity, never from here. */
export function SuggestForm({ venues, earliest, zoneLabel }: { venues: { id: string; name: string }[]; earliest: string; zoneLabel: string }) {
  const [state, action, pending] = useActionState(suggestMarket, {} as FormState);
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <div className="field">
        <label htmlFor="suggest-question">The question</label>
        <input id="suggest-question" name="question" required minLength={10} maxLength={200}
          placeholder="Will Buckeye Donuts sell more than 1,500 donuts on Friday night?" />
        <span className="field-hint">A yes-or-no question about something that can be counted or checked.</span>
      </div>

      <fieldset className="type-picker">
        <legend>Category</legend>
        {CATEGORIES.map((category, index) => (
          <label className="type-option" key={category.key}>
            <input type="radio" name="category" value={category.key} required defaultChecked={index === 0} />
            <span>{category.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor="suggest-venue">Venue or place</label>
        <input id="suggest-venue" name="venue" required minLength={2} maxLength={80} list="suggest-venues" autoComplete="off" placeholder="Gateway Film Center" />
        <datalist id="suggest-venues">{venues.map((venue) => <option key={venue.id} value={venue.name} />)}</datalist>
      </div>

      <div className="field-pair">
        <div className="field">
          <label htmlFor="suggest-start">When it starts</label>
          <input id="suggest-start" name="start" type="datetime-local" required min={earliest} />
        </div>
        <div className="field">
          <label htmlFor="suggest-end">When it ends <span className="muted">(optional)</span></label>
          <input id="suggest-end" name="end" type="datetime-local" min={earliest} />
        </div>
      </div>
      <p className="field-hint">Times are {zoneLabel}.</p>

      <div className="field">
        <label htmlFor="suggest-resolution">How it could be checked</label>
        <textarea id="suggest-resolution" name="resolution" required minLength={10} maxLength={500} rows={3}
          placeholder="The shop’s sales count for those hours, or the box office total for that showing." />
      </div>

      <p className="rule-note">Don’t suggest something you could decide yourself, and don’t trade a market about a place where you work.</p>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Sending…" : "Send suggestion"}</button>
    </form>
  );
}
