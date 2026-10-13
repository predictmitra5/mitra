"use client";

import { useSyncExternalStore } from "react";
import { CAMPUSES, type CampusKey } from "@/config/campus";
import { switchOwnerCampus } from "@/app/market-actions";

export function OwnerCampusPicker({ campus: initialCampus }: { campus?: CampusKey }) {
  const campus = useSyncExternalStore(
    subscribeToCampus,
    readCampus,
    () => initialCampus ?? "osu",
  );

  return (
    <details className="owner-campus-menu public-campus-menu" data-campus={campus}>
      <summary aria-label={`Switch campus storefront; currently ${CAMPUSES[campus].communityName}`}>
        {CAMPUSES[campus].communityName}<span className="public-campus-chevron" aria-hidden="true" />
      </summary>
      <div className="public-campus-menu-links" aria-label="Choose a campus storefront">
        {Object.values(CAMPUSES).map((entry) => (
          <form key={entry.key} action={switchOwnerCampus}>
            <input type="hidden" name="campus" value={entry.key} />
            <button type="submit" aria-current={campus === entry.key ? "page" : undefined}>
              {entry.communityName}{campus === entry.key ? " · Current" : ""}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}

function readCampus(): CampusKey {
  return document.documentElement.dataset.campus === "uiuc" ? "uiuc" : "osu";
}

function subscribeToCampus(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-campus"] });
  return () => observer.disconnect();
}
