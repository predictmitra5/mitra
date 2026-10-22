"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { recordServerEvent, VIEWER_COOKIE, viewerFor } from "@/modules/recommend/events";
import { isUuid } from "@/modules/market/input";
import { LIMITS, RATE_LIMITED_MESSAGE } from "@/modules/security/rate-limit";
import { within } from "@/modules/security/request";
import {
  addComment, fileReport, listComments, setFounderFollow, setLike, setSave, setStartupFollow, SocialError, type CommentTarget, type ReportTarget, type Toggle,
} from "./service";

/*
 * The feed's and profiles' social buttons (2026-10-19). Each checks the
 * signed-in account on the server; a visitor gets SIGNED_OUT and the page
 * opens the sign-up pop-up instead. Engagement the browser may not claim for
 * itself (likes, saves, follows, comments, reports) is recorded here.
 */

type Result<T> = { ok: true; value: T } | { ok: false; error: string; code: string };

function failure(error: unknown): { ok: false; error: string; code: string } {
  if (error instanceof SocialError) return { ok: false, error: error.message, code: error.code };
  return { ok: false, error: "That didn't go through. Please try again.", code: "UNAVAILABLE" };
}

async function member() {
  const identity = await currentIdentity();
  if (!identity) return null;
  return identity;
}

const signedOut = { ok: false as const, error: "Log in or sign up to do that.", code: "SIGNED_OUT" };
const limited = { ok: false as const, error: RATE_LIMITED_MESSAGE, code: "RATE_LIMITED" };

async function viewerOf(userId: string) {
  return viewerFor(userId, (await cookies()).get(VIEWER_COOKIE)?.value);
}

export async function toggleLike(videoId: string, on: boolean): Promise<Result<Toggle>> {
  const identity = await member();
  if (!identity) return signedOut;
  if (!(await within(LIMITS.social, `user:${identity.id}`))) return limited;
  try {
    const value = await setLike(getDb(), identity.id, videoId, on);
    await recordServerEvent(getDb(), await viewerOf(identity.id), videoId, on ? "like" : "unlike");
    return { ok: true, value };
  } catch (error) { return failure(error); }
}

export async function toggleSave(videoId: string, on: boolean): Promise<Result<Toggle>> {
  const identity = await member();
  if (!identity) return signedOut;
  if (!(await within(LIMITS.social, `user:${identity.id}`))) return limited;
  try {
    const value = await setSave(getDb(), identity.id, videoId, on);
    await recordServerEvent(getDb(), await viewerOf(identity.id), videoId, on ? "save" : "unsave");
    revalidatePath("/portfolio");
    return { ok: true, value };
  } catch (error) { return failure(error); }
}

/** `videoId`, when the follow came from a video, credits that video for the ranking. */
export async function toggleFounderFollow(founderId: string, on: boolean, videoId?: string | null): Promise<Result<Toggle>> {
  const identity = await member();
  if (!identity) return signedOut;
  if (!(await within(LIMITS.social, `user:${identity.id}`))) return limited;
  try {
    const value = await setFounderFollow(getDb(), identity.id, founderId, on);
    if (on && videoId && isUuid(videoId)) await recordServerEvent(getDb(), await viewerOf(identity.id), videoId, "follow_founder");
    return { ok: true, value };
  } catch (error) { return failure(error); }
}

export async function toggleStartupFollow(startupId: string, on: boolean, videoId?: string | null): Promise<Result<Toggle>> {
  const identity = await member();
  if (!identity) return signedOut;
  if (!(await within(LIMITS.social, `user:${identity.id}`))) return limited;
  try {
    const value = await setStartupFollow(getDb(), identity.id, startupId, on);
    if (on && videoId && isUuid(videoId)) await recordServerEvent(getDb(), await viewerOf(identity.id), videoId, "follow_startup");
    return { ok: true, value };
  } catch (error) { return failure(error); }
}

export type PostedComment = { id: string; body: string; createdAt: string };

export async function postComment(input: { target: CommentTarget; targetId: string; body: string; parentId?: string | null }): Promise<Result<PostedComment>> {
  const identity = await member();
  if (!identity) return signedOut;
  if (!(await within(LIMITS.social, `user:${identity.id}`))) return limited;
  try {
    const row = await addComment(getDb(), identity.id, input);
    if (input.target === "video") await recordServerEvent(getDb(), await viewerOf(identity.id), input.targetId, "comment");
    if (input.target === "market") revalidatePath(`/markets/${input.targetId}`);
    return { ok: true, value: { id: row.id, body: row.body, createdAt: row.createdAt.toISOString() } };
  } catch (error) { return failure(error); }
}

export async function reportItem(input: { target: ReportTarget; targetId: string; reason: string }): Promise<Result<{ filed: boolean }>> {
  const identity = await member();
  if (!identity) return signedOut;
  if (!(await within(LIMITS.report, `user:${identity.id}`))) return limited;
  try {
    const row = await fileReport(getDb(), identity.id, input);
    if (input.target === "video") await recordServerEvent(getDb(), await viewerOf(identity.id), input.targetId, "report");
    return { ok: true, value: { filed: !!row } };
  } catch (error) { return failure(error); }
}

export type CommentData = { id: string; body: string; createdAt: string; author: { handle: string; name: string; photo: string | null; isDemo: boolean; isFounder: boolean } };

/** Comments for a video, market or startup, newest first. Public, like the page they sit on. */
export async function getComments(target: CommentTarget, targetId: string): Promise<CommentData[]> {
  if (!["market", "video", "startup"].includes(target) || !isUuid(targetId)) return [];
  if (!(await within(LIMITS.feed))) return [];
  try {
    const rows = await listComments(getDb(), target, targetId, 80);
    return rows.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), author: c.author }));
  } catch {
    return [];
  }
}
