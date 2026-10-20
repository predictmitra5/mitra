"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/*
 * Search (2026-10-19): startups, founders, industries, markets and videos.
 * On the market directory, typing narrows its cards in place (the address
 * changes, the page does not reload, so it records nothing). Anywhere else,
 * Enter opens the search page. Without JavaScript it is a plain form.
 */

export function SearchBox({ initial = "", placeholder = "Search founders, startups, markets" }: { initial?: string; placeholder?: string }) {
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const inPlace = pathname === "/markets";

  function change(next: string) {
    setValue(next);
    if (!inPlace) return;
    const params = new URLSearchParams(window.location.search);
    if (next.trim()) params.set("q", next);
    else params.delete("q");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/markets?${query}` : "/markets");
  }

  return (
    <form className="search" role="search" action={inPlace ? "/markets" : "/search"} method="get" onSubmit={(event) => { if (inPlace) event.preventDefault(); }}>
      <label className="search-field">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <span className="sr-only">{placeholder}</span>
        <input
          type="search" name="q" value={value} onChange={(event) => change(event.target.value)}
          placeholder={placeholder} autoComplete="off" enterKeyHint="search" maxLength={80}
        />
      </label>
    </form>
  );
}
