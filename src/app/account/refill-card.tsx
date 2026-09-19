"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refillCash, type RefillResult } from "@/modules/account/refill-actions";
import type { RefillStatus } from "@/modules/account/refill";
import { formatMicro } from "@/modules/market/input";

export function RefillCard({ status }: { status: RefillStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const request = useRef<string | null>(null);
  const submitting = useRef(false);
  const [result, setResult] = useState<RefillResult | null>(null);
  const retry = result?.ok === false && result.code === "UNAVAILABLE";

  function refill() {
    if (submitting.current) return;
    submitting.current = true;
    startTransition(async () => {
      try {
        request.current ??= crypto.randomUUID();
        const response = await refillCash(request.current);
        setResult(response);
        // An uncertain result may already have committed: keep its identifier.
        if (response.ok || response.code !== "UNAVAILABLE") request.current = null;
        router.refresh();
      } catch {
        setResult({ ok: false, code: "UNAVAILABLE", error: "Your refill could not be confirmed. Retry to check the same refill safely." });
      } finally { submitting.current = false; }
    });
  }

  return <section className="account-note" aria-labelledby="refill-heading">
    <div className="section-head"><h2 id="refill-heading">Refill your points</h2><span className="status-pill">{status.remaining} of {status.monthlyLimit} left</span></div>
    <p>Top up your available cash to {formatMicro(status.targetMicro)} play points. Points in open predictions don’t count toward this limit.</p>
    <p className="field-hint">{status.monthLabel} · Resets at midnight Eastern time on the first of each month.</p>
    {!status.decision.eligible && <p className="field-hint">{status.decision.reason === "MONTHLY_LIMIT_REACHED"
      ? "You’ve used this month’s refills. More are available next month."
      : `You can refill when your cash is below ${formatMicro(status.targetMicro)} points.`}</p>}
    {result?.ok && <div className="form-success" role="status">Refill confirmed: {formatMicro(result.receipt.amountMicro)} points credited. Retrying a confirmed refill won’t add it again.</div>}
    {result?.ok === false && <div className="form-error" role="alert">{result.error}</div>}
    <button type="button" className="secondary-button" onClick={refill} disabled={pending || (!retry && !status.decision.eligible)}>
      {pending ? "Checking refill…" : retry ? "Retry this refill" : `Refill to ${formatMicro(status.targetMicro)} points`}
    </button>
  </section>;
}
