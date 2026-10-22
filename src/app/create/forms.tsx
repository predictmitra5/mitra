"use client";

import { useActionState } from "react";
import { addClaimAction, addUpdateAction, suggestMarketAction, type FormState } from "@/modules/startups/creator-actions";

/*
 * The creator hub's small forms (2026-10-19): updates, claims and market
 * suggestions, saved on the server with a message on what happens next. The
 * founder profile, startups and videos have their own step-by-step screens
 * since 2026-10-21 (flows.tsx).
 */

function Message({ state }: { state: FormState }) {
  if (!state) return null;
  return <p className={state.ok ? "form-success" : "form-error"} role={state.ok ? "status" : "alert"}>{state.message}</p>;
}

export function UpdateForm({ startupId }: { startupId: string }) {
  const [state, action, pending] = useActionState(addUpdateAction, null);
  return (
    <form action={action} className="review-form" key={state?.ok ? "sent" : "form"}>
      <input type="hidden" name="startupId" value={startupId} />
      <div className="field-pair">
        <div className="field"><label htmlFor={`u-title-${startupId}`}>Title</label><input id={`u-title-${startupId}`} name="title" maxLength={100} required /></div>
        <div className="field"><label htmlFor={`u-date-${startupId}`}>When</label><input id={`u-date-${startupId}`} name="happenedOn" type="date" /></div>
      </div>
      <div className="field"><label htmlFor={`u-body-${startupId}`}>What happened</label><textarea id={`u-body-${startupId}`} name="body" rows={3} maxLength={1000} required /></div>
      <label className="checkbox-row"><input type="checkbox" name="kind" value="milestone" />This is a milestone</label>
      <Message state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>Post update</button>
    </form>
  );
}

export function ClaimForm({ startupId }: { startupId: string }) {
  const [state, action, pending] = useActionState(addClaimAction, null);
  return (
    <form action={action} className="review-form" key={state?.ok ? "sent" : "form"}>
      <input type="hidden" name="startupId" value={startupId} />
      <div className="field"><label htmlFor={`c-st-${startupId}`}>Claim</label><input id={`c-st-${startupId}`} name="statement" maxLength={300} required placeholder="We have 31,000 monthly active users" /></div>
      <div className="field-pair">
        <div className="field"><label htmlFor={`c-sn-${startupId}`}>Source</label><input id={`c-sn-${startupId}`} name="sourceName" maxLength={120} placeholder="App Store Connect export" /></div>
        <div className="field"><label htmlFor={`c-su-${startupId}`}>Source link</label><input id={`c-su-${startupId}`} name="sourceUrl" type="url" placeholder="https://" /></div>
      </div>
      <Message state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>Send for verification</button>
    </form>
  );
}

export function SuggestForm({ startupId }: { startupId: string }) {
  const [state, action, pending] = useActionState(suggestMarketAction, null);
  return (
    <form action={action} className="review-form" key={state?.ok ? "sent" : "form"}>
      <input type="hidden" name="startupId" value={startupId} />
      <div className="field"><label htmlFor={`m-q-${startupId}`}>Question</label><input id={`m-q-${startupId}`} name="question" maxLength={240} required placeholder="Will we reach 10,000 paying users by June 30, 2027?" /></div>
      <div className="field"><label htmlFor={`m-h-${startupId}`}>How anyone could check it</label><textarea id={`m-h-${startupId}`} name="howToCheck" rows={2} maxLength={600} required /></div>
      <div className="field"><label htmlFor={`m-c-${startupId}`}>Suggested close date</label><input id={`m-c-${startupId}`} name="closesOn" type="date" /></div>
      <p className="field-hint">The owner publishes the exact rules and resolution source. Prices require actual orders and executions. You and your team cannot trade your own startup&rsquo;s markets.</p>
      <Message state={state} />
      <button className="btn btn-quiet" type="submit" disabled={pending}>Suggest market</button>
    </form>
  );
}
