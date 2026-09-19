"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { attachFile, attachLink } from "@/modules/evidence/actions";
import type { SubjectEvidence } from "@/modules/evidence/service";

const statusLabel: Record<SubjectEvidence["status"], string> = {
  submitted: "Waiting for review",
  published: "Public on this page",
  rejected: "Not published",
};

const dateOf = (value: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" }).format(new Date(value));

/**
 * The subject's own proof panel, decided 2026-09-19. It says plainly what will
 * become public, because by the time the owner approves something it is too
 * late for the person to change their mind: retention is permanent.
 */
export function EvidenceForm({
  marketId, mine, proofDeadline,
}: {
  marketId: string;
  mine: SubjectEvidence[];
  proofDeadline: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "link">("file");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(form: FormData) {
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = mode === "file" ? await attachFile(marketId, form) : await attachLink(marketId, form);
        if (result.ok) {
          setSuccess("Sent. The owner reviews it before anything appears on this page.");
          formRef.current?.reset();
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch {
        // A file upload can be cut off mid-request; nothing was recorded.
        setError("That did not go through. Check your connection and try again.");
      }
    });
  }

  return (
    <section className="evidence-panel">
      <h2>Send proof</h2>
      <p className="field-hint">
        Proof is due by <strong>{proofDeadline}</strong>. Without it this goal resolves NO.
      </p>

      {mine.length > 0 && (
        <ul className="evidence-mine">
          {mine.map((item) => (
            <li key={item.id}>
              <span className={`evidence-status evidence-status-${item.status}`}>{statusLabel[item.status]}</span>
              <span className="evidence-mine-what">
                {item.kind === "link" ? item.linkUrl : "Image"}
                {item.caption ? ` — ${item.caption}` : ""}
              </span>
              <span className="muted">{dateOf(item.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={submit} className="auth-form">
        <fieldset className="proof-options">
          <legend>What are you sending?</legend>
          <label className="checkbox-row">
            <input type="radio" name="mode" value="file" checked={mode === "file"}
              onChange={() => setMode("file")} disabled={pending} />
            An image
          </label>
          <label className="checkbox-row">
            <input type="radio" name="mode" value="link" checked={mode === "link"}
              onChange={() => setMode("link")} disabled={pending} />
            A link
          </label>
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="form-success" role="status">{success}</p>}

        {mode === "file" ? (
          <>
            <label className="field">
              Image
              <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required disabled={pending} />
            </label>
            <p className="field-hint">
              PNG, JPEG or WebP, up to 10 MB. PDFs are not accepted yet. The owner sees the whole image, hides
              anything private, and only the hidden version is published. <strong>You cannot take it back
              afterwards</strong>, so send the least that proves the point.
            </p>
          </>
        ) : (
          <>
            <label className="field">
              Link
              <input type="url" name="url" required maxLength={2048} placeholder="https://" disabled={pending} />
            </label>
            <p className="field-hint">
              <strong>A link cannot be hidden.</strong> If the owner approves it, this page shows the address and
              anyone can open it. Only paste something you are happy for strangers to see, and keep it working.
            </p>
          </>
        )}

        <label className="field">
          What does it show? <span className="muted">(optional)</span>
          <input type="text" name="caption" maxLength={500} disabled={pending}
            placeholder="Final transcript, fall semester" />
        </label>
        <p className="field-hint">This description is published with the proof.</p>

        <button className="secondary-button" disabled={pending}>
          {pending ? "Sending…" : "Send proof"}
        </button>
      </form>
    </section>
  );
}
