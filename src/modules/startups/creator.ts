import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { isInactive } from "@/modules/account/standing";
import { isIndustry, VIDEO_KINDS, type IndustryKey } from "./labels";
import { MEDIA_BUCKET } from "./media-buckets";
import { checkYoutubeVideo, youtubeId, youtubeThumbnail, youtubeUrl, type YoutubeCheck } from "./youtube";

/*
 * Creator tools (2026-10-19): a member makes a founder profile, registers
 * startups, describes the product, posts videos and thumbnails, writes
 * updates, submits claims for verification and suggests markets. Profiles,
 * startups and videos wait for the owner's approval before anyone else sees
 * them. Founders never create, change, pause or settle markets: they can only
 * suggest one, and only the owner opens it.
 *
 * Every write takes the freshly verified account id from the caller, and
 * checks that the account manages what it is changing: the startup's
 * registrant, or the member behind one of its founders.
 */

const { profiles, founders, startups, startupFounders, videos, startupUpdates, verificationClaims, marketProposals, videoEvents, videoLikes, startupFollows, founderFollows } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export class CreatorError extends Error {
  /** The form field the message is about, so the step-by-step screens can return to it (2026-10-21). */
  constructor(public readonly code: "PROFILE_REQUIRED" | "FOUNDER_REQUIRED" | "NOT_ALLOWED" | "INVALID_INPUT" | "TAKEN" | "LIMIT", message: string, public readonly field?: string) {
    super(message); this.name = "CreatorError";
  }
}

/** Tags a validation error with the field it came from. */
function at<T>(field: string, read: () => T): T {
  try { return read(); } catch (error) {
    if (error instanceof CreatorError && !error.field) throw new CreatorError(error.code, error.message, field);
    throw error;
  }
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
export const MAX_PENDING_STARTUPS = 5;
export const MAX_PENDING_VIDEOS = 10;

function text(value: unknown, label: string, min: number, max: number): string {
  const clean = typeof value === "string" ? value.trim() : "";
  if (clean.length < min || clean.length > max || CONTROL.test(clean)) throw new CreatorError("INVALID_INPUT", `${label}: write ${min} to ${max} characters.`);
  return clean;
}

function optionalText(value: unknown, label: string, max: number): string | null {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean) return null;
  return text(clean, label, 1, max);
}

/** An https link, or a path to a file uploaded to Mitra's own media storage. */
export function mediaUrl(value: unknown, label: string): string | null {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean) return null;
  if (clean.length > 600) throw new CreatorError("INVALID_INPUT", `${label}: that link is too long.`);
  try {
    const url = new URL(clean);
    if (url.protocol !== "https:") throw new Error("not https");
    return url.toString();
  } catch {
    throw new CreatorError("INVALID_INPUT", `${label}: use a full https:// link.`);
  }
}

function lines(value: unknown, label: string, maxLines: number, maxLength: number): string[] {
  const list = (typeof value === "string" ? value : "").split(/\r?\n|,/).map((l) => l.trim()).filter(Boolean);
  if (list.length > maxLines) throw new CreatorError("INVALID_INPUT", `${label}: at most ${maxLines}.`);
  for (const line of list) if (line.length > maxLength || CONTROL.test(line)) throw new CreatorError("INVALID_INPUT", `${label}: keep each to ${maxLength} characters.`);
  return list;
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "startup";
}

async function requireMember<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  if (!isUuid(userId)) throw new CreatorError("PROFILE_REQUIRED", "Log in to use creator tools.");
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile || !profile.adultConfirmedAt || isInactive(profile)) throw new CreatorError("PROFILE_REQUIRED", "Finish setting up your account first.");
  return profile;
}

/** The startups this member may manage: registered by them, or with one of their founder profiles on the team. */
export async function managedStartupIds<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string): Promise<string[]> {
  if (!isUuid(userId)) return [];
  const mine = await database.select({ id: founders.id }).from(founders).where(eq(founders.userId, userId));
  const linked = mine.length ? await database.select({ id: startupFounders.startupId }).from(startupFounders).where(inArray(startupFounders.founderId, mine.map((f) => f.id))) : [];
  const created = await database.select({ id: startups.id }).from(startups).where(eq(startups.createdBy, userId));
  return [...new Set([...linked, ...created].map((r) => r.id))];
}

async function requireManager<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: unknown) {
  await requireMember(database, userId);
  if (!isUuid(startupId)) throw new CreatorError("NOT_ALLOWED", "That startup isn't yours to change.");
  if (!(await managedStartupIds(database, userId)).includes(startupId)) throw new CreatorError("NOT_ALLOWED", "That startup isn't yours to change.");
  const [startup] = await database.select().from(startups).where(eq(startups.id, startupId));
  if (!startup || startup.status === "rejected" || startup.status === "suspended") throw new CreatorError("NOT_ALLOWED", "That startup can't be changed right now.");
  return startup;
}

// ----------------------------------------------------------- founder profile

const HANDLE = /^[a-z0-9_]{3,24}$/;

export function normalizeHandle(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/^@+/, "") : "";
}

/**
 * A founder's @handle is unique across members and founders (2026-10-21), so
 * nobody can take another person's @: it is free if no other founder has it
 * and no other member uses it as their username.
 */
async function founderHandleFree<Q extends PgQueryResultHKT>(database: Database<Q>, handle: string, userId: string): Promise<boolean> {
  const [founder] = await database.select({ userId: founders.userId }).from(founders).where(eq(founders.handle, handle)).limit(1);
  if (founder && founder.userId !== userId) return false;
  const [member] = await database.select({ id: profiles.id }).from(profiles).where(eq(profiles.handle, handle)).limit(1);
  return !member || member.id === userId;
}

/** The handle asked for if it is free, otherwise the nearest free one: `ravishah2`, `ravishah3`… */
export async function suggestFounderHandle<Q extends PgQueryResultHKT>(database: Database<Q>, wanted: unknown, userId: string): Promise<string> {
  let base = normalizeHandle(wanted).replace(/[^a-z0-9_]/g, "").slice(0, 20);
  if (base.length < 3) base = `${base}founder`.slice(0, 20);
  const taken = new Set<string>();
  const others = await database.select({ handle: founders.handle, userId: founders.userId }).from(founders).where(sql`starts_with(${founders.handle}, ${base})`);
  for (const row of others) if (row.userId !== userId) taken.add(row.handle);
  const members = await database.select({ handle: profiles.handle, id: profiles.id }).from(profiles).where(sql`starts_with(${profiles.handle}, ${base})`);
  for (const row of members) if (row.id !== userId) taken.add(row.handle);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${base.slice(0, 24 - String(n).length)}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 16)}${Date.now() % 100_000_000}`;
}

/** What the handle screen shows while a founder types: whether it is theirs to take, and if not, a free one. */
export async function checkFounderHandle<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, wanted: unknown) {
  await requireMember(database, userId);
  const handle = normalizeHandle(wanted);
  if (!HANDLE.test(handle)) return { handle, valid: false, available: false, suggestion: await suggestFounderHandle(database, handle, userId) };
  const [mine] = await database.select({ handle: founders.handle }).from(founders).where(eq(founders.userId, userId)).limit(1);
  const available = mine?.handle === handle || await founderHandleFree(database, handle, userId);
  return { handle, valid: true, available, suggestion: available ? handle : await suggestFounderHandle(database, handle, userId) };
}

export type FounderInput = {
  handle: unknown; name: unknown; headline: unknown; bio: unknown; background?: unknown; location?: unknown;
  portraitUrl?: unknown; websiteUrl?: unknown; accomplishments?: unknown;
};

/** Creates this member's founder profile (waiting for review) or updates it. */
export async function saveFounderProfile<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, input: FounderInput, now: Date = new Date()) {
  await requireMember(database, userId);
  const handle = normalizeHandle(input.handle);
  if (!HANDLE.test(handle)) throw new CreatorError("INVALID_INPUT", "Handle: 3 to 24 letters, numbers or underscores.", "handle");
  const values = {
    handle,
    name: at("name", () => text(input.name, "Name", 2, 80)),
    headline: at("headline", () => text(input.headline, "Headline", 6, 120)),
    bio: at("bio", () => text(input.bio, "Bio", 20, 600)),
    background: at("background", () => optionalText(input.background, "Background", 800)),
    location: at("location", () => optionalText(input.location, "Location", 80)),
    portraitUrl: at("portraitUrl", () => mediaUrl(input.portraitUrl, "Photo")),
    websiteUrl: at("websiteUrl", () => mediaUrl(input.websiteUrl, "Website")),
    accomplishments: at("accomplishments", () => lines(input.accomplishments, "Accomplishments", 6, 160)),
  };
  const [existing] = await database.select().from(founders).where(eq(founders.userId, userId)).limit(1);
  // A founder keeps the handle they already have; a new or changed one must be free.
  if (existing?.handle !== handle && !(await founderHandleFree(database, handle, userId))) {
    throw new CreatorError("TAKEN", `@${handle} is taken. Try @${await suggestFounderHandle(database, handle, userId)}.`, "handle");
  }
  if (existing) {
    if (existing.status === "suspended") throw new CreatorError("NOT_ALLOWED", "This profile is suspended. Contact the owner.");
    const [row] = await database.update(founders).set(values).where(eq(founders.id, existing.id)).returning();
    return row;
  }
  const hue = Math.abs([...handle].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 360;
  const [row] = await database.insert(founders).values({ ...values, hue, userId, status: "pending", createdAt: now }).returning();
  return row;
}

// ------------------------------------------------------------------ startups

export type StartupInput = {
  name: unknown; tagline: unknown; headline: unknown; description: unknown; industry: unknown; tags?: unknown; stage: unknown;
  foundedOn?: unknown; headquarters?: unknown; websiteUrl?: unknown; logoUrl?: unknown; thumbnailUrl?: unknown; productImageUrl?: unknown;
  productDetails: unknown; features?: unknown; screenshots?: unknown; role?: unknown;
};

function startupValues(input: StartupInput) {
  if (!isIndustry(input.industry)) throw new CreatorError("INVALID_INPUT", "Pick an industry.", "industry");
  const founded = typeof input.foundedOn === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(input.foundedOn.trim()) ? new Date(`${input.foundedOn.trim().slice(0, 7)}-01T12:00:00Z`) : null;
  return {
    name: at("name", () => text(input.name, "Name", 2, 60)),
    tagline: at("tagline", () => text(input.tagline, "Tagline", 4, 60)),
    headline: at("headline", () => text(input.headline, "Headline", 6, 90)),
    description: at("description", () => text(input.description, "Description", 30, 1200)),
    industry: input.industry as IndustryKey,
    tags: at("tags", () => lines(input.tags, "Tags", 5, 24).map((t) => t.replace(/^#/, ""))),
    stage: at("stage", () => text(input.stage, "Stage", 2, 40)),
    foundedOn: founded,
    headquarters: at("headquarters", () => optionalText(input.headquarters, "Based in", 80)),
    websiteUrl: at("websiteUrl", () => mediaUrl(input.websiteUrl, "Website")),
    logoUrl: at("logoUrl", () => mediaUrl(input.logoUrl, "Logo")),
    thumbnailUrl: at("thumbnailUrl", () => mediaUrl(input.thumbnailUrl, "Thumbnail")),
    productImageUrl: at("productImageUrl", () => mediaUrl(input.productImageUrl, "Product image")),
    productDetails: at("productDetails", () => text(input.productDetails, "Product details", 20, 1200)),
    productFeatures: at("features", () => lines(input.features, "Product features", 3, 40)),
    screenshotUrls: at("screenshots", () => lines(input.screenshots, "Screenshots", 6, 600).map((u) => mediaUrl(u, "Screenshot")!)),
  };
}

/** Registers a startup for review, with this member's founder profile as its primary founder. */
export async function registerStartup<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, input: StartupInput, now: Date = new Date()) {
  await requireMember(database, userId);
  const [founder] = await database.select().from(founders).where(eq(founders.userId, userId)).limit(1);
  if (!founder) throw new CreatorError("FOUNDER_REQUIRED", "Create your founder profile first.");
  if (founder.status === "suspended" || founder.status === "rejected") throw new CreatorError("NOT_ALLOWED", "Your founder profile can't register startups right now.");
  const values = startupValues(input);
  const pending = await database.$count(startups, and(eq(startups.createdBy, userId), eq(startups.status, "pending")));
  if (pending >= MAX_PENDING_STARTUPS) throw new CreatorError("LIMIT", `You have ${MAX_PENDING_STARTUPS} startups waiting for review. Wait for those first.`);
  const role = at("role", () => optionalText(input.role, "Your role", 60)) ?? "Founder";
  const base = slugify(values.name);
  let slug = base;
  for (let n = 2; (await database.select({ id: startups.id }).from(startups).where(eq(startups.slug, slug))).length; n += 1) slug = `${base}-${n}`;
  return database.transaction(async (tx) => {
    const [row] = await tx.insert(startups).values({ ...values, slug, hue: founder.hue, glyph: "sparkles", status: "pending", createdBy: userId, createdAt: now }).returning();
    await tx.insert(startupFounders).values({ startupId: row.id, founderId: founder.id, role, isPrimary: true, createdAt: now });
    return row;
  });
}

export async function updateStartup<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: unknown, input: StartupInput) {
  const startup = await requireManager(database, userId, startupId);
  const { name: _name, ...values } = startupValues(input);
  void _name; // The name is fixed once registered, so links and markets keep pointing at the same company.
  const [row] = await database.update(startups).set(values).where(eq(startups.id, startup.id)).returning();
  return row;
}

// -------------------------------------------------------------------- videos

export type VideoInput = { title: unknown; description: unknown; kind: unknown; videoUrl?: unknown; thumbnailUrl?: unknown; durationSeconds: unknown; captions?: unknown };

/** Parses "0:12 We started in a dorm" lines, or plain lines spread over the video. */
export function parseCaptions(value: unknown, durationSeconds: number): { at: number; text: string }[] {
  const raw = (typeof value === "string" ? value : "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 60);
  const timed = raw.map((line) => /^(\d{1,2}):(\d{2})\s+(.+)$/.exec(line));
  if (raw.length && timed.every(Boolean)) {
    return timed.map((m) => ({ at: Math.min(durationSeconds, Number(m![1]) * 60 + Number(m![2])), text: m![3].slice(0, 200) })).sort((a, b) => a.at - b.at);
  }
  const step = durationSeconds / Math.max(1, raw.length);
  return raw.map((line, i) => ({ at: Math.round(i * step * 10) / 10, text: line.slice(0, 200) }));
}

/**
 * The video a founder adds (2026-10-21): a YouTube link, stored in its one
 * canonical form, or, only while Mitra's own uploads are on, a file this
 * member uploaded to Mitra's media bucket. Links to files anywhere else are
 * refused.
 */
export function videoLink(value: unknown, userId: string): { url: string; youtube: string | null } {
  const id = youtubeId(value);
  if (id) return { url: youtubeUrl(id), youtube: id };
  const own = process.env.STARTUP_MEDIA_UPLOADS === "on" && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${userId}/` : null;
  const url = typeof value === "string" ? value.trim() : "";
  if (own && url.startsWith(own) && /^[0-9a-f-]{36}\.(mp4|webm)$/.test(url.slice(own.length))) return { url, youtube: null };
  throw new CreatorError("INVALID_INPUT", "Paste the YouTube link to your video, like youtube.com/watch?v=… or youtu.be/…", "videoUrl");
}

const YOUTUBE_REFUSAL: Partial<Record<YoutubeCheck, string>> = {
  not_embeddable: "YouTube says this video can't be played on other sites. In YouTube Studio, open the video's details, choose Show more and turn on Allow embedding.",
  missing: "YouTube can't find that video, or it's private. Set it to Public or Unlisted in YouTube Studio and paste the link again.",
};

export async function addVideo<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: unknown, input: VideoInput, now: Date = new Date(),
  checkYoutube: (id: string) => Promise<YoutubeCheck> = checkYoutubeVideo) {
  const startup = await requireManager(database, userId, startupId);
  const kind = typeof input.kind === "string" && (VIDEO_KINDS as readonly string[]).includes(input.kind) ? input.kind : "pitch";
  const seconds = Number(input.durationSeconds);
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 600) throw new CreatorError("INVALID_INPUT", "Videos can be 5 seconds to 10 minutes long.", "durationSeconds");
  const link = videoLink(input.videoUrl, userId);
  const title = at("title", () => text(input.title, "Title", 4, 100));
  const description = at("description", () => text(input.description, "Description", 10, 500));
  const thumbnail = at("thumbnailUrl", () => mediaUrl(input.thumbnailUrl, "Thumbnail"));
  const captions = parseCaptions(input.captions, seconds);
  if (link.youtube) {
    const refusal = YOUTUBE_REFUSAL[await checkYoutube(link.youtube)];
    if (refusal) throw new CreatorError("INVALID_INPUT", refusal, "videoUrl");
  }
  const pending = await database.$count(videos, and(eq(videos.uploadedBy, userId), eq(videos.status, "pending")));
  if (pending >= MAX_PENDING_VIDEOS) throw new CreatorError("LIMIT", `You have ${MAX_PENDING_VIDEOS} videos waiting for review. Wait for those first.`);
  const [founder] = await database.select({ id: founders.id }).from(founders).where(eq(founders.userId, userId)).limit(1);
  const [row] = await database.insert(videos).values({
    startupId: startup.id, founderId: founder?.id ?? null, title, description,
    kind, videoUrl: link.url, thumbnailUrl: thumbnail ?? (link.youtube ? youtubeThumbnail(link.youtube) : null), durationSeconds: seconds, captions,
    status: "pending", uploadedBy: userId, createdAt: now,
  }).returning();
  return row;
}

// ---------------------------------------------------------- updates, claims

export async function addUpdate<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: unknown, input: { title: unknown; body: unknown; kind?: unknown; happenedOn?: unknown }, now: Date = new Date()) {
  const startup = await requireManager(database, userId, startupId);
  const [founder] = await database.select({ id: founders.id }).from(founders).where(eq(founders.userId, userId)).limit(1);
  const happened = typeof input.happenedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.happenedOn) ? new Date(`${input.happenedOn}T12:00:00Z`) : now;
  if (happened.getTime() > now.getTime() + 86_400_000) throw new CreatorError("INVALID_INPUT", "Updates are about what already happened.");
  const [row] = await database.insert(startupUpdates).values({
    startupId: startup.id, founderId: founder?.id ?? null, kind: input.kind === "milestone" ? "milestone" : "update",
    title: text(input.title, "Title", 4, 100), body: text(input.body, "Update", 10, 1000), happenedAt: happened,
    // A founder's own update is exactly that until the owner checks it.
    verification: "founder_reported", createdBy: userId, createdAt: now,
  }).returning();
  return row;
}

export async function addClaim<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: unknown, input: { statement: unknown; sourceName?: unknown; sourceUrl?: unknown }, now: Date = new Date()) {
  const startup = await requireManager(database, userId, startupId);
  const [row] = await database.insert(verificationClaims).values({
    startupId: startup.id, statement: text(input.statement, "Claim", 10, 300), sourceName: optionalText(input.sourceName, "Source", 120),
    sourceUrl: mediaUrl(input.sourceUrl, "Source link"), level: "unverified", submittedBy: userId, createdAt: now,
  }).returning();
  return row;
}

/** A founder suggests a market on their startup. Only the owner can open it, with their own exact terms and price. */
export async function suggestMarket<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, startupId: unknown, input: { question: unknown; howToCheck: unknown; closesOn?: unknown }, now: Date = new Date()) {
  const startup = await requireManager(database, userId, startupId);
  if (startup.status !== "approved") throw new CreatorError("NOT_ALLOWED", "Markets can be suggested once the startup is approved.");
  const close = typeof input.closesOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.closesOn) ? new Date(`${input.closesOn}T23:59:00-05:00`) : null;
  if (close && close.getTime() < now.getTime() + 7 * 86_400_000) throw new CreatorError("INVALID_INPUT", "Pick a close date at least a week away.");
  const pending = await database.$count(marketProposals, and(eq(marketProposals.proposerUserId, userId), eq(marketProposals.status, "pending")));
  if (pending >= 10) throw new CreatorError("LIMIT", "You have 10 suggestions waiting. Wait for the owner to review them.");
  const [row] = await database.insert(marketProposals).values({
    proposerUserId: userId, startupId: startup.id, question: text(input.question, "Question", 15, 240),
    resolutionNote: text(input.howToCheck, "How it can be checked", 15, 600), suggestedCloseAt: close, createdAt: now,
  }).returning();
  return row;
}

// ----------------------------------------------------------- creator home

/** Everything the creator hub shows this member about their own profile, startups and videos. */
export async function readCreatorHome<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  await requireMember(database, userId);
  const [founder] = await database.select().from(founders).where(eq(founders.userId, userId)).limit(1);
  const ids = await managedStartupIds(database, userId);
  const owned = ids.length ? await database.select().from(startups).where(inArray(startups.id, ids)).orderBy(desc(startups.createdAt)) : [];
  const videoRows = ids.length ? await database.select().from(videos).where(inArray(videos.startupId, ids)).orderBy(desc(videos.createdAt)).limit(60) : [];
  const videoIds = videoRows.map((v) => v.id);
  const stats = videoIds.length ? await database.select({
    videoId: videoEvents.videoId,
    views: sql<number>`count(*) filter (where ${videoEvents.kind} = 'impression')::int`,
    watches: sql<number>`count(*) filter (where ${videoEvents.kind} = 'watch')::int`,
    completes: sql<number>`count(*) filter (where ${videoEvents.kind} = 'complete')::int`,
    progress: sql<number>`coalesce(avg(${videoEvents.progressBp}) filter (where ${videoEvents.kind} = 'watch'), 0)::float`,
    watchMs: sql<number>`coalesce(sum(${videoEvents.watchMs}), 0)::float`,
  }).from(videoEvents).where(inArray(videoEvents.videoId, videoIds)).groupBy(videoEvents.videoId) : [];
  const likes = videoIds.length ? await database.select({ videoId: videoLikes.videoId, n: sql<number>`count(*)::int` }).from(videoLikes).where(inArray(videoLikes.videoId, videoIds)).groupBy(videoLikes.videoId) : [];
  const followers = ids.length ? await database.select({ id: startupFollows.startupId, n: sql<number>`count(*)::int` }).from(startupFollows).where(inArray(startupFollows.startupId, ids)).groupBy(startupFollows.startupId) : [];
  const [founderFans] = founder ? await database.select({ n: sql<number>`count(*)::int` }).from(founderFollows).where(eq(founderFollows.founderId, founder.id)) : [];
  const updates = ids.length ? await database.select().from(startupUpdates).where(and(inArray(startupUpdates.startupId, ids), isNull(startupUpdates.removedAt))).orderBy(desc(startupUpdates.happenedAt)).limit(20) : [];
  const claims = ids.length ? await database.select().from(verificationClaims).where(inArray(verificationClaims.startupId, ids)).orderBy(desc(verificationClaims.createdAt)).limit(20) : [];
  const suggestions = await database.select().from(marketProposals).where(and(eq(marketProposals.proposerUserId, userId), or(isNull(marketProposals.venueName), sql`${marketProposals.startupId} is not null`))).orderBy(desc(marketProposals.createdAt)).limit(20);
  const byVideo = new Map(stats.map((s) => [s.videoId, s]));
  const likeMap = new Map(likes.map((l) => [l.videoId, Number(l.n)]));
  const fanMap = new Map(followers.map((f) => [f.id, Number(f.n)]));
  return {
    founder: founder ?? null,
    founderFollowers: Number(founderFans?.n ?? 0),
    startups: owned.map((s) => ({ ...s, followers: fanMap.get(s.id) ?? 0 })),
    videos: videoRows.map((v) => {
      const s = byVideo.get(v.id);
      return { ...v, views: Number(s?.views ?? 0), watches: Number(s?.watches ?? 0), completes: Number(s?.completes ?? 0), avgProgress: Number(s?.progress ?? 0) / 10_000, watchMinutes: Number(s?.watchMs ?? 0) / 60_000, likes: likeMap.get(v.id) ?? 0 };
    }),
    updates,
    claims,
    suggestions,
  };
}

export type CreatorHome = Awaited<ReturnType<typeof readCreatorHome>>;
