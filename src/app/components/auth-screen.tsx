import type { CampusKey } from "@/config/campus";
import { AuthForm, type AuthMode } from "./auth-form";
import { SignupFlow } from "./signup-flow";
import { BackLink, StepFrame } from "./step-frame";

/*
 * Sign-in, sign-up and password screens, one narrow column in Kalshi's shape
 * (decided 2026-10-05). Sign-up runs its own steps; the others are one screen.
 */

const copy: Record<Exclude<AuthMode, "sign-up">, { title: string; description: string }> = {
  "sign-in": { title: "Log in", description: "Welcome back. Use your school email and password." },
  "forgot-password": { title: "Reset your password", description: "We’ll email a reset link to your school inbox. Open it in this browser." },
  "reset-password": { title: "Choose a new password", description: "Then you’re back in." },
};

export function AuthScreen({ mode, notice, school = null }: { mode: AuthMode; notice?: string; school?: CampusKey | null }) {
  if (mode === "sign-up") return <SignupFlow initialSchool={school} />;
  const { title, description } = copy[mode];
  const message = notice === "link-expired"
    ? "That email link is invalid or has expired. Open the latest link in the browser where you requested it, or request a new one."
    : notice === "signout-failed" ? "We couldn’t finish signing out. Please try again from your account."
      : notice === "account-deleted" ? "Your Mitra account was deleted." : undefined;
  const success = notice === "account-deleted";
  return (
    <StepFrame back={<BackLink href={mode === "sign-in" ? "/" : "/sign-in"} label={mode === "sign-in" ? "Back to goals" : "Back to log in"} />}>
      <div className="step-form">
        <h1>{title}</h1>
        <p className="step-sub">{description}</p>
        {message && <p className={success ? "form-success" : "form-error"} role={success ? "status" : "alert"}>{message}</p>}
      </div>
      <AuthForm mode={mode} />
    </StepFrame>
  );
}
