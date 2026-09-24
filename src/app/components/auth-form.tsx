"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signUp, requestPasswordReset, resetPassword } from "@/modules/auth/actions";
import type { FormState } from "@/modules/auth/policy";

export type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password";
const actions = { "sign-in": signIn, "sign-up": signUp, "forgot-password": requestPasswordReset, "reset-password": resetPassword };
const labels = { "sign-in": "Sign in", "sign-up": "Create account", "forgot-password": "Send reset link", "reset-password": "Save new password" };

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [state, action, pending] = useActionState(actions[mode], {} as FormState);
  const newPassword = mode === "sign-up" || mode === "reset-password";
  return <form action={action} className="auth-form" aria-busy={pending}>
    {mode !== "reset-password" && <div className="field">
      <label htmlFor="email">Ohio State email</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="name.123@osu.edu" maxLength={254} required aria-describedby="email-hint" />
      <p id="email-hint" className="field-hint">BuckeyeMail addresses work too. We use your @osu.edu address.</p>
    </div>}
    {mode !== "forgot-password" && <div className="field">
      <div className="label-row"><label htmlFor="password">{newPassword ? "New password" : "Password"}</label>
        {mode === "sign-in" && <Link href="/forgot-password">Forgot password?</Link>}
      </div>
      <input id="password" name="password" type="password" autoComplete={newPassword ? "new-password" : "current-password"} minLength={newPassword ? 12 : 1} maxLength={128} required aria-describedby={newPassword ? "password-hint" : undefined} />
      {newPassword && <p id="password-hint" className="field-hint">At least 12 characters. A few memorable words work well.</p>}
    </div>}
    {newPassword && <div className="field">
      <label htmlFor="confirmPassword">Confirm password</label>
      <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
    </div>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && <div className="form-success" role="status">{state.success}</div>}
    <button className="primary-button" disabled={pending} type="submit">{pending ? "Please wait…" : labels[mode]}<span aria-hidden="true">↗︎</span></button>
    {mode === "sign-in" && <p className="form-switch">New here? <Link href="/sign-up">Create an account</Link></p>}
    {mode !== "sign-in" && <p className="form-switch"><Link href="/sign-in">Back to sign in</Link></p>}
  </form>;
}
