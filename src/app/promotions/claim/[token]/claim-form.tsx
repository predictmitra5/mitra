"use client";

import { useState } from "react";
import { claimQrCampaignAction } from "@/modules/promotions/actions";

export function ClaimForm({ token, signedIn }: { token: string; signedIn: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const claim = () => {
    if (!signedIn) return;
    if (!navigator.geolocation) { setMessage("Location isn’t available in this browser."); return; }
    setPending(true);
    setMessage("Checking your location…");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const result = await claimQrCampaignAction(token, coords.latitude, coords.longitude);
        setMessage(result.success ?? result.error ?? "We couldn’t verify this claim.");
      } catch {
        setMessage("We couldn’t verify this claim. Your location was not saved; please try again.");
      } finally { setPending(false); }
    }, () => {
      setPending(false);
      setMessage("Location permission is needed to check this campaign area.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  };
  return <div className="claim-action">
    <button className="btn btn-primary" type="button" onClick={claim} disabled={!signedIn || pending}>{pending ? "Verifying…" : "Verify location and claim"}</button>
    {!signedIn && <p>Sign in with your verified university email to claim.</p>}
    {message && <p role="status">{message}</p>}
    <p className="field-hint">Your device sends location for this check only. Claimant coordinates are not retained.</p>
  </div>;
}
