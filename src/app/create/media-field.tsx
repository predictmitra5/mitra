"use client";

import { useId, useState } from "react";
import { finishMediaUpload, startMediaUpload } from "@/modules/startups/media-actions";
import { putToSignedUrl } from "@/app/components/direct-upload";

/*
 * A link field for a founder's file (2026-10-19): paste an https:// link, or,
 * where uploads are set up, choose a file and the field fills itself with the
 * uploaded file's address. The form saves only the address.
 */
export function MediaField({ name, label, kind, defaultValue = "", uploads, hint }: {
  name: string; label: string; kind: "image" | "video"; defaultValue?: string; uploads: boolean; hint?: string;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setStatus("Uploading…");
    try {
      const start = await startMediaUpload({ kind, contentType: file.type, bytes: file.size });
      if (!start.ok) { setStatus(start.error); return; }
      if (!(await putToSignedUrl(start.value.url, file, file.type))) { setStatus("The upload didn't go through. Please try again."); return; }
      if (kind === "video" && start.value.publicUrl) { setValue(start.value.publicUrl); setStatus("Uploaded."); return; }
      const done = await finishMediaUpload(start.value.uploadId);
      if (done.ok) { setValue(done.value.publicUrl); setStatus("Uploaded."); } else setStatus(done.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field media-field">
      <label htmlFor={id}>{label} <span className="muted">(optional)</span></label>
      <input id={id} name={name} type="url" value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://" maxLength={600} />
      {uploads && (
        <label className="media-upload">
          <input type="file" accept={kind === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp"} disabled={busy}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
          <span className="btn btn-quiet">{busy ? "Uploading…" : kind === "video" ? "Upload a video" : "Upload an image"}</span>
        </label>
      )}
      {(hint || status) && <span className="field-hint" role={status ? "status" : undefined}>{status ?? hint}</span>}
    </div>
  );
}
