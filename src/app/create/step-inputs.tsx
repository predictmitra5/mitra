"use client";

import { useEffect, useRef, useState } from "react";
import { checkHandleAction } from "@/modules/startups/creator-actions";
import { finishMediaUpload, finishResumeUploadAction, startMediaUpload, startResumeUpload } from "@/modules/startups/media-actions";
import { MAX_VIDEO_SECONDS, MIN_VIDEO_SECONDS, youtubeId, youtubeThumbnail } from "@/modules/startups/youtube";
import { duration } from "@/modules/startups/labels";
import { putToSignedUrl } from "@/app/components/direct-upload";
import { usePhotoUpload } from "@/app/account/use-photo-upload";
import { YouTubePlayer } from "@/app/components/startup/youtube-player";
import { withHttps, type InputProps } from "./step-flow";

/*
 * The founder steps' special inputs (2026-10-21): the @handle, checked as it is
 * typed with the nearest free one offered; a picture by link (or upload, where
 * uploads are on); and a YouTube link with a preview that reads the video's
 * length and title.
 */

type HandleState = { kind: "idle" | "checking" | "invalid" } | { kind: "free" | "taken"; suggestion: string };

/** Sets `_handle` in the answers to "taken" while the typed handle belongs to someone else, so Continue can stop. */
export function HandleInput({ id, value, set, patch }: InputProps) {
  const clean = value.trim().toLowerCase().replace(/^@+/, "");
  const valid = /^[a-z0-9_]{3,24}$/.test(clean);
  const [answer, setAnswer] = useState<{ handle: string; available: boolean; suggestion: string } | { handle: string; failed: true } | null>(null);
  const state: HandleState = !clean ? { kind: "idle" } : !valid ? { kind: "invalid" }
    : answer?.handle !== clean ? { kind: "checking" }
    : "failed" in answer ? { kind: "idle" } : { kind: answer.available ? "free" : "taken", suggestion: answer.suggestion };

  useEffect(() => {
    if (!valid) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await checkHandleAction(clean).catch(() => null);
      if (!stale) setAnswer(result ? { handle: clean, available: result.available, suggestion: result.suggestion } : { handle: clean, failed: true });
    }, 350);
    return () => { stale = true; clearTimeout(timer); };
  }, [clean, valid]);

  useEffect(() => { patch({ _handle: state.kind === "taken" ? "taken" : "" }); },
    // `patch` is a new function each render; only the state matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.kind]);

  return (
    <div className="field">
      <label className="sr-only" htmlFor={id}>Your @handle</label>
      <div className="handle-input">
        <span aria-hidden="true">@</span>
        <input id={id} value={value.replace(/^@+/, "")} onChange={(e) => set(e.target.value.replace(/^@+/, "").toLowerCase())} maxLength={24}
          autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus aria-describedby={`${id}-status`} />
      </div>
      <p id={`${id}-status`} className="field-hint step-handle-status" role="status">
        {state.kind === "checking" && "Checking…"}
        {state.kind === "invalid" && "3 to 24 lowercase letters, numbers or underscores."}
        {state.kind === "free" && <span className="step-ok">@{clean} is yours.</span>}
        {state.kind === "taken" && <>@{clean} is taken. <button type="button" className="text-button step-inline" onClick={() => set(state.suggestion)}>Use @{state.suggestion}</button></>}
        {state.kind === "idle" && "Letters, numbers and underscores. People find you at app.mitra.market/@handle."}
      </p>
    </div>
  );
}

export function ImageInput({ id, value, set, uploads, label, round = false }: InputProps & { uploads: boolean; label: string; round?: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = /^https:\/\//.test(value.trim()) ? value.trim() : null;

  async function upload(file: File) {
    setBusy(true);
    setStatus("Uploading…");
    try {
      const start = await startMediaUpload({ kind: "image", contentType: file.type, bytes: file.size });
      if (!start.ok) { setStatus(start.error); return; }
      if (!(await putToSignedUrl(start.value.url, file, file.type))) { setStatus("The upload didn't go through. Please try again."); return; }
      const done = await finishMediaUpload(start.value.uploadId);
      if (done.ok) { set(done.value.publicUrl); setStatus("Uploaded."); } else setStatus(done.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="step-image">
      {shown && (
        // A founder's own link, shown as a preview of what they chose.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={`step-image-preview${round ? " round" : ""}`} src={shown} alt="" referrerPolicy="no-referrer" />
      )}
      {uploads && (
        <label className="media-upload">
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
          <span className="secondary-button">{busy ? "Uploading…" : "Choose an image"}</span>
        </label>
      )}
      <div className="field">
        <label htmlFor={id}>{uploads ? "Or paste a link" : `Link to ${label}`}</label>
        <input id={id} type="url" inputMode="url" value={value} onChange={(e) => set(e.target.value)} onBlur={() => set(withHttps(value))}
          placeholder="https://" maxLength={600} autoFocus={!uploads} />
      </div>
      {status && <p className="field-hint" role="status">{status}</p>}
    </div>
  );
}

/** "1:30" or "90" to seconds; NaN when it is neither. */
function seconds(text: string): number {
  const clean = text.trim();
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(clean);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return /^\d{1,3}$/.test(clean) ? Number(clean) : NaN;
}

/** The YouTube link, with a preview that fills in the length (and the title, if none is written yet). */
export function YouTubeInput({ id, value, set, values, patch }: InputProps) {
  const video = youtubeId(value);
  const [unknownLength, setUnknownLength] = useState(false);
  const [typed, setTyped] = useState(() => values.durationSeconds ? duration(Number(values.durationSeconds)) : "");
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (video === last.current) return;
    last.current = video;
    setUnknownLength(false);
    if (!video) patch({ durationSeconds: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  return (
    <div className="step-youtube">
      <div className="field">
        <label className="sr-only" htmlFor={id}>YouTube link</label>
        <input id={id} type="url" inputMode="url" value={value} onChange={(e) => set(e.target.value)} placeholder="youtube.com/watch?v=… or youtu.be/…"
          maxLength={600} autoFocus autoComplete="off" aria-describedby={`${id}-hint`} />
        <p id={`${id}-hint`} className="field-hint">
          {value.trim() && !video ? "That isn't a YouTube video link yet. Copy it from YouTube's Share button." : "Public or Unlisted both work. Shorts too."}
        </p>
      </div>
      {video && (
        <div className="step-youtube-preview">
          <YouTubePlayer key={video} youtube={video} videoId={null} title="Your video" track={false}
            // eslint-disable-next-line @next/next/no-img-element
            poster={<img className="thumb-image" src={youtubeThumbnail(video)} alt="" referrerPolicy="no-referrer" />}
            onDetails={({ durationSeconds, title }) => {
              if (durationSeconds > 0) { patch({ durationSeconds: String(durationSeconds), ...(values.title || !title ? {} : { title: title.slice(0, 100) }) }); setTyped(duration(durationSeconds)); }
              else setUnknownLength(true);
            }} />
          {values.durationSeconds && !unknownLength && <p className="field-hint">Length {duration(Number(values.durationSeconds))}, read from YouTube.</p>}
        </div>
      )}
      {video && unknownLength && (
        <div className="field">
          <label htmlFor={`${id}-length`}>How long is it? (minutes:seconds)</label>
          <input id={`${id}-length`} value={typed} inputMode="numeric" placeholder="1:30" maxLength={5}
            onChange={(e) => { setTyped(e.target.value); const s = seconds(e.target.value); patch({ durationSeconds: Number.isFinite(s) ? String(s) : "" }); }} />
        </div>
      )}
    </div>
  );
}

export function youtubeCheck(value: string, values: Record<string, string>): string | null {
  if (!youtubeId(value)) return "Paste the link to your video on YouTube.";
  const length = Number(values.durationSeconds);
  if (!values.durationSeconds) return "Wait a moment for the preview to load, or type the video's length.";
  if (!Number.isInteger(length) || length < MIN_VIDEO_SECONDS || length > MAX_VIDEO_SECONDS) return `Videos can be up to 2 minutes long. This one is ${duration(length)}: trim it on YouTube, or use a shorter one.`;
  return null;
}

/**
 * A photo of the founder's face (2026-10-22): their Mitra profile photo,
 * uploaded through the profile-photo upload (re-encoded, AI-labelled images
 * turned away). The answer becomes the photo's address on Mitra.
 */
export function FacePhotoInput({ id, value, set, memberHandle, name }: InputProps & { memberHandle: string; name: string }) {
  const { state, uploading, upload } = usePhotoUpload();
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = preview ?? (value || null);

  return (
    <div className="step-image">
      <label className="photo-drop" htmlFor={id}>
        {shown
          // The photo just chosen (a local preview) or the one saved on Mitra.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="photo-drop-image" src={shown} alt={`${name}'s photo`} />
          : <span className="photo-drop-empty" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </span>}
        <span className="photo-drop-label">{uploading ? "Uploading…" : shown ? "Choose a different photo" : "Choose a photo of your face"}</span>
        <input id={id} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setPreview(URL.createObjectURL(file));
            upload(file, () => set(`/photos/${memberHandle}?v=${Date.now()}`));
          }} />
      </label>
      <p className="field-hint photo-drop-hint">JPEG, PNG or WebP, up to 8 MB. A real photo of you: images labelled as AI-generated are turned away. It&rsquo;s also your profile photo.</p>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {!state.error && value && preview && !uploading && <p className="field-hint step-ok" role="status">Saved.</p>}
    </div>
  );
}

/** A resume as a PDF (2026-10-22), checked on the server; the answer is where the checked copy is kept. */
export function ResumeInput({ id, value, set, viewHref }: InputProps & { viewHref: string | null }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setStatus("Uploading…");
    try {
      if (file.type !== "application/pdf") { setStatus("Use a PDF of your resume."); return; }
      const start = await startResumeUpload({ contentType: file.type, bytes: file.size });
      if (!start.ok) { setStatus(start.error); return; }
      if (!(await putToSignedUrl(start.value.url, file, file.type))) { setStatus("The upload didn't go through. Please try again."); return; }
      const done = await finishResumeUploadAction(start.value.uploadId);
      if (done.ok) { set(done.value.path); setStatus(`${file.name} uploaded.`); } else setStatus(done.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="step-image">
      <label className="media-upload" htmlFor={id}>
        <input id={id} type="file" accept="application/pdf" disabled={busy}
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} />
        <span className="secondary-button">{busy ? "Uploading…" : value ? "Replace your resume" : "Choose a PDF"}</span>
      </label>
      <p className="field-hint" role="status">
        {status ?? (value ? "Your resume is uploaded." : "A PDF up to 5 MB. Visitors can open it once your profile is approved.")}
        {value && viewHref && !status && <> <a href={viewHref} target="_blank" rel="noopener noreferrer">Open it</a></>}
      </p>
      {value && <button type="button" className="text-button step-inline" onClick={() => { set(""); setStatus("Removed. Save to delete it."); }}>Remove resume</button>}
    </div>
  );
}

/** A password box with Show, for the co-founder join password. */
export function PasswordInput({ id, value, set, label, autoComplete = "new-password" }: InputProps & { label: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <div className="handle-input">
        <input id={id} type={visible ? "text" : "password"} value={value} onChange={(e) => set(e.target.value)} maxLength={72}
          autoComplete={autoComplete} autoCapitalize="none" spellCheck={false} autoFocus />
        <button type="button" className="text-button step-show" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>{visible ? "Hide" : "Show"}</button>
      </div>
    </div>
  );
}
