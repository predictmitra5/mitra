"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimInviteAction } from "@/modules/startups/invite-actions";

/** The join password, typed by the invited co-founder (2026-10-22). */
export function JoinForm({ code, inviterName, startupName }: { code: string; inviterName: string; startupName: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (!password) { setProblem(`Type the join password ${inviterName} gave you.`); return; }
    setPending(true);
    setProblem(null);
    try {
      const result = await claimInviteAction(code, password);
      if (!result.ok) { setProblem(result.message); setPassword(""); return; }
      router.push(result.joined ? "/create?saved=joined" : "/create/founder?joining=1");
    } catch {
      setProblem("That didn't go through. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="step-form" onSubmit={join} noValidate>
      <div className="field">
        <label htmlFor="join-password">Join password</label>
        <div className="handle-input">
          <input id="join-password" type={visible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
            maxLength={72} autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus />
          <button type="button" className="text-button step-show" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>{visible ? "Hide" : "Show"}</button>
        </div>
        <p className="field-hint">{inviterName} chose it and should tell you it themselves.</p>
      </div>
      {problem && <p className="form-error" role="alert">{problem}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Checking…" : `Join ${startupName}`}</button>
    </form>
  );
}
