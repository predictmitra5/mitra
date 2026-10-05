import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./brand/logo";

/*
 * One screen per step, in Kalshi's shape (decided 2026-10-05): a segmented
 * progress bar, a back arrow, the logo in the middle and a close button, then a
 * single narrow column. Used by sign-up, onboarding and the other sign-in screens.
 * The progress has four parts: account, profile, photo, getting started.
 */

export const arrowLeft = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export function BackLink({ href, label }: { href: string; label: string }) {
  return <Link className="icon-button step-icon" href={href} prefetch={false} aria-label={label}>{arrowLeft}</Link>;
}

export function StepFrame({ fills, label, back, closeHref = "/", children }: {
  /** How full each of the four progress segments is, 0–100. Left out on single screens. */
  fills?: readonly number[];
  /** Said to screen readers in place of the bar, such as "Step 2 of 8". */
  label?: string;
  back?: ReactNode;
  closeHref?: string;
  children: ReactNode;
}) {
  return (
    <div className="step-shell">
      {fills && (
        <div className="step-progress" aria-hidden="true">
          {fills.map((fill, index) => <span key={index}><i style={{ width: `${Math.max(0, Math.min(100, fill))}%` }} /></span>)}
        </div>
      )}
      <header className="step-nav">
        <div className="step-nav-side">{back}</div>
        <Link className="step-logo" href="/" prefetch={false}><Logo className="step-logo-mark" title="Mitra" /></Link>
        <div className="step-nav-side step-nav-end">
          <Link className="icon-button step-icon" href={closeHref} prefetch={false} aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </Link>
        </div>
      </header>
      <main className="step-main">
        {label && <p className="sr-only">{label}</p>}
        {children}
      </main>
      <footer className="step-foot">
        Points are play money with no cash value. <Link href="/faq">FAQ</Link> · <Link href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
