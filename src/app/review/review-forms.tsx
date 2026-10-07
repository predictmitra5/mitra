"use client";

import { useActionState } from "react";
import { approveGoal, rejectGoal } from "@/modules/goals/actions";
import type { FormState } from "@/modules/auth/policy";

export function ReviewForms({ marketId }: { marketId: string }) {
  const [approveState, approve, approving] = useActionState(approveGoal, {} as FormState);
  const [rejectState, reject, rejecting] = useActionState(rejectGoal, {} as FormState);
  const busy = approving || rejecting;

  return <div className="review-actions">
    <form action={approve} className="review-form" aria-busy={approving}>
      <input type="hidden" name="marketId" value={marketId} />
      <div className="field"><label htmlFor={`open-${marketId}`}>Opening odds of YES (%)</label><input id={`open-${marketId}`} name="openingPercent" type="number" min={1} max={99} step={1} placeholder="30" required /></div>
      <div className="field"><label htmlFor={`note-${marketId}`}>Note for your records (optional)</label><input id={`note-${marketId}`} name="note" maxLength={500} /></div>
      {approveState.error && <p className="form-error" role="alert">{approveState.error}</p>}
      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>{approving ? "Opening…" : "Approve and open"}<span aria-hidden="true">↗︎</span></button>
    </form>
    <form action={reject} className="review-form" aria-busy={rejecting}>
      <input type="hidden" name="marketId" value={marketId} />
      <div className="field"><label htmlFor={`reason-${marketId}`}>Reason (shown to them)</label><textarea id={`reason-${marketId}`} name="reason" rows={2} minLength={3} maxLength={500} required /></div>
      {rejectState.error && <p className="form-error" role="alert">{rejectState.error}</p>}
      <button className="btn btn-secondary btn-lg btn-block" type="submit" disabled={busy}>{rejecting ? "Rejecting…" : "Reject"}</button>
    </form>
  </div>;
}
