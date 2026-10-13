"use client";

import { useActionState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CAMPUSES } from "@/config/campus";
import { createQrCampaignAction, type CampaignFormState } from "@/modules/promotions/actions";

export function CampaignForm() {
  const [state, action, pending] = useActionState(createQrCampaignAction, {} as CampaignFormState);
  const qrRef = useRef<SVGSVGElement>(null);
  const qrUrl = state.claimUrl && typeof window !== "undefined"
    ? new URL(state.claimUrl, window.location.origin).toString()
    : "";

  function downloadQr() {
    const svg = qrRef.current;
    if (!svg) return;
    const file = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = href;
    link.download = "mitra-campus-claim-qr.svg";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }

  return <form action={action} className="auth-form campaign-form" aria-busy={pending}>
    <h2>New campus QR campaign</h2>
    <p>Set its Trade Coin reward and allowed area. Only this reference location is retained; a visitor’s coordinates are checked and discarded. Device location can be spoofed and is not proof of physical presence.</p>
    <div className="field"><label htmlFor="campaign-name">Name</label><input id="campaign-name" name="name" required minLength={2} maxLength={80} placeholder="Union South launch" /></div>
    <div className="field-pair">
      <div className="field"><label htmlFor="campaign-campus">Campus</label><select id="campaign-campus" name="campus" defaultValue="osu">{Object.values(CAMPUSES).map((campus) => <option key={campus.key} value={campus.key}>{campus.universityName}</option>)}</select></div>
      <div className="field"><label htmlFor="campaign-reward">Trade Coins to award</label><input id="campaign-reward" name="rewardCoins" type="number" min="1" max="100000" required defaultValue="5" /></div>
    </div>
    <div className="field-pair">
      <div className="field"><label htmlFor="campaign-lat">Center latitude</label><input id="campaign-lat" name="latitude" type="number" step="any" min="-90" max="90" required /></div>
      <div className="field"><label htmlFor="campaign-lon">Center longitude</label><input id="campaign-lon" name="longitude" type="number" step="any" min="-180" max="180" required /></div>
    </div>
    <div className="field-pair">
      <div className="field"><label htmlFor="campaign-radius">Radius (metres)</label><input id="campaign-radius" name="radiusMeters" type="number" min="10" max="2000" required defaultValue="100" /></div>
      <div className="field"><label htmlFor="campaign-limit">Maximum claims (optional)</label><input id="campaign-limit" name="maxClaims" type="number" min="1" max="100000" /></div>
    </div>
    <div className="field-pair">
      <div className="field"><label htmlFor="campaign-start">Starts (campus time)</label><input id="campaign-start" name="startsAt" type="datetime-local" required /></div>
      <div className="field"><label htmlFor="campaign-end">Ends (campus time)</label><input id="campaign-end" name="endsAt" type="datetime-local" required /></div>
    </div>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && <div className="form-success campaign-result" role="status">
      <p>{state.success}</p>
      {qrUrl && <>
        <div className="campaign-qr"><QRCodeSVG ref={qrRef} value={qrUrl} size={240} level="Q" marginSize={4} title="Campus campaign claim QR code" /></div>
        <p className="campaign-link"><a href={qrUrl}>{qrUrl}</a></p>
        <p>This campaign link can be claimed once per eligible account, up to the campaign cap. Keep the QR available only during the campaign.</p>
        <button type="button" className="btn btn-quiet campaign-download" onClick={downloadQr}>Download QR image</button>
      </>}
    </div>}
    <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create campaign and QR"}</button>
  </form>;
}
