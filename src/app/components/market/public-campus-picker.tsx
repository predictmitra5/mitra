"use client";

import Link from "next/link";
import { useState } from "react";
import { CAMPUSES, type CampusKey } from "@/config/campus";

export function PublicCampusPicker({ campus, query = "" }: { campus: CampusKey; query?: string }) {
  const [open, setOpen] = useState(false);

  return <details className="public-campus-menu" data-campus={campus} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary aria-label={`Browse campus; currently ${CAMPUSES[campus].communityName}`}>
      {CAMPUSES[campus].communityName}<span className="public-campus-chevron" aria-hidden="true" />
    </summary>
    <div className="public-campus-menu-links" aria-label="Choose a campus">
      {(Object.keys(CAMPUSES) as CampusKey[]).map((key) => <Link
        key={key}
        href={campusBrowseHref(key, query)}
        aria-current={campus === key ? "page" : undefined}
        onClick={() => setOpen(false)}
      >{CAMPUSES[key].communityName}</Link>)}
    </div>
  </details>;
}

function campusBrowseHref(campus: CampusKey, query: string): string {
  const params = new URLSearchParams({ campus });
  if (query) params.set("q", query);
  return `/?${params.toString()}`;
}
