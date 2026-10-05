"use client";

import { useActionState, useState } from "react";
import { completeProfile } from "@/modules/account/actions";
import type { FormState } from "@/modules/auth/policy";
import { StepFrame, arrowLeft } from "@/app/components/step-frame";

/*
 * Onboarding, first two screens (decided 2026-10-05): name and @username, then
 * the 18+ confirmation. Nothing is saved until the second screen, which creates
 * the profile and the 1,000-point grant in one transaction (provisionAccount).
 * If the server refuses (a taken username, say), the person lands back on the
 * first screen with the reason.
 */
export function ProfileSteps() {
  const [step, setStep] = useState<"name" | "age">("name");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [state, action, pending] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await completeProfile(previous, form);
    if (result.error) setStep("name");
    return result;
  }, {} as FormState);

  const back = step === "age"
    ? <button className="icon-button step-icon" type="button" onClick={() => setStep("name")} aria-label="Back">{arrowLeft}</button>
    : null;

  return (
    <StepFrame fills={[100, step === "name" ? 50 : 100, 0, 0]} label={`Set up, step ${step === "name" ? 1 : 2} of 5`} back={back}>
      {step === "name" ? (
        <form className="step-form" onSubmit={(event) => { event.preventDefault(); setStep("age"); }}>
          <h1>What should we call you?</h1>
          <p className="step-sub">Your name and username show next to your goals and on your profile.</p>
          <div className="field">
            <label htmlFor="displayName">Name</label>
            <input id="displayName" autoComplete="name" placeholder="Your full name" minLength={2} maxLength={80} required autoFocus
              value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="handle">Username</label>
            <div className="handle-input">
              <span aria-hidden="true">@</span>
              <input id="handle" autoComplete="username" placeholder="yourname" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required
                value={handle} onChange={(event) => setHandle(event.target.value)} aria-describedby="handle-hint" />
            </div>
            <p id="handle-hint" className="field-hint">3–24 letters, numbers or underscores.</p>
          </div>
          {state.error && <p className="form-error" role="alert">{state.error}</p>}
          <button className="primary-button" type="submit">Continue</button>
        </form>
      ) : (
        <form action={action} className="step-form" aria-busy={pending}>
          <input type="hidden" name="displayName" value={displayName} />
          <input type="hidden" name="handle" value={handle} />
          <h1>Are you 18 or older?</h1>
          <p className="step-sub">Mitra is for adults. We don’t ask for your birthday or an ID.</p>
          <label className="check-card">
            <input type="checkbox" name="adultConfirmed" required />
            <span><strong>I’m 18 or older</strong><small>We take your word for it, so please be honest.</small></span>
          </label>
          <button className="primary-button" type="submit" disabled={pending}>{pending ? "Setting up your account…" : "Continue"}</button>
        </form>
      )}
    </StepFrame>
  );
}
