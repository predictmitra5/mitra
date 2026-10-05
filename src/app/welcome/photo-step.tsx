"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/app/components/market/goal-card";
import { usePhotoUpload } from "@/app/account/use-photo-upload";

/*
 * Onboarding: the profile photo (decided 2026-10-05). It can be skipped here;
 * posting a goal still needs one (decided 2026-09-24).
 */
export function PhotoStep({ name, photo }: { name: string; photo: string | null }) {
  const router = useRouter();
  const { state, uploading, upload } = usePhotoUpload();
  const [preview, setPreview] = useState<string | null>(null);

  // Object URLs hold the file in memory until revoked.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <form className="step-form" aria-busy={uploading}
      action={(form) => upload(form.get("photo"), () => router.push("/welcome?step=topics"))}>
      <h1>Add a profile photo</h1>
      <p className="step-sub">It shows next to your name and your goals. You’ll need one before you post a goal.</p>
      <label className="photo-drop">
        {preview
          // A local preview of the file just chosen; it never leaves the browser until saved.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="photo-drop-image" src={preview} alt="The photo you chose" />
          : photo ? <Avatar name={name} photo={photo} size={168} />
          : <span className="photo-drop-empty" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </span>}
        <span className="photo-drop-label">{preview || photo ? "Choose a different photo" : "Choose a photo"}</span>
        <input className="sr-only" type="file" name="photo" accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }} />
      </label>
      <p className="field-hint photo-drop-hint">JPEG, PNG or WebP, up to 8 MB. A real photo of you: images labelled as AI-generated are turned away.</p>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={uploading || !preview}>{uploading ? "Saving…" : "Upload photo"}</button>
      <Link className="text-button step-skip" href="/welcome?step=topics" prefetch={false}>{photo ? "Keep this photo" : "Skip for now"}</Link>
    </form>
  );
}
