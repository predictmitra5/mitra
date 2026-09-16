"use client";

import { useActionState } from "react";
import { completeProfile } from "@/modules/account/actions";
import type { FormState } from "@/modules/auth/policy";

export function ProfileForm({ displayName = "", handle = "" }: { displayName?: string; handle?: string }) {
  const [state, action, pending] = useActionState(completeProfile, {} as FormState);
  return <form action={action} className="auth-form" aria-busy={pending}>
    <div className="field"><label htmlFor="displayName">Display name</label><input id="displayName" name="displayName" autoComplete="nickname" minLength={2} maxLength={80} defaultValue={displayName} required /></div>
    <div className="field"><label htmlFor="handle">Username</label><input id="handle" name="handle" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" defaultValue={handle} aria-describedby="handle-hint" required /><p id="handle-hint" className="field-hint">3–24 letters, numbers or underscores.</p></div>
    <label className="checkbox-row"><input type="checkbox" name="adultConfirmed" required /><span>I confirm that I am 18 years old or older.</span></label>
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    <button className="primary-button" type="submit" disabled={pending}>{pending ? "Creating your profile…" : "Complete my profile"}<span aria-hidden="true">↗</span></button>
  </form>;
}
