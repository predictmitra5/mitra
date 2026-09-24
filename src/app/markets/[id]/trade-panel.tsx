"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirmOrder, previewOrder } from "@/modules/market/actions";
import { estimateBuy, estimateSell } from "@/modules/market/estimate";
import { formatMicro, parseTradeAmount } from "@/modules/market/input";
import type { Side } from "@/modules/market/lmsr";
import type { TradePreview, TradeReceipt } from "@/modules/market/service";
import { percent } from "@/modules/discovery/present";

/*
 * The trade panel (decided 2026-09-24): Buy or Sell, Yes or No, an amount with
 * +10, +25 and Max, an estimate with "To win", and a lime button. The button
 * asks the server for the exact preview, which the trader then confirms, as
 * before; the estimate never charges anyone. Play points only, up to 100 points
 * of held cost per goal.
 */

export type TradeAccess =
  | { kind: "open" }
  | { kind: "signed-out" }
  | { kind: "no-profile" }
  | { kind: "blocked"; message: string }
  | { kind: "closed" }
  | { kind: "unavailable" };

const QUICK = [10, 25] as const;
const DEFAULT_BUY = 25;

/** Micro-units as a plain decimal an input accepts: no thousands separators. */
function plain(micro: number): string {
  return (Math.max(0, micro) / 1_000_000).toFixed(6).replace(/\.?0+$/, "");
}
const one = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cents = (p: number) => (p < 0.005 ? "<1¢" : `${Math.round(p * 100)}¢`);
const words = (side: Side) => (side === "YES" ? "Yes" : "No");

export function TradePanel({
  marketId, yesPrice, liquidity, access, balanceMicro, allowanceMicro, heldYesMicro, heldNoMicro, side, onSide,
}: {
  marketId: string;
  yesPrice: number;
  liquidity: number;
  access: TradeAccess;
  balanceMicro: number | null;
  allowanceMicro: number | null;
  heldYesMicro: number;
  heldNoMicro: number;
  side: Side;
  onSide: (side: Side) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const buyMax = balanceMicro === null || allowanceMicro === null ? null : Math.max(0, Math.min(balanceMicro, allowanceMicro));
  const [amount, setAmount] = useState(() =>
    buyMax === null || buyMax >= DEFAULT_BUY * 1_000_000 ? String(DEFAULT_BUY) : buyMax > 0 ? plain(buyMax) : "");
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [receipt, setReceipt] = useState<TradeReceipt | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [pending, startTransition] = useTransition();

  const held = side === "YES" ? heldYesMicro : heldNoMicro;
  const maxMicro = mode === "buy" ? buyMax : held;
  const amountMicro = parseTradeAmount(amount);
  const over = amountMicro !== null && maxMicro !== null && amountMicro > maxMicro;
  const sidePrice = side === "YES" ? yesPrice : 1 - yesPrice;
  const buy = mode === "buy" && amountMicro ? estimateBuy(yesPrice, liquidity, side, amountMicro / 1_000_000) : null;
  const sell = mode === "sell" && amountMicro ? estimateSell(yesPrice, liquidity, side, amountMicro / 1_000_000) : null;
  const canTrade = access.kind === "open";

  function pickMode(next: "buy" | "sell") {
    setMode(next); setError("");
    setAmount(next === "buy" ? (buyMax === null || buyMax >= DEFAULT_BUY * 1_000_000 ? String(DEFAULT_BUY) : plain(buyMax)) : "");
  }

  function add(points: number) {
    const current = parseTradeAmount(amount) ?? 0;
    let next = current + points * 1_000_000;
    if (maxMicro !== null) next = Math.min(next, maxMicro);
    setAmount(next > 0 ? plain(next) : "");
  }

  function quote(event: React.FormEvent) {
    event.preventDefault();
    if (!canTrade) return;
    setError(""); setReceipt(null);
    const form = new FormData();
    form.set("marketId", marketId); form.set("action", mode); form.set("side", side); form.set("amount", amount.trim());
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

  if (access.kind === "blocked" || access.kind === "closed" || access.kind === "unavailable") {
    return (
      <div className="trade-body">
        <div className="trade-sides trade-sides-static" aria-label="Current prices">
          <span className="trade-side trade-side-yes"><span>Yes</span><span>{percent(yesPrice)}¢</span></span>
          <span className="trade-side trade-side-no"><span>No</span><span>{100 - percent(yesPrice)}¢</span></span>
        </div>
        <p className={access.kind === "unavailable" ? "form-error" : "trade-notice"} role={access.kind === "unavailable" ? "alert" : undefined}>
          {access.kind === "blocked" ? access.message
            : access.kind === "closed" ? "Trading is closed. The terms, proof and outcome stay on this page."
            : "Your trading account couldn’t load. Refresh to try again."}
        </p>
      </div>
    );
  }

  if (preview) {
    return (
      <div className="trade-body">
        {error && <p className="form-error" role="alert">{error}</p>}
        <section className="trade-review" aria-label="Review trade">
          <h3>Review your {preview.action === "buy" ? "buy" : "sale"}</h3>
          <dl className="trade-lines">
            <div><dt>{words(preview.side)} shares</dt><dd>{formatMicro(preview.sharesMicro)}</dd></div>
            <div><dt>You {preview.action === "buy" ? "pay" : "receive"}</dt><dd>{formatMicro(preview.totalMicro)} pts</dd></div>
            <div><dt>Average per share</dt><dd>{(preview.totalMicro / preview.sharesMicro * 100).toFixed(2)}¢</dd></div>
            <div><dt>{words(preview.side)} price after</dt><dd>{(preview.priceAfter * 100).toFixed(2)}¢</dd></div>
            <div><dt>Available after</dt><dd>{formatMicro(preview.balanceAfterMicro)} pts</dd></div>
          </dl>
          <p className="trade-note">{preview.action === "buy"
            ? `If ${words(preview.side)} wins, these shares pay ${formatMicro(preview.sharesMicro)} points. If it loses, they pay 0.`
            : "Selling returns these shares to the market maker. You give up their eventual payout."}</p>
          {preview.action === "sell" && preview.totalMicro === 0 && <p className="trade-notice">This tiny sale rounds down to 0 points. Confirm only if you want to give up these shares for nothing.</p>}
          <button type="button" className="btn btn-lime trade-cta" disabled={pending} onClick={confirm}>
            {pending ? "Confirming…" : uncertain ? "Retry the same confirmation" : `Confirm ${preview.action === "buy" ? "buy" : "sale"}`}
          </button>
          {!uncertain && <button type="button" className="trade-back" disabled={pending} onClick={() => { setPreview(null); setError(""); }}>Change trade</button>}
        </section>
      </div>
    );
  }

  const estimateLines = mode === "buy" ? [
    { label: "Average price", value: buy ? cents(buy.averagePrice) : cents(sidePrice) },
    { label: "Shares", value: buy ? one(buy.shares) : "—" },
  ] : [
    { label: "Average price", value: sell ? cents(sell.averagePrice) : cents(sidePrice) },
    { label: "Shares", value: amountMicro ? one(amountMicro / 1_000_000) : "—" },
  ];
  const payoff = mode === "buy" ? (buy ? `${one(buy.toWin)} pts` : "—") : (sell ? `${one(sell.proceeds)} pts` : "—");
  const amountLabel = mode === "buy" ? "Amount" : "Shares to sell";
  const available = mode === "buy"
    ? (balanceMicro === null ? null : `${formatMicro(Math.floor(balanceMicro / 10_000) * 10_000)} pts available`)
    : (canTrade ? `${one(held / 1_000_000)} ${words(side)} shares held` : null);

  return (
    <div className="trade-body">
      {receipt && <p className="form-success" role="status">{receipt.action === "buy" ? "Bought" : "Sold"} {formatMicro(receipt.sharesMicro)} {words(receipt.side)} shares for {formatMicro(receipt.totalMicro)} points.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="trade-modes" role="group" aria-label="Order type">
        {(["buy", "sell"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => pickMode(value)}>
            {value === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>
      <div className="trade-sides" role="group" aria-label="Outcome">
        <button type="button" className="trade-side trade-side-yes" aria-pressed={side === "YES"} aria-label={`Yes, ${percent(yesPrice)}¢`} onClick={() => onSide("YES")}>
          <span>Yes</span><span>{percent(yesPrice)}¢</span>
        </button>
        <button type="button" className="trade-side trade-side-no" aria-pressed={side === "NO"} aria-label={`No, ${100 - percent(yesPrice)}¢`} onClick={() => onSide("NO")}>
          <span>No</span><span>{100 - percent(yesPrice)}¢</span>
        </button>
      </div>
      <form className="trade-form" onSubmit={quote} noValidate>
        <div className="trade-amount">
          <label htmlFor={`amount-${marketId}`}><span>{amountLabel}</span>{available && <span className="muted">{available}</span>}</label>
          <div className="amount-box">
            <input id={`amount-${marketId}`} name="amount" inputMode="decimal" autoComplete="off" value={amount} maxLength={30}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))} aria-describedby={`amount-help-${marketId}`}
              aria-invalid={over || (amount !== "" && amountMicro === null)} />
            <span>{mode === "buy" ? "pts" : "shares"}</span>
          </div>
          <div className="quick">
            {QUICK.map((points) => <button key={points} type="button" onClick={() => add(points)}>+{points}</button>)}
            <button type="button" disabled={maxMicro === null || maxMicro <= 0} onClick={() => maxMicro !== null && setAmount(maxMicro > 0 ? plain(maxMicro) : "")}>Max</button>
          </div>
          <p id={`amount-help-${marketId}`} className={over ? "trade-over" : "sr-only"}>
            {over
              ? mode === "buy" ? `You can put in up to ${formatMicro(maxMicro ?? 0)} points here: your available points or what is left of your 100-point limit on this goal, whichever is less.` : `You hold ${formatMicro(held)} ${words(side)} shares.`
              : mode === "buy" ? "Points to spend." : "Shares to sell."}
          </p>
        </div>
        <dl className="trade-estimate">
          {estimateLines.map((line) => <div key={line.label}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}
          <div className="trade-win"><dt>{mode === "buy" ? "To win" : "You receive"}</dt><dd className={`win-${side === "YES" ? "yes" : "no"}`}>{payoff}</dd></div>
        </dl>
        {access.kind === "open" ? (
          <button type="submit" className="btn btn-lime trade-cta" disabled={pending || !amountMicro || over}>
            {pending ? "Getting your quote…" : mode === "buy"
              ? `Buy ${words(side)}${amountMicro ? ` for ${formatMicro(amountMicro)} pts` : ""}`
              : `Sell ${words(side)}${amountMicro ? ` · ${formatMicro(amountMicro)} shares` : ""}`}
          </button>
        ) : access.kind === "signed-out" ? (
          <Link className="btn btn-lime trade-cta" href="/sign-in">Log in to trade</Link>
        ) : (
          <Link className="btn btn-lime trade-cta" href="/account">Finish your profile to trade</Link>
        )}
      </form>
      <p className="trade-note">
        Estimate. Prices move as people trade; you see the exact total before you confirm. Up to 100 pts per goal.
        {access.kind === "signed-out" && " Trading needs an Ohio State email and is for ages 18 and up."}
      </p>
    </div>
  );
}
