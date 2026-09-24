"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refillCash, type RefillResult } from "@/modules/account/refill-actions";
import type { RefillStatus } from "@/modules/account/refill";
import { formatMicro } from "@/modules/market/input";

/**
 * "Top up to 1,000 pts" on the account page (refills decided 2026-09-15; the
 * button's wording 2026-09-24). Up to twice a month, counting available points
 * only. A retry after an uncertain answer reuses the same request, so it can
 * never credit twice.
 */
export function RefillButton({ status }: { status: RefillStatus }) {
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
        setResult({ ok: false, code: "UNAVAILABLE", error: "Your top-up could not be confirmed. Retry to check the same top-up safely." });
      } finally { submitting.current = false; }
    });
  }

  const target = formatMicro(status.targetMicro);
  return <div className="refill">
    <button type="button" className="btn btn-quiet refill-button" onClick={refill} disabled={pending || (!retry && !status.decision.eligible)}>
      {pending ? "Checking…" : retry ? "Retry this top-up" : `Top up to ${target} pts`}
    </button>
    {result?.ok && <p className="form-success" role="status">Topped up: {formatMicro(result.receipt.amountMicro)} points added. Retrying won’t add them again.</p>}
    {result?.ok === false && <p className="form-error" role="alert">{result.error}</p>}
    <p className="muted account-small">
      {!status.decision.eligible && (status.decision.reason === "MONTHLY_LIMIT_REACHED"
        ? "You’ve used this month’s top-ups. "
        : `You can top up when you have less than ${target} points available. `)}
      Points in positions don’t count. Resets at midnight Eastern on the first of each month.
    </p>
  </div>;
}
