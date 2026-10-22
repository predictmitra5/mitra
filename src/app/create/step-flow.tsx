"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BackLink, StepFrame, arrowLeft } from "@/app/components/step-frame";
import type { StepResult } from "@/modules/startups/creator-actions";

/*
 * Becoming a founder, one question per screen (decided 2026-10-21), in the
 * shape of sign-up's onboarding: a progress bar, a back arrow, one question
 * and Continue (or Skip, where the answer is optional). The last screen lists
 * every answer with Edit beside it, and only then is anything sent. The step is
 * in the address (?step=bio), so the phone's back gesture goes back a step and
 * a refresh keeps the place; an unsent draft is kept for the tab's session.
 * A server refusal returns to the screen it is about.
 */

export type Values = Record<string, string>;

export type InputProps = { id: string; value: string; set: (value: string) => void; values: Values; patch: (changes: Values) => void };

export type StepDef = {
  /** The answer this screen asks for. */
  key: string;
  title: string;
  sub?: ReactNode;
  /** The answer's name on the review screen. */
  label: string;
  optional?: boolean;
  input: (props: InputProps) => ReactNode;
  /** Why the answer can't be used yet, if it can't. */
  check?: (value: string, values: Values) => string | null;
  /** The answer as the review screen shows it. */
  show?: (value: string, values: Values) => ReactNode;
  /** Other answers this screen fills (a video's length, say), so a refusal about them returns here. */
  also?: readonly string[];
};

const REVIEW = "review";

export function StepFlow({ steps, initial, draftKey, reviewTitle, reviewSub, submitLabel, submit, onDone, exitHref, exitLabel = "Back" }: {
  steps: readonly StepDef[];
  initial: Values;
  /** Where an unsent draft is kept; null when editing something already saved. */
  draftKey: string | null;
  reviewTitle: string;
  reviewSub?: ReactNode;
  submitLabel: string;
  submit: (values: Values) => Promise<StepResult>;
  onDone: (result: Extract<StepResult, { ok: true }>) => void;
  exitHref: string;
  exitLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const id = useId();
  const [values, setValues] = useState<Values>(initial);
  const [problem, setProblem] = useState<{ message: string; step: string } | null>(null);
  const [pending, setPending] = useState(false);
  const restored = useRef(false);

  const requested = params.get("step");
  const editing = params.get("edit") === "1";
  const found = steps.findIndex((s) => s.key === requested);
  const index = requested === REVIEW ? steps.length : found >= 0 ? found : (draftKey ? 0 : steps.length);
  const step = steps[index] as StepDef | undefined;

  // A draft from earlier in this tab's session.
  useEffect(() => {
    if (!draftKey || restored.current) return;
    restored.current = true;
    try {
      const saved = window.sessionStorage.getItem(draftKey);
      // Browser storage only exists after hydration, so the draft can only be read here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setValues((current) => ({ ...current, ...JSON.parse(saved) }));
    } catch { /* storage may be unavailable */ }
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey || !restored.current) return;
    try { window.sessionStorage.setItem(draftKey, JSON.stringify(values)); } catch { /* storage may be unavailable */ }
  }, [draftKey, values]);

  function go(key: string, edit = false) {
    const next = new URLSearchParams(params.toString());
    next.set("step", key);
    if (edit) next.set("edit", "1"); else next.delete("edit");
    window.history.pushState(null, "", `?${next.toString()}`);
    window.scrollTo({ top: 0 });
  }

  const set = (key: string) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const patch = (changes: Values) => setValues((current) => ({ ...current, ...changes }));

  function advance(event: React.FormEvent) {
    event.preventDefault();
    if (!step) return;
    const value = (values[step.key] ?? "").trim();
    const reason = !value && !step.optional ? "Please answer this one to continue." : step.check?.(value, values) ?? null;
    if (reason) { setProblem({ message: reason, step: step.key }); return; }
    setProblem(null);
    go(editing || index === steps.length - 1 ? REVIEW : steps[index + 1].key);
  }

  function skip() {
    if (!step) return;
    set(step.key)("");
    setProblem(null);
    go(editing || index === steps.length - 1 ? REVIEW : steps[index + 1].key);
  }

  async function send() {
    setPending(true);
    setProblem(null);
    try {
      const result = await submit(values);
      if (result.ok) {
        if (draftKey) { try { window.sessionStorage.removeItem(draftKey); } catch { /* fine */ } }
        onDone(result);
        return;
      }
      const target = result.field ? steps.find((s) => s.key === result.field || s.also?.includes(result.field!)) : undefined;
      setProblem({ message: result.message, step: target?.key ?? REVIEW });
      if (target) go(target.key, true);
    } catch {
      setProblem({ message: "That didn't send. Check your connection and try again.", step: REVIEW });
    } finally {
      setPending(false);
    }
  }

  const total = steps.length + 1;
  const done = (index + 1) / total;
  const fills = [0, 1, 2, 3].map((part) => Math.max(0, Math.min(100, (done * 4 - part) * 100)));
  const backKey = editing ? REVIEW : index > 0 ? steps[index - 1].key : null;
  const back = backKey
    ? <button className="icon-button step-icon" type="button" onClick={() => go(backKey)} aria-label="Back">{arrowLeft}</button>
    : <BackLink href={exitHref} label={exitLabel} />;
  const message = problem && problem.step === (step?.key ?? REVIEW) ? problem.message : null;

  if (!step) {
    return (
      <StepFrame fills={fills} label={`Step ${total} of ${total}: check your answers`} back={back} closeHref={exitHref}>
        <div className="step-form">
          <h1>{reviewTitle}</h1>
          {reviewSub && <p className="step-sub">{reviewSub}</p>}
          <dl className="step-review">
            {steps.map((s) => {
              const value = (values[s.key] ?? "").trim();
              return (
                <div key={s.key} className="step-review-row">
                  <dt>{s.label}</dt>
                  <dd>{value ? (s.show ? s.show(value, values) : value) : <span className="muted">{s.optional ? "Skipped" : "Not answered yet"}</span>}</dd>
                  <button type="button" className="text-button step-review-edit" onClick={() => go(s.key, true)} aria-label={`Edit ${s.label.toLowerCase()}`}>Edit</button>
                </div>
              );
            })}
          </dl>
          {message && <p className="form-error" role="alert">{message}</p>}
          <button className="primary-button" type="button" onClick={send} disabled={pending}>{pending ? "Sending…" : submitLabel}</button>
          <button className="secondary-button" type="button" onClick={() => router.push(exitHref)} disabled={pending}>Not now</button>
        </div>
      </StepFrame>
    );
  }

  return (
    <StepFrame fills={fills} label={`Step ${index + 1} of ${total}`} back={back} closeHref={exitHref}>
      <form className="step-form" onSubmit={advance} noValidate key={step.key}>
        <h1 id={`${id}-title`}>{step.title}</h1>
        {step.sub && <p className="step-sub">{step.sub}</p>}
        {step.input({ id: `${id}-${step.key}`, value: values[step.key] ?? "", set: set(step.key), values, patch })}
        {message && <p className="form-error" role="alert">{message}</p>}
        <button className="primary-button" type="submit">{editing ? "Save and review" : index === steps.length - 1 ? "Review" : "Continue"}</button>
        {step.optional && <button className="text-button step-skip" type="button" onClick={skip}>Skip for now</button>}
      </form>
    </StepFrame>
  );
}

// ------------------------------------------------------------------ inputs

export function TextInput({ id, value, set, placeholder, maxLength, autoComplete, type = "text", label }: InputProps & {
  placeholder?: string; maxLength: number; autoComplete?: string; type?: "text" | "url" | "month"; label: string;
}) {
  return (
    <div className="field">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} maxLength={maxLength}
        autoComplete={autoComplete ?? "off"} autoFocus inputMode={type === "url" ? "url" : undefined} />
    </div>
  );
}

export function LongText({ id, value, set, placeholder, minLength = 0, maxLength, rows = 5, label }: InputProps & {
  placeholder?: string; minLength?: number; maxLength: number; rows?: number; label: string;
}) {
  const length = value.trim().length;
  return (
    <div className="field">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <textarea id={id} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} maxLength={maxLength} rows={rows} autoFocus aria-describedby={`${id}-count`} />
      <p id={`${id}-count`} className="field-hint step-count">{length < minLength ? `At least ${minLength - length} more characters` : `${length} / ${maxLength}`}</p>
    </div>
  );
}

/** One answer per line, as up to `count` separate boxes. */
export function ListInput({ id, value, set, count, placeholder, maxLength, label }: InputProps & {
  count: number; placeholder?: (n: number) => string; maxLength: number; label: string;
}) {
  const items = value.split("\n");
  const shown = Math.min(count, Math.max(1, items.filter((l) => l.trim()).length + 1));
  const update = (n: number, text: string) => {
    const next = [...items];
    while (next.length <= n) next.push("");
    next[n] = text.replace(/\n/g, " ");
    set(next.join("\n").replace(/\n+$/, ""));
  };
  return (
    <div className="step-list">
      {Array.from({ length: shown }, (_, n) => (
        <div className="field" key={n}>
          <label className="sr-only" htmlFor={`${id}-${n}`}>{`${label} ${n + 1}`}</label>
          <input id={`${id}-${n}`} value={items[n] ?? ""} onChange={(e) => update(n, e.target.value)} maxLength={maxLength}
            placeholder={placeholder?.(n)} autoFocus={n === 0} autoComplete="off" />
        </div>
      ))}
    </div>
  );
}

export function Choices({ id, value, set, options, label }: InputProps & { options: readonly { key: string; label: string; hint?: string }[]; label: string }) {
  return (
    <fieldset className="topics" aria-labelledby={`${id}-legend`}>
      <legend id={`${id}-legend`} className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.key} className={`topic${value === option.key ? " on" : ""}`} title={option.hint}>
          <input className="sr-only" type="radio" name={id} value={option.key} checked={value === option.key} onChange={() => set(option.key)} />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

/** A link that must be a full https:// address, checked before Continue. */
export function httpsLink(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" ? null : "Use a link that starts with https://";
  } catch {
    return "That doesn't look like a web address.";
  }
}

/** Adds https:// to a bare address such as example.com. */
export function withHttps(value: string): string {
  const clean = value.trim();
  return !clean || /^[a-z]+:\/\//i.test(clean) ? clean : `https://${clean}`;
}

export function lengthCheck(min: number, max: number, what: string) {
  return (value: string) => value.length < min ? `${what} needs at least ${min} characters.` : value.length > max ? `${what} can be up to ${max} characters.` : null;
}
