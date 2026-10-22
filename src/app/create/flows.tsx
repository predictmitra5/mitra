"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addVideoStepsAction, saveFounderStepsAction, saveStartupStepsAction } from "@/modules/startups/creator-actions";
import { createInviteAction } from "@/modules/startups/invite-actions";
import { EDUCATION_LEVELS, INDUSTRIES, VIDEO_KINDS, duration, industryLabel, videoKindLabel } from "@/modules/startups/labels";
import { linkedinProfileUrl } from "@/modules/startups/links";
import { youtubeId, youtubeThumbnail } from "@/modules/startups/youtube";
import { StepFrame } from "@/app/components/step-frame";
import { Choices, ListInput, LongText, StepFlow, TextInput, httpsLink, lengthCheck, withHttps, type StepDef, type Values } from "./step-flow";
import { FacePhotoInput, HandleInput, ImageInput, PasswordInput, ResumeInput, YouTubeInput, youtubeCheck } from "./step-inputs";

/*
 * The three founder flows (2026-10-21): the founder profile, the startup and a
 * video, each one question per screen with a review screen at the end. The
 * same screens edit what is already saved.
 */

const lines = (value: string) => value.split("\n").map((l) => l.trim()).filter(Boolean);
const bullets = (value: string) => <ul className="step-review-list">{lines(value).map((l, i) => <li key={i}>{l}</li>)}</ul>;
function picture(round: boolean) {
  return function Picture(value: string) {
    // A founder's own link, shown as they chose it.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`step-review-image${round ? " round" : ""}`} src={value} alt="" referrerPolicy="no-referrer" />;
  };
}
const links = (value: string) => lines(value).map(withHttps).join("\n");
const linkList = (value: string) => lines(value).map(httpsLink).find(Boolean) ?? null;

// ---------------------------------------------------------- founder profile

const linkedinCheck = (value: string) => value && !linkedinProfileUrl(value) ? "Use the link to your LinkedIn profile, like linkedin.com/in/yourname." : null;
const faceStep = (memberHandle: string, name: string, optional: boolean, sub: string): StepDef => ({
  key: "portraitUrl", label: "Photo", optional, title: "Add a photo of your face", sub,
  show: picture(true), input: (p) => <FacePhotoInput {...p} memberHandle={memberHandle} name={name} />,
});

export function FounderFlow({ initial, isNew, memberHandle, joining = false }: {
  initial: Values; isNew: boolean; memberHandle: string; joining?: boolean;
}) {
  const router = useRouter();
  const steps: StepDef[] = [
    { key: "name", label: "Name", title: "What's your name?",
      sub: joining ? "Your co-founder invited you. Make your founder profile to finish joining their startup." : "As people should know you as a founder.",
      check: lengthCheck(2, 80, "Your name"), input: (p) => <TextInput {...p} label="Your name" maxLength={80} autoComplete="name" placeholder="Your full name" /> },
    { key: "handle", label: "Handle", title: "Pick your @handle", sub: "It's unique to you, like a YouTube handle. We started you with your username.",
      check: (value, values) => !/^[a-z0-9_]{3,24}$/.test(value.replace(/^@+/, "")) ? "3 to 24 lowercase letters, numbers or underscores."
        : values._handle === "taken" ? "That @handle is taken. Pick another, or use the one we suggest." : null,
      show: (value) => `@${value.replace(/^@+/, "")}`, input: (p) => <HandleInput {...p} /> },
    { key: "headline", label: "Headline", title: "Sum yourself up in one line", sub: "It shows under your name. For example: Building AI study tools for college students.",
      check: lengthCheck(6, 120, "Your headline"), input: (p) => <TextInput {...p} label="Headline" maxLength={120} placeholder="Building…" /> },
    { key: "bio", label: "Bio", title: "Tell people your story", sub: "A few sentences: who you are, what you're building and why. It appears under your videos.",
      check: lengthCheck(20, 600, "Your bio"), input: (p) => <LongText {...p} label="Bio" minLength={20} maxLength={600} /> },
    faceStep(memberHandle, initial.name || "You", true, "A clear photo of your face. You'll need one before you post a video."),
    { key: "location", label: "Based in", title: "Where are you based?", sub: "A city and country is plenty.",
      check: lengthCheck(2, 80, "Where you're based"), input: (p) => <TextInput {...p} label="Based in" maxLength={80} placeholder="Columbus, Ohio" /> },
    { key: "educationLevel", label: "Education", title: "What's your education?", sub: "The highest you've finished, or that you're in college now.",
      input: (p) => <Choices {...p} label="Education" options={EDUCATION_LEVELS.map((e) => ({ key: e, label: e }))} /> },
    { key: "school", label: "School", optional: true, title: "Which college or school?", sub: "Where you studied or study now.",
      check: (v) => v && (v.length < 2 || v.length > 120) ? "Keep it to 2 to 120 characters." : null,
      input: (p) => <TextInput {...p} label="School" maxLength={120} placeholder="The Ohio State University" /> },
    { key: "background", label: "Background", optional: true, title: "What's your background?", sub: "Where you've worked or studied, and what you've built before.",
      input: (p) => <LongText {...p} label="Background" maxLength={800} /> },
    { key: "accomplishments", label: "Proud of", optional: true, title: "Anything you're proud of?", sub: "Up to six things, one per box: an award, a launch, a number you hit.",
      show: bullets, input: (p) => <ListInput {...p} label="Accomplishment" count={6} maxLength={160} placeholder={(n) => n === 0 ? "Won the campus pitch competition" : ""} /> },
    { key: "linkedinUrl", label: "LinkedIn", optional: true, title: "Your LinkedIn profile", sub: "Paste the link to your profile. It shows on your founder page.",
      check: linkedinCheck, show: (v) => linkedinProfileUrl(v) ?? v,
      input: (p) => <TextInput {...p} type="url" label="LinkedIn profile" maxLength={300} placeholder="linkedin.com/in/yourname" /> },
    { key: "websiteUrl", label: "Website", optional: true, title: "Your website", sub: "A personal site, portfolio or anything else people can visit.",
      check: httpsLink, input: (p) => <TextInput {...p} type="url" label="Website" maxLength={600} placeholder="https://" /> },
    { key: "resumePath", label: "Resume", optional: true, title: "Add your resume", sub: "As a PDF. People can open it from your founder page once you're approved.",
      show: () => "PDF uploaded", input: (p) => <ResumeInput {...p} viewHref={isNew ? null : `/founders/${initial.handle}/resume`} /> },
  ];
  return (
    <StepFlow steps={steps} initial={initial} draftKey={isNew ? "mitra-founder-draft" : null} exitHref="/create"
      reviewTitle={isNew ? "Check your founder profile" : "Your founder profile"}
      reviewSub={isNew ? "The owner approves new profiles before anyone else sees them." : "Change anything, then save."}
      submitLabel={isNew ? "Send for review" : "Save changes"}
      submit={(v) => saveFounderStepsAction({ ...v, handle: v.handle.replace(/^@+/, ""), websiteUrl: withHttps(v.websiteUrl ?? "") })}
      onDone={() => router.push(joining ? "/create?saved=joined" : isNew ? "/create/startup?first=1" : "/create?saved=profile")} />
  );
}

// ------------------------------------------------------------------ startup

const STAGES = ["Idea", "Building", "Pre-seed", "Seed", "Series A", "Series B or later", "Bootstrapped"];

export function StartupFlow({ startupId, initial, uploads, first }: { startupId: string | null; initial: Values; uploads: boolean; first: boolean }) {
  const router = useRouter();
  const stages = STAGES.includes(initial.stage) || !initial.stage ? STAGES : [initial.stage, ...STAGES];
  const steps: StepDef[] = [
    ...(startupId ? [] : [{ key: "name", label: "Name", title: "What's your startup called?",
      sub: first ? "Your founder profile is in. Now tell us about the company. The name can't be changed later." : "The name can't be changed later.",
      check: lengthCheck(2, 60, "The name"), input: (p) => <TextInput {...p} label="Startup name" maxLength={60} placeholder="Lumenly" /> } satisfies StepDef]),
    { key: "tagline", label: "What it is", title: "What is it, in a few words?", sub: "For example: AI study companion.",
      check: lengthCheck(4, 60, "This"), input: (p) => <TextInput {...p} label="What it is" maxLength={60} /> },
    { key: "industry", label: "Industry", title: "Which industry is it in?", show: industryLabel,
      input: (p) => <Choices {...p} label="Industry" options={INDUSTRIES.map((i) => ({ key: i.key, label: i.label }))} /> },
    { key: "stage", label: "Stage", title: "What stage is it at?",
      input: (p) => <Choices {...p} label="Stage" options={stages.map((s) => ({ key: s, label: s }))} /> },
    { key: "headline", label: "Pitch", title: "Your one-line pitch", sub: "It goes on your cards. For example: Building the future of studying.",
      check: lengthCheck(6, 90, "Your pitch"), input: (p) => <TextInput {...p} label="Pitch" maxLength={90} /> },
    { key: "description", label: "Description", title: "Describe your startup", sub: "The problem, who it's for and what you're doing about it.",
      check: lengthCheck(30, 1200, "The description"), input: (p) => <LongText {...p} label="Description" minLength={30} maxLength={1200} rows={6} /> },
    { key: "productDetails", label: "How it works", title: "How does the product work?", sub: "What someone sees and does when they use it.",
      check: lengthCheck(20, 1200, "This"), input: (p) => <LongText {...p} label="How it works" minLength={20} maxLength={1200} rows={6} /> },
    { key: "features", label: "Features", optional: true, title: "Its three main features", sub: "A few words each.", show: bullets,
      input: (p) => <ListInput {...p} label="Feature" count={3} maxLength={40} placeholder={(n) => ["Study plans", "Course notes", "AI tutoring"][n]} /> },
    ...(startupId ? [] : [{ key: "role", label: "Your role", optional: true, title: "What's your role?", sub: "As it should appear next to your name.",
      input: (p) => <TextInput {...p} label="Your role" maxLength={60} placeholder="Founder / CEO" /> } satisfies StepDef]),
    { key: "foundedOn", label: "Started", optional: true, title: "When did you start it?",
      show: (v) => new Date(`${v}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      input: (p) => <TextInput {...p} type="month" label="Started" maxLength={7} /> },
    { key: "headquarters", label: "Based in", optional: true, title: "Where is it based?", input: (p) => <TextInput {...p} label="Based in" maxLength={80} placeholder="Columbus, Ohio" /> },
    { key: "websiteUrl", label: "Website", optional: true, title: "Its website", check: httpsLink,
      input: (p) => <TextInput {...p} type="url" label="Website" maxLength={600} placeholder="https://" /> },
    { key: "logoUrl", label: "Logo", optional: true, title: "Add your logo", sub: "A square image works best.", check: httpsLink, show: picture(false),
      input: (p) => <ImageInput {...p} uploads={uploads} label="your logo" /> },
    { key: "thumbnailUrl", label: "Cover picture", optional: true, title: "A picture of you and the product", sub: "Shown on cards before a video plays. Without one, Mitra draws one from your photo, logo and features.",
      check: httpsLink, show: picture(false), input: (p) => <ImageInput {...p} uploads={uploads} label="the picture" /> },
    { key: "tags", label: "Tags", optional: true, title: "Any tags?", sub: "Up to five words people might search for.", show: bullets,
      input: (p) => <ListInput {...p} label="Tag" count={5} maxLength={24} placeholder={(n) => n === 0 ? "study tools" : ""} /> },
    { key: "screenshots", label: "Screenshots", optional: true, title: "Links to product screenshots", sub: "Up to six image links, one per box.", check: linkList, show: bullets,
      input: (p) => <ListInput {...p} label="Screenshot link" count={6} maxLength={600} placeholder={() => "https://"} /> },
  ];
  return (
    <StepFlow steps={steps} initial={initial} draftKey={startupId ? null : "mitra-startup-draft"} exitHref="/create"
      reviewTitle={startupId ? `${initial.name}: details` : "Check your startup"}
      reviewSub={startupId ? "Change anything, then save." : "The owner reviews new startups before they appear anywhere."}
      submitLabel={startupId ? "Save changes" : "Register startup"}
      submit={(v) => saveStartupStepsAction(startupId, { ...v, websiteUrl: withHttps(v.websiteUrl ?? ""), logoUrl: withHttps(v.logoUrl ?? ""), thumbnailUrl: withHttps(v.thumbnailUrl ?? ""), screenshots: links(v.screenshots ?? "") })}
      onDone={(result) => router.push(startupId || !result.startupId ? "/create?saved=startup" : `/create/video?startup=${result.startupId}&first=1`)} />
  );
}

// -------------------------------------------------------------------- video

export function VideoFlow({ startups, initialStartup, uploads, first, face }: {
  startups: { id: string; name: string }[]; initialStartup: string; uploads: boolean; first: boolean;
  /** Set when the founder has no photo yet: who they are, for the photo screen that comes first. */
  face: { memberHandle: string; name: string } | null;
}) {
  const router = useRouter();
  const steps: StepDef[] = [
    ...(face ? [faceStep(face.memberHandle, face.name, false, "Founders show their face on Mitra. Add a clear photo of yourself before your first video.")] : []),
    ...(startups.length > 1 ? [{ key: "startupId", label: "Startup", title: "Which startup is this video for?",
      show: (v: string) => startups.find((s) => s.id === v)?.name ?? "", input: (p) => <Choices {...p} label="Startup" options={startups.map((s) => ({ key: s.id, label: s.name }))} /> } satisfies StepDef] : []),
    { key: "videoUrl", label: "YouTube video", also: ["durationSeconds"],
      title: first ? "Now add your first video" : "Paste your YouTube link",
      sub: "Upload your video to YouTube (Unlisted is fine if you don't want it public there), then paste its link here. Videos can be up to 2 minutes long.",
      check: youtubeCheck,
      show: (v, values) => {
        const id = youtubeId(v);
        return id ? <span className="step-review-video">
          {/* YouTube's own thumbnail for the video. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={youtubeThumbnail(id)} alt="" referrerPolicy="no-referrer" />
          <span>{values.durationSeconds ? duration(Number(values.durationSeconds)) : ""}</span>
        </span> : v;
      },
      input: (p) => <YouTubeInput {...p} /> },
    { key: "title", label: "Title", title: "Give it a title", sub: "We used the title from YouTube, if it had one. Change it as you like.",
      check: lengthCheck(4, 100, "The title"), input: (p) => <TextInput {...p} label="Title" maxLength={100} /> },
    { key: "kind", label: "Kind", title: "What kind of video is it?", show: videoKindLabel,
      input: (p) => <Choices {...p} label="Kind of video" options={VIDEO_KINDS.map((k) => ({ key: k, label: videoKindLabel(k) }))} /> },
    { key: "description", label: "Description", title: "What's it about?", sub: "A sentence or two shown with the video.",
      check: lengthCheck(10, 500, "The description"), input: (p) => <LongText {...p} label="Description" minLength={10} maxLength={500} rows={4} /> },
    { key: "thumbnailUrl", label: "Thumbnail", title: "Use a different thumbnail?",
      // A Short's tall YouTube thumbnail is cut to a strip on Mitra's wide cards, so it needs a wide one (2026-10-22).
      optional: (v) => v._short !== "1", heading: (v) => v._short === "1" ? "Add a wide thumbnail" : "Use a different thumbnail?",
      sub: (v) => v._short === "1"
        ? "This is a YouTube Short. Its tall thumbnail gets cut off on Mitra's wide cards, so upload a wide (landscape) picture to show instead."
        : "Without one, the video's YouTube thumbnail is used.",
      check: httpsLink, show: picture(false), input: (p) => <ImageInput {...p} uploads={uploads} label="the thumbnail" /> },
  ];
  return (
    <StepFlow steps={steps} initial={{ startupId: initialStartup, kind: "pitch" }} draftKey={`mitra-video-draft-${initialStartup}`} exitHref="/create"
      reviewTitle="Check your video" reviewSub="The owner approves each video before it appears in feeds."
      submitLabel="Send for review"
      submit={(v) => addVideoStepsAction(v.startupId || initialStartup, { ...v, thumbnailUrl: withHttps(v.thumbnailUrl ?? "") })}
      onDone={() => router.push("/create?saved=video")} />
  );
}

// --------------------------------------------------------- co-founder invite

/**
 * Inviting a co-founder (2026-10-22): their role and a join password, then the
 * private link to send. The password is never kept in the tab's draft, and the
 * link is shown once.
 */
export function InviteFlow({ startupId, startupName }: { startupId: string; startupName: string }) {
  const [made, setMade] = useState<{ link: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const steps: StepDef[] = [
    { key: "role", label: "Their role", title: `Invite a co-founder to ${startupName}`, sub: "What's their role? It shows next to their name on the startup's page.",
      check: lengthCheck(2, 60, "Their role"), input: (p) => <TextInput {...p} label="Their role" maxLength={60} placeholder="Co-founder / CTO" /> },
    { key: "password", label: "Join password", title: "Choose a join password",
      sub: "Your co-founder types it after opening the link. Tell it to them yourself, in person or by text, never in the same message as the link.",
      check: (v) => v.length < 8 ? "Use at least 8 characters." : null, show: (v) => "•".repeat(Math.min(v.length, 16)),
      input: (p) => <PasswordInput {...p} label="Join password" /> },
    { key: "confirm", label: "Password again", title: "Type it once more", sub: "So you know you'll tell them the right one.",
      check: (v, values) => v !== values.password ? "That doesn't match the password you chose." : null, show: () => "Matches",
      input: (p) => <PasswordInput {...p} label="Join password again" /> },
  ];

  if (made) {
    async function share() {
      try { await navigator.share({ title: `Join ${startupName} on Mitra`, text: `I'm inviting you to join ${startupName} on Mitra as my co-founder.`, url: made!.link }); } catch { /* closed */ }
    }
    return (
      <StepFrame fills={[100, 100, 100, 100]} label="Invite made" closeHref="/create">
        <div className="step-form">
          <h1>Send this link to your co-founder</h1>
          <p className="step-sub">It works once, until {new Date(made.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. For safety Mitra can&rsquo;t show it again, so copy it now.</p>
          <div className="invite-link"><code>{made.link}</code></div>
          <button className="primary-button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(made.link); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy link"}</button>
          {typeof navigator !== "undefined" && "share" in navigator && <button className="secondary-button" type="button" onClick={share}>Share…</button>}
          <p className="step-sub"><strong>Then tell them the join password yourself</strong>, in person, on a call or in a separate text. After five wrong tries the link locks.</p>
          <Link className="text-button step-skip" href="/create">Done</Link>
        </div>
      </StepFrame>
    );
  }

  return (
    <StepFlow steps={steps} initial={{ role: "Co-founder", password: "", confirm: "" }} draftKey={null} exitHref="/create"
      reviewTitle="Check your invite" reviewSub={`They join ${startupName}'s team once they open the link, log in or sign up, and type the password.`}
      submitLabel="Make the invite link"
      submit={async (v) => {
        const result = await createInviteAction(startupId, { role: v.role, password: v.password });
        if (!result.ok) return result;
        setMade({ link: result.link, expiresAt: result.expiresAt });
        return { ok: true, message: "Invite made." };
      }}
      onDone={() => undefined} />
  );
}
