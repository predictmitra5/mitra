import Link from "next/link";

/**
 * The dark top bar, in the shape of Kalshi's, on every page.
 *
 * `ownerQueue` is set only for the owner: how many goals and pieces of proof
 * are waiting. The owner link stays visible on a phone, where the other links
 * collapse, because nothing else tells the owner something is waiting.
 */
export function MarketHeader({ signedIn, ownerQueue = null }: { signedIn: boolean; ownerQueue?: number | null }) {
  return (
    <header className="topbar">
      <Link className="topbar-brand" href="/">
        <span className="topbar-mark" aria-hidden="true">&#8599;&#65038;</span>
        Mitra
      </Link>
      <span className="topbar-scope">Ohio State <span>/ early access</span></span>
      <nav className="topbar-actions" aria-label="Account">
        {signedIn ? (
          <>
            {ownerQueue !== null && (
              <Link className="btn btn-ghost owner-link" href="/review" aria-label={ownerQueue > 0 ? `Owner review: ${ownerQueue} waiting` : "Owner review"}>
                Review
                {ownerQueue > 0 && <span className="owner-badge" aria-hidden="true">{ownerQueue}</span>}
              </Link>
            )}
            <Link className="topbar-link" href="/goals/new">Write a goal</Link>
            <Link className="topbar-link" href="/positions" prefetch={false}>Your predictions</Link>
            <Link className="btn btn-ghost" href="/account">Account</Link>
          </>
        ) : (
          <>
            <Link className="btn btn-ghost" href="/sign-in">Log in</Link>
            <Link className="btn btn-accent" href="/sign-up">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function MarketFooter() {
  return (
    <footer className="market-footer">
      <span>Bet on literally anything.</span>
      <span>Play money. No deposits. No cash value.</span>
    </footer>
  );
}
