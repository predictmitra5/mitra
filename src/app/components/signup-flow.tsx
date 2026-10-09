"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CAMPUSES, type CampusKey } from "@/config/campus";
import { sendSignupCode, setSignupPassword, verifyEmailCode } from "@/modules/auth/actions";
import type { FormState } from "@/modules/auth/policy";
import { BackLink, StepFrame, arrowLeft } from "./step-frame";

/*
 * Sign-up in Kalshi's shape (decided 2026-10-05): school, school email, the
 * six-digit code, then a password. Each screen is its own step; the code proves
 * the inbox is theirs before the account can be used, and the password is set
 * on that verified session. Onboarding follows on /account.
 */

type Step = "school" | "email" | "code" | "password";
const FILL: Record<Step, number> = { school: 8, email: 33, code: 66, password: 100 };
const NUMBER: Record<Step, number> = { school: 1, email: 1, code: 2, password: 3 };
const PREVIOUS: Partial<Record<Step, Step>> = { email: "school", code: "email" };
const RESEND_AFTER_SECONDS = 60;

export function SignupFlow({ initialSchool }: { initialSchool: CampusKey | null }) {
  const [step, setStep] = useState<Step>(initialSchool ? "email" : "school");
  const [school, setSchool] = useState<CampusKey | null>(initialSchool);
  const [email, setEmail] = useState("");
  const previous = PREVIOUS[step];

  const back = step === "school" ? <BackLink href="/" label="Back to markets" />
    : previous ? <button className="icon-button step-icon" type="button" onClick={() => setStep(previous)} aria-label="Back">{arrowLeft}</button>
    : null;

  return (
    <StepFrame fills={[FILL[step], 0, 0, 0]} label={`Sign up, step ${NUMBER[step]} of 3`} back={back}>
      {step === "school" && <SchoolStep onPick={(key) => { setSchool(key); setStep("email"); }} />}
      {step === "email" && school && (
        <EmailStep school={school} defaultEmail={email} onChangeSchool={() => setStep("school")}
          onSent={(sentTo) => { setEmail(sentTo); setStep("code"); }} />
      )}
      {step === "code" && school && (
        <CodeStep school={school} email={email} onVerified={() => setStep("password")} onChangeEmail={() => setStep("email")} />
      )}
      {step === "password" && <PasswordStep onRestart={() => setStep("email")} />}
    </StepFrame>
  );
}

function SchoolStep({ onPick }: { onPick: (key: CampusKey) => void }) {
  return (
    <div className="step-form">
      <h1>Where do you go to school?</h1>
      <p className="step-sub">Mitra is for Ohio State and Illinois students. Your school email gets you in.</p>
      {Object.values(CAMPUSES).map((campus) => (
        <button key={campus.key} className={`school-button school-${campus.key}`} type="button" onClick={() => onPick(campus.key)}>
          <span className="school-dot" aria-hidden="true" />{campus.communityName}
        </button>
      ))}
      <Link className="secondary-button" href="/sign-in" prefetch={false}>Already have an account? Log in</Link>
    </div>
  );
}

function EmailStep({ school, defaultEmail, onSent, onChangeSchool }: {
  school: CampusKey; defaultEmail: string; onSent: (email: string) => void; onChangeSchool: () => void;
}) {
  const campus = CAMPUSES[school];
  const [state, action, pending] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await sendSignupCode(previous, form);
    if (result.verification) onSent(result.verification.email);
    return result;
  }, {} as FormState);

  return (
    <form action={action} className="step-form" aria-busy={pending}>
      <span className={`school-chip school-${school}`}>
        <span className="school-dot" aria-hidden="true" />{campus.communityName}
        <button type="button" onClick={onChangeSchool}>Change</button>
      </span>
      <h1>What’s your {campus.communityName} email?</h1>
      <input type="hidden" name="campus" value={school} />
      <div className="field">
        <label htmlFor="email">School email</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder={campus.emailExample}
          defaultValue={defaultEmail} maxLength={254} required autoFocus aria-describedby="email-hint" />
        <p id="email-hint" className="field-hint">We’ll email you a 6-digit code to prove it’s yours. {campus.emailHint}</p>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Sending your code…" : "Continue"}</button>
      <Link className="secondary-button" href="/sign-in" prefetch={false}>Already have an account? Log in</Link>
    </form>
  );
}

function CodeStep({ school, email, onVerified, onChangeEmail }: {
  school: CampusKey; email: string; onVerified: () => void; onChangeEmail: () => void;
}) {
  const [wait, setWait] = useState(RESEND_AFTER_SECONDS);
  const [state, action, pending] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await verifyEmailCode(previous, form);
    if (result.verified) onVerified();
    return result;
  }, {} as FormState);
  const [resent, resend, resending] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await sendSignupCode(previous, form);
    if (result.verification) setWait(RESEND_AFTER_SECONDS);
    return result;
  }, {} as FormState);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  return (
    <div className="step-form">
      <form action={action} className="step-form" aria-busy={pending}>
        <h1>Enter the 6-digit code</h1>
        <p className="step-sub">We sent it to <strong>{email}</strong>. It can take a minute to arrive; check spam too.</p>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="campus" value={school} />
        <div className="field">
          <label htmlFor="token">6-digit code</label>
          <input className="code-input" id="token" name="token" type="text" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required autoFocus />
        </div>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Checking…" : "Continue"}</button>
      </form>
      <form action={resend} className="step-resend">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="campus" value={school} />
        {resent.error ? <p className="form-error" role="alert">{resent.error}</p>
          : resent.success ? <p className="field-hint" role="status">A new code is on its way.</p> : null}
        {wait > 0
          ? <p className="field-hint">Didn’t get it? You can ask for a new code in 0:{String(wait).padStart(2, "0")}.</p>
          : <button className="text-button" type="submit" disabled={resending}>{resending ? "Sending…" : "Send a new code"}</button>}
        <button className="text-button" type="button" onClick={onChangeEmail}>Wrong email? Change it</button>
      </form>
    </div>
  );
}

function PasswordStep({ onRestart }: { onRestart: () => void }) {
  const [state, action, pending] = useActionState(setSignupPassword, { verified: true } as FormState);
  return (
    <form action={action} className="step-form" aria-busy={pending}>
      <h1>Create a password</h1>
      <p className="step-sub">You’ll use it with your school email to log in.</p>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required autoFocus aria-describedby="password-hint" />
        <p id="password-hint" className="field-hint">At least 12 characters. A few words you’ll remember work well.</p>
      </div>
      <div className="field">
        <label htmlFor="confirmPassword">Type it again</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.error && !state.verified && <button className="secondary-button" type="button" onClick={onRestart}>Start again</button>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Continue"}</button>
    </form>
  );
}
