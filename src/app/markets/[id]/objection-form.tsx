"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { objectToRuling } from "@/modules/market/lifecycle-actions";
import type { ObjectionInput } from "@/modules/market/lifecycle";

export function ObjectionForm({ marketId, version }: { marketId: string; version: number }) {
  const router = useRouter();
  const [retry, setRetry] = useState<ObjectionInput | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit(form: FormData) {
    const input = retry ?? { id: crypto.randomUUID(), marketId, rulingVersion: version, reason: String(form.get("reason") ?? "") };
    setError(""); setSuccess(false);
    startTransition(async () => {
      try {
        const result = await objectToRuling(input);
        if (result.ok) { setRetry(null); setSuccess(true); router.refresh(); }
        else { setError(result.error); setRetry(result.code === "UNAVAILABLE" ? input : null); if (result.code === "STALE_RULING") router.refresh(); }
      } catch { setRetry(input); setError("The response was interrupted. Retry the same objection safely."); }
    });
  }
  return <form action={submit} className="auth-form">
    <h3>Object to this ruling</h3>
    <p className="field-hint">Only you and the owner can read your objection. Explain which goal term or evidence you think was missed. Submitting an objection does not extend the cutoff; a changed ruling does.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {success && <p className="form-success" role="status">Your objection was sent to the owner.</p>}
    {retry ? <p className="market-criteria">{retry.reason}</p> : <label className="field">Your objection<textarea name="reason" required minLength={3} maxLength={2000} rows={4} disabled={pending} /></label>}
    <button className="btn btn-secondary btn-lg" disabled={pending}>{pending ? "Submitting…" : retry ? "Retry same objection" : "Submit objection"}</button>
  </form>;
}
