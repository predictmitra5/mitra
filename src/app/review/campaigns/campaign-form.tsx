"use client";

import { useActionState } from "react";
import { CAMPUSES } from "@/config/campus";
import { createQrCampaignAction, type CampaignFormState } from "@/modules/promotions/actions";

export function CampaignForm() {
  const [state, action, pending] = useActionState(createQrCampaignAction, {} as CampaignFormState);
  return <form action={action} className="auth-form campaign-form" aria-busy={pending}>
    <h2>New campus QR campaign</h2>
    <p>Set its reward and allowed area. Only this reference location is retained; a visitor’s scan coordinates are checked and discarded.</p>
    <div className="field"><label htmlFor="campaign-name">Name</label><input id="campaign-name" name="name" required minLength={2} maxLength={80} placeholder="Union South launch" /></div>
    <div className="field-pair">
      <div className="field"><label htmlFor="campaign-campus">Campus</label><select id="campaign-campus" name="campus" defaultValue="osu">{Object.values(CAMPUSES).map((campus) => <option key={campus.key} value={campus.key}>{campus.universityName}</option>)}</select></div>
      <div className="field"><label htmlFor="campaign-reward">Gold Trade Coins</label><input id="campaign-reward" name="rewardCoins" type="number" min="1" max="100000" required defaultValue="5" /></div>
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
    {state.success && <div className="form-success" role="status"><p>{state.success}</p>{state.claimUrl && <p><a href={state.claimUrl}>{state.claimUrl}</a></p>}</div>}
    <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create campaign link"}</button>
  </form>;
}
