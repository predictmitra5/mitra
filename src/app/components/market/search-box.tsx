"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/*
 * Search for markets and venues (decided 2026-09-24: it filters the feed). On the
 * feed, typing rewrites the address in place, which the feed reads to narrow
 * its cards; the page is not reloaded, so typing records no extra views. On any
 * other page, pressing Enter opens the feed with the search filled in. Without
 * JavaScript it is a plain form that does the same.
 */

export function SearchBox({ initial = "" }: { initial?: string }) {
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const onFeed = pathname === "/";

  function change(next: string) {
    setValue(next);
    if (!onFeed) return;
    const params = new URLSearchParams(window.location.search);
    if (next.trim()) params.set("q", next);
    else params.delete("q");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  }

  return (
    <form className="search" role="search" action="/" method="get" onSubmit={(event) => { if (onFeed) event.preventDefault(); }}>
      <label className="search-field">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <span className="sr-only">Search markets or venues</span>
        <input
          type="search" name="q" value={value} onChange={(event) => change(event.target.value)}
          placeholder="Search markets or venues" autoComplete="off" enterKeyHint="search" maxLength={80}
        />
      </label>
    </form>
  );
}
