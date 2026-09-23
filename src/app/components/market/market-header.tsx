import Link from "next/link";

/** The dark top bar for the market surfaces, in the shape of Kalshi's. */
export function MarketHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="topbar">
      <Link className="topbar-brand" href="/">
        <span className="topbar-mark" aria-hidden="true">&#8599;</span>
        Mitra
      </Link>
      <span className="topbar-scope">Ohio State <span>/ early access</span></span>
      <nav className="topbar-actions" aria-label="Account">
        {signedIn ? (
          <>
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
      <span>Play money. Real goals.</span>
      <span>No deposits. No cash value.</span>
    </footer>
  );
}
