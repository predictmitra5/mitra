"use client";

import { useActionState, useState } from "react";
import { createGoal } from "@/modules/goals/actions";
import type { FormState } from "@/modules/auth/policy";
import type { GoalType } from "@/modules/goals/templates";

const types: { value: GoalType; label: string; rule: string }[] = [
  { value: "gpa", label: "GPA", rule: "Counts that semester's GPA once final grades post. Set the deadline to when grades post, not the last day of class." },
  { value: "internship", label: "Internship", rule: "Counts a written offer received before the deadline, even if you turn it down." },
  { value: "club", label: "Club", rule: "Counts the club's admission offer before the deadline, whether or not you join." },
  { value: "gym", label: "Gym", rule: "Proven by one uncut video you post publicly on Instagram, TikTok or YouTube before the deadline." },
  { value: "own_words", label: "Something else", rule: "Write the question and exactly what counts as YES. The owner checks it's clear before it goes live." },
];

export function GoalForm({ minDate }: { minDate: string }) {
  const [state, action, pending] = useActionState(createGoal, {} as FormState);
  const [type, setType] = useState<GoalType>("gpa");
  const selected = types.find((option) => option.value === type)!;

  return <form action={action} className="auth-form" aria-busy={pending}>
    <fieldset className="type-picker">
      <legend>What kind of goal?</legend>
      {types.map((option) => <label key={option.value} className="type-option">
        <input type="radio" name="type" value={option.value} checked={type === option.value} onChange={() => setType(option.value)} />
        <span>{option.label}</span>
      </label>)}
    </fieldset>
    <p className="rule-note">{selected.rule}</p>

    {type === "gpa" && <>
      <div className="field"><label htmlFor="gpa">Target GPA</label><input id="gpa" name="gpa" inputMode="decimal" placeholder="3.5" pattern="\d(\.\d{1,2})?" required /></div>
      <div className="field"><label htmlFor="semester">Semester</label><input id="semester" name="semester" placeholder="Autumn 2026" minLength={3} maxLength={40} required /></div>
    </>}
    {type === "internship" && <div className="field"><label htmlFor="company">Company</label><input id="company" name="company" placeholder="Google" minLength={2} maxLength={80} required /></div>}
    {type === "club" && <div className="field"><label htmlFor="club">Club</label><input id="club" name="club" placeholder="Consulting Club" minLength={2} maxLength={80} required /></div>}
    {type === "gym" && <div className="field"><label htmlFor="achievement">Achievement</label><input id="achievement" name="achievement" placeholder="bench press 225 lb" minLength={3} maxLength={120} required aria-describedby="achievement-hint" /><p id="achievement-hint" className="field-hint">Finish the sentence “Will you ___ by the deadline?”</p></div>}
    {type === "own_words" && <>
      <div className="field"><label htmlFor="question">Question</label><input id="question" name="question" placeholder="Will I launch my study app?" minLength={10} maxLength={200} required /></div>
      <div className="field"><label htmlFor="criteria">What counts as YES</label><textarea id="criteria" name="criteria" rows={3} minLength={20} maxLength={1000} placeholder="YES if the app is live on the App Store before the deadline." required /></div>
    </>}

    <div className="field"><label htmlFor="deadline">Deadline</label><input id="deadline" name="deadline" type="date" min={minDate} required aria-describedby="deadline-hint" /><p id="deadline-hint" className="field-hint">Trading closes at 11:59 pm Eastern that day. You then have 7 days to send proof, or it resolves NO.</p></div>

    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="primary-button" type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit for approval"}<span aria-hidden="true">↗︎</span></button>
  </form>;
}
