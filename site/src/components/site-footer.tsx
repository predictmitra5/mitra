import { app } from "@/lib/links";
import { FooterShell } from "./footer-shell";
import { Logo } from "./logo";

/*
 * Vela's black footer: the logo and a line about Mitra, the columns of links,
 * the wordmark set huge along the bottom (a light passes through it a few
 * times once it is in view) and the small print. Kept short enough that, as on
 * xo.market, the page can lift off it at the end.
 */

export function SiteFooter({ showTeam }: { showTeam: boolean }) {
  return (
    <FooterShell>
      <div className="container footer-inner">
        <div className="footer-cols">
          <div className="footer-brand">
            <Logo />
            <p>Founder videos, and Yes/No markets on what they build next.</p>
          </div>
          <nav aria-label="Mitra">
            <h3 className="label">Mitra</h3>
            <ul>
              <li><a href={app()}>Open Mitra</a></li>
              <li><a href={app("/markets")}>Markets</a></li>
              <li><a href="#how">How it works</a></li>
            </ul>
          </nav>
          <nav aria-label="Founders">
            <h3 className="label">Founders</h3>
            <ul>
              <li><a href={app("/create")}>Start a founder page</a></li>
              <li><a href="#founders">For founders</a></li>
              <li><a href="#rules">How markets settle</a></li>
            </ul>
          </nav>
          <nav aria-label="Company">
            <h3 className="label">Company</h3>
            <ul>
              {showTeam && <li><a href="#team">Team</a></li>}
              <li><a href="#faq">Questions</a></li>
              <li><a href={app("/faq")}>Mitra&rsquo;s FAQ</a></li>
              <li><a href={app("/privacy")}>Privacy</a></li>
            </ul>
          </nav>
        </div>

        <div className="footer-word" aria-hidden="true" />

        <div className="footer-legal">
          <span>&copy; 2026 Mitra</span>
          <span>Example markets on this page are fictional and labelled Demo.</span>
        </div>
      </div>
    </FooterShell>
  );
}
