"use client";

/** Opens the sign-up pop-up (signup-prompt.tsx listens) when a visitor uses something that needs an account. */
export const NEEDS_ACCOUNT_EVENT = "mitra:needs-account";

export function askToSignUp() {
  window.dispatchEvent(new CustomEvent(NEEDS_ACCOUNT_EVENT));
}

/** A short message at the bottom of the screen, for "Link copied" and the like. */
export const TOAST_EVENT = "mitra:toast";

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}
