"use client";
import { useActionState,useState } from "react";
import Link from "next/link";
import { sendSignupCode,setSignupPassword,verifyEmailCode } from "@/modules/auth/actions";
import type { FormState } from "@/modules/auth/policy";
import { StepFrame,BackLink } from "./step-frame";
export function SignupFlow({returnTo=null}:{returnTo?:string|null}){
 const [email,setEmail]=useState(""),[step,setStep]=useState<"email"|"code"|"password">("email");
 const [sent,send,sending]=useActionState(async(s:FormState,f:FormData)=>{const r=await sendSignupCode(s,f);if(r.verification){setEmail(r.verification.email);setStep("code");}return r;},{});
 const [checked,verify,checking]=useActionState(async(s:FormState,f:FormData)=>{const r=await verifyEmailCode(s,f);if(r.verified)setStep("password");return r;},{});
 const [password,save,saving]=useActionState(setSignupPassword,{});
 return <StepFrame fills={[step==="email"?33:step==="code"?66:100,0,0,0]} label="Create your Mitra account" back={<BackLink href="/" label="Back to Mitra" />}>
 <form className="step-form" action={step==="email"?send:step==="code"?verify:save}>
 <h1>{step==="email"?"Your next chapter.":step==="code"?"Check your inbox":"Create a password"}</h1>
 <p className="step-sub">{step==="email"?"Discover founders and the milestones ahead. Verify your email to join.":step==="code"?`Enter the six-digit code sent to ${email}.`:"At least 12 characters. A few memorable words work well."}</p>
 {returnTo&&<input type="hidden" name="next" value={returnTo}/>}
 {step==="email"?<div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required/></div>:<input type="hidden" name="email" value={email}/>}
 {step==="code"&&<div className="field"><label htmlFor="token">Verification code</label><input id="token" className="code-input" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></div>}
 {step==="password"&&<><div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></div><div className="field"><label htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></div></>}
 {(step==="email"?sent:step==="code"?checked:password).error&&<p className="form-error" role="alert">{(step==="email"?sent:step==="code"?checked:password).error}</p>}
 <button className="primary-button" disabled={sending||checking||saving}>{sending||checking||saving?"Please wait…":"Continue"}</button>
 </form>
 {step==="code"&&<form action={send} className="step-resend"><input type="hidden" name="email" value={email}/><button className="text-button" disabled={sending}>Resend code</button><button type="button" className="text-button" onClick={()=>setStep("email")}>Change email</button></form>}
 <Link className="secondary-button" href={`/sign-in${returnTo?`?next=${encodeURIComponent(returnTo)}`:""}`}>Already have an account? Log in</Link>
 </StepFrame>;
}
