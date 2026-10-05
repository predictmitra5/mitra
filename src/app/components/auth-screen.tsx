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
  return <div className="market-shell">
    <MarketHeader viewer={null} />
    <main className="entry-grid">
      <section className="entry-form-panel" aria-labelledby="form-title">
        <div className="form-heading"><span className="eyebrow">YOUR NEXT CHAPTER</span><h1 id="form-title">{title}</h1><p>{description}</p></div>
        {message && <p className="form-error" role="alert">{message}</p>}
        <AuthForm mode={mode} initialCampus={campus.key} />
      </section>
      <aside className="entry-story" aria-label="About Mitra">
        <span className="eyebrow">BET ON LITERALLY ANYTHING</span>
        <h2>Your people.<br />Their next <em>move.</em></h2>
        <p className="story-description">Follow the goals. Read the evidence.<br />Make your own call.</p>
        <div className="goal-list" aria-label="Examples of goals">
          <div><span>01</span><p>Run the half marathon</p><span aria-hidden="true">↗︎</span></div>
          <div><span>02</span><p>Launch the app</p><span aria-hidden="true">↗︎</span></div>
          <div><span>03</span><p>Land the internship</p><span aria-hidden="true">↗︎</span></div>
          <div><span>04</span><p>Visit five new countries</p><span aria-hidden="true">↗︎</span></div>
        </div>
        <p className="story-footnote">Your goals don’t have to fit in a box.</p>
      </aside>
    </main>
    <MarketFooter />
  </div>;
}
