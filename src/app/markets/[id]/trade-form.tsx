"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmOrder, previewOrder } from "@/modules/market/actions";
import { formatMicro } from "@/modules/market/input";
import type { TradePreview, TradeReceipt } from "@/modules/market/service";

export function TradeForm({ marketId }: { marketId: string }) {
  const router = useRouter();
  const [action, setAction] = useState("buy");
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [receipt, setReceipt] = useState<TradeReceipt | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [pending, startTransition] = useTransition();

  function quote(form: FormData) {
    setError(""); setReceipt(null);
    startTransition(async () => {
      try {
        const result = await previewOrder(form);
        if (result.ok) setPreview(result.value);
        else setError(result.error);
      } catch { setError("The preview couldn’t load. Please try again."); }
    });
  }

  function confirm() {
    if (!preview) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await confirmOrder(preview);
        if (result.ok) {
          setReceipt(result.value); setPreview(null); setUncertain(false); router.refresh();
        } else {
          setError(result.error);
          // Retain the same request id after an uncertain response. A fresh
          // preview here could accidentally turn one intended trade into two.
          if (result.code === "UNAVAILABLE") setUncertain(true);
          else { setPreview(null); setUncertain(false); router.refresh(); }
        }
      } catch {
        setUncertain(true);
        setError("The response was interrupted. Retry this confirmation to check or complete the same trade.");
      }
    });
  }

  return <div className="trade-form">
    {receipt && <p className="form-success" role="status">{receipt.action === "buy" ? "Bought" : "Sold"} {formatMicro(receipt.sharesMicro)} {receipt.side} shares for {formatMicro(receipt.totalMicro)} play points.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {preview ? <section className="trade-preview" aria-label="Review trade">
      <h3>Review your {preview.action}</h3>
      <dl className="trade-summary">
        <div><dt>{preview.side} shares</dt><dd>{formatMicro(preview.sharesMicro)}</dd></div>
        <div><dt>You {preview.action === "buy" ? "pay" : "receive"}</dt><dd>{formatMicro(preview.totalMicro)} points</dd></div>
        <div><dt>Average per share</dt><dd>{(preview.totalMicro / preview.sharesMicro * 100).toFixed(2)}¢</dd></div>
        <div><dt>{preview.side} price after trade</dt><dd>{(preview.priceAfter * 100).toFixed(2)}¢</dd></div>
        <div><dt>Cash after this quote</dt><dd>{formatMicro(preview.balanceAfterMicro)} points</dd></div>
      </dl>
      <p className="field-hint">{preview.action === "buy" ? `If ${preview.side} wins, these shares pay ${formatMicro(preview.sharesMicro)} points. If it loses, they pay 0.` : "Selling returns these shares to the market maker. You give up their eventual payout."}</p>
      {preview.action === "sell" && preview.totalMicro === 0 && <p className="rule-note">This tiny sale rounds down to 0 points. Confirm only if you want to give up these shares for no proceeds.</p>}
      <button type="button" className="primary-button" disabled={pending} onClick={confirm}>{pending ? "Confirming…" : uncertain ? "Retry same confirmation" : `Confirm ${preview.action}`}</button>
      {!uncertain && <button type="button" className="text-button" disabled={pending} onClick={() => { setPreview(null); setError(""); }}>Change trade</button>}
    </section> : <form action={quote} className="auth-form">
      <input type="hidden" name="marketId" value={marketId} />
      <fieldset className="type-picker" disabled={pending}><legend>Trade</legend>
        {(["buy", "sell"] as const).map((value) => <label className="type-option" key={value}><input type="radio" name="action" value={value} checked={action === value} onChange={() => setAction(value)} /><span>{value === "buy" ? "Buy" : "Sell"}</span></label>)}
      </fieldset>
      <fieldset className="type-picker" disabled={pending}><legend>Outcome</legend>
        {(["YES", "NO"] as const).map((side) => <label className="type-option" key={side}><input type="radio" name="side" value={side} defaultChecked={side === "YES"} /><span>{side}</span></label>)}
      </fieldset>
      <div className="field"><label htmlFor="trade-amount">{action === "buy" ? "Play points to spend" : "Shares to sell"}</label>
        <input id="trade-amount" name="amount" inputMode="decimal" placeholder={action === "buy" ? "e.g. 10" : "e.g. 5"} required maxLength={30} disabled={pending} aria-describedby="amount-help" />
        <p id="amount-help" className="field-hint">{action === "buy" ? "Hold up to 100 points of cost across YES and NO in this goal." : "Enter up to the number of shares you hold on that side."}</p>
      </div>
      <button className="primary-button" disabled={pending}>{pending ? "Getting your quote…" : "Preview trade"}</button>
    </form>}
    <p className="field-hint">Play points only. Prices move with trades. Confirm after reviewing the exact total.</p>
  </div>;
}
