"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishProof, rejectProof } from "@/modules/evidence/review-actions";
import { MAX_STATEMENT_LENGTH } from "@/modules/evidence/policy";

/*
 * The owner's review screen, decided 2026-09-19 (D06, D07, revised same day).
 *
 * The document is never published, so there is nothing to redact and nothing to
 * get wrong with a box. What ships is this sentence. The screen is built so the
 * owner reads the original first and writes the sentence themselves; the
 * proposals are a starting point, labelled as one.
 */

type Proposal = { statement: string; basis: string };

export function StatementForm({
  evidenceId, marketId, kind, imageUrl, linkUrl, proposals, privateDetails, extractionNote,
  caption, handle, question, criteria,
}: {
  evidenceId: string;
  marketId: string;
  kind: "file" | "link";
  imageUrl: string | null;
  linkUrl: string | null;
  proposals: Proposal[];
  privateDetails: string[];
  extractionNote?: string;
  caption: string | null;
  handle: string;
  question: string;
  criteria: string;
}) {
  const router = useRouter();
  const [statement, setStatement] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const canPublish = kind === "link" || statement.trim().length >= 3;

  function publish() {
    setError("");
    startTransition(async () => {
      try {
        const result = await publishProof({ evidenceId, marketId, statement, note });
        if (result.ok) router.push(`/markets/${marketId}`);
        else setError(result.error);
      } catch {
        setError("That did not go through. Check the goal page before trying again.");
      }
    });
  }

  function reject() {
    setError("");
    startTransition(async () => {
      try {
        const result = await rejectProof({ evidenceId, marketId, note });
        if (result.ok) router.push("/review/markets");
        else setError(result.error);
      } catch {
        setError("That did not go through. Check the goal page before trying again.");
      }
    });
  }

  return (
    <div className="redact-layout">
      <div className="redact-stage">
        <section className="market-rules">
          <span className="eyebrow">THE GOAL</span>
          <h2>{question}</h2>
          <p className="market-criteria">{criteria}</p>
        </section>

        <section className="market-rules">
          <span className="eyebrow">WHAT WAS SENT</span>
          <p className="field-hint">From @{handle}{caption ? ` — ${caption}` : ""}</p>
          {kind === "link" ? (
            <p className="market-criteria">
              <a href={linkUrl ?? "#"} target="_blank" rel="noopener noreferrer nofollow">{linkUrl}</a>
            </p>
          ) : imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="review-original" src={imageUrl} alt={`Document sent by @${handle}`} />
              <p className="field-hint">
                This is the original, visible only to you. It is never published and the link above expires
                in five minutes.
              </p>
            </>
          ) : (
            <p className="field-hint">
              This is a PDF. Open it to read it; it is never published, and the link expires in five minutes.
            </p>
          )}
        </section>
      </div>

      <aside className="redact-panel">
        <div>
          <span className="eyebrow">PUBLISH A STATEMENT</span>
          <h2>What does this prove?</h2>
        </div>

        <p className="rule-note">
          Only this sentence becomes public. The document stays private, so write the fact and leave the
          personal details out of it.
        </p>

        {privateDetails.length > 0 && (
          <div className="redact-findings">
            <h3>Do not carry these across</h3>
            <ul>
              {privateDetails.map((detail, index) => (
                <li key={`${detail}-${index}`}><span className="redact-finding-text">{detail}</span></li>
              ))}
            </ul>
            <p className="field-hint">Spotted automatically. The list may be incomplete.</p>
          </div>
        )}

        {proposals.length > 0 && (
          <div className="redact-findings">
            <h3>Suggested wording</h3>
            <ul>
              {proposals.map((proposal, index) => (
                <li key={`${proposal.statement}-${index}`}>
                  <button type="button" className="proposal-button" disabled={pending}
                    onClick={() => setStatement(proposal.statement)}>
                    {proposal.statement}
                  </button>
                  {proposal.basis && <span className="muted">{proposal.basis}</span>}
                </li>
              ))}
            </ul>
            <p className="field-hint">Suggestions from reading the document. Check each against it yourself.</p>
          </div>
        )}
        {extractionNote && <p className="field-hint">{extractionNote}</p>}

        {error && <p className="form-error" role="alert">{error}</p>}

        <label className="field">
          Statement to publish{kind === "link" && <span className="muted"> (optional for a link)</span>}
          <textarea value={statement} maxLength={MAX_STATEMENT_LENGTH} rows={3} disabled={pending}
            onChange={(event) => setStatement(event.target.value)}
            placeholder="Fall 2026 term GPA is 3.85, checked against an official transcript." />
        </label>
        <p className="field-hint">{statement.length} of {MAX_STATEMENT_LENGTH} characters.</p>

        <label className="field">
          Note for the record <span className="muted">(private)</span>
          <input type="text" value={note} maxLength={500} disabled={pending}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Registrar letterhead, dated 18 December" />
        </label>

        <button type="button" className="primary-button" disabled={pending || !canPublish} onClick={publish}>
          {pending ? "Working…" : "Publish this statement"}
        </button>
        <button type="button" className="secondary-button" disabled={pending} onClick={reject}>
          Reject this proof
        </button>
        <p className="field-hint">
          Publishing puts the statement on the public goal page under your name as reviewer, and cannot be
          undone. Rejecting publishes nothing and keeps the record.
        </p>
      </aside>
    </div>
  );
}
