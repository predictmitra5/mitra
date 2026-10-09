"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { manageMarket } from "@/modules/market/lifecycle-actions";
import type { OwnerCommand } from "@/modules/market/lifecycle";

export function OwnerControls({ marketId, version, canClose, canRule, canRuleMissing, isRevision, resultsDue }: {
  marketId: string; version: number; canClose: boolean; canRule: boolean; canRuleMissing: boolean; isRevision: boolean; resultsDue: string;
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
          setSuccess(review.action === "rule" ? "Ruling saved. The 24-hour objection window is open." : review.action === "cancel" ? "Market voided. Held costs have been refunded." : "Trading closed.");
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
      <h3>{review.action === "rule" ? `Confirm ${review.outcome?.toUpperCase()} ruling` : review.action === "cancel" ? "Confirm voiding and refunds" : "Confirm early close"}</h3>
      <p className="market-criteria">{review.reason}</p>
      <p className="rule-note">{review.action === "rule"
        ? "This explanation is public. A fresh 24-hour objection window starts, including when you revise an earlier ruling. Payout becomes final when that window ends."
        : review.action === "cancel" ? "Every participant gets back the cost of the shares they still hold. This ends the market permanently."
        : "Both buying and selling will stop. The results deadline stays the same."}</p>
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
          <label className="checkbox-row"><input type="radio" name="basis" value="checked_source" required />I checked the market’s source against its frozen terms.</label>
          <label className="checkbox-row"><input type="radio" name="basis" value="missing_data" required disabled={!canRuleMissing} />The source never reported by the results deadline ({resultsDue}). The outcome must be NO.</label>
        </fieldset>
        <label className="field">Public explanation<textarea name="reason" required minLength={3} maxLength={2000} rows={4} /><span className="field-hint">Give the number the source reported and how it compares with the terms. This text appears on the public market page.</span></label>
        <button className="secondary-button">Review ruling</button>
      </form></details> : <p className="field-hint">Ruling opens when the event window ends.</p>}
      <details><summary>Void this market</summary><form action={prepare} className="auth-form">
        <input type="hidden" name="action" value="cancel" />
        <p className="field-hint">For a broken or retired sample market: refund held costs and end trading. A source that never reported is a NO ruling, not a reason to refund.</p>
        <label className="field">Reason for voiding (kept in the record)<textarea name="reason" required minLength={3} maxLength={2000} rows={3} /></label>
        <button className="secondary-button">Review voiding</button>
      </form></details>
    </>}
  </div>;
}
