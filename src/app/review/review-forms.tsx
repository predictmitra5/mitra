"use client";

import { useActionState, useState } from "react";
import { publishMarketAction, rejectProposalAction } from "@/modules/events/actions";
import { CATEGORIES } from "@/modules/events/categories";
import type { FormState } from "@/modules/auth/policy";
import { SHORT_QUESTION_MAX } from "@/modules/events/limits";

export type PublishDefaults = {
  proposalId: string | null;
  campus: string;
  question: string;
  category: string;
  venueId: string;
  venueName: string;
  eventTitle: string;
  /** datetime-local values in the campus's zone. */
  windowStart: string;
  windowEnd: string;
  cutoff: string;
  resultsDue: string;
};

type Option = { id: string; name: string };

/**
 * The owner's form for opening an event market (2026-10-08): exact terms, the
 * window, cutoff and results deadline, the source and whether it really
 * reports, and the opening odds. Prefilled from a suggestion when there is one.
 */
export function PublishForm({ defaults, venues, sources, campuses }: {
  defaults: PublishDefaults; venues: Option[]; sources: (Option & { operational: boolean })[];
  campuses: { key: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(publishMarketAction, {} as FormState);
  const [venueId, setVenueId] = useState(defaults.venueId);
  const [sourceId, setSourceId] = useState("");
  const id = defaults.proposalId ?? "new";
  return (
    <form action={action} className="auth-form publish-form" aria-busy={pending}>
      {defaults.proposalId && <input type="hidden" name="proposalId" value={defaults.proposalId} />}
      <div className="field-pair">
        <div className="field">
          <label htmlFor={`campus-${id}`}>Campus</label>
          <select id={`campus-${id}`} name="campus" defaultValue={defaults.campus}>
            {campuses.map((campus) => <option key={campus.key} value={campus.key}>{campus.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`category-${id}`}>Category</label>
          <select id={`category-${id}`} name="category" defaultValue={defaults.category}>
            {CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`question-${id}`}>Question (frozen once trading opens)</label>
        <input id={`question-${id}`} name="question" required minLength={10} maxLength={200} defaultValue={defaults.question} />
      </div>
      <div className="field">
        <label htmlFor={`short-${id}`}>Short title for cards</label>
        <input id={`short-${id}`} name="shortQuestion" minLength={10} maxLength={SHORT_QUESTION_MAX} aria-describedby={`short-hint-${id}`} />
        <p className="field-hint" id={`short-hint-${id}`}>A few words for the feed, e.g. “Will Midway on High sell more than 1,000 drinks?”. The full question shows once someone opens the market. Leave it empty to show the full question everywhere.</p>
      </div>

      <fieldset className="publish-group">
        <legend>Venue and event</legend>
        <div className="field">
          <label htmlFor={`venue-${id}`}>Venue</label>
          <select id={`venue-${id}`} name="venueId" value={venueId} onChange={(event) => setVenueId(event.target.value)}>
            <option value="">A new venue…</option>
            {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
          </select>
        </div>
        {!venueId && <>
          <div className="field">
            <label htmlFor={`venue-name-${id}`}>New venue’s name</label>
            <input id={`venue-name-${id}`} name="venueName" required maxLength={80} defaultValue={defaults.venueName} />
          </div>
          <div className="field-pair">
            <div className="field"><label htmlFor={`venue-area-${id}`}>Area (optional)</label><input id={`venue-area-${id}`} name="venueArea" maxLength={80} placeholder="North High Street" /></div>
            <div className="field"><label htmlFor={`venue-about-${id}`}>One line about it (optional)</label><input id={`venue-about-${id}`} name="venueDescription" maxLength={300} /></div>
          </div>
        </>}
        <div className="field">
          <label htmlFor={`event-${id}`}>Event name</label>
          <input id={`event-${id}`} name="eventTitle" required minLength={2} maxLength={120} defaultValue={defaults.eventTitle} placeholder="Friday night, Oct 16" />
        </div>
        <div className="field-pair">
          <div className="field"><label htmlFor={`start-${id}`}>Window starts</label><input id={`start-${id}`} name="windowStart" type="datetime-local" required defaultValue={defaults.windowStart} /></div>
          <div className="field"><label htmlFor={`end-${id}`}>Window ends</label><input id={`end-${id}`} name="windowEnd" type="datetime-local" required defaultValue={defaults.windowEnd} /></div>
        </div>
        <div className="field-pair">
          <div className="field"><label htmlFor={`cutoff-${id}`}>Trading cutoff</label><input id={`cutoff-${id}`} name="cutoff" type="datetime-local" required defaultValue={defaults.cutoff} /></div>
          <div className="field"><label htmlFor={`due-${id}`}>Results due</label><input id={`due-${id}`} name="resultsDue" type="datetime-local" required defaultValue={defaults.resultsDue} /></div>
        </div>
        <p className="field-hint">Times are the chosen campus’s local time (Eastern for Ohio State). The cutoff is usually when the window starts; results are usually due three days after it ends. With no result by then, the market is ruled No.</p>
      </fieldset>

      <fieldset className="publish-group">
        <legend>Exact terms</legend>
        <div className="field"><label htmlFor={`yes-${id}`}>Resolves Yes if</label><textarea id={`yes-${id}`} name="yesCondition" required minLength={10} maxLength={500} rows={2} /></div>
        <div className="field"><label htmlFor={`no-${id}`}>Resolves No if</label><textarea id={`no-${id}`} name="noCondition" required minLength={10} maxLength={500} rows={2} defaultValue="" placeholder="…or no result arrives by the results deadline." /></div>
        <div className="field">
          <label htmlFor={`rules-${id}`}>Full rules</label>
          <textarea id={`rules-${id}`} name="rules" required minLength={20} maxLength={2000} rows={4}
            defaultValue="Don’t buy, or ask anyone to buy, at the venue to move this market. If you work at or own the venue, don’t trade it." />
          <span className="field-hint">What counts and what doesn’t, units, edge cases. Public and frozen once trading opens.</span>
        </div>
      </fieldset>

      <fieldset className="publish-group">
        <legend>Verification source</legend>
        <div className="field">
          <label htmlFor={`source-${id}`}>Source</label>
          <select id={`source-${id}`} name="sourceId" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
            <option value="">A new source…</option>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.name}{source.operational ? "" : " (placeholder)"}</option>)}
          </select>
        </div>
        {!sourceId && <>
          <div className="field"><label htmlFor={`source-name-${id}`}>Name</label><input id={`source-name-${id}`} name="sourceName" required minLength={3} maxLength={120} placeholder="Venue point-of-sale report" /></div>
          <div className="field"><label htmlFor={`source-method-${id}`}>How it counts</label><textarea id={`source-method-${id}`} name="sourceMethod" required minLength={10} maxLength={600} rows={2} /></div>
          <div className="field"><label htmlFor={`source-url-${id}`}>Link (optional)</label><input id={`source-url-${id}`} name="sourceUrl" type="url" maxLength={500} placeholder="https://" /></div>
          <label className="checkbox-row"><input type="checkbox" name="sourceOperational" />This source is connected and will report. Leave unticked for a placeholder; the market page says so.</label>
        </>}
      </fieldset>

      <div className="field-pair">
        <div className="field"><label htmlFor={`open-${id}`}>Opening odds of Yes (%)</label><input id={`open-${id}`} name="openingPercent" type="number" min={1} max={99} step={1} placeholder="40" required /></div>
        <div className="field"><label htmlFor={`note-${id}`}>Note for your records (optional)</label><input id={`note-${id}`} name="note" maxLength={500} /></div>
      </div>
      <label className="checkbox-row"><input type="checkbox" name="isSample" />Sample market: a hypothetical demonstration, labelled as such everywhere.</label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Publishing…" : "Publish and open trading"}</button>
    </form>
  );
}

export function RejectForm({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState(rejectProposalAction, {} as FormState);
  return (
    <form action={action} className="review-form" aria-busy={pending}>
      <input type="hidden" name="proposalId" value={proposalId} />
      <div className="field"><label htmlFor={`reason-${proposalId}`}>Reason (shown to them)</label><textarea id={`reason-${proposalId}`} name="reason" rows={2} minLength={3} maxLength={500} required /></div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Turn down"}</button>
    </form>
  );
}
