"use client";

import { useActionState } from "react";
import { banAction, unbanAction } from "@/modules/account/moderation-actions";
import { removePersonPhotoAction } from "@/modules/account/photo-actions";
import type { FormState } from "@/modules/auth/policy";

function Result({ state }: { state: FormState }) {
  if (state.error) return <p className="form-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="form-success" role="status">{state.success}</p>;
  return null;
}

export function BanForm({ userId, name, liveGoals }: { userId: string; name: string; liveGoals: number }) {
  const [state, action, pending] = useActionState(banAction, {} as FormState);
  return <details className="person-action">
    <summary>Ban {name}</summary>
    <form action={action} className="review-form" aria-busy={pending}>
      <input type="hidden" name="userId" value={userId} />
      <div className="field">
        <label htmlFor={`ban-${userId}`}>Reason (private, only you see it)</label>
        <textarea id={`ban-${userId}`} name="reason" rows={2} minLength={3} maxLength={500} required />
      </div>
      <label className="checkbox-row">
        <input type="checkbox" name="confirm" value="yes" required />
        <span>
          They will be signed out and unable to sign in, bet or post.
          {liveGoals > 0 ? ` Their goals that still need proof will be cancelled and everyone refunded.` : ""}
          {" "}Goals already ruled finish normally.
        </span>
      </label>
      <Result state={state} />
      <button className="btn btn-danger btn-lg" type="submit" disabled={pending}>{pending ? "Banning…" : "Ban"}</button>
    </form>
  </details>;
}

export function UnbanForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(unbanAction, {} as FormState);
  return <form action={action} className="person-inline">
    <input type="hidden" name="userId" value={userId} />
    <button className="btn btn-secondary btn-lg" type="submit" disabled={pending}>{pending ? "Lifting…" : "Lift ban"}</button>
    <Result state={state} />
  </form>;
}

/** Re-runs a ban whose cancellations did not all go through. */
export function FinishBanForm({ userId, reason, pending: remaining }: { userId: string; reason: string; pending: number }) {
  const [state, action, pending] = useActionState(banAction, {} as FormState);
  return <form action={action} className="person-inline">
    <input type="hidden" name="userId" value={userId} />
    <input type="hidden" name="reason" value={reason} />
    <input type="hidden" name="confirm" value="yes" />
    <button className="btn btn-secondary btn-lg" type="submit" disabled={pending}>
      {pending ? "Cancelling…" : `Finish cancelling ${remaining} goal${remaining === 1 ? "" : "s"}`}
    </button>
    <Result state={state} />
  </form>;
}

export function RemovePhotoForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(removePersonPhotoAction, {} as FormState);
  return <form action={action} className="person-inline">
    <input type="hidden" name="userId" value={userId} />
    <button className="btn btn-text" type="submit" disabled={pending}>{pending ? "Removing…" : "Remove photo"}</button>
    <Result state={state} />
  </form>;
}
