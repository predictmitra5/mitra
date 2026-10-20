"use client";

import { useActionState } from "react";
import {
  claimAction, declineSuggestionAction, openDraftAction, pauseAction, removeCommentAction, reportAction, reviewAction, type AdminFormState,
} from "@/modules/startups/admin-actions";
import { VERIFICATION } from "@/modules/startups/labels";

/*
 * The owner's small forms (2026-10-19): approve, turn down or suspend a
 * founder, startup or video; review a claim; close a report; remove a
 * comment; turn down a market suggestion; pause or resume trading; open a
 * draft market. Each says what happened and keeps its reason in the audit.
 */

function Message({ state }: { state: AdminFormState }) {
  if (!state) return null;
  return <p className={state.ok ? "form-success" : "form-error"} role={state.ok ? "status" : "alert"}>{state.message}</p>;
}

export function ReviewForm({ what, id, allowSuspend = false }: { what: "founder" | "startup" | "video"; id: string; allowSuspend?: boolean }) {
  const [state, action, pending] = useActionState(reviewAction, null);
  if (state?.ok) return <Message state={state} />;
  return (
    <form action={action} className="review-decide">
      <input type="hidden" name="what" value={what} />
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor={`reason-${id}`}>Reason <span className="muted">(needed to turn down or suspend; the member reads it)</span></label>
        <textarea id={`reason-${id}`} name="reason" rows={2} maxLength={1000} />
      </div>
      <div className="review-buttons">
        <button className="btn btn-primary" type="submit" name="decision" value="approve" disabled={pending}>Approve</button>
        <button className="btn btn-quiet" type="submit" name="decision" value="reject" disabled={pending}>Turn down</button>
        {allowSuspend && <button className="btn btn-quiet" type="submit" name="decision" value="suspend" disabled={pending}>Suspend</button>}
      </div>
      <Message state={state} />
    </form>
  );
}

export function ClaimForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(claimAction, null);
  if (state?.ok) return <Message state={state} />;
  return (
    <form action={action} className="review-decide">
      <input type="hidden" name="id" value={id} />
      <div className="field-pair">
        <div className="field">
          <label htmlFor={`level-${id}`}>Verification</label>
          <select id={`level-${id}`} name="level" defaultValue="founder_reported">
            {Object.entries(VERIFICATION).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`note-${id}`}>What you checked</label>
          <input id={`note-${id}`} name="note" maxLength={600} required />
        </div>
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>Save review</button>
      <Message state={state} />
    </form>
  );
}

export function ReportForm({ id, canRemove }: { id: string; canRemove: boolean }) {
  const [state, action, pending] = useActionState(reportAction, null);
  if (state?.ok) return <Message state={state} />;
  return (
    <form action={action} className="review-decide">
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor={`rnote-${id}`}>Note for the record</label>
        <input id={`rnote-${id}`} name="note" maxLength={600} required />
      </div>
      {canRemove && <label className="checkbox-row"><input type="checkbox" name="act" value="remove" />Remove the comment or suspend the video</label>}
      <div className="review-buttons">
        <button className="btn btn-primary" type="submit" name="outcome" value="resolved" disabled={pending}>Resolve</button>
        <button className="btn btn-quiet" type="submit" name="outcome" value="dismissed" disabled={pending}>Dismiss</button>
      </div>
      <Message state={state} />
    </form>
  );
}

export function RemoveCommentForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeCommentAction, null);
  if (state?.ok) return <Message state={state} />;
  return (
    <form action={action} className="review-inline">
      <input type="hidden" name="id" value={id} />
      <input name="reason" placeholder="Why" maxLength={600} required aria-label="Why remove it" />
      <button className="btn btn-quiet" type="submit" disabled={pending}>Remove</button>
      <Message state={state} />
    </form>
  );
}

export function DeclineSuggestionForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(declineSuggestionAction, null);
  if (state?.ok) return <Message state={state} />;
  return (
    <form action={action} className="review-inline">
      <input type="hidden" name="id" value={id} />
      <input name="reason" placeholder="Reason they can read" maxLength={600} required aria-label="Reason" />
      <button className="btn btn-quiet" type="submit" disabled={pending}>Turn down</button>
      <Message state={state} />
    </form>
  );
}

export function PauseForm({ marketId, paused }: { marketId: string; paused: boolean }) {
  const [state, action, pending] = useActionState(pauseAction, null);
  return (
    <form action={action} className="review-inline">
      <input type="hidden" name="id" value={marketId} />
      <input type="hidden" name="paused" value={paused ? "false" : "true"} />
      <input name="reason" placeholder={paused ? "Why trading resumes" : "Why trading pauses"} maxLength={600} required aria-label="Reason" />
      <button className="btn btn-quiet" type="submit" disabled={pending}>{paused ? "Resume trading" : "Pause trading"}</button>
      <Message state={state} />
    </form>
  );
}

export function OpenDraftForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(openDraftAction, null);
  return (
    <form action={action} className="review-inline">
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-primary" type="submit" disabled={pending}>Open trading now</button>
      <Message state={state} />
    </form>
  );
}
