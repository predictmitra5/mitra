"use client";

import { useActionState, useRef, useState } from "react";
import { createGoal } from "@/modules/goals/actions";
import type { FormState } from "@/modules/auth/policy";
import type { GoalType, RaceDistance } from "@/modules/goals/templates";

// "Bet on literally anything" (decided 2026-09-24): a goal in your own words
// comes first and is the default. The four templates stay as quick starts.
const types: { value: GoalType; label: string; rule: string }[] = [
  { value: "own_words", label: "Anything", rule: "Anything about your own life. Write the question and exactly what counts as YES. It has to be something you can't win or lose just by deciding to, and something the owner can check." },
  { value: "gpa", label: "GPA", rule: "Counts that semester's GPA once final grades post. Set the deadline to when grades post, not the last day of class." },
  { value: "internship", label: "Internship", rule: "Counts a written offer received before the deadline, even if you turn it down." },
  { value: "club", label: "Club", rule: "Counts the club's admission offer before the deadline, whether or not you join." },
  { value: "gym", label: "Gym", rule: "Proven by one uncut video you post publicly on Instagram, TikTok or YouTube before the deadline." },
  { value: "running", label: "Running", rule: "Only a race's official published results count, not a run logged in an app or on a watch. With a target time, chip time counts when the results list it." },
];

const DISTANCES: { value: RaceDistance; label: string }[] = [
  { value: "5k", label: "5K" },
  { value: "10k", label: "10K" },
  { value: "half", label: "Half marathon" },
  { value: "marathon", label: "Marathon" },
  { value: "miles", label: "Other distance" },
];

const IDEAS = [
  "Will I run a half marathon?",
  "Will I launch my app on the App Store?",
  "Will I read 20 books this year?",
  "Will I visit 5 new countries?",
  "Will I hit 1,000 followers?",
  "Will I learn to do a backflip?",
];

export function GoalForm({ minDate }: { minDate: string }) {
  const [state, action, pending] = useActionState(createGoal, {} as FormState);
  const [type, setType] = useState<GoalType>("own_words");
  const [distance, setDistance] = useState<RaceDistance>("5k");
  const question = useRef<HTMLInputElement>(null);
  const selected = types.find((option) => option.value === type)!;

  return <form action={action} className="auth-form" aria-busy={pending}>
    <fieldset className="type-picker">
      <legend>Start from anything, or a quick start</legend>
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
    {type === "running" && <>
      <fieldset className="type-picker">
        <legend>Race distance</legend>
        {DISTANCES.map((option) => <label key={option.value} className="type-option">
          <input type="radio" name="distance" value={option.value} checked={distance === option.value} onChange={() => setDistance(option.value)} />
          <span>{option.label}</span>
        </label>)}
      </fieldset>
      {distance === "miles" && <div className="field"><label htmlFor="miles">Distance in miles</label><input id="miles" name="miles" inputMode="decimal" placeholder="10" pattern="\d{1,3}(\.\d)?" required /></div>}
      <div className="field"><label htmlFor="time">Target time <span className="muted">(optional)</span></label><input id="time" name="time" inputMode="numeric" placeholder="25:00 or 1:59:00" pattern="(\d{1,2}:)?\d{1,2}:\d{2}" aria-describedby="time-hint" /><p id="time-hint" className="field-hint">Leave it blank to count finishing the race at any time.</p></div>
    </>}
    {type === "own_words" && <>
      <div className="field"><label htmlFor="question">Question</label><input ref={question} id="question" name="question" placeholder="Will I run a half marathon before graduation?" minLength={10} maxLength={200} required /></div>
      <div className="idea-row" aria-label="Ideas to start from">
        {IDEAS.map((idea) => <button key={idea} type="button" className="idea" onClick={() => { if (question.current) { question.current.value = idea; question.current.focus(); } }}>{idea}</button>)}
      </div>
      <div className="field"><label htmlFor="criteria">What counts as YES</label><textarea id="criteria" name="criteria" rows={3} minLength={20} maxLength={1000} placeholder="YES if the app is live on the App Store before the deadline." required /></div>
    </>}

    <div className="field"><label htmlFor="deadline">Deadline</label><input id="deadline" name="deadline" type="date" min={minDate} required aria-describedby="deadline-hint" /><p id="deadline-hint" className="field-hint">Trading closes at 11:59 pm Eastern that day. You then have 7 days to send proof, or it resolves NO.</p></div>

    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="primary-button" type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit for approval"}<span aria-hidden="true">↗︎</span></button>
  </form>;
}
