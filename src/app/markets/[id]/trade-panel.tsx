"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirmOrder, previewOrder } from "@/modules/market/actions";
import { estimateBuy, estimateBuyShares, estimateSell } from "@/modules/market/estimate";
import { formatMicro, parseTradeAmount } from "@/modules/market/input";
import type { Side } from "@/modules/market/lmsr";
import type { TradePreview, TradeReceipt } from "@/modules/market/service";
import { percent } from "@/modules/discovery/present";
import { refreshQuotes } from "@/app/components/market/live-quotes";

/*
 * The trade panel (2026-09-24, with contract quantities since 2026-10-19):
 * Buy or Sell, Yes or No, then how many contracts (or how many Trade Coins to
 * spend), with the available balance, the estimated cost, the payout if that
 * side wins, and the profit or loss either way. The button asks the server for
 * the exact preview, which the trader then confirms; the estimate never
 * charges anyone, and a confirmation sent twice executes once. Trade Coins
 * only, up to 100 Trade Coins of held cost per market.
 */

export type TradeAccess =
  | { kind: "open" }
  | { kind: "signed-out" }
  | { kind: "no-profile" }
  | { kind: "blocked"; message: string }
  | { kind: "closed" }
  | { kind: "paused"; reason: string | null }
  | { kind: "unavailable" };

type Unit = "contracts" | "credits";
const QUICK: Record<Unit, number[]> = { contracts: [10, 50], credits: [10, 25] };
const DEFAULT: Record<Unit, number> = { contracts: 20, credits: 25 };

/** Micro-units as a plain decimal an input accepts: no thousands separators. */
function plain(micro: number): string {
  return (Math.max(0, micro) / 1_000_000).toFixed(6).replace(/\.?0+$/, "");
}
const credits = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => (Math.abs(n) < 0.005 ? "0.00" : `${n > 0 ? "+" : "−"}${credits(Math.abs(n))}`);
const cents = (p: number) => (p < 0.005 ? "<1¢" : `${(p * 100).toFixed(1).replace(/\.0$/, "")}¢`);
const words = (side: Side) => (side === "YES" ? "Yes" : "No");

export function TradePanel({
  marketId, yesPrice, liquidity, access, balanceMicro, allowanceMicro, heldYesMicro, heldNoMicro, heldYesCostMicro = 0, heldNoCostMicro = 0, side, onSide,
}: {
  marketId: string;
  yesPrice: number;
  liquidity: number;
  access: TradeAccess;
  balanceMicro: number | null;
  allowanceMicro: number | null;
  heldYesMicro: number;
  heldNoMicro: number;
  heldYesCostMicro?: number;
  heldNoCostMicro?: number;
  side: Side;
  onSide: (side: Side) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [unit, setUnit] = useState<Unit>("contracts");
  const [amount, setAmount] = useState(String(DEFAULT.contracts));
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [receipt, setReceipt] = useState<TradeReceipt | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [pending, startTransition] = useTransition();

  const spendMax = balanceMicro === null || allowanceMicro === null ? null : Math.max(0, Math.min(balanceMicro, allowanceMicro));
  const held = side === "YES" ? heldYesMicro : heldNoMicro;
  const heldCost = side === "YES" ? heldYesCostMicro : heldNoCostMicro;
  const amountMicro = parseTradeAmount(amount);
  const value = amountMicro ? amountMicro / 1_000_000 : 0;

  // What this trade would do, from the current price alone (estimate.ts).
  const buyContracts = mode === "buy" && unit === "contracts" && value ? estimateBuyShares(yesPrice, liquidity, side, value) : null;
  const buyCredits = mode === "buy" && unit === "credits" && value ? estimateBuy(yesPrice, liquidity, side, value) : null;
  const sell = mode === "sell" && value ? estimateSell(yesPrice, liquidity, side, value) : null;
  const cost = buyContracts ? buyContracts.cost : buyCredits ? value : 0;
  const shares = buyContracts ? buyContracts.shares : buyCredits ? buyCredits.shares : 0;
  const over = mode === "buy"
    ? spendMax !== null && cost * 1_000_000 > spendMax + 0.5
    : amountMicro !== null && amountMicro > held;
  const canTrade = access.kind === "open";
  const sidePrice = side === "YES" ? yesPrice : 1 - yesPrice;

  function pickMode(next: "buy" | "sell") {
    setMode(next); setError("");
    setAmount(next === "buy" ? String(DEFAULT[unit]) : held > 0 ? plain(held) : "");
  }

  function pickUnit(next: Unit) {
    setUnit(next); setError("");
    setAmount(String(DEFAULT[next]));
  }

  function add(n: number) {
    const current = parseTradeAmount(amount) ?? 0;
    const next = current + n * 1_000_000;
    setAmount(plain(mode === "sell" ? Math.min(next, held) : next));
  }

  function max() {
    if (mode === "sell") { setAmount(held > 0 ? plain(held) : ""); return; }
    if (spendMax === null || spendMax <= 0) { setAmount(""); return; }
    if (unit === "credits") { setAmount(plain(spendMax)); return; }
    // The most whole contracts the balance and the market limit allow.
    const most = estimateBuy(yesPrice, liquidity, side, spendMax / 1_000_000);
    setAmount(most ? String(Math.max(0, Math.floor(most.shares))) : "");
  }

  function quote(event: React.FormEvent) {
    event.preventDefault();
    if (!canTrade) return;
    setError(""); setReceipt(null);
    const form = new FormData();
    form.set("marketId", marketId); form.set("action", mode); form.set("side", side); form.set("amount", amount.trim());
    if (mode === "buy") form.set("unit", unit);
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
          setReceipt(result.value); setPreview(null); setUncertain(false); router.refresh(); refreshQuotes();
        } else {
          setError(result.error);
          // Keep the same request id after an uncertain response, so retrying
          // can never turn one intended trade into two.
          if (result.code === "UNAVAILABLE") setUncertain(true);
          else { setPreview(null); setUncertain(false); router.refresh(); }
        }
      } catch {
        setUncertain(true);
        setError("The response was interrupted. Retry this confirmation to check or complete the same trade.");
      }
    });
  }

  if (access.kind === "blocked" || access.kind === "closed" || access.kind === "unavailable" || access.kind === "paused") {
    return (
      <div className="trade-body">
        <div className="trade-sides trade-sides-static" aria-label="Current prices">
          <span className="trade-side trade-side-yes"><span>Yes</span><span>{percent(yesPrice)}¢</span></span>
          <span className="trade-side trade-side-no"><span>No</span><span>{100 - percent(yesPrice)}¢</span></span>
        </div>
        <p className={access.kind === "unavailable" ? "form-error" : "trade-notice"} role={access.kind === "unavailable" ? "alert" : undefined}>
          {access.kind === "blocked" ? access.message
            : access.kind === "closed" ? "Trading is closed. The rules, discussion and outcome stay on this page."
            : access.kind === "paused" ? `Trading is paused while the owner reviews this market.${access.reason ? ` ${access.reason}` : ""}`
            : "Your trading account couldn’t load. Refresh to try again."}
        </p>
      </div>
    );
  }

  if (preview) {
    const totalCredits = preview.totalMicro / 1_000_000;
    const contracts = preview.sharesMicro / 1_000_000;
    return (
      <div className="trade-body">
        {error && <p className="form-error" role="alert">{error}</p>}
        <section className="trade-review" aria-label="Review order">
          <h3>Confirm your {preview.action === "buy" ? "order" : "sale"}</h3>
          <dl className="trade-lines">
            <div><dt>{words(preview.side)} contracts</dt><dd>{formatMicro(preview.sharesMicro)}</dd></div>
            <div><dt>You {preview.action === "buy" ? "pay" : "receive"}</dt><dd>{formatMicro(preview.totalMicro)} Trade Coins</dd></div>
            <div><dt>Average price</dt><dd>{(preview.totalMicro / preview.sharesMicro * 100).toFixed(2)}¢</dd></div>
            {preview.action === "buy" && <div><dt>Payout if {words(preview.side)}</dt><dd>{credits(contracts)} Trade Coins</dd></div>}
            {preview.action === "buy" && <div><dt>Profit if {words(preview.side)} / if not</dt><dd><span className="gain-up">{signed(contracts - totalCredits)}</span> / <span className="gain-down">{signed(-totalCredits)}</span></dd></div>}
            <div><dt>{words(preview.side)} price after</dt><dd>{(preview.priceAfter * 100).toFixed(1)}¢</dd></div>
            <div><dt>Available after</dt><dd>{formatMicro(preview.balanceAfterMicro)} Trade Coins</dd></div>
          </dl>
          <p className="trade-note">{preview.action === "buy"
            ? `Each contract pays 1 Trade Coin if ${words(preview.side)} wins and 0 if it loses.`
            : "Selling returns these contracts to the market maker. You give up their payout."}</p>
          {preview.action === "sell" && preview.totalMicro === 0 && <p className="trade-notice">This tiny sale rounds down to 0 Trade Coins. Confirm only if you want to give up these contracts for nothing.</p>}
          <button type="button" className="btn btn-primary trade-cta" disabled={pending} onClick={confirm}>
            {pending ? "Confirming…" : uncertain ? "Retry the same confirmation" : `Confirm ${preview.action === "buy" ? `buy ${words(preview.side)}` : "sale"}`}
          </button>
          {!uncertain && <button type="button" className="trade-back" disabled={pending} onClick={() => { setPreview(null); setError(""); }}>Change order</button>}
        </section>
      </div>
    );
  }

  const averagePrice = buyContracts?.averagePrice ?? buyCredits?.averagePrice ?? sell?.averagePrice ?? sidePrice;
  // What these contracts cost on average when bought, against what selling them returns.
  const sellProfit = sell && held > 0 ? sell.proceeds - (heldCost / held) * value : null;
  const balanceText = balanceMicro === null ? null : `${formatMicro(Math.floor(balanceMicro / 10_000) * 10_000)} Trade Coins`;

  return (
    <div className="trade-body">
      {receipt && <p className="form-success" role="status">{receipt.action === "buy" ? "Bought" : "Sold"} {formatMicro(receipt.sharesMicro)} {words(receipt.side)} contracts for {formatMicro(receipt.totalMicro)} Trade Coins.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="trade-modes" role="group" aria-label="Order type">
        {(["buy", "sell"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => pickMode(value)}>{value === "buy" ? "Buy" : "Sell"}</button>
        ))}
      </div>
      <div className="trade-sides" role="group" aria-label="Outcome">
        <button type="button" className="trade-side trade-side-yes" aria-pressed={side === "YES"} aria-label={`Yes, ${percent(yesPrice)}¢`} onClick={() => onSide("YES")}>
          <span>{mode === "buy" ? "Buy Yes" : "Yes"}</span><span>{percent(yesPrice)}¢</span>
        </button>
        <button type="button" className="trade-side trade-side-no" aria-pressed={side === "NO"} aria-label={`No, ${100 - percent(yesPrice)}¢`} onClick={() => onSide("NO")}>
          <span>{mode === "buy" ? "Buy No" : "No"}</span><span>{100 - percent(yesPrice)}¢</span>
        </button>
      </div>
      <form className="trade-form" onSubmit={quote} noValidate>
        {mode === "buy" && (
          <div className="trade-units" role="group" aria-label="Order by">
            <button type="button" aria-pressed={unit === "contracts"} onClick={() => pickUnit("contracts")}>Contracts</button>
            <button type="button" aria-pressed={unit === "credits"} onClick={() => pickUnit("credits")}>Trade Coins</button>
          </div>
        )}
        <div className="trade-amount">
          <label htmlFor={`amount-${marketId}`}>
            <span>{mode === "sell" ? "Contracts to sell" : unit === "contracts" ? "Contract quantity" : "Trade Coins to spend"}</span>
            {mode === "buy" ? balanceText && <span className="muted">{balanceText} available</span> : canTrade && <span className="muted">{credits(held / 1_000_000)} held</span>}
          </label>
          <div className="amount-box">
            <input id={`amount-${marketId}`} name="amount" inputMode="decimal" autoComplete="off" value={amount} maxLength={30}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))} aria-describedby={`amount-help-${marketId}`}
              aria-invalid={over || (amount !== "" && amountMicro === null)} />
            <span>{mode === "sell" || unit === "contracts" ? "contracts" : "Trade Coins"}</span>
          </div>
          <div className="quick">
            {QUICK[mode === "sell" ? "contracts" : unit].map((n) => <button key={n} type="button" onClick={() => add(n)}>+{n}</button>)}
            <button type="button" disabled={mode === "buy" ? spendMax === null || spendMax <= 0 : held <= 0} onClick={max}>Max</button>
          </div>
          <p id={`amount-help-${marketId}`} className={over ? "trade-over" : "sr-only"}>
            {over
              ? mode === "buy" ? `That costs more than you can put in here: ${formatMicro(spendMax ?? 0)} Trade Coins, your balance or what is left of your 100-Trade-Coin limit on this market, whichever is less.` : `You hold ${formatMicro(held)} ${words(side)} contracts.`
              : mode === "buy" ? (unit === "contracts" ? "How many contracts to buy." : "Trade Coins to spend.") : "Contracts to sell."}
          </p>
        </div>
        <dl className="trade-estimate">
          <div><dt>Average price</dt><dd>{cents(averagePrice)}</dd></div>
          {mode === "buy" ? (
            <>
              <div><dt>Estimated cost</dt><dd>{cost ? `${credits(cost)} Trade Coins` : "—"}</dd></div>
              <div className="trade-win"><dt>Payout if {words(side)}</dt><dd className={`win-${side === "YES" ? "yes" : "no"}`}>{shares ? `${credits(shares)}` : "—"}</dd></div>
              <div><dt>Profit if {words(side)} / if not</dt><dd>{shares ? <><span className="gain-up">{signed(shares - cost)}</span> / <span className="gain-down">{signed(-cost)}</span></> : "—"}</dd></div>
            </>
          ) : (
            <>
              <div className="trade-win"><dt>You receive</dt><dd className={`win-${side === "YES" ? "yes" : "no"}`}>{sell ? credits(sell.proceeds) : "—"}</dd></div>
              <div><dt>Profit or loss</dt><dd>{sellProfit === null ? "—" : <span className={sellProfit >= 0 ? "gain-up" : "gain-down"}>{signed(sellProfit)}</span>}</dd></div>
            </>
          )}
        </dl>
        {access.kind === "open" ? (
          <button type="submit" className="btn btn-primary trade-cta" disabled={pending || !amountMicro || over}>
            {pending ? "Getting your quote…" : mode === "buy" ? `Review: buy ${words(side)}` : `Review: sell ${words(side)}`}
          </button>
        ) : access.kind === "signed-out" ? (
          <Link className="btn btn-primary trade-cta" href="/sign-up" data-needs-account>Sign up to trade</Link>
        ) : (
          <Link className="btn btn-primary trade-cta" href="/welcome">Finish your profile to trade</Link>
        )}
      </form>
      <p className="trade-note">
        Estimate. Prices move as people trade; you see the exact total before you confirm. Up to 100 Trade Coins per market; they have no cash value.
        {access.kind === "signed-out" && " Trading needs a verified university email and is for ages 18 and up."}
      </p>
    </div>
  );
}
