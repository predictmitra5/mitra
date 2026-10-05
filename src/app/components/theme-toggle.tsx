"use client";

import { THEME_COOKIE, themeFor } from "@/config/theme";

/*
 * The black/white switch in the top bar (decided 2026-10-05). It flips
 * html[data-theme] at once and remembers the choice for a year; the server
 * reads the same cookie, so the next page paints in the chosen theme. Both
 * icons and both labels are rendered and CSS shows the pair for the current
 * theme, so the button is right on the first paint without the server passing
 * anything down.
 */
export function ThemeToggle() {
  function choose() {
    const next = themeFor(document.documentElement.dataset.theme) === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }

  return (
    <button className="icon-button theme-toggle" type="button" onClick={choose}>
      <svg className="when-dark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <span className="sr-only when-dark">Switch to a white background</span>
      <svg className="when-light" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <span className="sr-only when-light">Switch to a black background</span>
    </button>
  );
}
