"use client";

import { useActionState } from "react";
import { saveDraftAction } from "@/modules/startups/admin-actions";
import { MILESTONES } from "@/modules/startups/labels";

/*
 * The owner's market form (2026-10-19): the startup, the question and its
 * card title, the milestone, exact Yes and No conditions, the full rules
 * (measurement, what happens when the source is missing or sources conflict),
 * the source, the close date, when results are due, the opening price, and
 * whether it is demo data. Save a draft to keep editing the rules, or open it
 * now; once open, its wording is frozen.
 */

export type DraftDefaults = {
  marketId: string | null; proposalId: string | null; startupId: string; question: string; shortQuestion: string; kind: string;
  yesCondition: string; noCondition: string; rules: string; sourceName: string; sourceMethod: string; sourceUrl: string;
  closesOn: string; resultsDueDays: number; isDemo: boolean;
};

const RULES_HINT = "How the number is counted and what does not count. If the source is unavailable at the deadline, what the owner checks instead. If sources conflict, which figure counts. If nothing can be verified within the results window, the market resolves No.";

export function DraftForm({ startups, defaults }: { startups: { id: string; name: string; isDemo: boolean }[]; defaults: DraftDefaults }) {
  const [state, action, pending] = useActionState(saveDraftAction, null);
  return (
    <form action={action} className="review-form draft-form">
      {defaults.marketId && <input type="hidden" name="marketId" value={defaults.marketId} />}
      {defaults.proposalId && <input type="hidden" name="proposalId" value={defaults.proposalId} />}
      <div className="field">
        <label htmlFor="startupId">Startup</label>
        <select id="startupId" name="startupId" defaultValue={defaults.startupId} required>
          <option value="" disabled>Pick an approved startup</option>
          {startups.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isDemo ? " (demo)" : ""}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="question">Question</label>
        <textarea id="question" name="question" rows={2} maxLength={240} defaultValue={defaults.question} required placeholder="Will Lumenly reach 100,000 verified monthly active users by December 31, 2027?" />
      </div>
      <div className="field-pair">
        <div className="field">
          <label htmlFor="shortQuestion">Card title <span className="muted">(optional, 10 to 70 characters)</span></label>
          <input id="shortQuestion" name="shortQuestion" maxLength={70} defaultValue={defaults.shortQuestion} />
        </div>
        <div className="field">
          <label htmlFor="kind">Milestone</label>
          <select id="kind" name="kind" defaultValue={defaults.kind}>{MILESTONES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
          <span className="field-hint">Financial milestones are demonstration only; real money would need legal review.</span>
        </div>
      </div>
      <div className="field-pair">
        <div className="field">
          <label htmlFor="yesCondition">Resolves Yes if</label>
          <textarea id="yesCondition" name="yesCondition" rows={3} maxLength={800} defaultValue={defaults.yesCondition} required />
        </div>
        <div className="field">
          <label htmlFor="noCondition">Resolves No if</label>
          <textarea id="noCondition" name="noCondition" rows={3} maxLength={800} defaultValue={defaults.noCondition} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="rules">Rules</label>
        <textarea id="rules" name="rules" rows={6} maxLength={4000} defaultValue={defaults.rules} required placeholder={RULES_HINT} />
        <span className="field-hint">{RULES_HINT}</span>
      </div>
      <div className="field-pair">
        <div className="field">
          <label htmlFor="sourceName">Verification source</label>
          <input id="sourceName" name="sourceName" maxLength={160} defaultValue={defaults.sourceName} required placeholder="Independent analytics audit" />
        </div>
        <div className="field">
          <label htmlFor="sourceUrl">Source link <span className="muted">(optional)</span></label>
          <input id="sourceUrl" name="sourceUrl" type="url" maxLength={600} defaultValue={defaults.sourceUrl} placeholder="https://" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="sourceMethod">How it is measured</label>
        <textarea id="sourceMethod" name="sourceMethod" rows={2} maxLength={800} defaultValue={defaults.sourceMethod} required />
      </div>
      <div className="field-pair">
        <div className="field">
          <label htmlFor="closesOn">Trading closes (end of day, Eastern)</label>
          <input id="closesOn" name="closesOn" type="date" defaultValue={defaults.closesOn} required />
        </div>
        <div className="field">
          <label htmlFor="resultsDueDays">Results due, days after the close</label>
          <input id="resultsDueDays" name="resultsDueDays" type="number" min={1} max={120} defaultValue={defaults.resultsDueDays} required />
        </div>
      </div>
      <div className="field-pair">
        <p className="field-hint">New markets always open at 50/50; the price moves only as people trade.</p>
        <label className="checkbox-row draft-demo"><input type="checkbox" name="isDemo" defaultChecked={defaults.isDemo} />Demo market: label it as fictional demonstration data</label>
      </div>
      {state && <p className={state.ok ? "form-success" : "form-error"} role={state.ok ? "status" : "alert"}>{state.message}</p>}
      <div className="review-buttons">
        <button className="btn btn-quiet" type="submit" name="intent" value="draft" disabled={pending}>Save draft</button>
        <button className="btn btn-primary" type="submit" name="intent" value="open" disabled={pending}>Save and open trading</button>
      </div>
    </form>
  );
}
