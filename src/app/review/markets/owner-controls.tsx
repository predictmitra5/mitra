"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { manageMarket } from "@/modules/market/lifecycle-actions";
import type { OwnerCommand } from "@/modules/market/lifecycle";

export function OwnerControls({ marketId, version, canClose, canRule, isRevision }: {
  marketId: string; version: number; canClose: boolean; canRule: boolean; isRevision: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [review, setReview] = useState<OwnerCommand | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [pending, startTransition] = useTransition();

  function prepare(form: FormData) {
    setError(""); setSuccess("");
    const action = form.get("action") as OwnerCommand["action"];
    setReview({ marketId, requestId: crypto.randomUUID(), expectedVersion: version, action,
      reason: String(form.get("reason") ?? ""),
      ...(action === "rule" ? { outcome: form.get("outcome") as "yes" | "no", basis: form.get("basis") as OwnerCommand["basis"] } : {}),
      ...(action === "close" ? { publicOutcomeConfirmed: form.get("publicOutcome") === "on" } : {}) });
  }

  function confirm() {
    if (!review) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await manageMarket(review);
        if (result.ok) {
          setSuccess(review.action === "rule" ? "Ruling saved. The 24-hour objection window is open." : review.action === "cancel" ? "Goal cancelled. Held costs have been refunded." : "Trading closed.");
          setReview(null); setUncertain(false); router.refresh();
        } else {
          setError(result.error);
          if (result.code === "UNAVAILABLE") setUncertain(true);
          else { setReview(null); setUncertain(false); router.refresh(); }
        }
      } catch { setUncertain(true); setError("The response was interrupted. Retry this same update to check or complete it."); }
    });
  }

  return <div className="lifecycle-controls">
    {error && <p className="form-error" role="alert">{error}</p>}
    {success && <p className="form-success" role="status">{success}</p>}
    {review ? <section className="lifecycle-confirm">
      <h3>{review.action === "rule" ? `Confirm ${review.outcome?.toUpperCase()} ruling` : review.action === "cancel" ? "Confirm cancellation and refunds" : "Confirm early close"}</h3>
      <p className="market-criteria">{review.reason}</p>
      <p className="rule-note">{review.action === "rule"
        ? "This explanation is public. A fresh 24-hour objection window starts, including when you revise an earlier ruling. Payout becomes final when that window ends."
        : review.action === "cancel" ? "Every participant gets back the cost of the shares they still hold. This ends the market permanently."
        : "Both buying and selling will stop. The goal's proof deadline stays the same."}</p>
      <button className="primary-button" type="button" disabled={pending} onClick={confirm}>{pending ? "Saving…" : uncertain ? "Retry same update" : "Confirm update"}</button>
      {!uncertain && <button className="text-button" type="button" disabled={pending} onClick={() => setReview(null)}>Back to edit</button>}
    </section> : <>
      {canClose && <details><summary>Close trading early</summary><form action={prepare} className="auth-form">
        <input type="hidden" name="action" value="close" />
        <label className="checkbox-row"><input type="checkbox" name="publicOutcome" required />The outcome is already public.</label>
        <label className="field">Owner note<textarea name="reason" required minLength={3} maxLength={2000} rows={3} /></label>
        <button className="secondary-button">Review early close</button>
      </form></details>}
      {canRule ? <details><summary>{isRevision ? "Revise the ruling" : "Record the ruling"}</summary><form action={prepare} className="auth-form">
        <input type="hidden" name="action" value="rule" />
        <fieldset className="type-picker"><legend>Outcome</legend>{["yes", "no"].map((outcome) => <label className="type-option" key={outcome}><input type="radio" name="outcome" value={outcome} required /><span>{outcome.toUpperCase()}</span></label>)}</fieldset>
        <fieldset className="proof-options"><legend>Basis for the ruling</legend>
          <label className="checkbox-row"><input type="radio" name="basis" value="reviewed_proof" required />I reviewed proof against the goal’s frozen terms.</label>
          <label className="checkbox-row"><input type="radio" name="basis" value="missing_proof" required />No proof arrived by the proof deadline. The outcome must be NO.</label>
        </fieldset>
        <label className="field">Public explanation<textarea name="reason" required minLength={3} maxLength={2000} rows={4} /><span className="field-hint">Explain the outcome without copying private documents or personal details. This text appears on the public goal page.</span></label>
        <button className="secondary-button">Review ruling</button>
      </form></details> : <p className="field-hint">Ruling opens after the seven-day proof period. Proof the subject sends before then is listed on this card for you to review.</p>}
      <details><summary>Cancel this goal</summary><form action={prepare} className="auth-form">
        <input type="hidden" name="action" value="cancel" />
        <p className="field-hint">For a broken market: refund held costs and end trading. Missing proof is a NO ruling, not a reason to refund.</p>
        <label className="field">Owner cancellation note<textarea name="reason" required minLength={3} maxLength={2000} rows={3} /></label>
        <button className="secondary-button">Review cancellation</button>
      </form></details>
    </>}
  </div>;
}
