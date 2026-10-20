"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { toggleFounderFollow, toggleStartupFollow } from "@/modules/social/actions";
import { askToSignUp, toast } from "../feed/needs-account";

/*
 * Follow a founder or a startup (2026-10-19). Founders and companies are
 * followed separately, as the brief asks. The button changes at once and
 * goes back if the server says no; a visitor gets the sign-up pop-up.
 */
export function FollowButton({ kind, id, initial, signedIn, videoId, count, size = "small", label }: {
  kind: "founder" | "startup";
  id: string;
  initial: boolean;
  signedIn: boolean;
  /** The video it was pressed under, which the ranking credits. */
  videoId?: string | null;
  count?: number;
  size?: "small" | "large";
  label?: string;
}) {
  const [on, setOn] = useState(initial);
  const [followers, setFollowers] = useState(count);
  const [pending, start] = useTransition();
  const noun = label ?? (kind === "founder" ? "Follow" : "Follow startup");

  function press() {
    if (!signedIn) { askToSignUp(); return; }
    const next = !on;
    setOn(next);
    start(async () => {
      const result = kind === "founder" ? await toggleFounderFollow(id, next, videoId) : await toggleStartupFollow(id, next, videoId);
      if (result.ok) setFollowers(result.value.count);
      else {
        setOn(!next);
        if (result.code === "SIGNED_OUT") askToSignUp(); else toast(result.error);
      }
    });
  }

  return (
    <button type="button" className={`follow-button follow-${size}${on ? " is-on" : ""}`} onClick={press} aria-pressed={on} disabled={pending}
      data-needs-account={signedIn ? undefined : true}>
      {on ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
      <span>{on ? "Following" : noun}</span>
      {followers !== undefined && size === "large" && <span className="follow-count">{followers.toLocaleString("en-US")}</span>}
    </button>
  );
}
