"use client";

import { useActionState } from "react";
import {
  addClaimAction, addUpdateAction, addVideoAction, registerStartupAction, saveFounderAction, suggestMarketAction, updateStartupAction, type FormState,
} from "@/modules/startups/creator-actions";
import { INDUSTRIES } from "@/modules/startups/labels";
import { MediaField } from "./media-field";

/*
 * The creator hub's forms (2026-10-19). Plain fields, saved on the server,
 * with a message on what happens next. Links to files (a video, a thumbnail,
 * a logo, a portrait) can be pasted, or the file uploaded where storage is set
 * up (media-field.tsx).
 */

function Message({ state }: { state: FormState }) {
  if (!state) return null;
  return <p className={state.ok ? "form-success" : "form-error"} role={state.ok ? "status" : "alert"}>{state.message}</p>;
}

export type FounderDefaults = {
  handle: string; name: string; headline: string; bio: string; background: string; location: string; portraitUrl: string; websiteUrl: string; accomplishments: string;
};

export function FounderForm({ defaults, uploads }: { defaults: FounderDefaults; uploads: boolean }) {
  const [state, action, pending] = useActionState(saveFounderAction, null);
  return (
    <form action={action} className="review-form">
      <div className="field-pair">
        <div className="field"><label htmlFor="f-name">Name</label><input id="f-name" name="name" defaultValue={defaults.name} maxLength={80} required /></div>
        <div className="field"><label htmlFor="f-handle">Handle</label><input id="f-handle" name="handle" defaultValue={defaults.handle} maxLength={24} required pattern="[a-z0-9_]{3,24}" placeholder="arivale" /></div>
      </div>
      <div className="field"><label htmlFor="f-headline">Headline</label><input id="f-headline" name="headline" defaultValue={defaults.headline} maxLength={120} required placeholder="Turning class notes into study plans" /></div>
      <div className="field"><label htmlFor="f-bio">Bio <span className="muted">(shown under your videos)</span></label><textarea id="f-bio" name="bio" rows={3} maxLength={600} defaultValue={defaults.bio} required /></div>
      <div className="field"><label htmlFor="f-background">Professional background</label><textarea id="f-background" name="background" rows={3} maxLength={800} defaultValue={defaults.background} /></div>
      <div className="field"><label htmlFor="f-acc">Public accomplishments <span className="muted">(one per line, up to 6)</span></label><textarea id="f-acc" name="accomplishments" rows={3} defaultValue={defaults.accomplishments} /></div>
      <div className="field-pair">
        <div className="field"><label htmlFor="f-location">Based in</label><input id="f-location" name="location" defaultValue={defaults.location} maxLength={80} /></div>
        <div className="field"><label htmlFor="f-web">Website</label><input id="f-web" name="websiteUrl" type="url" defaultValue={defaults.websiteUrl} placeholder="https://" /></div>
      </div>
      <MediaField name="portraitUrl" label="Portrait" kind="image" defaultValue={defaults.portraitUrl} uploads={uploads} hint="A clear photo of you. Without one, your initials are shown." />
      <Message state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save founder profile"}</button>
    </form>
  );
}

export type StartupDefaults = {
  startupId: string | null; name: string; tagline: string; headline: string; description: string; industry: string; tags: string; stage: string;
  foundedOn: string; headquarters: string; websiteUrl: string; logoUrl: string; thumbnailUrl: string; productImageUrl: string; productDetails: string; features: string; screenshots: string;
};

export function StartupForm({ defaults, uploads }: { defaults: StartupDefaults; uploads: boolean }) {
  const [state, action, pending] = useActionState(defaults.startupId ? updateStartupAction : registerStartupAction, null);
  const id = defaults.startupId ?? "new";
  return (
    <form action={action} className="review-form">
      {defaults.startupId && <input type="hidden" name="startupId" value={defaults.startupId} />}
      <div className="field-pair">
        <div className="field"><label htmlFor={`s-name-${id}`}>Startup name</label><input id={`s-name-${id}`} name="name" defaultValue={defaults.name} maxLength={60} required readOnly={!!defaults.startupId} /></div>
        <div className="field"><label htmlFor={`s-tag-${id}`}>What it is, in a few words</label><input id={`s-tag-${id}`} name="tagline" defaultValue={defaults.tagline} maxLength={60} required placeholder="AI Study Companion" /></div>
      </div>
      <div className="field"><label htmlFor={`s-head-${id}`}>Headline for your cards</label><input id={`s-head-${id}`} name="headline" defaultValue={defaults.headline} maxLength={90} required placeholder="Building the future of studying" /></div>
      <div className="field"><label htmlFor={`s-desc-${id}`}>Description</label><textarea id={`s-desc-${id}`} name="description" rows={3} maxLength={1200} defaultValue={defaults.description} required /></div>
      <div className="field-pair">
        <div className="field"><label htmlFor={`s-ind-${id}`}>Industry</label>
          <select id={`s-ind-${id}`} name="industry" defaultValue={defaults.industry || "ai"}>{INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select></div>
        <div className="field"><label htmlFor={`s-stage-${id}`}>Stage</label><input id={`s-stage-${id}`} name="stage" defaultValue={defaults.stage} maxLength={40} required placeholder="Pre-seed" /></div>
      </div>
      <div className="field-pair">
        <div className="field"><label htmlFor={`s-founded-${id}`}>Founded</label><input id={`s-founded-${id}`} name="foundedOn" type="month" defaultValue={defaults.foundedOn} /></div>
        <div className="field"><label htmlFor={`s-hq-${id}`}>Based in</label><input id={`s-hq-${id}`} name="headquarters" defaultValue={defaults.headquarters} maxLength={80} /></div>
      </div>
      <div className="field"><label htmlFor={`s-prod-${id}`}>Product details</label><textarea id={`s-prod-${id}`} name="productDetails" rows={3} maxLength={1200} defaultValue={defaults.productDetails} required /></div>
      <div className="field-pair">
        <div className="field"><label htmlFor={`s-feat-${id}`}>Three product features <span className="muted">(one per line)</span></label><textarea id={`s-feat-${id}`} name="features" rows={3} defaultValue={defaults.features} placeholder={"Study plans\nCourse notes\nAI tutoring"} /></div>
        <div className="field"><label htmlFor={`s-tags-${id}`}>Tags <span className="muted">(up to 5, one per line)</span></label><textarea id={`s-tags-${id}`} name="tags" rows={3} defaultValue={defaults.tags} /></div>
      </div>
      <div className="field"><label htmlFor={`s-web-${id}`}>Website</label><input id={`s-web-${id}`} name="websiteUrl" type="url" defaultValue={defaults.websiteUrl} placeholder="https://" /></div>
      <div className="field-pair">
        <MediaField name="logoUrl" label="Logo" kind="image" defaultValue={defaults.logoUrl} uploads={uploads} />
        <MediaField name="thumbnailUrl" label="Thumbnail" kind="image" defaultValue={defaults.thumbnailUrl} uploads={uploads} hint="You and the product together. Without one, Mitra draws it from your portrait, logo and features." />
      </div>
      <div className="field"><label htmlFor={`s-shots-${id}`}>Product screenshots <span className="muted">(links, one per line, up to 6)</span></label><textarea id={`s-shots-${id}`} name="screenshots" rows={2} defaultValue={defaults.screenshots} /></div>
      {!defaults.startupId && <div className="field"><label htmlFor="s-role">Your role</label><input id="s-role" name="role" maxLength={60} defaultValue="Founder / CEO" /></div>}
      <Message state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : defaults.startupId ? "Save details" : "Register startup"}</button>
    </form>
  );
}

export function VideoForm({ startupId, uploads }: { startupId: string; uploads: boolean }) {
  const [state, action, pending] = useActionState(addVideoAction, null);
  return (
    <form action={action} className="review-form" key={state?.ok ? "sent" : "form"}>
      <input type="hidden" name="startupId" value={startupId} />
      <div className="field-pair">
        <div className="field"><label htmlFor={`v-title-${startupId}`}>Title</label><input id={`v-title-${startupId}`} name="title" maxLength={100} required /></div>
        <div className="field"><label htmlFor={`v-kind-${startupId}`}>Kind</label>
          <select id={`v-kind-${startupId}`} name="kind" defaultValue="pitch"><option value="pitch">Founder video</option><option value="demo">Product demo</option><option value="update">Progress update</option><option value="interview">Interview</option></select></div>
      </div>
      <div className="field"><label htmlFor={`v-desc-${startupId}`}>Description</label><textarea id={`v-desc-${startupId}`} name="description" rows={2} maxLength={500} required /></div>
      <MediaField name="videoUrl" label="Video file" kind="video" uploads={uploads} hint="An MP4 or WebM up to 50 MB, or a direct https:// link to one." />
      <MediaField name="thumbnailUrl" label="Thumbnail" kind="image" uploads={uploads} hint="Optional. Without one, the founder-and-startup thumbnail is drawn for you." />
      <div className="field-pair">
        <div className="field"><label htmlFor={`v-len-${startupId}`}>Length in seconds</label><input id={`v-len-${startupId}`} name="durationSeconds" type="number" min={5} max={600} required defaultValue={90} /></div>
        <div className="field"><label htmlFor={`v-cap-${startupId}`}>Captions <span className="muted">(one line each; &ldquo;0:12 text&rdquo; to time them)</span></label><textarea id={`v-cap-${startupId}`} name="captions" rows={4} /></div>
      </div>
      <Message state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send video for review"}</button>
    </form>
  );
}

export function UpdateForm({ startupId }: { startupId: string }) {
  const [state, action, pending] = useActionState(addUpdateAction, null);
  return (
    <form action={action} className="review-form" key={state?.ok ? "sent" : "form"}>
      <input type="hidden" name="startupId" value={startupId} />
      <div className="field-pair">
        <div className="field"><label htmlFor={`u-title-${startupId}`}>Title</label><input id={`u-title-${startupId}`} name="title" maxLength={100} required /></div>
        <div className="field"><label htmlFor={`u-date-${startupId}`}>When</label><input id={`u-date-${startupId}`} name="happenedOn" type="date" /></div>
      </div>
      <div className="field"><label htmlFor={`u-body-${startupId}`}>What happened</label><textarea id={`u-body-${startupId}`} name="body" rows={3} maxLength={1000} required /></div>
      <label className="checkbox-row"><input type="checkbox" name="kind" value="milestone" />This is a milestone</label>
      <Message state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>Post update</button>
    </form>
  );
}

export function ClaimForm({ startupId }: { startupId: string }) {
  const [state, action, pending] = useActionState(addClaimAction, null);
  return (
    <form action={action} className="review-form" key={state?.ok ? "sent" : "form"}>
      <input type="hidden" name="startupId" value={startupId} />
      <div className="field"><label htmlFor={`c-st-${startupId}`}>Claim</label><input id={`c-st-${startupId}`} name="statement" maxLength={300} required placeholder="We have 31,000 monthly active users" /></div>
      <div className="field-pair">
        <div className="field"><label htmlFor={`c-sn-${startupId}`}>Source</label><input id={`c-sn-${startupId}`} name="sourceName" maxLength={120} placeholder="App Store Connect export" /></div>
        <div className="field"><label htmlFor={`c-su-${startupId}`}>Source link</label><input id={`c-su-${startupId}`} name="sourceUrl" type="url" placeholder="https://" /></div>
      </div>
      <Message state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>Send for verification</button>
    </form>
  );
}

export function SuggestForm({ startupId }: { startupId: string }) {
  const [state, action, pending] = useActionState(suggestMarketAction, null);
  return (
    <form action={action} className="review-form" key={state?.ok ? "sent" : "form"}>
      <input type="hidden" name="startupId" value={startupId} />
      <div className="field"><label htmlFor={`m-q-${startupId}`}>Question</label><input id={`m-q-${startupId}`} name="question" maxLength={240} required placeholder="Will we reach 10,000 paying users by June 30, 2027?" /></div>
      <div className="field"><label htmlFor={`m-h-${startupId}`}>How anyone could check it</label><textarea id={`m-h-${startupId}`} name="howToCheck" rows={2} maxLength={600} required /></div>
      <div className="field"><label htmlFor={`m-c-${startupId}`}>Suggested close date</label><input id={`m-c-${startupId}`} name="closesOn" type="date" /></div>
      <p className="field-hint">The owner publishes the exact rules and resolution source. Prices require actual orders and executions. You and your team cannot trade your own startup&rsquo;s markets.</p>
      <Message state={state} />
      <button className="btn btn-quiet" type="submit" disabled={pending}>Suggest market</button>
    </form>
  );
}
