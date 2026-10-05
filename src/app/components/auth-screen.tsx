import { selectedCampus } from "@/config/campus-server";
import { AuthForm, type AuthMode } from "./auth-form";
import { MarketFooter, MarketHeader } from "./market/market-header";

const copy: Record<AuthMode, { title: string; description: string }> = {
  "sign-in": { title: "Welcome back.", description: "Sign in to follow the next chapter." },
  "sign-up": { title: "You’re up next.", description: "Choose your university, verify your email, and start with 1,000 play points. Ages 18 and up." },
  "forgot-password": { title: "Let’s get you back in.", description: "We’ll send a password-reset link to your university inbox." },
  "reset-password": { title: "A fresh start.", description: "Choose a new password for your account." },
};

export async function AuthScreen({ mode, notice }: { mode: AuthMode; notice?: string }) {
  const campus = await selectedCampus();
  const { title, description } = copy[mode];
  const message = notice === "link-expired"
    ? "That email link is invalid or has expired. Open the latest link in the browser where you requested it, or request a new one."
    : notice === "signout-failed" ? "We couldn’t finish signing out. Please try again from your account." : undefined;
  return <div className="market-shell entry-shell">
    <MarketHeader viewer={null} brandMode="neutral" entryAction={mode === "sign-up" ? "sign-in" : "sign-up"} />
    <main className="entry-grid">
      <section className="entry-form-panel" aria-labelledby="form-title">
        <div className="form-heading"><span className="eyebrow">YOUR NEXT CHAPTER</span><h1 id="form-title">{title}</h1><p>{description}</p></div>
        {message && <p className="form-error" role="alert">{message}</p>}
        <AuthForm mode={mode} initialCampus={campus.key} />
      </section>
      <aside className="entry-story" aria-label="About Mitra">
        <span className="eyebrow">PLAY MONEY · REAL ACCOUNTABILITY</span>
        <h2>Put a little belief<br />behind the <em>next move.</em></h2>
        <p className="story-description">A private university community for following through—without deposits, cash value, or public browsing.</p>
        <div className="entry-principles" aria-label="How Mitra starts">
          <div><span>01</span><p><strong>Choose your university</strong><small>Your verified inbox unlocks the right community.</small></p></div>
          <div><span>02</span><p><strong>Post only about yourself</strong><small>You decide which personal goals enter review.</small></p></div>
          <div><span>03</span><p><strong>Use play points</strong><small>Make a call with no deposits and no cash payouts.</small></p></div>
        </div>
        <p className="story-footnote">Your university sets the community—not the first impression.</p>
      </aside>
    </main>
    <MarketFooter brandMode="neutral" />
  </div>;
}
