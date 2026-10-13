"use client";

import { useActionState, useState } from "react";
import { CAMPUSES, type CampusKey } from "@/config/campus";
import { deleteQrCampaignAction, replaceCampaignQrAction, setQrCampaignActiveAction, updateQrCampaignAction, type CampaignFormState } from "@/modules/promotions/actions";
import { CampaignQr } from "./campaign-qr";

export type CampaignItemData = {
  id: string;
  campus: CampusKey;
  name: string;
  latitude: string;
  longitude: string;
  radiusMeters: number;
  rewardCoins: number;
  maxClaims: number | null;
  startsAt: string;
  endsAt: string;
  endsAtIso: string;
  nowMs: number;
  active: boolean;
  claimCount: number;
};

export function CampaignItem({ campaign }: { campaign: CampaignItemData }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [updated, updateAction, updating] = useActionState(updateQrCampaignAction, {} as CampaignFormState);
  const [status, statusAction, changingStatus] = useActionState(setQrCampaignActiveAction, {} as CampaignFormState);
  const [removed, removeAction, removing] = useActionState(deleteQrCampaignAction, {} as CampaignFormState);
  const [replacement, replaceAction, replacing] = useActionState(replaceCampaignQrAction, {} as CampaignFormState);
  const end = new Date(campaign.endsAtIso);
  const now = campaign.nowMs;
  const active = campaign.active && end.getTime() > now && (campaign.maxClaims === null || campaign.claimCount < campaign.maxClaims);
  const canResume = !campaign.active && end.getTime() > now && (campaign.maxClaims === null || campaign.claimCount < campaign.maxClaims);
  const canEditTerms = campaign.claimCount === 0 && end.getTime() > now;
  const campus = CAMPUSES[campaign.campus];

  return <article className="campaign-card">
    <div className="campaign-card-heading">
      <div><span className="eyebrow">{campus.communityName}</span><h3>{campaign.name}</h3></div>
      <span className={`status-pill ${active ? "status-open" : "status-cancelled"}`}>{active ? "Active" : campaign.maxClaims !== null && campaign.claimCount >= campaign.maxClaims ? "Limit reached" : end.getTime() <= now ? "Ended" : "Paused"}</span>
    </div>
    <div className="campaign-facts">
      <span><strong>{campaign.rewardCoins}</strong> Trade Coins per claim</span>
      <span><strong>{campaign.claimCount}{campaign.maxClaims == null ? "" : ` / ${campaign.maxClaims}`}</strong> claims</span>
      <span><strong>{campaign.radiusMeters} m</strong> allowed area</span>
      <span>Ends <strong>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: campus.timeZone }).format(end)}</strong></span>
    </div>
    <div className="campaign-controls">
      <form action={statusAction}>
        <input type="hidden" name="campaignId" value={campaign.id} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
        <button className="btn btn-quiet" type="submit" disabled={changingStatus || (!active && !canResume)}>
          {changingStatus ? "Saving…" : active ? "Pause campaign" : canResume ? "Resume campaign" : "Campaign ended"}
        </button>
      </form>
      {canEditTerms && <button className="btn btn-quiet" type="button" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>{editing ? "Close editor" : "Edit details"}</button>}
      <form action={replaceAction}>
        <input type="hidden" name="campaignId" value={campaign.id} />
        <button className="btn btn-quiet" type="submit" disabled={replacing}>{replacing ? "Replacing…" : "Replace QR"}</button>
      </form>
      <button className="btn btn-danger-quiet" type="button" onClick={() => setConfirmDelete((open) => !open)} aria-expanded={confirmDelete}>{confirmDelete ? "Cancel remove" : "Remove campaign"}</button>
    </div>
    {status.error && <p className="form-error" role="alert">{status.error}</p>}
    {status.success && <p className="form-success" role="status">{status.success}</p>}
    {updated.error && <p className="form-error" role="alert">{updated.error}</p>}
    {updated.success && <p className="form-success" role="status">{updated.success}</p>}
    {removed.error && <p className="form-error" role="alert">{removed.error}</p>}
    {removed.success && <p className="form-success" role="status">{removed.success}</p>}
    {replacement.error && <p className="form-error" role="alert">{replacement.error}</p>}
    {replacement.success && replacement.claimUrl && <CampaignQr claimPath={replacement.claimUrl} notice={replacement.success} />}
    {canEditTerms && editing && <form action={updateAction} className="campaign-edit-form" aria-busy={updating}>
      <input type="hidden" name="campaignId" value={campaign.id} />
      <div className="field"><label htmlFor={`campaign-name-${campaign.id}`}>Campaign name</label><input id={`campaign-name-${campaign.id}`} name="name" required minLength={2} maxLength={80} defaultValue={campaign.name} /></div>
      <div className="field-pair">
        <div className="field"><label htmlFor={`campaign-campus-${campaign.id}`}>Campus</label><select id={`campaign-campus-${campaign.id}`} name="campus" defaultValue={campaign.campus}>{Object.values(CAMPUSES).map((entry) => <option key={entry.key} value={entry.key}>{entry.universityName}</option>)}</select></div>
        <div className="field"><label htmlFor={`campaign-reward-${campaign.id}`}>Trade Coins to award</label><input id={`campaign-reward-${campaign.id}`} name="rewardCoins" type="number" min="1" max="100000" required defaultValue={campaign.rewardCoins} /></div>
      </div>
      <div className="field-pair">
        <div className="field"><label htmlFor={`campaign-lat-${campaign.id}`}>Center latitude</label><input id={`campaign-lat-${campaign.id}`} name="latitude" type="number" step="any" min="-90" max="90" required defaultValue={campaign.latitude} /></div>
        <div className="field"><label htmlFor={`campaign-lon-${campaign.id}`}>Center longitude</label><input id={`campaign-lon-${campaign.id}`} name="longitude" type="number" step="any" min="-180" max="180" required defaultValue={campaign.longitude} /></div>
      </div>
      <div className="field-pair">
        <div className="field"><label htmlFor={`campaign-radius-${campaign.id}`}>Radius (metres)</label><input id={`campaign-radius-${campaign.id}`} name="radiusMeters" type="number" min="10" max="2000" required defaultValue={campaign.radiusMeters} /></div>
        <div className="field"><label htmlFor={`campaign-limit-${campaign.id}`}>Maximum claims (optional)</label><input id={`campaign-limit-${campaign.id}`} name="maxClaims" type="number" min="1" max="100000" defaultValue={campaign.maxClaims ?? ""} /></div>
      </div>
      <div className="field-pair">
        <div className="field"><label htmlFor={`campaign-start-${campaign.id}`}>Starts (campus time)</label><input id={`campaign-start-${campaign.id}`} name="startsAt" type="datetime-local" required defaultValue={campaign.startsAt} /></div>
        <div className="field"><label htmlFor={`campaign-end-${campaign.id}`}>Ends (campus time)</label><input id={`campaign-end-${campaign.id}`} name="endsAt" type="datetime-local" required defaultValue={campaign.endsAt} /></div>
      </div>
      <p className="field-hint">Campaign terms lock after the first claim so earlier awards keep their original conditions.</p>
      {updated.error && <p className="form-error" role="alert">{updated.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={updating}>{updating ? "Saving…" : "Save changes"}</button>
    </form>}
    {confirmDelete && <div className="campaign-remove-confirm">
      <p>{campaign.claimCount > 0 ? "This campaign has claims. It will be archived and its claim history retained; the QR will stop working." : "This campaign has no claims and will be permanently deleted."}</p>
      <form action={removeAction}>
        <input type="hidden" name="campaignId" value={campaign.id} />
        <button className="btn btn-danger-quiet" type="submit" disabled={removing}>{removing ? "Removing…" : campaign.claimCount > 0 ? "Archive campaign" : "Delete campaign"}</button>
      </form>
    </div>}
  </article>;
}
