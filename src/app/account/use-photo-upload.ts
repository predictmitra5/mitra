"use client";

import { useState, useTransition } from "react";
import { finishPhotoUpload, startPhotoUpload } from "@/modules/account/photo-actions";
import type { FormState } from "@/modules/auth/policy";
import { putToSignedUrl } from "@/app/components/direct-upload";

/**
 * Uploading a profile photo (decided 2026-09-24), shared by the account page and
 * onboarding. The file goes straight to a private staging bucket (Vercel refuses
 * request bodies over 4.5 MB); the server then checks it for AI labels,
 * re-encodes it and deletes the staged original.
 */
export function usePhotoUpload() {
  const [state, setState] = useState<FormState>({});
  const [uploading, startUpload] = useTransition();

  function upload(file: unknown, onSaved?: () => void) {
    if (!(file instanceof File) || file.size === 0) { setState({ error: "Choose a photo first." }); return; }
    setState({});
    startUpload(async () => {
      try {
        const start = await startPhotoUpload({ contentType: file.type, bytes: file.size });
        if (!start.ok) { setState({ error: start.error }); return; }
        if (!(await putToSignedUrl(start.url, file, file.type))) {
          setState({ error: "The upload did not finish. Check your connection and try again." });
          return;
        }
        const result = await finishPhotoUpload({ uploadId: start.uploadId, contentType: file.type });
        setState(result);
        if (!result.error) onSaved?.();
      } catch {
        setState({ error: "Your photo could not be saved. Please try again." });
      }
    });
  }

  return { state, uploading, upload, clear: () => setState({}) };
}
