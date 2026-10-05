"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, requestPasswordReset, resetPassword } from "@/modules/auth/actions";
import type { FormState } from "@/modules/auth/policy";

/** The single-screen forms. Sign-up has its own steps in signup-flow.tsx. */
export type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password";
type FormMode = Exclude<AuthMode, "sign-up">;

const actions = { "sign-in": signIn, "forgot-password": requestPasswordReset, "reset-password": resetPassword };
const labels = { "sign-in": "Log in", "forgot-password": "Send reset link", "reset-password": "Save new password" };
const busy = { "sign-in": "Logging in…", "forgot-password": "Sending…", "reset-password": "Saving…" };

export function AuthForm({ mode }: { mode: FormMode }) {
  const [state, action, pending] = useActionState(actions[mode], {} as FormState);
  return (
    <form action={action} className="step-form" aria-busy={pending}>
      {mode !== "reset-password" && (
        <div className="field">
          <label htmlFor="email">School email</label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="name@osu.edu or netid@illinois.edu"
            maxLength={254} required autoFocus aria-describedby="email-hint" />
          <p id="email-hint" className="field-hint">Your @osu.edu or @illinois.edu address.</p>
        </div>
      )}
      {mode !== "forgot-password" && (
        <div className="field">
          <div className="label-row">
            <label htmlFor="password">{mode === "reset-password" ? "New password" : "Password"}</label>
            {mode === "sign-in" && <Link href="/forgot-password" prefetch={false}>Forgot password?</Link>}
          </div>
          <input id="password" name="password" type="password" autoComplete={mode === "reset-password" ? "new-password" : "current-password"}
            minLength={mode === "reset-password" ? 12 : 1} maxLength={128} required autoFocus={mode === "reset-password"}
            aria-describedby={mode === "reset-password" ? "password-hint" : undefined} />
          {mode === "reset-password" && <p id="password-hint" className="field-hint">At least 12 characters. A few words you’ll remember work well.</p>}
        </div>
      )}
      {mode === "reset-password" && (
        <div className="field">
          <label htmlFor="confirmPassword">Type it again</label>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
        </div>
      )}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.success && <p className="form-success" role="status">{state.success}</p>}
      <button className="primary-button" disabled={pending} type="submit">{pending ? busy[mode] : labels[mode]}</button>
      {mode === "sign-in"
        ? <Link className="secondary-button" href="/sign-up" prefetch={false}>No account? Create one</Link>
        : <Link className="secondary-button" href="/sign-in" prefetch={false}>Back to log in</Link>}
    </form>
  );
}
