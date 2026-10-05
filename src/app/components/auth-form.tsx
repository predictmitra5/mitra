"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CAMPUSES, CAMPUS_COOKIE, type CampusKey } from "@/config/campus";
import { signIn, signUp, requestPasswordReset, resetPassword, verifyEmailCode } from "@/modules/auth/actions";
import type { FormState } from "@/modules/auth/policy";

export type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password";
const actions = { "sign-in": signIn, "sign-up": signUp, "forgot-password": requestPasswordReset, "reset-password": resetPassword };
const labels = { "sign-in": "Sign in", "sign-up": "Create account", "forgot-password": "Send reset link", "reset-password": "Save new password" };

function applyCampus(campus: CampusKey) {
  document.documentElement.dataset.campus = campus;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CAMPUS_COOKIE}=${campus}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function AuthForm({ mode, initialCampus }: { mode: AuthMode; initialCampus: CampusKey }) {
  const [state, action, pending] = useActionState(actions[mode], {} as FormState);
  const [campus, setCampus] = useState<CampusKey | null>(mode === "sign-up" ? null : initialCampus);
  const newPassword = mode === "sign-up" || mode === "reset-password";

  if (mode === "sign-up" && state.verification) {
    return <VerifyEmailForm verification={state.verification} message={state.success} />;
  }

  if (mode === "sign-up" && !campus) {
    return <section className="campus-step" aria-labelledby="campus-step-title">
      <div className="step-label"><span>01</span><span>Choose your community</span></div>
      <h2 id="campus-step-title">Where are you joining from?</h2>
      <p>Your university sets your Mitra edition and color theme. Your email will verify the choice.</p>
      <div className="campus-picker">
        {(Object.values(CAMPUSES)).map((option) => <button key={option.key} className="campus-option" type="button" onClick={() => {
          setCampus(option.key);
          applyCampus(option.key);
        }}>
          <span className="campus-swatch" aria-hidden="true" />
          <span><strong>{option.shortName}</strong><small>{option.universityName}</small></span>
          <span aria-hidden="true">↗︎</span>
        </button>)}
      </div>
      <p className="form-switch">Already have an account? <Link href="/sign-in">Sign in</Link></p>
    </section>;
  }

  const selected = CAMPUSES[campus ?? initialCampus];
  return <form action={action} className="auth-form" aria-busy={pending}>
    {mode === "sign-up" && <div className="campus-choice">
      <div><span className="campus-swatch" aria-hidden="true" /><span><small>YOUR COMMUNITY</small><strong>{selected.editionName}</strong></span></div>
      <button type="button" onClick={() => setCampus(null)}>Change</button>
      <input type="hidden" name="campus" value={selected.key} />
    </div>}
    {mode !== "reset-password" && <div className="field">
      <label htmlFor="email">{mode === "sign-up" ? `${selected.shortName} email` : "University email"}</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder={mode === "sign-up" ? selected.emailExample : "name@university.edu"} maxLength={254} required aria-describedby="email-hint" />
      <p id="email-hint" className="field-hint">{mode === "sign-up" ? selected.emailHint : "Use your @osu.edu or @illinois.edu address."}</p>
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

function VerifyEmailForm({ verification, message }: { verification: NonNullable<FormState["verification"]>; message?: string }) {
  const [state, action, pending] = useActionState(verifyEmailCode, { verification } as FormState);
  const campus = CAMPUSES[verification.campus];
  return <form action={action} className="auth-form verification-form" aria-busy={pending}>
    <input type="hidden" name="email" value={verification.email} />
    <input type="hidden" name="campus" value={verification.campus} />
    <div className="verification-mark" aria-hidden="true">@</div>
    <div className="verification-copy">
      <span className="eyebrow">CHECK YOUR {campus.shortName} INBOX</span>
      <h2>Enter your verification code.</h2>
      <p>{message ?? `We sent a six-digit code to ${verification.email}.`}</p>
    </div>
    <div className="field">
      <label htmlFor="token">Six-digit code</label>
      <input className="code-input" id="token" name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required autoFocus />
    </div>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="primary-button" disabled={pending} type="submit">{pending ? "Verifying…" : "Verify email"}<span aria-hidden="true">↗︎</span></button>
    <p className="field-hint">Use the newest code. Codes expire and can only be used once.</p>
    <p className="form-switch"><Link href="/sign-up">Use a different email</Link></p>
  </form>;
}
