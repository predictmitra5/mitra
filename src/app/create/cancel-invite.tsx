"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeInviteAction } from "@/modules/startups/invite-actions";

/** Cancels a co-founder invite that hasn't been used (2026-10-22). */
export function CancelInvite({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <span className="invite-cancel">
      <button type="button" className="text-button" disabled={pending} onClick={() => start(async () => {
        const result = await revokeInviteAction(id);
        if (!result.ok) { setProblem(result.message); return; }
        router.refresh();
      })}>{pending ? "Cancelling…" : "Cancel"}</button>
      {problem && <span className="form-error" role="alert">{problem}</span>}
    </span>
  );
}
