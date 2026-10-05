"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CAMPUSES } from "@/config/campus";

/*
 * The sign-up pop-up for visitors without an account (decided 2026-10-05, like
 * Kalshi's). It opens once after 30 seconds on a page; closing it lets them keep
 * browsing and stops it opening by itself again in this browser session. Any
 * Yes, No or trade control opens it at once instead of acting, because those
 * need an account. Mounted only for signed-out visitors, so it never touches a
 * member's clicks.
 *
 * A native <dialog> opened with showModal() keeps focus inside, closes on
 * Escape and makes the page behind it inert.
 */

const OPEN_AFTER_MS = 30_000;
const DISMISSED_KEY = "mitra.signup-prompt-dismissed";
/** Controls that need an account. Links keep a real address for visitors without JavaScript. */
const NEEDS_ACCOUNT = "[data-needs-account], a.price-button, .trade-side, .buy-bar button";

function wasDismissed(): boolean {
  try { return window.sessionStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
}

function rememberDismissed() {
  try { window.sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* not remembered, still closes */ }
}

export function SignupPrompt() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const open = () => { if (!element.open) element.showModal(); };

    const timer = wasDismissed() ? undefined : window.setTimeout(open, OPEN_AFTER_MS);

    function intercept(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest(NEEDS_ACCOUNT) : null;
      if (!target || element!.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      open();
    }
    // Capture, so the control's own handler never runs for a visitor.
    document.addEventListener("click", intercept, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", intercept, true);
    };
  }, []);

  function close() {
    rememberDismissed();
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      className="signup-prompt"
      aria-labelledby="signup-prompt-title"
      onCancel={rememberDismissed}
      // A click on the dimmed area outside the panel lands on the dialog itself.
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="signup-prompt-panel">
        <button className="icon-button signup-prompt-close" type="button" onClick={close} aria-label="Close and keep browsing">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <h2 id="signup-prompt-title">Create your account</h2>
        <p className="signup-prompt-sub">Bet on your classmates’ goals with 1,000 free points. Sign up in a minute.</p>
        {Object.values(CAMPUSES).map((campus) => (
          <Link key={campus.key} className={`school-button school-${campus.key}`} href={`/sign-up?school=${campus.key}`} prefetch={false}>
            <span className="school-dot" aria-hidden="true" />Continue with {campus.communityName} email
          </Link>
        ))}
        <p className="signup-prompt-login">Already have an account? <Link href="/sign-in" prefetch={false}>Log in</Link></p>
        <p className="signup-prompt-fine">Start with 1,000 points. See the <Link href="/faq">FAQ</Link> and <Link href="/privacy">Privacy</Link> page.</p>
      </div>
    </dialog>
  );
}
