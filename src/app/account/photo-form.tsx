"use client";

import { useActionState, useEffect, useState } from "react";
import { removeOwnPhotoAction } from "@/modules/account/photo-actions";
import type { FormState } from "@/modules/auth/policy";
import { Avatar } from "@/app/components/market/market-card";
import { usePhotoUpload } from "./use-photo-upload";

/**
 * The signed-in person's profile photo (decided 2026-09-24): required to post a
 * goal, shown wherever their name appears. Used on the account page and, for
 * someone without a photo, in place of the goal form.
 * The upload itself is usePhotoUpload, shared with onboarding.
 */
export function PhotoForm({ name, photo, heading = "Profile photo" }: { name: string; photo: string | null; heading?: string }) {
  const { state: uploadState, uploading, upload: send } = usePhotoUpload();
  const [removeState, remove, removing] = useActionState(removeOwnPhotoAction, {} as FormState);
  const [preview, setPreview] = useState<string | null>(null);

  // Object URLs hold the file in memory until revoked.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const state = removeState.error || removeState.success ? removeState : uploadState;
  const busy = uploading || removing;

  function upload(form: FormData) {
    send(form.get("photo"));
  }

  return <section className="account-note photo-card" aria-labelledby="photo-heading">
    <div className="photo-row">
      <span className="photo-current">
        {preview
          // A local preview of the file just chosen; it never leaves the browser until saved.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="avatar avatar-round avatar-photo" src={preview} alt="The photo you chose" width={72} height={72} style={{ width: 72, height: 72 }} />
          : <Avatar name={name} photo={photo} size={72} />}
      </span>
      <div className="photo-copy">
        <h2 id="photo-heading">{heading}</h2>
        <p>Shown on your account. Use a real photo of yourself: images labelled as AI-generated are refused.</p>
      </div>
    </div>
    <form action={upload} className="photo-upload" aria-busy={uploading}>
      <label className="field">
        <span className="sr-only">Choose a photo</span>
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }} />
      </label>
      <p className="field-hint">JPEG, PNG or WebP, up to 8 MB. It is cropped to a square, and the location and camera details inside the file are removed.</p>
      <button className="primary-button" type="submit" disabled={busy}>{uploading ? "Saving…" : photo ? "Replace photo" : "Save photo"}</button>
    </form>
    {photo && <form action={remove}>
      <button className="text-button" type="submit" disabled={busy}>{removing ? "Removing…" : "Remove my photo"}</button>
    </form>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && <p className="form-success" role="status">{state.success}</p>}
  </section>;
}
