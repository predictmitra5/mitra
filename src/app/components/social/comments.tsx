"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { getComments, postComment, type CommentData } from "@/modules/social/actions";
import type { CommentTarget } from "@/modules/social/service";
import { Avatar, SampleTag } from "../market/market-card";
import { askToSignUp, toast } from "../feed/needs-account";

/*
 * Discussion (2026-10-19): on a market's page about the founder, the company
 * and the odds, and under a video. Newest first, each with the author and how
 * long ago; a founder of the startup is marked Founder, a fictional demo
 * commenter Demo. Posting needs an account.
 */

const ago = (iso: string, now = Date.now()) => {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
};

export function CommentList({ comments }: { comments: CommentData[] }) {
  if (!comments.length) return <p className="comments-none muted">No comments yet. Start the discussion.</p>;
  return (
    <ul className="comments">
      {comments.map((comment) => (
        <li key={comment.id} className="comment">
          <Avatar name={comment.author.name} photo={comment.author.photo} size={32} />
          <div>
            <p className="comment-head">
              <strong>{comment.author.name}</strong>
              <span className="muted">@{comment.author.handle}</span>
              {comment.author.isFounder && <span className="founder-tag">Founder</span>}
              {comment.author.isDemo && <SampleTag />}
              <span className="muted comment-time">{ago(comment.createdAt)}</span>
            </p>
            <p className="comment-body">{comment.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CommentForm({ target, targetId, signedIn, onPosted, placeholder = "Add a comment" }: {
  target: CommentTarget; targetId: string; signedIn: boolean; onPosted: (comment: CommentData) => void; placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  if (!signedIn) {
    return <p className="comment-signin"><Link href="/sign-in" data-needs-account>Log in</Link> or <Link href="/sign-up" data-needs-account>sign up</Link> to join the discussion.</p>;
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    start(async () => {
      const result = await postComment({ target, targetId, body: text });
      if (result.ok) {
        setBody("");
        onPosted({ id: result.value.id, body: result.value.body, createdAt: result.value.createdAt, author: { handle: "you", name: "You", photo: null, isDemo: false, isFounder: false } });
      } else if (result.code === "SIGNED_OUT") askToSignUp();
      else toast(result.error);
    });
  }
  return (
    <form className="comment-form" onSubmit={submit}>
      <label className="sr-only" htmlFor={`comment-${targetId}`}>{placeholder}</label>
      <textarea id={`comment-${targetId}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={2} placeholder={placeholder} />
      <button type="submit" className="btn btn-primary" disabled={pending || !body.trim()}>{pending ? "Posting…" : "Post"}</button>
    </form>
  );
}

/** The discussion inline on a page, starting from what the server rendered. */
export function CommentThread({ target, targetId, initial, signedIn }: { target: CommentTarget; targetId: string; initial: CommentData[]; signedIn: boolean }) {
  const [comments, setComments] = useState(initial);
  return (
    <div className="comment-thread">
      <CommentForm target={target} targetId={targetId} signedIn={signedIn} onPosted={(c) => setComments((list) => [c, ...list])} placeholder="What do you think the odds should be, and why?" />
      <CommentList comments={comments} />
    </div>
  );
}

/** Comments under a video, in a sheet that loads them when opened. */
export function CommentSheet({ open, onClose, videoId, title, signedIn, onCount }: {
  open: boolean; onClose: () => void; videoId: string; title: string; signedIn: boolean; onCount: (delta: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [comments, setComments] = useState<CommentData[] | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      if (comments === null) void getComments("video", videoId).then(setComments);
    }
    if (!open && element.open) element.close();
  }, [open, videoId, comments]);
  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={`comments-${videoId}`} onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="sheet-panel">
        <div className="sheet-head">
          <h2 id={`comments-${videoId}`}>Comments <span className="muted">on {title}</span></h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close comments"><X size={18} aria-hidden="true" /></button>
        </div>
        <CommentForm target="video" targetId={videoId} signedIn={signedIn} onPosted={(c) => { setComments((list) => [c, ...(list ?? [])]); onCount(1); }} />
        {comments === null ? <p className="muted comments-none">Loading comments…</p> : <CommentList comments={comments} />}
      </div>
    </dialog>
  );
}
