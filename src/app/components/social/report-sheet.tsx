"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { reportItem } from "@/modules/social/actions";
import type { ReportTarget } from "@/modules/social/service";
import { askToSignUp, toast } from "../feed/needs-account";

/*
 * Report something to the owner (2026-10-19): a video, a comment, a startup,
 * a founder or a market. The owner reviews reports at /review/reports; the
 * reporter is never shown to anyone else.
 */
const REASONS = [
  "Misleading or false claims",
  "Impersonating a real person or company",
  "Spam or scam",
  "Harassment or hate",
  "Something else",
];

export function ReportSheet({ open, onClose, target, targetId, what, signedIn }: {
  open: boolean; onClose: () => void; target: ReportTarget; targetId: string; what: string; signedIn: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      if (!signedIn) { onClose(); askToSignUp(); return; }
      element.showModal();
    }
    if (!open && element.open) element.close();
  }, [open, signedIn, onClose]);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await reportItem({ target, targetId, reason: detail.trim() ? `${reason}: ${detail.trim()}` : reason });
      if (result.ok) { toast("Thanks. The owner will review it."); onClose(); setDetail(""); }
      else if (result.code === "SIGNED_OUT") askToSignUp();
      else toast(result.error);
    });
  }
  return (
    <dialog ref={dialog} className="sheet sheet-small" aria-labelledby={`report-${targetId}`} onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="sheet-panel report-form" onSubmit={submit}>
        <div className="sheet-head">
          <h2 id={`report-${targetId}`}>Report {what}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <fieldset className="report-reasons">
          <legend className="sr-only">Reason</legend>
          {REASONS.map((r) => (
            <label key={r} className="report-reason"><input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />{r}</label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor={`report-detail-${targetId}`}>Anything else? <span className="muted">(optional)</span></label>
          <textarea id={`report-detail-${targetId}`} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={400} rows={3} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send report"}</button>
      </form>
    </dialog>
  );
}
