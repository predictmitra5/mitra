import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { AdminError, readAudit } from "@/modules/startups/admin";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";

export const metadata = { title: "Audit record", robots: { index: false } };
export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  approve: "Opened a market", reject: "Turned down", close_early: "Closed early", close_deadline: "Closed at the deadline", rule: "Ruled",
  change_ruling: "Changed a ruling", settle: "Paid out", cancel: "Voided and refunded", ban: "Banned", unban: "Unbanned", remove_photo: "Removed a photo",
  withdraw_account: "Account withdrawn", approve_founder: "Approved a founder", reject_founder: "Turned down a founder", approve_startup: "Approved a startup",
  reject_startup: "Turned down a startup", approve_video: "Approved a video", reject_video: "Turned down a video", edit_market: "Edited a draft",
  pause: "Paused trading", resume: "Resumed trading", review_claim: "Reviewed a claim", resolve_report: "Closed a report", remove_comment: "Removed a comment",
};

const moment = (value: Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(value);

/** Every owner and system decision, newest first, with its reason (2026-10-19). Owner only. */
export default async function AuditPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  let rows;
  try { rows = await readAudit(getDb(), identity.id); }
  catch (error) { if (error instanceof AdminError && error.code === "NOT_OWNER") notFound(); throw error; }
  const viewer = await readViewerOrNull(getDb(), identity.id);
  return <div className="market-shell"><MarketHeader viewer={viewer} /><main className="account-main review-main">
    <div className="account-topline"><span className="eyebrow">OWNER · AUDIT</span><Link className="text-button" href="/review">Review queue</Link></div>
    <section className="account-welcome"><h1>Audit record</h1><p>The latest {rows.length} decisions. Records are never edited or deleted; demo seeding is marked as such.</p></section>
    <ol className="audit-list">
      {rows.map((row) => {
        const details = (row.details ?? {}) as Record<string, unknown>;
        return <li key={row.id}>
          <time>{moment(row.createdAt)}</time>
          <div>
            <strong>{LABELS[row.kind] ?? row.kind}</strong>
            <span className="muted"> by {row.actor ? `@${row.actor}` : "the system"}{details.demo ? " · demo data" : ""}</span>
            {row.question && <p>{row.marketId ? <Link href={`/markets/${row.marketId}`}>{row.question}</Link> : row.question}</p>}
            {row.reason && <p className="muted">{row.reason}</p>}
          </div>
        </li>;
      })}
    </ol>
  </main><MarketFooter /></div>;
}
